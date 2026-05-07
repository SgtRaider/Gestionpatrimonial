import { z } from 'zod';
import { decimalString } from './transaction.js';

export const holdingTransactionKindSchema = z.enum([
  'buy',
  'sell',
  'transfer_in',
  'transfer_out',
  'dividend',
  'split',
  'fee',
  'tax',
]);
export type HoldingTransactionKind = z.infer<typeof holdingTransactionKindSchema>;

export const holdingSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  isin: z.string().nullable(),
  ticker: z.string().nullable(),
  name: z.string(),
  assetClass: z.string().nullable(),
  currency: z.string().length(3),
  quantity: decimalString,
  avgCost: decimalString,
  openedAt: z.string().date().nullable(),
  closedAt: z.string().date().nullable(),
  notes: z.string().nullable(),
});
export type Holding = z.infer<typeof holdingSchema>;

export const holdingValuationSchema = z.object({
  id: z.string().uuid(),
  holdingId: z.string().uuid(),
  valuationAt: z.string().date(),
  nav: decimalString,
  totalValue: decimalString,
  source: z.string().nullable(),
});
export type HoldingValuation = z.infer<typeof holdingValuationSchema>;

export const createHoldingInputSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1).max(200),
  ticker: z.string().max(20).nullable().optional(),
  isin: z.string().length(12).nullable().optional(),
  assetClass: z.string().max(50).nullable().optional(),
  currency: z.string().length(3).default('EUR'),
  quantity: decimalString,
  avgCost: decimalString,
  openedAt: z.string().date().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type CreateHoldingInput = z.infer<typeof createHoldingInputSchema>;

export const recordValuationInputSchema = z.object({
  valuationAt: z.string().date(),
  nav: decimalString,
});
export type RecordValuationInput = z.infer<typeof recordValuationInputSchema>;

export const recordHoldingTxInputSchema = z.object({
  kind: holdingTransactionKindSchema,
  occurredAt: z.string().date(),
  quantity: decimalString,
  price: decimalString,
  fees: decimalString.optional(),
  taxes: decimalString.optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type RecordHoldingTxInput = z.infer<typeof recordHoldingTxInputSchema>;

export const holdingTransactionRowSchema = z.object({
  id: z.string().uuid(),
  kind: holdingTransactionKindSchema,
  occurredAt: z.string().datetime(),
  quantity: decimalString,
  price: decimalString,
  fees: decimalString,
  taxes: decimalString,
  notes: z.string().nullable(),
});
export type HoldingTransactionRow = z.infer<typeof holdingTransactionRowSchema>;

export const holdingValuationRowSchema = z.object({
  id: z.string().uuid(),
  valuationAt: z.string().date(),
  nav: decimalString,
  totalValue: decimalString,
  source: z.string().nullable(),
});
export type HoldingValuationRow = z.infer<typeof holdingValuationRowSchema>;

export const holdingDetailSchema = holdingSchema.extend({
  lastNav: decimalString.nullable(),
  marketValue: decimalString,
  costBasis: decimalString,
  unrealisedPnL: decimalString,
  unrealisedPnLPct: z.number().nullable(),
  transactions: z.array(holdingTransactionRowSchema),
  valuations: z.array(holdingValuationRowSchema),
});
export type HoldingDetail = z.infer<typeof holdingDetailSchema>;
