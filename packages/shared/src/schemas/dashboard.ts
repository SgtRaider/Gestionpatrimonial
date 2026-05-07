import { z } from 'zod';
import { decimalString } from './transaction.js';

export const dashboardPeriodSchema = z.enum(['month', 'quarter', 'halfyear', 'year']);
export type DashboardPeriod = z.infer<typeof dashboardPeriodSchema>;

export const kpiSchema = z.object({
  netWorth: z.object({
    value: decimalString,
    delta30d: decimalString,
    deltaPct30d: decimalString,
  }),
  cashFlowMonth: z.object({
    value: decimalString,
    deltaVsMedian6m: decimalString,
    period: dashboardPeriodSchema.default('month'),
  }),
  savingsRate: z.object({
    value: decimalString,
    deltaPpVsMedian6m: decimalString,
  }),
  nextLargeExpense: z
    .object({
      label: z.string(),
      amount: decimalString,
      scheduledAt: z.string().date(),
    })
    .nullable(),
});
export type Kpis = z.infer<typeof kpiSchema>;

export const netWorthPointSchema = z.object({
  date: z.string().date(),
  netWorth: decimalString,
  assets: decimalString.optional(),
  liabilities: decimalString.optional(),
  breakdown: z
    .object({
      liquid: decimalString,
      invested: decimalString,
      realEstate: decimalString,
      other: decimalString,
    })
    .optional(),
});
export type NetWorthPoint = z.infer<typeof netWorthPointSchema>;

export const cashFlowMonthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  income: decimalString,
  expenses: decimalString,
  net: decimalString,
});
export type CashFlowMonth = z.infer<typeof cashFlowMonthSchema>;

export const upcomingEventSchema = z.object({
  id: z.string(),
  label: z.string(),
  scheduledAt: z.string().date(),
  amount: decimalString,
  kind: z.enum(['recurring', 'planned', 'loan_payment']),
  iconKey: z.string().optional(),
});
export type UpcomingEvent = z.infer<typeof upcomingEventSchema>;

// Subset of the persisted `action_payload` we surface to the UI so it can
// build deep-link CTAs. New keys are added when a detector emits them.
export const insightActionPayloadSchema = z
  .object({
    loanId: z.string().uuid(),
    ruleId: z.string().uuid(),
    accountId: z.string().uuid(),
    merchant: z.string(),
    cadence: z.string(),
  })
  .partial();
export type InsightActionPayload = z.infer<typeof insightActionPayloadSchema>;

export const dashboardInsightSchema = z.object({
  id: z.string().uuid(),
  kind: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  estimatedSavings: decimalString.nullable(),
  actionable: z.boolean(),
  actionPayload: insightActionPayloadSchema.nullable(),
});
export type DashboardInsight = z.infer<typeof dashboardInsightSchema>;

export const attentionAlertSchema = z.object({
  id: z.string(),
  kind: z.enum([
    'uncategorized_transactions',
    'consent_expiring',
    'sync_stale',
    'low_balance',
    'valuation_outdated',
  ]),
  severity: z.enum(['info', 'warning', 'urgent']),
  message: z.string(),
});
export type AttentionAlert = z.infer<typeof attentionAlertSchema>;

export const distributionSchema = z.object({
  liquid: decimalString,
  invested: decimalString,
  realEstate: decimalString,
  other: decimalString,
  liabilities: decimalString,
});
export type Distribution = z.infer<typeof distributionSchema>;

export const dashboardSchema = z.object({
  kpis: kpiSchema,
  netWorthSeries: z.array(netWorthPointSchema),
  cashFlowSeries: z.array(cashFlowMonthSchema),
  distribution: distributionSchema,
  upcomingEvents: z.array(upcomingEventSchema),
  insights: z.array(dashboardInsightSchema),
  alerts: z.array(attentionAlertSchema),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
