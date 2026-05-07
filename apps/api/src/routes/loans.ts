import {
  type LoanDetail,
  type LoanSummary,
  type PrepaymentSimulationResponse,
  addLoanRateHistoryInputSchema,
  manualMatchPaymentInputSchema,
  prepaymentSimulationInputSchema,
} from '@gp/shared';
import { Decimal } from 'decimal.js';
import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';
import { db } from '../db/index.js';
import { loanPayments, loanRateHistory, loans, transactions } from '../db/schema.js';
import {
  type AmortizationRow,
  locateCurrentPeriod,
  simulatePrepayment,
  summarizeSchedule,
} from '../services/amortization.js';
import {
  buildRateReviewMarkers,
  buildSchedule,
  matchLoanPayments,
} from '../services/loan-helpers.js';

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

    // Load manual payment overrides (loan_payments rows where the user
    // pinned a transaction to a specific period). They take precedence over
    // the regex matcher in matchLoanPayments.
    const overrideRows = await db
      .select({
        period: loanPayments.period,
        transactionId: loanPayments.transactionId,
        bookedAt: transactions.bookedAt,
        amount: transactions.amount,
        descriptionRaw: transactions.descriptionRaw,
      })
      .from(loanPayments)
      .innerJoin(transactions, eq(transactions.id, loanPayments.transactionId))
      .where(
        and(
          eq(loanPayments.loanId, params.id),
          isNull(loanPayments.deletedAt),
          isNull(transactions.deletedAt),
        ),
      );
    const overrides = overrideRows
      .filter(
        (r): r is typeof r & { period: number; transactionId: string } =>
          r.period != null && r.transactionId != null,
      )
      .map((r) => ({
        period: r.period,
        transactionId: r.transactionId,
        bookedAt: r.bookedAt,
        amount: r.amount,
        descriptionRaw: r.descriptionRaw,
      }));

    const matched = matchLoanPayments(schedule, txs, overrides);
    const reviewMarkers = buildRateReviewMarkers(data.loan, data.rateRows, schedule);
    const enrichedRows = matched.rows.map((row) => ({
      ...row,
      rateReview: reviewMarkers.get(row.period) ?? null,
    }));

    const detail: LoanDetail = {
      ...summary,
      principalInitial: data.loan.principalInitial,
      prepaymentFeePct: data.loan.prepaymentFeePct,
      fiscalDeductible: data.loan.fiscalDeductible,
      notes: data.loan.notes,
      schedule: enrichedRows,
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

  // Manually pin a transaction to a specific schedule period. Overrides any
  // auto-match the regex would have made. Idempotent on the (loan, period)
  // pair: re-linking replaces the previous override.
  app.post('/loans/:id/schedule/:period/match', async (request, reply) => {
    const params = z
      .object({ id: z.string().uuid(), period: z.coerce.number().int().positive() })
      .parse(request.params);
    const body = manualMatchPaymentInputSchema.parse(request.body);

    const data = await loadLoanWithRates(params.id);
    if (!data) return reply.code(404).send({ error: 'Préstamo no encontrado' });

    const [tx] = await db
      .select({
        id: transactions.id,
        bookedAt: transactions.bookedAt,
        amount: transactions.amount,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.id, body.transactionId),
          eq(transactions.userId, DEFAULT_USER_ID),
          isNull(transactions.deletedAt),
        ),
      );
    if (!tx) return reply.code(404).send({ error: 'Transacción no encontrada' });

    // Replace any prior override for this period (soft-delete first).
    await db
      .update(loanPayments)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(loanPayments.loanId, params.id),
          eq(loanPayments.period, params.period),
          isNull(loanPayments.deletedAt),
        ),
      );

    await db.insert(loanPayments).values({
      id: uuidv7(),
      loanId: params.id,
      transactionId: body.transactionId,
      occurredAt: tx.bookedAt.toISOString().slice(0, 10),
      period: params.period,
      principalPaid: '0',
      interestPaid: '0',
      feesPaid: '0',
    });

    return { ok: true };
  });

  // Remove a manual override (the auto-matcher takes over again on the next
  // load). Safe no-op if no override exists.
  app.delete('/loans/:id/schedule/:period/match', async (request) => {
    const params = z
      .object({ id: z.string().uuid(), period: z.coerce.number().int().positive() })
      .parse(request.params);
    const updated = await db
      .update(loanPayments)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(loanPayments.loanId, params.id),
          eq(loanPayments.period, params.period),
          isNull(loanPayments.deletedAt),
        ),
      )
      .returning({ id: loanPayments.id });
    return { ok: true, removed: updated.length };
  });

  // Record a rate review (variable / mixed loans get one each anniversary).
  // The schedule recomputes from this row on the next /loans/:id load — the
  // amortization engine reads `loan_rate_history` ordered by effective date.
  app.post('/loans/:id/rate-history', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = addLoanRateHistoryInputSchema.parse(request.body);

    const data = await loadLoanWithRates(params.id);
    if (!data) return reply.code(404).send({ error: 'Préstamo no encontrado' });

    const [inserted] = await db
      .insert(loanRateHistory)
      .values({
        id: uuidv7(),
        loanId: params.id,
        effectiveAt: body.effectiveAt,
        rate: body.rate,
        indexValueAtReview: body.indexValueAtReview ?? null,
        spread: data.loan.rateSpread,
        source: body.source,
        notes: body.notes ?? null,
      })
      .returning();

    if (!inserted) {
      return reply.code(500).send({ error: 'No se pudo registrar la revisión' });
    }
    return {
      effectiveAt: inserted.effectiveAt,
      rate: inserted.rate,
      source: inserted.source,
    };
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
