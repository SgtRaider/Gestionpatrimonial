import { z } from 'zod';
import { amortizationSystemSchema, loanKindSchema, rateTypeSchema } from '../enums.js';
import { decimalString } from './transaction.js';

export const loanSummarySchema = z.object({
  id: z.string().uuid(),
  kind: loanKindSchema,
  alias: z.string().nullable(),
  lender: z.string(),
  currency: z.string().length(3),
  startedAt: z.string().date(),
  termMonths: z.number().int().positive(),
  amortizationSystem: amortizationSystemSchema,
  rateType: rateTypeSchema,
  // Current applicable annual rate as percent (e.g. "3.5200").
  currentRatePct: decimalString,
  rateIndex: z.string().nullable(),
  rateSpread: decimalString.nullable(),
  reviewFrequencyMonths: z.number().int().positive().nullable(),
  nextReviewAt: z.string().date().nullable(),
  // Aggregates derived from the full schedule.
  outstanding: decimalString,
  totalInterest: decimalString,
  paidInterest: decimalString,
  pendingInterest: decimalString,
  // Next pending payment (if any).
  nextPaymentDate: z.string().date().nullable(),
  nextPaymentAmount: decimalString.nullable(),
});
export type LoanSummary = z.infer<typeof loanSummarySchema>;

export const loanScheduleRowSchema = z.object({
  period: z.number().int().positive(),
  dueAt: z.string().date(),
  payment: decimalString,
  principal: decimalString,
  interest: decimalString,
  outstandingAfter: decimalString,
  rateApplied: decimalString,
});
export type LoanScheduleRow = z.infer<typeof loanScheduleRowSchema>;

export const loanRateHistoryRowSchema = z.object({
  effectiveAt: z.string().date(),
  rate: decimalString,
  source: z.enum(['contract', 'review', 'novation']),
});
export type LoanRateHistoryRow = z.infer<typeof loanRateHistoryRowSchema>;

export const loanDetailSchema = loanSummarySchema.extend({
  principalInitial: decimalString,
  prepaymentFeePct: decimalString.nullable(),
  fiscalDeductible: z.boolean(),
  notes: z.string().nullable(),
  schedule: z.array(loanScheduleRowSchema),
  rateHistory: z.array(loanRateHistoryRowSchema),
  // The period the borrower is currently at (last fully past one).
  lastPaidPeriod: z.number().int().nonnegative(),
});
export type LoanDetail = z.infer<typeof loanDetailSchema>;
