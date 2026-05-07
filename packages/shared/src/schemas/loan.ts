import { z } from 'zod';
import {
  amortizationSystemSchema,
  loanKindSchema,
  prepaymentModeSchema,
  rateTypeSchema,
} from '../enums.js';
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

export const loanPaymentMatchSchema = z.object({
  transactionId: z.string().uuid(),
  bookedAt: z.string().date(),
  actualPayment: decimalString,
  descriptionRaw: z.string(),
  // `true` when the match is a stored override (user picked it manually);
  // `false` when the regex+amount+date matcher inferred it on the fly.
  manual: z.boolean().default(false),
});
export type LoanPaymentMatch = z.infer<typeof loanPaymentMatchSchema>;

export const manualMatchPaymentInputSchema = z.object({
  transactionId: z.string().uuid(),
});
export type ManualMatchPaymentInput = z.infer<typeof manualMatchPaymentInputSchema>;

// `recorded`: the rate at this review came from `loan_rate_history` (past
// real review, or a future one the user already entered).
// `projected`: variable/mixed loan anniversary with no recorded rate yet —
// the engine carried forward the last known rate. Will resolve into the new
// Euribor + spread once the review actually happens.
export const loanRateReviewSchema = z.object({
  rate: decimalString,
  kind: z.enum(['recorded', 'projected']),
});
export type LoanRateReview = z.infer<typeof loanRateReviewSchema>;

export const loanScheduleRowSchema = z.object({
  period: z.number().int().positive(),
  dueAt: z.string().date(),
  payment: decimalString,
  principal: decimalString,
  interest: decimalString,
  outstandingAfter: decimalString,
  rateApplied: decimalString,
  matchedPayment: loanPaymentMatchSchema.nullable(),
  rateReview: loanRateReviewSchema.nullable(),
});
export type LoanScheduleRow = z.infer<typeof loanScheduleRowSchema>;

export const loanRateHistoryRowSchema = z.object({
  effectiveAt: z.string().date(),
  rate: decimalString,
  source: z.enum(['contract', 'review', 'novation']),
});
export type LoanRateHistoryRow = z.infer<typeof loanRateHistoryRowSchema>;

export const addLoanRateHistoryInputSchema = z.object({
  effectiveAt: z.string().date(),
  rate: decimalString,
  source: z.enum(['contract', 'review', 'novation']).default('review'),
  indexValueAtReview: decimalString.optional(),
  notes: z.string().max(500).optional(),
});
export type AddLoanRateHistoryInput = z.infer<typeof addLoanRateHistoryInputSchema>;

export const loanDetailSchema = loanSummarySchema.extend({
  principalInitial: decimalString,
  prepaymentFeePct: decimalString.nullable(),
  fiscalDeductible: z.boolean(),
  notes: z.string().nullable(),
  schedule: z.array(loanScheduleRowSchema),
  rateHistory: z.array(loanRateHistoryRowSchema),
  // The period the borrower is currently at (last fully past one).
  lastPaidPeriod: z.number().int().nonnegative(),
  // Loan-shaped transactions that the matcher could not pin to any schedule
  // row (different lender ref, off-by-too-many days, etc.). Surfaced for
  // manual reconciliation.
  orphanPayments: z.array(loanPaymentMatchSchema),
});
export type LoanDetail = z.infer<typeof loanDetailSchema>;

export const prepaymentSimulationInputSchema = z.object({
  amount: decimalString,
  occurredAt: z.string().date(),
  mode: prepaymentModeSchema,
});
export type PrepaymentSimulationInput = z.infer<typeof prepaymentSimulationInputSchema>;

export const prepaymentScenarioSchema = z.object({
  payment: decimalString,
  termMonths: z.number().int().nonnegative(),
  finalDate: z.string().date(),
  totalInterestRemaining: decimalString,
});
export type PrepaymentScenario = z.infer<typeof prepaymentScenarioSchema>;

export const prepaymentSimulationResponseSchema = z.object({
  appliedAt: z.string().date(),
  appliedPeriod: z.number().int().positive(),
  outstandingBefore: decimalString,
  outstandingAfter: decimalString,
  fee: decimalString, // Computed from prepaymentFeePct × amount.
  baseline: prepaymentScenarioSchema,
  withPrepayment: prepaymentScenarioSchema,
  interestSaved: decimalString,
  monthsSaved: z.number().int(),
  paymentDelta: decimalString, // Negative when "reduce_payment" lowers the cuota.
});
export type PrepaymentSimulationResponse = z.infer<typeof prepaymentSimulationResponseSchema>;
