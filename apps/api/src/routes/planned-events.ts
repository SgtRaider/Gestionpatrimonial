import {
  type PlannedEvent,
  createPlannedEventInputSchema,
  updatePlannedEventInputSchema,
} from '@gp/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';
import { db } from '../db/index.js';
import { plannedEvents } from '../db/schema.js';

const DEFAULT_USER_ID = '01951b00-0000-7000-8000-000000000001';

function toPlannedEvent(e: typeof plannedEvents.$inferSelect): PlannedEvent {
  return {
    id: e.id,
    name: e.name,
    kind: e.kind,
    amount: e.amount,
    currency: e.currency,
    scheduledAt: e.scheduledAt,
    recurrenceFrequency: e.recurrenceFrequency,
    recurrenceUntil: e.recurrenceUntil,
    certainty: e.certainty,
    categoryId: e.categoryId,
    accountId: e.accountId,
    goalId: e.goalId,
    notes: e.notes,
    status: e.status,
  };
}

export const plannedEventsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/planned-events', async () => {
    const rows = await db
      .select()
      .from(plannedEvents)
      .where(and(eq(plannedEvents.userId, DEFAULT_USER_ID), isNull(plannedEvents.deletedAt)))
      .orderBy(asc(plannedEvents.scheduledAt));
    return rows.map(toPlannedEvent);
  });

  app.post('/planned-events', async (request, reply) => {
    const body = createPlannedEventInputSchema.parse(request.body);
    const id = uuidv7();
    const [inserted] = await db
      .insert(plannedEvents)
      .values({
        id,
        userId: DEFAULT_USER_ID,
        name: body.name,
        kind: body.kind,
        amount: body.amount,
        currency: body.currency,
        scheduledAt: body.scheduledAt,
        recurrenceFrequency: body.recurrenceFrequency ?? null,
        recurrenceUntil: body.recurrenceUntil ?? null,
        certainty: body.certainty,
        categoryId: body.categoryId ?? null,
        accountId: body.accountId ?? null,
        goalId: body.goalId ?? null,
        notes: body.notes ?? null,
      })
      .returning();
    if (!inserted) return reply.code(500).send({ error: 'No se pudo crear el evento' });
    return toPlannedEvent(inserted);
  });

  app.patch('/planned-events/:id', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = updatePlannedEventInputSchema.parse(request.body);
    if (Object.keys(body).length === 0) {
      return reply.code(400).send({ error: 'Empty patch' });
    }
    const fields: Record<string, unknown> = { updatedAt: new Date() };
    if ('name' in body) fields.name = body.name;
    if ('kind' in body) fields.kind = body.kind;
    if ('amount' in body) fields.amount = body.amount;
    if ('currency' in body) fields.currency = body.currency;
    if ('scheduledAt' in body) fields.scheduledAt = body.scheduledAt;
    if ('recurrenceFrequency' in body) fields.recurrenceFrequency = body.recurrenceFrequency;
    if ('recurrenceUntil' in body) fields.recurrenceUntil = body.recurrenceUntil;
    if ('certainty' in body) fields.certainty = body.certainty;
    if ('categoryId' in body) fields.categoryId = body.categoryId;
    if ('accountId' in body) fields.accountId = body.accountId;
    if ('goalId' in body) fields.goalId = body.goalId;
    if ('notes' in body) fields.notes = body.notes;
    if ('status' in body) fields.status = body.status;

    const [updated] = await db
      .update(plannedEvents)
      .set(fields)
      .where(
        and(
          eq(plannedEvents.id, params.id),
          eq(plannedEvents.userId, DEFAULT_USER_ID),
          isNull(plannedEvents.deletedAt),
        ),
      )
      .returning();
    if (!updated) return reply.code(404).send({ error: 'Evento no encontrado' });
    return toPlannedEvent(updated);
  });

  app.delete('/planned-events/:id', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const updated = await db
      .update(plannedEvents)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(plannedEvents.id, params.id),
          eq(plannedEvents.userId, DEFAULT_USER_ID),
          isNull(plannedEvents.deletedAt),
        ),
      )
      .returning({ id: plannedEvents.id });
    if (updated.length === 0) return reply.code(404).send({ error: 'Evento no encontrado' });
    return { ok: true };
  });
};
