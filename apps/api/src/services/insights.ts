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

// Patterns to skip in subscription detection (loan/mortgage charges are
// recurring but already covered by the mortgage detector + their own UI).
const LOAN_DESCRIPTION_RE = /\b(hipoteca|prestamo|préstamo|loan|rcbo|mortgage|cuota)\b/i;

async function detectRecurringSubscriptions(userId: string): Promise<InsightCandidate[]> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const rows = await db
    .select({
      merchantRaw: sql<
        string | null
      >`COALESCE(NULLIF(${transactions.normalizedMerchant}, ''), ${transactions.descriptionRaw})`,
      bookedAt: transactions.bookedAt,
      amount: transactions.amount,
      description: transactions.descriptionRaw,
      recurringRuleId: transactions.recurringRuleId,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        isNull(transactions.transferPairId),
        eq(transactions.isProjection, false),
        gte(transactions.bookedAt, sixMonthsAgo),
        lte(transactions.amount, '0'),
      ),
    );

  // Merchants whose transactions are already linked to a recurring rule are
  // considered "declared" by the user — skip the auto-detector for them so we
  // don't surface a duplicate "is this a subscription?" prompt.
  const declaredMerchants = new Set<string>();
  for (const r of rows) {
    if (!r.recurringRuleId || !r.merchantRaw) continue;
    declaredMerchants.add(r.merchantRaw.trim().toLowerCase());
  }

  type Group = { display: string; dates: Date[]; amounts: Decimal[] };
  const groups = new Map<string, Group>();
  for (const r of rows) {
    if (!r.merchantRaw) continue;
    const display = r.merchantRaw.trim();
    if (!display) continue;
    if (LOAN_DESCRIPTION_RE.test(r.description) || LOAN_DESCRIPTION_RE.test(display)) continue;
    const key = display.toLowerCase();
    if (declaredMerchants.has(key)) continue;
    const g = groups.get(key) ?? { display, dates: [], amounts: [] };
    g.dates.push(new Date(r.bookedAt));
    g.amounts.push(new Decimal(r.amount).abs());
    groups.set(key, g);
  }

  const candidates: InsightCandidate[] = [];
  const now = Date.now();
  for (const [key, g] of groups) {
    if (g.dates.length < 2) continue;
    g.dates.sort((a, b) => a.getTime() - b.getTime());

    const deltas: number[] = [];
    for (let i = 1; i < g.dates.length; i++) {
      const a = g.dates[i - 1];
      const b = g.dates[i];
      if (!a || !b) continue;
      deltas.push((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
    }
    if (deltas.length === 0) continue;
    const avgDelta = deltas.reduce((acc, d) => acc + d, 0) / deltas.length;

    let cadence: 'monthly' | 'weekly' | 'yearly' | null = null;
    if (avgDelta >= 25 && avgDelta <= 35) cadence = 'monthly';
    else if (avgDelta >= 6 && avgDelta <= 8) cadence = 'weekly';
    else if (avgDelta >= 350 && avgDelta <= 380) cadence = 'yearly';
    if (!cadence) continue;

    // Skip subscriptions that look discontinued: most recent charge older
    // than 1.75x the cadence. (Prevents flagging cancelled trials.)
    const lastDate = g.dates[g.dates.length - 1];
    if (!lastDate) continue;
    const daysSinceLast = (now - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLast > avgDelta * 1.75) continue;

    // Require near-identical amounts (within 2 % drift AND ≤ 0.50 € absolute
    // spread). True subscriptions charge the same cents every period; close-
    // but-not-identical amounts are usually habitual purchases (gas stations,
    // groceries, utilities) that we don't want to flag as cancellable.
    const nums = g.amounts.map((a) => a.toNumber());
    const mean = nums.reduce((acc, n) => acc + n, 0) / nums.length;
    if (mean === 0) continue;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const spread = max - min;
    if (spread > 0.5 || spread / mean > 0.02) continue;

    const meanD = new Decimal(mean.toFixed(2));
    if (meanD.lessThan(3)) continue;

    const annualizer = cadence === 'monthly' ? 12 : cadence === 'weekly' ? 52 : 1;
    const annual = meanD.times(annualizer);

    const cadenceLabel =
      cadence === 'monthly' ? 'mensual' : cadence === 'weekly' ? 'semanal' : 'anual';

    candidates.push({
      kind: 'unused_subscription',
      signature: `recurring_subscription:${key}`,
      severity: 'info',
      title: `Suscripción ${cadenceLabel}: ${g.display} — ${eur(annual)}/año`,
      description: `${g.dates.length} cargos detectados (cada ~${Math.round(avgDelta)} días, ${eur(meanD)} cada uno). ¿Sigues usándola?`,
      estimatedSavings: annual.toFixed(2),
      actionable: true,
      payload: {
        merchant: g.display,
        cadence,
        unitAmount: meanD.toFixed(2),
        occurrences: g.dates.length,
      },
    });
  }
  return candidates;
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

  const [idle, mort, low, fees, subs] = await Promise.all([
    detectIdleLiquidity(userId),
    detectMortgageRate(userId, loansData),
    detectLowSavingsRate(userId),
    detectHighFees(userId),
    detectRecurringSubscriptions(userId),
  ]);
  const candidates = [...idle, ...mort, ...low, ...fees, ...subs];

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
