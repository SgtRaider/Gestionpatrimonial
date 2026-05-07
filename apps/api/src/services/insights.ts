import { Decimal } from 'decimal.js';
import { and, eq, gte, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { db } from '../db/index.js';
import {
  accounts,
  insights as insightsTable,
  loanRateHistory,
  loans,
  transactions,
} from '../db/schema.js';
import { type AmortizationRow, buildSchedule } from './loan-helpers.js';

// Cache schedule per loan (avoid recomputing inside generators).
type LoanWithSchedule = {
  loan: typeof loans.$inferSelect;
  schedule: AmortizationRow[];
};

type Severity = 'info' | 'warning' | 'urgent';
type InsightKind =
  | 'unused_subscription'
  | 'idle_liquidity'
  | 'mortgage_vs_invest'
  | 'high_fees'
  | 'modelo_720_alert'
  | 'category_spike'
  | 'low_savings_rate'
  | 'rebalance_suggestion'
  | 'other';

type InsightCandidate = {
  kind: InsightKind;
  signature: string; // stable id used for dismissed/acted dedup
  severity: Severity;
  title: string;
  description: string;
  estimatedSavings: string | null;
  actionable: boolean;
  payload?: Record<string, unknown>;
};

// ────────────────────────────────────────────────────────────────────────────
// Detectors
// ────────────────────────────────────────────────────────────────────────────

const BUFFER_MONTHS = 3;
const IDLE_LIQUIDITY_MIN_EXCESS = 5000;
const MONEY_MARKET_RATE = 0.025;

async function detectIdleLiquidity(userId: string): Promise<InsightCandidate[]> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [expenseRow] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${transactions.amount}) FILTER (WHERE ${transactions.amount} < 0), 0)::text`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        isNull(transactions.transferPairId),
        eq(transactions.isProjection, false),
        gte(transactions.bookedAt, sixMonthsAgo),
      ),
    );
  const totalExpenses6m = new Decimal(expenseRow?.total ?? '0').abs();
  const monthlyExpenseAvg = totalExpenses6m.div(6);
  const buffer = monthlyExpenseAvg.times(BUFFER_MONTHS);

  // Per-account balance (only liquid accounts).
  const balances = await db
    .select({
      accountId: accounts.id,
      accountName: accounts.name,
      institutionId: accounts.institutionId,
      balance: sql<string>`COALESCE(SUM(${transactions.amount}), 0)::text`,
    })
    .from(accounts)
    .leftJoin(
      transactions,
      and(
        eq(transactions.accountId, accounts.id),
        isNull(transactions.deletedAt),
        eq(transactions.isProjection, false),
      ),
    )
    .where(
      and(
        eq(accounts.userId, userId),
        isNull(accounts.deletedAt),
        eq(accounts.isActive, true),
        or(eq(accounts.type, 'checking'), eq(accounts.type, 'savings')),
      ),
    )
    .groupBy(accounts.id, accounts.name, accounts.institutionId);

  const candidates: InsightCandidate[] = [];
  for (const b of balances) {
    const balance = new Decimal(b.balance);
    const excess = balance.minus(buffer);
    if (excess.lessThan(IDLE_LIQUIDITY_MIN_EXCESS)) continue;
    const annual = excess.times(MONEY_MARKET_RATE);
    candidates.push({
      kind: 'idle_liquidity',
      signature: `idle_liquidity:${b.accountId}`,
      severity: 'info',
      title: `Liquidez ociosa: ${eur(excess)} en ${b.accountName}`,
      description: buffer.greaterThan(0)
        ? `Buffer recomendado: ${eur(buffer)} (≈ ${BUFFER_MONTHS} meses de gastos). El excedente podría generar ~${eur(annual)}/año en una cuenta remunerada.`
        : `Excedente que podría generar ~${eur(annual)}/año en una cuenta remunerada.`,
      estimatedSavings: annual.toFixed(2),
      actionable: true,
      payload: { accountId: b.accountId, excess: excess.toFixed(2) },
    });
  }
  return candidates;
}

async function detectMortgageRate(
  userId: string,
  loansData: LoanWithSchedule[],
): Promise<InsightCandidate[]> {
  const candidates: InsightCandidate[] = [];
  for (const { loan, schedule } of loansData) {
    if (loan.kind !== 'mortgage') continue;
    // Pick the next-pending row's applied rate.
    const today = todayYmd();
    const next = schedule.find((r) => r.dueAt > today);
    if (!next) continue;
    const ratePct = new Decimal(next.rateApplied);
    if (ratePct.lessThan(3.5)) continue;
    candidates.push({
      kind: 'mortgage_vs_invest',
      signature: `mortgage_vs_invest:${loan.id}`,
      severity: 'info',
      title: `Hipoteca al ${ratePct.toFixed(2)}% — revisa amortización vs inversión`,
      description: `${loan.alias ?? loan.lender}: con un tipo por encima del 3,5%, amortizar puede compensar más que invertir según tu rentabilidad esperada de cartera.`,
      estimatedSavings: null,
      actionable: true,
      payload: { loanId: loan.id, currentRate: ratePct.toFixed(4) },
    });
  }
  return candidates;
}

async function detectLowSavingsRate(userId: string): Promise<InsightCandidate[]> {
  const now = new Date();
  const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [row] = await db
    .select({
      income: sql<string>`COALESCE(SUM(${transactions.amount}) FILTER (WHERE ${transactions.amount} > 0), 0)::text`,
      expenses: sql<string>`COALESCE(SUM(${transactions.amount}) FILTER (WHERE ${transactions.amount} < 0), 0)::text`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        isNull(transactions.transferPairId),
        eq(transactions.isProjection, false),
        gte(transactions.bookedAt, thisMonthStart),
        lt(transactions.bookedAt, nextMonthStart),
      ),
    );

  const income = new Decimal(row?.income ?? '0');
  const expenses = new Decimal(row?.expenses ?? '0');
  if (income.lessThanOrEqualTo(0)) return [];
  const ratePct = income.plus(expenses).div(income).times(100);
  // Only flag in negative or below-10% territory; ignore early-month noise
  // (income hasn't landed yet) by requiring at least 50% of expected month
  // elapsed.
  const elapsedFrac = (now.getUTCDate() - 1) / 28;
  if (elapsedFrac < 0.5) return [];
  if (ratePct.greaterThanOrEqualTo(10)) return [];

  const severity: Severity = ratePct.lessThan(0) ? 'warning' : 'info';
  const monthLabel = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return [
    {
      kind: 'low_savings_rate',
      signature: `low_savings_rate:${ymd(thisMonthStart).slice(0, 7)}`,
      severity,
      title: `Tasa de ahorro ${monthLabel}: ${ratePct.toFixed(0)}%`,
      description: ratePct.lessThan(0)
        ? 'Estás gastando más de lo que ingresas este mes. Revisa categorías con gasto creciente.'
        : 'Por debajo del 10% recomendado para construir patrimonio a medio plazo.',
      estimatedSavings: null,
      actionable: false,
      payload: { ratePct: ratePct.toFixed(2) },
    },
  ];
}

async function detectHighFees(userId: string): Promise<InsightCandidate[]> {
  // Sum all transactions whose description matches commission-like patterns
  // over the last 12 months.
  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const [row] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${transactions.amount}) FILTER (WHERE ${transactions.amount} < 0), 0)::text`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        eq(transactions.isProjection, false),
        gte(transactions.bookedAt, yearAgo),
        sql`${transactions.descriptionRaw} ~* '(comisi|comision|tarifa|mantenimiento|cuota tarjeta|fee)'`,
      ),
    );
  const total = new Decimal(row?.total ?? '0').abs();
  const count = row?.count ?? 0;
  if (total.lessThan(50)) return [];
  return [
    {
      kind: 'high_fees',
      signature: 'high_fees:annual',
      severity: total.greaterThan(200) ? 'warning' : 'info',
      title: `Comisiones bancarias: ${eur(total)} en 12 meses`,
      description: `${count} cargos identificados como comisiones o tarifas. Mira si compensa cambiar de cuenta o producto.`,
      estimatedSavings: total.toFixed(2),
      actionable: true,
      payload: { total: total.toFixed(2), count },
    },
  ];
}

// ────────────────────────────────────────────────────────────────────────────
// Top-level refresh
// ────────────────────────────────────────────────────────────────────────────

export async function refreshInsights(userId: string): Promise<void> {
  // Pre-compute loan schedules once (used by mortgage_vs_invest).
  const loanRows = await db
    .select()
    .from(loans)
    .where(and(eq(loans.userId, userId), isNull(loans.deletedAt)));
  const loansData: LoanWithSchedule[] = [];
  for (const loan of loanRows) {
    const rateRows = await db
      .select()
      .from(loanRateHistory)
      .where(eq(loanRateHistory.loanId, loan.id));
    const schedule = buildSchedule(loan, rateRows);
    loansData.push({ loan, schedule });
  }

  const [idle, mort, low, fees] = await Promise.all([
    detectIdleLiquidity(userId),
    detectMortgageRate(userId, loansData),
    detectLowSavingsRate(userId),
    detectHighFees(userId),
  ]);
  const candidates = [...idle, ...mort, ...low, ...fees];

  // Skip candidates whose signature matches a dismissed/acted insight (preserve
  // the user's choice across refreshes).
  const dismissed = await db
    .select({ payload: insightsTable.payload })
    .from(insightsTable)
    .where(
      and(
        eq(insightsTable.userId, userId),
        or(isNotNull(insightsTable.dismissedAt), isNotNull(insightsTable.actedAt)),
      ),
    );
  const dismissedSignatures = new Set<string>();
  for (const r of dismissed) {
    const sig = (r.payload as { signature?: string } | null)?.signature;
    if (sig) dismissedSignatures.add(sig);
  }

  const toInsert = candidates.filter((c) => !dismissedSignatures.has(c.signature));

  // Replace the active set: delete current actives and insert fresh.
  await db
    .delete(insightsTable)
    .where(
      and(
        eq(insightsTable.userId, userId),
        isNull(insightsTable.dismissedAt),
        isNull(insightsTable.actedAt),
      ),
    );

  if (toInsert.length === 0) return;
  await db.insert(insightsTable).values(
    toInsert.map((c) => ({
      id: uuidv7(),
      userId,
      kind: c.kind,
      severity: c.severity,
      title: c.title,
      description: c.description,
      estimatedSavings: c.estimatedSavings,
      actionPayload: c.actionable ? { signature: c.signature, ...(c.payload ?? {}) } : null,
      payload: { signature: c.signature, ...(c.payload ?? {}) },
    })),
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function eur(d: Decimal): string {
  // Lightweight EUR formatter (the API string output; the UI re-formats).
  const fixed = d.toFixed(0);
  // Add Spanish thousand separators ("12345" → "12.345").
  return `${fixed.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} €`;
}
