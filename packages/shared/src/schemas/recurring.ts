import { z } from 'zod';
import {
  recurringAmountKindSchema,
  recurringFrequencySchema,
  recurringKindSchema,
  recurringStatusSchema,
} from '../enums.js';
import { decimalString } from './transaction.js';

export const recurringRuleSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: recurringKindSchema,
  frequency: recurringFrequencySchema,
  expectedAmount: decimalString,
  amountKind: recurringAmountKindSchema,
  currency: z.string().length(3),
  status: recurringStatusSchema,
  detectedAutomatically: z.boolean(),
  categoryId: z.string().uuid().nullable(),
  accountId: z.string().uuid().nullable(),
  nextExpectedAt: z.string().date().nullable(),
  notes: z.string().nullable(),
});
export type RecurringRule = z.infer<typeof recurringRuleSchema>;

export const markRecurringInputSchema = z.object({
  transactionIds: z.array(z.string().uuid()).min(1).max(500),
  name: z.string().min(1).max(200),
  kind: recurringKindSchema,
  frequency: recurringFrequencySchema,
  amountKind: recurringAmountKindSchema.default('fixed'),
  // If omitted, the API uses the mean amount of the selected transactions.
  // For `variable` rules this acts as a typical/average amount used for KPIs
  // and projections rather than an exact-match expectation.
  expectedAmount: decimalString.optional(),
  notes: z.string().max(2000).optional(),
});
export type MarkRecurringInput = z.infer<typeof markRecurringInputSchema>;

export const markRecurringResponseSchema = z.object({
  rule: recurringRuleSchema,
  linkedCount: z.number().int().nonnegative(),
});
export type MarkRecurringResponse = z.infer<typeof markRecurringResponseSchema>;

export const unlinkRecurringInputSchema = z.object({
  transactionIds: z.array(z.string().uuid()).min(1).max(500),
});
export type UnlinkRecurringInput = z.infer<typeof unlinkRecurringInputSchema>;

export const unlinkRecurringResponseSchema = z.object({
  unlinkedCount: z.number().int().nonnegative(),
  rulesDeleted: z.number().int().nonnegative(),
});
export type UnlinkRecurringResponse = z.infer<typeof unlinkRecurringResponseSchema>;

export const recurringRuleEnrichedSchema = recurringRuleSchema.extend({
  linkedCount: z.number().int().nonnegative(),
  lastChargedAt: z.string().date().nullable(),
  annualMultiplier: z.number().positive(),
  annualCost: decimalString,
});
export type RecurringRuleEnriched = z.infer<typeof recurringRuleEnrichedSchema>;

export const recurringRulesListResponseSchema = z.object({
  items: z.array(recurringRuleEnrichedSchema),
  summary: z.object({
    activeCount: z.number().int().nonnegative(),
    monthlyOutflow: decimalString,
    monthlyInflow: decimalString,
    annualOutflow: decimalString,
    annualInflow: decimalString,
  }),
});
export type RecurringRulesListResponse = z.infer<typeof recurringRulesListResponseSchema>;

export const deleteRecurringRuleResponseSchema = z.object({
  unlinkedCount: z.number().int().nonnegative(),
});
export type DeleteRecurringRuleResponse = z.infer<typeof deleteRecurringRuleResponseSchema>;
