import {
  type Goal,
  type GoalEnriched,
  createGoalInputSchema,
  updateGoalInputSchema,
} from '@gp/shared';
import { Decimal } from 'decimal.js';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';
import { db } from '../db/index.js';
import { goals } from '../db/schema.js';

const DEFAULT_USER_ID = '01951b00-0000-7000-8000-000000000001';

function toGoal(g: typeof goals.$inferSelect): Goal {
  return {
    id: g.id,
    name: g.name,
    targetAmount: g.targetAmount,
    currency: g.currency,
    targetDate: g.targetDate,
    currentAmount: g.currentAmount,
    monthlyContributionTarget: g.monthlyContributionTarget,
    linkedAccountId: g.linkedAccountId,
    priority: g.priority,
    status: g.status,
    notes: g.notes,
  };
}

// "On track" rule: if target hits or beats the user-declared monthly
// contribution given current balance + remaining months. If no monthly
// contribution is set, fall back to comparing requiredMonthly to a 50 €
// floor — keeps the badge meaningful for vague goals without nagging.
function enrich(g: Goal, today: Date): GoalEnriched {
  const target = new Decimal(g.targetAmount);
  const current = new Decimal(g.currentAmount);
  const progressPct = target.greaterThan(0)
    ? Math.min(100, current.div(target).times(100).toNumber())
    : 0;

  let monthsToTarget: number | null = null;
  let requiredMonthly: string | null = null;
  let onTrack = true;

  if (g.targetDate) {
    const target_d = new Date(g.targetDate);
    const months =
      (target_d.getUTCFullYear() - today.getUTCFullYear()) * 12 +
      (target_d.getUTCMonth() - today.getUTCMonth());
    monthsToTarget = months;
    if (months > 0) {
      const remaining = target.minus(current);
      requiredMonthly = remaining.div(months).toFixed(2);
      const declared = g.monthlyContributionTarget
        ? new Decimal(g.monthlyContributionTarget)
        : null;
      if (declared) onTrack = declared.greaterThanOrEqualTo(requiredMonthly);
      else onTrack = new Decimal(requiredMonthly).lessThanOrEqualTo(50);
    } else if (months <= 0 && current.lessThan(target)) {
      onTrack = false;
    }
  }

  return { ...g, monthsToTarget, requiredMonthly, progressPct, onTrack };
}

export const goalsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/goals', async () => {
    const rows = await db
      .select()
      .from(goals)
      .where(and(eq(goals.userId, DEFAULT_USER_ID), isNull(goals.deletedAt)))
      .orderBy(asc(goals.priority), asc(goals.targetDate));
    const today = new Date();
    return rows.map((r) => enrich(toGoal(r), today));
  });

  app.post('/goals', async (request, reply) => {
    const body = createGoalInputSchema.parse(request.body);
    const id = uuidv7();
    const [inserted] = await db
      .insert(goals)
      .values({
        id,
        userId: DEFAULT_USER_ID,
        name: body.name,
        targetAmount: body.targetAmount,
        currency: body.currency,
        targetDate: body.targetDate ?? null,
        currentAmount: body.currentAmount,
        monthlyContributionTarget: body.monthlyContributionTarget ?? null,
        linkedAccountId: body.linkedAccountId ?? null,
        priority: body.priority,
        notes: body.notes ?? null,
      })
      .returning();
    if (!inserted) return reply.code(500).send({ error: 'No se pudo crear el objetivo' });
    return enrich(toGoal(inserted), new Date());
  });

  app.patch('/goals/:id', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = updateGoalInputSchema.parse(request.body);
    if (Object.keys(body).length === 0) {
      return reply.code(400).send({ error: 'Empty patch' });
    }
    const fields: Record<string, unknown> = { updatedAt: new Date() };
    if ('name' in body) fields.name = body.name;
    if ('targetAmount' in body) fields.targetAmount = body.targetAmount;
    if ('currency' in body) fields.currency = body.currency;
    if ('targetDate' in body) fields.targetDate = body.targetDate;
    if ('currentAmount' in body) fields.currentAmount = body.currentAmount;
    if ('monthlyContributionTarget' in body)
      fields.monthlyContributionTarget = body.monthlyContributionTarget;
    if ('linkedAccountId' in body) fields.linkedAccountId = body.linkedAccountId;
    if ('priority' in body) fields.priority = body.priority;
    if ('status' in body) fields.status = body.status;
    if ('notes' in body) fields.notes = body.notes;

    const [updated] = await db
      .update(goals)
      .set(fields)
      .where(
        and(eq(goals.id, params.id), eq(goals.userId, DEFAULT_USER_ID), isNull(goals.deletedAt)),
      )
      .returning();
    if (!updated) return reply.code(404).send({ error: 'Objetivo no encontrado' });
    return enrich(toGoal(updated), new Date());
  });

  app.delete('/goals/:id', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const updated = await db
      .update(goals)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(eq(goals.id, params.id), eq(goals.userId, DEFAULT_USER_ID), isNull(goals.deletedAt)),
      )
      .returning({ id: goals.id });
    if (updated.length === 0) return reply.code(404).send({ error: 'Objetivo no encontrado' });
    return { ok: true };
  });
};
