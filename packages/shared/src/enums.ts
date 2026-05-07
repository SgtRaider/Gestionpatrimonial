import { z } from 'zod';

// Mirror of Drizzle enums in apps/api/src/db/schema.ts.
// The DB is the source of truth — keep these in sync.

export const accountTypeSchema = z.enum([
  'checking',
  'savings',
  'brokerage',
  'pension',
  'crypto',
  'real_estate',
  'vehicle',
  'other',
]);
export type AccountType = z.infer<typeof accountTypeSchema>;

export const institutionTypeSchema = z.enum([
  'bank',
  'broker',
  'insurer',
  'crypto_exchange',
  'real_estate',
  'manual',
]);
export type InstitutionType = z.infer<typeof institutionTypeSchema>;

export const transactionStatusSchema = z.enum(['booked', 'pending']);
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;

export const transactionSourceSchema = z.enum(['psd2', 'csv', 'scrape', 'manual', 'derived']);
export type TransactionSource = z.infer<typeof transactionSourceSchema>;

export const categoryKindSchema = z.enum(['expense', 'income', 'transfer']);
export type CategoryKind = z.infer<typeof categoryKindSchema>;

export const loanKindSchema = z.enum(['mortgage', 'personal', 'car', 'student', 'other']);
export type LoanKind = z.infer<typeof loanKindSchema>;

export const amortizationSystemSchema = z.enum(['french', 'german', 'american', 'bullet']);
export type AmortizationSystem = z.infer<typeof amortizationSystemSchema>;

export const rateTypeSchema = z.enum(['fixed', 'variable', 'mixed']);
export type RateType = z.infer<typeof rateTypeSchema>;

export const prepaymentModeSchema = z.enum(['reduce_term', 'reduce_payment']);
export type PrepaymentMode = z.infer<typeof prepaymentModeSchema>;

export const recurringFrequencySchema = z.enum([
  'weekly',
  'monthly',
  'quarterly',
  'biannual',
  'yearly',
  'custom',
]);
export type RecurringFrequency = z.infer<typeof recurringFrequencySchema>;

export const recurringKindSchema = z.enum([
  'subscription',
  'bill',
  'salary',
  'rent',
  'transfer',
  'other',
]);
export type RecurringKind = z.infer<typeof recurringKindSchema>;

export const recurringStatusSchema = z.enum(['active', 'paused', 'cancelled']);
export type RecurringStatus = z.infer<typeof recurringStatusSchema>;

export const certaintySchema = z.enum(['low', 'medium', 'high', 'certain']);
export type Certainty = z.infer<typeof certaintySchema>;

export const plannedEventKindSchema = z.enum([
  'expense',
  'income',
  'transfer',
  'asset_purchase',
  'asset_sale',
  'loan_origination',
  'loan_payoff',
  'life_event',
]);
export type PlannedEventKind = z.infer<typeof plannedEventKindSchema>;

export const insightSeveritySchema = z.enum(['info', 'warning', 'urgent']);
export type InsightSeverity = z.infer<typeof insightSeveritySchema>;
