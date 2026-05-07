import type { LoanDetail, LoanSummary } from '@gp/shared';
import { Decimal } from 'decimal.js';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { loanRateHistory, loans } from '../db/schema.js';
import {
  type AmortizationRow,
  type RateChange,
  generateSchedule,
  locateCurrentPeriod,
  summarizeSchedule,
} from '../services/amortization.js';

const DEFAULT_USER_ID = '01951b00-0000-7000-8000-000000000001';

function toIsoDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

async function loadLoanWithRates(loanId: string) {
  const [loan] = await db
    .select()
    .from(loans)
    .where(and(eq(loans.id, loanId), eq(loans.userId, DEFAULT_USER_ID), isNull(loans.deletedAt)));
  if (!loan) return null;
  const rateRows = await db
    .select()
    .from(loanRateHistory)
    .where(eq(loanRateHistory.loanId, loan.id))
    .orderBy(asc(loanRateHistory.effectiveAt));
  return { loan, rateRows };
}

function buildSchedule(
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

function buildSummary(loan: typeof loans.$inferSelect, schedule: AmortizationRow[]): LoanSummary {
  const today = new Date();
  const cur = locateCurrentPeriod(schedule, today);
  const totals = summarizeSchedule(schedule);
  const currentRow =
    schedule.find((r) => r.dueAt > toIsoDate(today)) ?? schedule[schedule.length - 1];
  const currentRate = currentRow?.rateApplied ?? loan.rateFixed ?? '0.0000';

  return {
    id: loan.id,
    kind: loan.kind,
    alias: loan.alias,
    lender: loan.lender,
    currency: loan.currency,
    startedAt: toIsoDate(loan.startedAt),
    termMonths: loan.termMonths,
    amortizationSystem: loan.amortizationSystem,
    rateType: loan.rateType,
    currentRatePct: new Decimal(currentRate).toFixed(4),
    rateIndex: loan.rateIndex,
    rateSpread: loan.rateSpread,
    reviewFrequencyMonths: loan.reviewFrequencyMonths,
    nextReviewAt: loan.nextReviewAt ? toIsoDate(loan.nextReviewAt) : null,
    outstanding: cur.outstanding,
    totalInterest: totals.totalInterest,
    paidInterest: cur.paidInterest,
    pendingInterest: cur.pendingInterest,
    nextPaymentDate: cur.nextPeriod?.dueAt ?? null,
    nextPaymentAmount: cur.nextPeriod?.payment ?? null,
  };
}

export const loansRoutes: FastifyPluginAsync = async (app) => {
  app.get('/loans', async () => {
    const rows = await db
      .select()
      .from(loans)
      .where(and(eq(loans.userId, DEFAULT_USER_ID), isNull(loans.deletedAt)))
      .orderBy(asc(loans.startedAt));

    const summaries: LoanSummary[] = [];
    for (const loan of rows) {
      const rateRows = await db
        .select()
        .from(loanRateHistory)
        .where(eq(loanRateHistory.loanId, loan.id))
        .orderBy(asc(loanRateHistory.effectiveAt));
      const schedule = buildSchedule(loan, rateRows);
      summaries.push(buildSummary(loan, schedule));
    }
    return summaries;
  });

  app.get('/loans/:id', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = await loadLoanWithRates(params.id);
    if (!data) return reply.code(404).send({ error: 'Préstamo no encontrado' });

    const schedule = buildSchedule(data.loan, data.rateRows);
    const summary = buildSummary(data.loan, schedule);
    const today = new Date();
    const cur = locateCurrentPeriod(schedule, today);

    const detail: LoanDetail = {
      ...summary,
      principalInitial: data.loan.principalInitial,
      prepaymentFeePct: data.loan.prepaymentFeePct,
      fiscalDeductible: data.loan.fiscalDeductible,
      notes: data.loan.notes,
      schedule,
      rateHistory: data.rateRows.map((r) => ({
        effectiveAt: toIsoDate(r.effectiveAt),
        rate: r.rate,
        source: r.source,
      })),
      lastPaidPeriod: cur.lastPaidPeriod,
    };
    return detail;
  });
};
