import {
  type LoanDetail,
  type LoanSummary,
  type PrepaymentSimulationResponse,
  prepaymentSimulationInputSchema,
} from '@gp/shared';
import { Decimal } from 'decimal.js';
import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { loanRateHistory, loans, transactions } from '../db/schema.js';
import {
  type AmortizationRow,
  locateCurrentPeriod,
  simulatePrepayment,
  summarizeSchedule,
} from '../services/amortization.js';
import { buildSchedule, matchLoanPayments } from '../services/loan-helpers.js';

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

    // Pull negative debit transactions in the loan's window so the matcher
    // can pin payments to schedule rows. The 30-day padding either side
    // catches early/late payments without widening the search to the whole
    // history.
    const startDate = new Date(data.loan.startedAt);
    startDate.setUTCDate(startDate.getUTCDate() - 30);
    const lastDue = schedule[schedule.length - 1]?.dueAt;
    const endDate = lastDue ? new Date(lastDue) : new Date();
    endDate.setUTCDate(endDate.getUTCDate() + 30);

    const txs = await db
      .select({
        id: transactions.id,
        bookedAt: transactions.bookedAt,
        amount: transactions.amount,
        descriptionRaw: transactions.descriptionRaw,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, DEFAULT_USER_ID),
          isNull(transactions.deletedAt),
          isNull(transactions.transferPairId),
          eq(transactions.isProjection, false),
          lte(transactions.amount, '0'),
          gte(transactions.bookedAt, startDate),
          lte(transactions.bookedAt, endDate),
        ),
      );

    const matched = matchLoanPayments(schedule, txs);

    const detail: LoanDetail = {
      ...summary,
      principalInitial: data.loan.principalInitial,
      prepaymentFeePct: data.loan.prepaymentFeePct,
      fiscalDeductible: data.loan.fiscalDeductible,
      notes: data.loan.notes,
      schedule: matched.rows,
      rateHistory: data.rateRows.map((r) => ({
        effectiveAt: toIsoDate(r.effectiveAt),
        rate: r.rate,
        source: r.source,
      })),
      lastPaidPeriod: cur.lastPaidPeriod,
      orphanPayments: matched.orphans,
    };
    return detail;
  });

  app.post('/loans/:id/simulate-prepayment', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = prepaymentSimulationInputSchema.parse(request.body);
    const data = await loadLoanWithRates(params.id);
    if (!data) return reply.code(404).send({ error: 'Préstamo no encontrado' });

    const schedule = buildSchedule(data.loan, data.rateRows);
    const sim = simulatePrepayment(
      schedule,
      body.amount,
      new Date(`${body.occurredAt}T00:00:00Z`),
      body.mode,
    );
    if (!sim) {
      return reply.code(400).send({
        error: 'No se puede aplicar la amortización (préstamo ya saldado o fecha posterior al fin)',
      });
    }

    const feePct = data.loan.prepaymentFeePct
      ? new Decimal(data.loan.prepaymentFeePct)
      : new Decimal(0);
    const fee = new Decimal(body.amount).times(feePct).div(100).toFixed(2);

    const response: PrepaymentSimulationResponse = {
      appliedAt: sim.appliedAt,
      appliedPeriod: sim.appliedPeriod,
      outstandingBefore: sim.outstandingBefore,
      outstandingAfter: sim.outstandingAfter,
      fee,
      baseline: sim.baseline,
      withPrepayment: sim.withPrepayment,
      interestSaved: sim.interestSaved,
      monthsSaved: sim.monthsSaved,
      paymentDelta: sim.paymentDelta,
    };
    return response;
  });
};
