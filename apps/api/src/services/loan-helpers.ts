// Shared helpers around the amortization engine and the loans tables.
// Used by both the /api/loans routes and the insights generator.

import type { LoanPaymentMatch, LoanScheduleRow } from '@gp/shared';
import { Decimal } from 'decimal.js';
import type { loanRateHistory, loans } from '../db/schema.js';
import { type AmortizationRow, type RateChange, generateSchedule } from './amortization.js';

export type { AmortizationRow };

export function buildSchedule(
  loan: typeof loans.$inferSelect,
  rateRows: (typeof loanRateHistory.$inferSelect)[],
): AmortizationRow[] {
  const rates: RateChange[] =
    rateRows.length > 0
      ? rateRows.map((r) => ({ effectiveAt: new Date(r.effectiveAt), rate: r.rate }))
      : [
          {
            effectiveAt: new Date(loan.startedAt),
            rate: loan.rateFixed ?? loan.rateSpread ?? '0',
          },
        ];

  return generateSchedule({
    principalInitial: loan.principalInitial,
    termMonths: loan.termMonths,
    startDate: new Date(loan.startedAt),
    amortizationSystem: loan.amortizationSystem,
    rates,
  });
}

// Loan-payment patterns: require the full word, not generic banking prefixes
// like "RCBO." (which Spanish banks use for any direct debit) or "CUOTA"
// alone (matches gym/insurance memberships).
const LOAN_DESCRIPTION_RE = /\b(hipoteca|prestamo|préstamo|mortgage|amortizaci[oó]n)\b/i;

type LoanLikeTransaction = {
  id: string;
  bookedAt: Date;
  amount: string;
  descriptionRaw: string;
};

// Match each schedule row to the closest loan-shaped debit, by date proximity
// (±10 days) and amount tolerance (±5 %). Returns enriched rows + the orphans
// that fit the loan's amount range but couldn't be pinned to a specific row
// (off-by-too-many days, lender ref drift, etc.).
export function matchLoanPayments(
  schedule: AmortizationRow[],
  candidates: LoanLikeTransaction[],
): { rows: LoanScheduleRow[]; orphans: LoanPaymentMatch[] } {
  // Bound candidate amounts to this loan's range so we don't surface
  // transactions for a different mortgage / personal loan as orphans.
  const payments = schedule.map((r) => new Decimal(r.payment).toNumber()).filter((n) => n > 0);
  const minExpected = payments.length > 0 ? Math.min(...payments) : 0;
  const maxExpected = payments.length > 0 ? Math.max(...payments) : 0;
  const lowerBound = minExpected * 0.95;
  const upperBound = maxExpected * 1.05;

  const loanLike = candidates.filter((t) => {
    if (!LOAN_DESCRIPTION_RE.test(t.descriptionRaw)) return false;
    const abs = Math.abs(Number(t.amount));
    if (lowerBound > 0 && (abs < lowerBound || abs > upperBound)) return false;
    return true;
  });
  const usedTxIds = new Set<string>();

  const rows: LoanScheduleRow[] = schedule.map((row) => {
    const dueAtMs = new Date(row.dueAt).getTime();
    const expected = new Decimal(row.payment);
    let best: { tx: LoanLikeTransaction; diffDays: number } | null = null;

    for (const tx of loanLike) {
      if (usedTxIds.has(tx.id)) continue;
      const txAmt = new Decimal(tx.amount).abs();
      if (expected.greaterThan(0)) {
        const ratio = txAmt.minus(expected).abs().div(expected).toNumber();
        if (ratio > 0.05) continue;
      }
      const diffDays = Math.abs((tx.bookedAt.getTime() - dueAtMs) / 86400000);
      if (diffDays > 10) continue;
      if (!best || diffDays < best.diffDays) best = { tx, diffDays };
    }

    if (!best) return { ...row, matchedPayment: null };
    usedTxIds.add(best.tx.id);
    return {
      ...row,
      matchedPayment: {
        transactionId: best.tx.id,
        bookedAt: best.tx.bookedAt.toISOString().slice(0, 10),
        actualPayment: new Decimal(best.tx.amount).abs().toFixed(2),
        descriptionRaw: best.tx.descriptionRaw,
      },
    };
  });

  const orphans: LoanPaymentMatch[] = loanLike
    .filter((t) => !usedTxIds.has(t.id))
    .map((t) => ({
      transactionId: t.id,
      bookedAt: t.bookedAt.toISOString().slice(0, 10),
      actualPayment: new Decimal(t.amount).abs().toFixed(2),
      descriptionRaw: t.descriptionRaw,
    }));

  return { rows, orphans };
}
