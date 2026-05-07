import { z } from 'zod';
import { decimalString } from './transaction.js';

export const categorySuggestionSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string(),
  color: z.string().nullable(),
  iconKey: z.string().nullable(),
  hits: z.number().int().nonnegative(),
  source: z.enum(['merchant', 'description', 'recent']),
});
export type CategorySuggestion = z.infer<typeof categorySuggestionSchema>;

export const categorizationQueueItemSchema = z.object({
  id: z.string().uuid(),
  bookedAt: z.string().datetime(),
  amount: decimalString,
  currency: z.string().length(3),
  descriptionRaw: z.string(),
  counterparty: z.string().nullable(),
  normalizedMerchant: z.string().nullable(),
  accountId: z.string().uuid(),
  accountName: z.string(),
  institutionName: z.string(),
  institutionColor: z.string().nullable(),
});
export type CategorizationQueueItem = z.infer<typeof categorizationQueueItemSchema>;

export const categorizationQueueResponseSchema = z.object({
  pending: z.number().int().nonnegative(),
  next: categorizationQueueItemSchema.nullable(),
  suggestions: z.array(categorySuggestionSchema),
});
export type CategorizationQueueResponse = z.infer<typeof categorizationQueueResponseSchema>;
