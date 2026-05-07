// Shared helpers around the amortization engine and the loans tables.
// Used by both the /api/loans routes and the insights generator.

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
