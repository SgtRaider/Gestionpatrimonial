import { z } from 'zod';
import { recurringFrequencySchema, recurringKindSchema, recurringStatusSchema } from '../enums.js';
import { decimalString } from './transaction.js';

export const recurringRuleSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: recurringKindSchema,
  frequency: recurringFrequencySchema,
  expectedAmount: decimalString,
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
  // If omitted, the API uses the mean amount of the selected transactions.
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
