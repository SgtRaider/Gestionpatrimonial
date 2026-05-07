import { Decimal } from 'decimal.js';
import { and, eq, gte, inArray, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { db } from '../db/index.js';
import {
  accounts,
  insights as insightsTable,
  loanRateHistory,
  loans,
  recurringRules,
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

type DetectedSubscription = {
  display: string;
  key: string;
  cadence: 'monthly' | 'weekly' | 'yearly';
  frequency: 'monthly' | 'weekly' | 'yearly';
  avgDelta: number;
  unitAmount: Decimal;
  occurrences: number;
  txIds: string[];
  unlinkedTxIds: string[];
  inferredAccountId: string | null;
  inferredCategoryId: string | null;
  inferredCurrency: string;
  lastBooked: Date;
  amountKind: 'fixed' | 'variable';
};

async function detectRecurringSubscriptions(userId: string): Promise<InsightCandidate[]> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const rows = await db
    .select({
      id: transactions.id,
      merchantRaw: sql<
        string | null
      >`COALESCE(NULLIF(${transactions.normalizedMerchant}, ''), ${transactions.descriptionRaw})`,
      bookedAt: transactions.bookedAt,
      amount: transactions.amount,
      description: transactions.descriptionRaw,
      recurringRuleId: transactions.recurringRuleId,
      accountId: transactions.accountId,
      categoryId: transactions.categoryId,
      currency: transactions.currency,
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

  type Group = {
    display: string;
    txs: {
      id: string;
      bookedAt: Date;
      amount: Decimal;
      recurringRuleId: string | null;
      accountId: string;
      categoryId: string | null;
      currency: string;
    }[];
  };
  const groups = new Map<string, Group>();
  for (const r of rows) {
    if (!r.merchantRaw) continue;
    const display = r.merchantRaw.trim();
    if (!display) continue;
    if (LOAN_DESCRIPTION_RE.test(r.description) || LOAN_DESCRIPTION_RE.test(display)) continue;
    const key = display.toLowerCase();
    const g = groups.get(key) ?? { display, txs: [] };
    g.txs.push({
      id: r.id,
      bookedAt: new Date(r.bookedAt),
      amount: new Decimal(r.amount).abs(),
      recurringRuleId: r.recurringRuleId,
      accountId: r.accountId,
      categoryId: r.categoryId,
      currency: r.currency,
    });
    groups.set(key, g);
  }

  // Pre-fetch rules so the analysis loop knows whether a merchant already has
  // a `variable` manual rule — those skip the amount-stability check so e.g.
  // utilities (Iberdrola, Aguas, …) get linked even when bills swing month to
  // month.
  const allRules = await db
    .select({
      id: recurringRules.id,
      name: recurringRules.name,
      amountKind: recurringRules.amountKind,
      detectedAutomatically: recurringRules.detectedAutomatically,
      deletedAt: recurringRules.deletedAt,
    })
    .from(recurringRules)
    .where(eq(recurringRules.userId, userId));
  const activeRulesByName = new Map<
    string,
    { id: string; detectedAutomatically: boolean; amountKind: 'fixed' | 'variable' }
  >();
  const tombstoned = new Set<string>();
  for (const r of allRules) {
    const nameKey = r.name.trim().toLowerCase();
    if (r.deletedAt) {
      tombstoned.add(nameKey);
    } else {
      activeRulesByName.set(nameKey, {
        id: r.id,
        detectedAutomatically: r.detectedAutomatically,
        amountKind: r.amountKind,
      });
    }
  }

  const detected: DetectedSubscription[] = [];
  const now = Date.now();
  for (const [key, g] of groups) {
    if (g.txs.length < 2) continue;
    const sorted = [...g.txs].sort((a, b) => a.bookedAt.getTime() - b.bookedAt.getTime());

    const deltas: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1];
      const b = sorted[i];
      if (!a || !b) continue;
      deltas.push((b.bookedAt.getTime() - a.bookedAt.getTime()) / (1000 * 60 * 60 * 24));
    }
    if (deltas.length === 0) continue;
    const avgDelta = deltas.reduce((acc, d) => acc + d, 0) / deltas.length;

    let cadence: 'monthly' | 'weekly' | 'yearly' | null = null;
    if (avgDelta >= 25 && avgDelta <= 35) cadence = 'monthly';
    else if (avgDelta >= 6 && avgDelta <= 8) cadence = 'weekly';
    else if (avgDelta >= 350 && avgDelta <= 380) cadence = 'yearly';
    if (!cadence) continue;

    const lastTx = sorted[sorted.length - 1];
    if (!lastTx) continue;
    const daysSinceLast = (now - lastTx.bookedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLast > avgDelta * 1.75) continue;

    const nums = sorted.map((t) => t.amount.toNumber());
    const mean = nums.reduce((acc, n) => acc + n, 0) / nums.length;
    if (mean === 0) continue;

    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const spread = max - min;
    const isFixedAmounts = spread <= 0.5 || spread / mean <= 0.02;
    const existingRule = activeRulesByName.get(key);
    const isExistingVariable = existingRule?.amountKind === 'variable';

    let amountKind: 'fixed' | 'variable';
    if (isExistingVariable) {
      // Existing manual variable rule: skip stability check entirely so new
      // utility bills get linked even when the swing is wide.
      amountKind = 'variable';
    } else if (isFixedAmounts) {
      amountKind = 'fixed';
    } else if (!existingRule) {
      // No rule yet, amounts swing — try to autocreate as a variable bill, but
      // only when the signal is strong enough to be confident this is a real
      // recurring bill (utility) rather than habitual shopping at the same
      // merchant.
      const cadenceMean = avgDelta;
      const cadenceVar = deltas.reduce((acc, d) => acc + (d - cadenceMean) ** 2, 0) / deltas.length;
      const cadenceCv = Math.sqrt(cadenceVar) / cadenceMean;
      const ratio = max / Math.max(min, 0.01);
      const eligible = sorted.length >= 3 && cadenceCv <= 0.1 && ratio <= 1.5 && mean >= 15;
      if (!eligible) continue;
      amountKind = 'variable';
    } else {
      // Existing fixed rule + amounts no longer match → skip linking. The
      // user can decide to convert it to variable manually.
      continue;
    }

    const meanD = new Decimal(mean.toFixed(2));
    if (meanD.lessThan(3)) continue;

    const accountIdSet = new Set(sorted.map((t) => t.accountId));
    const categoryIdSet = new Set(sorted.map((t) => t.categoryId).filter((c): c is string => !!c));
    detected.push({
      display: g.display,
      key,
      cadence,
      frequency: cadence,
      avgDelta,
      unitAmount: meanD,
      occurrences: sorted.length,
      txIds: sorted.map((t) => t.id),
      unlinkedTxIds: sorted.filter((t) => !t.recurringRuleId).map((t) => t.id),
      inferredAccountId: accountIdSet.size === 1 ? (sorted[0]?.accountId ?? null) : null,
      inferredCategoryId: categoryIdSet.size === 1 ? (Array.from(categoryIdSet)[0] ?? null) : null,
      inferredCurrency: sorted[0]?.currency ?? 'EUR',
      lastBooked: lastTx.bookedAt,
      amountKind,
    });
  }

  if (detected.length === 0) return [];

  // Sync rules and link transactions, then emit insights.
  const candidates: InsightCandidate[] = [];
  for (const sub of detected) {
    const existing = activeRulesByName.get(sub.key);
    let ruleId: string;
    let detectedAutomaticallyFlag: boolean;
    if (existing) {
      ruleId = existing.id;
      detectedAutomaticallyFlag = existing.detectedAutomatically;
    } else if (tombstoned.has(sub.key)) {
      // The user explicitly removed this rule before AND no active rule with
      // the same name exists — honor their choice and skip recreation.
      continue;
    } else {
      const newRuleId = uuidv7();
      const nextExpectedAt = nextDateFor(sub.lastBooked, sub.frequency);
      // Variable autocreates land as `bill` (typical for utilities); fixed
      // ones default to `subscription`. The user can change either via the
      // mark-recurring dialog (future: edit-rule flow).
      const inferredKind = sub.amountKind === 'variable' ? 'bill' : 'subscription';
      await db.insert(recurringRules).values({
        id: newRuleId,
        userId,
        name: sub.display,
        kind: inferredKind,
        frequency: sub.frequency,
        amountKind: sub.amountKind,
        expectedAmount: sub.unitAmount.negated().toFixed(2),
        currency: sub.inferredCurrency,
        accountId: sub.inferredAccountId,
        categoryId: sub.inferredCategoryId,
        status: 'active',
        detectedAutomatically: true,
        nextExpectedAt,
      });
      ruleId = newRuleId;
      detectedAutomaticallyFlag = true;
    }

    if (sub.unlinkedTxIds.length > 0) {
      await db
        .update(transactions)
        .set({ recurringRuleId: ruleId, updatedAt: new Date() })
        .where(and(inArray(transactions.id, sub.unlinkedTxIds), eq(transactions.userId, userId)));
    }

    // Manually-confirmed subscriptions don't need a "is this a sub?" insight
    // — the user already declared them recurrent. Auto-detected ones still
    // surface so the user can confirm/dismiss.
    if (!detectedAutomaticallyFlag) continue;

    const annualizer = sub.cadence === 'monthly' ? 12 : sub.cadence === 'weekly' ? 52 : 1;
    const annual = sub.unitAmount.times(annualizer);
    const cadenceLabel =
      sub.cadence === 'monthly' ? 'mensual' : sub.cadence === 'weekly' ? 'semanal' : 'anual';
    const isVariable = sub.amountKind === 'variable';
    const labelNoun = isVariable ? 'Factura' : 'Suscripción';
    const amountHint = isVariable
      ? `media ~${eur(sub.unitAmount)} (importe variable)`
      : `${eur(sub.unitAmount)} cada uno`;

    candidates.push({
      kind: 'unused_subscription',
      signature: `recurring_subscription:${sub.key}`,
      severity: 'info',
      title: `${labelNoun} ${cadenceLabel}: ${sub.display} — ${eur(annual)}/año`,
      description: `${sub.occurrences} cargos detectados (cada ~${Math.round(sub.avgDelta)} días, ${amountHint}). Confirma o quítala.`,
      estimatedSavings: annual.toFixed(2),
      actionable: true,
      payload: {
        merchant: sub.display,
        cadence: sub.cadence,
        unitAmount: sub.unitAmount.toFixed(2),
        occurrences: sub.occurrences,
        amountKind: sub.amountKind,
        ruleId,
      },
    });
  }
  return candidates;
}

function nextDateFor(lastBooked: Date, frequency: 'monthly' | 'weekly' | 'yearly'): string {
  const d = new Date(lastBooked);
  switch (frequency) {
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case 'monthly':
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case 'yearly':
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
  }
  return d.toISOString().slice(0, 10);
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
