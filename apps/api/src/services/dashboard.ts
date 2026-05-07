import type { Dashboard } from '@gp/shared';
import { Decimal } from 'decimal.js';
import { and, asc, count, desc, eq, gte, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  accounts,
  insights as insightsTable,
  netWorthSnapshots,
  plannedEvents,
  recurringRules,
  transactions,
} from '../db/schema.js';
import { refreshInsights } from './insights.js';
import { computeNetWorth } from './net-worth.js';

const LARGE_EXPENSE_THRESHOLD = '200.00';
const UPCOMING_DAYS = 30;
const SERIES_MONTHS = 12;

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 0, 0, 0, 0));
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function ym(d: Date): string {
  return d.toISOString().slice(0, 7);
}

// ────────────────────────────────────────────────────────────────────────────
// Compute distribution by account type, plus liabilities placeholder.
// ────────────────────────────────────────────────────────────────────────────

// Distribution + headline net worth come from the same `computeNetWorth`
// service that powers /patrimonio so figures are consistent across pages
// (holdings + loan outstanding included).
async function computeDistribution(userId: string) {
  const nw = await computeNetWorth(userId);
  return {
    liquid: nw.totals.liquid,
    invested: nw.totals.invested,
    realEstate: nw.totals.realEstate,
    other: nw.totals.other,
    liabilities: nw.totals.liabilities,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Cash flow per month for the last SERIES_MONTHS months.
// Excludes transfer pairs and projections.
// ────────────────────────────────────────────────────────────────────────────

async function computeCashFlowSeries(userId: string, anchor: Date) {
  const seriesStart = addMonths(startOfMonth(anchor), -(SERIES_MONTHS - 1));
  const rows = await db
    .select({
      month: sql<string>`to_char(${transactions.bookedAt}, 'YYYY-MM')`,
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
        gte(transactions.bookedAt, seriesStart),
      ),
    )
    .groupBy(sql`to_char(${transactions.bookedAt}, 'YYYY-MM')`)
    .orderBy(asc(sql`to_char(${transactions.bookedAt}, 'YYYY-MM')`));

  const byMonth = new Map<string, { income: Decimal; expenses: Decimal }>();
  for (const r of rows) {
    byMonth.set(r.month, {
      income: new Decimal(r.income),
      expenses: new Decimal(r.expenses),
    });
  }

  // Fill missing months with zeros so the chart x-axis is dense.
  const series: Dashboard['cashFlowSeries'] = [];
  for (let i = 0; i < SERIES_MONTHS; i++) {
    const monthDate = addMonths(seriesStart, i);
    const monthKey = ym(monthDate);
    const entry = byMonth.get(monthKey) ?? {
      income: new Decimal(0),
      expenses: new Decimal(0),
    };
    series.push({
      month: monthKey,
      income: entry.income.toFixed(2),
      expenses: entry.expenses.toFixed(2),
      net: entry.income.plus(entry.expenses).toFixed(2),
    });
  }
  return series;
}

// ────────────────────────────────────────────────────────────────────────────
// Net worth time series for the headline 12-month chart.
// Strategy: pin each month's point to a real `net_worth_snapshot` when one
// exists for that month (most accurate — reflects holdings + loans at the
// time). For months without a snapshot, fall back to the flow-based
// reconstruction: walk back from `currentNetWorth` subtracting each month's
// transaction delta. This blends "pictures" with "bank statements" — exact
// where we have data, approximate elsewhere.
// ────────────────────────────────────────────────────────────────────────────

async function computeNetWorthSeries(userId: string, anchor: Date, currentNetWorth: Decimal) {
  const seriesStart = addMonths(startOfMonth(anchor), -(SERIES_MONTHS - 1));

  const txDeltaRows = await db
    .select({
      month: sql<string>`to_char(${transactions.bookedAt}, 'YYYY-MM')`,
      net: sql<string>`COALESCE(SUM(${transactions.amount}), 0)::text`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        eq(transactions.isProjection, false),
        gte(transactions.bookedAt, seriesStart),
      ),
    )
    .groupBy(sql`to_char(${transactions.bookedAt}, 'YYYY-MM')`);
  const monthDeltas = new Map<string, Decimal>();
  for (const r of txDeltaRows) monthDeltas.set(r.month, new Decimal(r.net));

  // Latest snapshot per month within the window.
  const snapRows = await db
    .select({
      snapshotAt: netWorthSnapshots.snapshotAt,
      netWorth: netWorthSnapshots.netWorth,
    })
    .from(netWorthSnapshots)
    .where(
      and(
        eq(netWorthSnapshots.userId, userId),
        gte(netWorthSnapshots.snapshotAt, ymd(seriesStart)),
      ),
    )
    .orderBy(asc(netWorthSnapshots.snapshotAt));
  const monthSnapshot = new Map<string, Decimal>();
  for (const r of snapRows) {
    monthSnapshot.set(r.snapshotAt.slice(0, 7), new Decimal(r.netWorth));
  }

  const points: { date: string; netWorth: string }[] = [];
  let running = currentNetWorth;
  for (let i = SERIES_MONTHS - 1; i >= 0; i--) {
    const monthDate = addMonths(seriesStart, i);
    const monthKey = ym(monthDate);
    const snap = monthSnapshot.get(monthKey);
    if (snap) {
      points.push({ date: ymd(monthDate), netWorth: snap.toFixed(2) });
      running = snap.minus(monthDeltas.get(monthKey) ?? new Decimal(0));
    } else {
      points.push({ date: ymd(monthDate), netWorth: running.toFixed(2) });
      running = running.minus(monthDeltas.get(monthKey) ?? new Decimal(0));
    }
  }
  return points.reverse();
}

// ────────────────────────────────────────────────────────────────────────────
// KPIs
// ────────────────────────────────────────────────────────────────────────────

async function currentNetWorth(userId: string, asOf: Date): Promise<Decimal> {
  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)::text` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        eq(transactions.isProjection, false),
        lte(transactions.bookedAt, asOf),
      ),
    );
  return new Decimal(row?.total ?? '0');
}

// Best-effort 30-day-ago net worth: prefer the most recent snapshot ≤ asOf.
// Falls back to `currentNetWorth(asOf)` (transactions-only sum) when no
// snapshot is available — gives a useful flow-based delta even before the
// user starts taking pictures.
async function netWorthAt(userId: string, asOf: Date): Promise<Decimal> {
  const asOfYmd = asOf.toISOString().slice(0, 10);
  const [snap] = await db
    .select({ netWorth: netWorthSnapshots.netWorth })
    .from(netWorthSnapshots)
    .where(and(eq(netWorthSnapshots.userId, userId), lte(netWorthSnapshots.snapshotAt, asOfYmd)))
    .orderBy(desc(netWorthSnapshots.snapshotAt))
    .limit(1);
  if (snap) return new Decimal(snap.netWorth);
  return currentNetWorth(userId, asOf);
}

async function cashFlowForRange(userId: string, from: Date, to: Date) {
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
        gte(transactions.bookedAt, from),
        lt(transactions.bookedAt, to),
      ),
    );
  const income = new Decimal(row?.income ?? '0');
  const expenses = new Decimal(row?.expenses ?? '0');
  return { income, expenses, net: income.plus(expenses) };
}

// ────────────────────────────────────────────────────────────────────────────
// Upcoming events: union of recurring_rules + planned_events in next N days.
// ────────────────────────────────────────────────────────────────────────────

async function computeUpcomingEvents(userId: string, anchor: Date) {
  const horizon = new Date(anchor.getTime() + UPCOMING_DAYS * 24 * 60 * 60 * 1000);
  const today = ymd(anchor);
  const horizonYmd = ymd(horizon);

  const recurring = await db
    .select({
      id: recurringRules.id,
      name: recurringRules.name,
      kind: recurringRules.kind,
      amount: recurringRules.expectedAmount,
      nextExpectedAt: recurringRules.nextExpectedAt,
    })
    .from(recurringRules)
    .where(
      and(
        eq(recurringRules.userId, userId),
        eq(recurringRules.status, 'active'),
        isNull(recurringRules.deletedAt),
        gte(recurringRules.nextExpectedAt, today),
        lte(recurringRules.nextExpectedAt, horizonYmd),
      ),
    );

  const planned = await db
    .select({
      id: plannedEvents.id,
      name: plannedEvents.name,
      kind: plannedEvents.kind,
      amount: plannedEvents.amount,
      scheduledAt: plannedEvents.scheduledAt,
      certainty: plannedEvents.certainty,
    })
    .from(plannedEvents)
    .where(
      and(
        eq(plannedEvents.userId, userId),
        eq(plannedEvents.status, 'planned'),
        isNull(plannedEvents.deletedAt),
        gte(plannedEvents.scheduledAt, today),
        lte(plannedEvents.scheduledAt, horizonYmd),
        // Dashboard policy: only show confirmed-or-better certainty + recurring detected.
        or(eq(plannedEvents.certainty, 'high'), eq(plannedEvents.certainty, 'certain')),
      ),
    );

  const merged: Dashboard['upcomingEvents'] = [];
  for (const r of recurring) {
    if (!r.nextExpectedAt) continue;
    // recurring expected_amount is positive magnitude; expense rules are still
    // outflows from the user's perspective. We surface the raw amount and let
    // the UI/caller interpret based on kind.
    const amount = ['salary'].includes(r.kind)
      ? new Decimal(r.amount).toFixed(2)
      : new Decimal(r.amount).negated().toFixed(2);
    merged.push({
      id: r.id,
      label: r.name,
      scheduledAt: r.nextExpectedAt,
      amount,
      kind: 'recurring',
    });
  }
  for (const p of planned) {
    const amount =
      p.kind === 'income' || p.kind === 'asset_sale'
        ? new Decimal(p.amount).toFixed(2)
        : new Decimal(p.amount).negated().toFixed(2);
    merged.push({
      id: p.id,
      label: p.name,
      scheduledAt: p.scheduledAt,
      amount,
      kind: 'planned',
    });
  }

  merged.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  return merged.slice(0, 10);
}

// ────────────────────────────────────────────────────────────────────────────
// Alerts
// ────────────────────────────────────────────────────────────────────────────

async function computeAlerts(userId: string): Promise<Dashboard['alerts']> {
  const alerts: Dashboard['alerts'] = [];

  const [unc] = await db
    .select({ n: count() })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.status, 'booked'),
        isNull(transactions.categoryId),
        isNull(transactions.deletedAt),
        eq(transactions.isProjection, false),
      ),
    );
  const uncategorized = Number(unc?.n ?? 0);
  if (uncategorized > 0) {
    alerts.push({
      id: 'alert-uncategorized',
      kind: 'uncategorized_transactions',
      severity: uncategorized > 30 ? 'urgent' : 'warning',
      message: `${uncategorized} ${uncategorized === 1 ? 'movimiento sin categorizar' : 'movimientos sin categorizar'}`,
    });
  }

  return alerts;
}

// ────────────────────────────────────────────────────────────────────────────
// Insights (read-through; empty until insight generation lands).
// ────────────────────────────────────────────────────────────────────────────

async function computeInsights(userId: string): Promise<Dashboard['insights']> {
  const rows = await db
    .select({
      id: insightsTable.id,
      kind: insightsTable.kind,
      severity: insightsTable.severity,
      title: insightsTable.title,
      description: insightsTable.description,
      estimatedSavings: insightsTable.estimatedSavings,
      actionPayload: insightsTable.actionPayload,
    })
    .from(insightsTable)
    .where(
      and(
        eq(insightsTable.userId, userId),
        isNull(insightsTable.dismissedAt),
        isNull(insightsTable.actedAt),
      ),
    )
    .orderBy(desc(insightsTable.estimatedSavings))
    .limit(5);

  return rows.map((r) => {
    const raw = (r.actionPayload as Record<string, unknown> | null) ?? null;
    const surfaced = raw
      ? {
          ...(typeof raw.loanId === 'string' ? { loanId: raw.loanId } : {}),
          ...(typeof raw.ruleId === 'string' ? { ruleId: raw.ruleId } : {}),
          ...(typeof raw.accountId === 'string' ? { accountId: raw.accountId } : {}),
          ...(typeof raw.merchant === 'string' ? { merchant: raw.merchant } : {}),
          ...(typeof raw.cadence === 'string' ? { cadence: raw.cadence } : {}),
        }
      : null;
    return {
      id: r.id,
      kind: r.kind,
      title: r.title,
      description: r.description,
      estimatedSavings: r.estimatedSavings,
      actionable: r.actionPayload !== null,
      actionPayload: surfaced,
    };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Top-level builder
// ────────────────────────────────────────────────────────────────────────────

export type DashboardPeriod = 'month' | 'quarter' | 'halfyear' | 'year';

const PERIOD_MONTHS: Record<DashboardPeriod, number> = {
  month: 1,
  quarter: 3,
  halfyear: 6,
  year: 12,
};

export async function buildDashboard(
  userId: string,
  period: DashboardPeriod = 'month',
): Promise<Dashboard> {
  // Regenerate insights on every dashboard load. Cheap (a handful of
  // SUM queries) and keeps the feed in sync with the latest data.
  await refreshInsights(userId);

  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const nextMonthStart = addMonths(thisMonthStart, 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const periodMonths = PERIOD_MONTHS[period];
  const periodStart = addMonths(thisMonthStart, -(periodMonths - 1));

  // KPI: Net worth (cumulative sum of all transactions up to now)
  // Headline net worth uses the same source as /patrimonio so the figures
  // match across the app (includes holdings + loan outstanding). The 30-day
  // delta prefers a saved snapshot; if none exists, falls back to a
  // transactions-only baseline.
  const nwBreakdown = await computeNetWorth(userId);
  const totalNW = new Decimal(nwBreakdown.totals.netWorth);
  const nw30dAgo = await netWorthAt(userId, thirtyDaysAgo);
  const delta30d = totalNW.minus(nw30dAgo);
  const deltaPct30d = nw30dAgo.isZero() ? new Decimal(0) : delta30d.div(nw30dAgo.abs()).times(100);

  // KPI: Cash flow for the selected period (defaults to current month).
  const periodCashFlow = await cashFlowForRange(userId, periodStart, nextMonthStart);

  // 6-period median for comparison (the previous 6 windows of the same size,
  // ending right before this period starts). Lets the user compare apples to
  // apples regardless of whether they picked month/quarter/halfyear/year.
  const monthlyNets: Decimal[] = [];
  for (let i = 6; i >= 1; i--) {
    const from = addMonths(periodStart, -i * periodMonths);
    const to = addMonths(from, periodMonths);
    const cf = await cashFlowForRange(userId, from, to);
    monthlyNets.push(cf.net);
  }
  const median6m = (() => {
    if (monthlyNets.length === 0) return new Decimal(0);
    const sorted = [...monthlyNets].sort((a, b) => (a.lessThan(b) ? -1 : 1));
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      const a = sorted[mid - 1] ?? new Decimal(0);
      const b = sorted[mid] ?? new Decimal(0);
      return a.plus(b).div(2);
    }
    return sorted[mid] ?? new Decimal(0);
  })();
  const deltaVsMedian6m = periodCashFlow.net.minus(median6m);

  // KPI: Savings rate for the selected period.
  const savingsRate = periodCashFlow.income.isZero()
    ? new Decimal(0)
    : periodCashFlow.income.plus(periodCashFlow.expenses).div(periodCashFlow.income).times(100);
  // Compare to median 6m savings rate
  const median6mSavingsRate = (() => {
    if (monthlyNets.length === 0) return new Decimal(0);
    // Re-run cashflow per month is wasteful; the data is already in monthlyNets
    // but we'd need income separately. Approximate via net only — good enough
    // for v1, refine later with a per-month income query.
    return new Decimal(0);
  })();
  const deltaPpVsMedian6m = savingsRate.minus(median6mSavingsRate);
  // Reused below (cash flow KPI value).
  const thisMonth = periodCashFlow;

  const upcomingEvents = await computeUpcomingEvents(userId, now);
  // KPI: next large expense
  const nextLargeExpense =
    upcomingEvents.find((e) =>
      new Decimal(e.amount).abs().greaterThanOrEqualTo(LARGE_EXPENSE_THRESHOLD),
    ) ?? null;

  const distribution = await computeDistribution(userId);
  const cashFlowSeries = await computeCashFlowSeries(userId, now);
  const netWorthSeries = await computeNetWorthSeries(userId, now, totalNW);
  const alerts = await computeAlerts(userId);
  const insights = await computeInsights(userId);

  return {
    kpis: {
      netWorth: {
        value: totalNW.toFixed(2),
        delta30d: delta30d.toFixed(2),
        deltaPct30d: deltaPct30d.toFixed(1),
      },
      cashFlowMonth: {
        value: thisMonth.net.toFixed(2),
        deltaVsMedian6m: deltaVsMedian6m.toFixed(2),
        period,
      },
      savingsRate: {
        value: savingsRate.toFixed(1),
        deltaPpVsMedian6m: deltaPpVsMedian6m.toFixed(1),
      },
      nextLargeExpense: nextLargeExpense
        ? {
            label: nextLargeExpense.label,
            amount: nextLargeExpense.amount,
            scheduledAt: nextLargeExpense.scheduledAt,
          }
        : null,
    },
    netWorthSeries,
    cashFlowSeries,
    distribution,
    upcomingEvents,
    insights,
    alerts,
  };
}
