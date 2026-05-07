import { z } from 'zod';
import { categoryKindSchema, transactionSourceSchema, transactionStatusSchema } from '../enums.js';

export const decimalString = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, 'Must be a numeric string (precision-safe)');

export const categorySchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  name: z.string(),
  kind: categoryKindSchema,
  color: z.string().nullable(),
  iconKey: z.string().nullable(),
});
export type Category = z.infer<typeof categorySchema>;

export const transactionSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  bookedAt: z.string().datetime(),
  valueAt: z.string().datetime().nullable(),
  amount: decimalString,
  currency: z.string().length(3),
  amountBaseCurrency: decimalString.nullable(),
  descriptionRaw: z.string(),
  counterparty: z.string().nullable(),
  normalizedMerchant: z.string().nullable(),
  merchantAliasUser: z.string().nullable(),
  categoryId: z.string().uuid().nullable(),
  status: transactionStatusSchema,
  source: transactionSourceSchema,
  transferPairId: z.string().uuid().nullable(),
  parentTransactionId: z.string().uuid().nullable(),
  recurringRuleId: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  isProjection: z.boolean(),
});
export type Transaction = z.infer<typeof transactionSchema>;

export const transactionListQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  accountIds: z.array(z.string().uuid()).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  status: transactionStatusSchema.optional(),
  uncategorized: z.boolean().optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});
export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>;

// Account + institution embedded so the UI doesn't need a join lookup
export const transactionListItemSchema = transactionSchema.extend({
  accountName: z.string(),
  accountIbanLast4: z.string().nullable(),
  institutionName: z.string(),
  institutionColor: z.string().nullable(),
  category: categorySchema.nullable(),
  tags: z.array(z.string()),
});
export type TransactionListItem = z.infer<typeof transactionListItemSchema>;

export const transactionPatchSchema = z
  .object({
    categoryId: z.string().uuid().nullable(),
    notes: z.string().max(2000).nullable(),
    merchantAliasUser: z.string().max(200).nullable(),
    tags: z.array(z.string().max(50)),
  })
  .partial();
export type TransactionPatch = z.infer<typeof transactionPatchSchema>;

export const bulkCategorizeInputSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  categoryId: z.string().uuid().nullable(),
});
export type BulkCategorizeInput = z.infer<typeof bulkCategorizeInputSchema>;

export const bulkCategorizeResponseSchema = z.object({
  updated: z.number().int().nonnegative(),
});
export type BulkCategorizeResponse = z.infer<typeof bulkCategorizeResponseSchema>;

export const categorizationRuleSchema = z.object({
  id: z.string().uuid(),
  patternRegex: z.string(),
  categoryId: z.string().uuid(),
  accountId: z.string().uuid().nullable(),
  amountMin: decimalString.nullable(),
  amountMax: decimalString.nullable(),
  priority: z.number().int(),
  active: z.boolean(),
});
export type CategorizationRule = z.infer<typeof categorizationRuleSchema>;

export const createCategorizationRuleSchema = z.object({
  patternRegex: z.string().min(1).max(500),
  categoryId: z.string().uuid(),
  accountId: z.string().uuid().nullable().optional(),
  amountMin: decimalString.optional(),
  amountMax: decimalString.optional(),
  priority: z.number().int().optional(),
  applyToExisting: z.boolean().optional(),
  suggestedFromTransactionId: z.string().uuid().optional(),
});
export type CreateCategorizationRuleInput = z.infer<typeof createCategorizationRuleSchema>;

export const createCategorizationRuleResponseSchema = z.object({
  rule: categorizationRuleSchema,
  appliedToCount: z.number().int().nonnegative(),
});
export type CreateCategorizationRuleResponse = z.infer<
  typeof createCategorizationRuleResponseSchema
>;

export const transactionListResponseSchema = z.object({
  items: z.array(transactionListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  summary: z.object({
    income: decimalString,
    expenses: decimalString,
    net: decimalString,
    count: z.number().int().nonnegative(),
  }),
});
export type TransactionListResponse = z.infer<typeof transactionListResponseSchema>;
