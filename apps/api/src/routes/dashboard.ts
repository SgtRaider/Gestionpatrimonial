import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { insights } from '../db/schema.js';
import { buildDashboard } from '../services/dashboard.js';

const DEFAULT_USER_ID = '01951b00-0000-7000-8000-000000000001';

const querySchema = z.object({
  period: z.enum(['month', 'quarter', 'halfyear', 'year']).default('month'),
});

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/dashboard', async (request) => {
    const { period } = querySchema.parse(request.query);
    return buildDashboard(DEFAULT_USER_ID, period);
  });

  // Tag an insight as dismissed (user said "not interested") or acted on
  // (user followed through). The detector skips signatures that already have
  // either timestamp set, so the insight won't resurface on the next refresh.
  app.post('/insights/:id/dismiss', async (request, reply) => {
    return tagInsight(request, reply, 'dismissed');
  });

  app.post('/insights/:id/act', async (request, reply) => {
    return tagInsight(request, reply, 'acted');
  });
};

async function tagInsight(
  request: { params: unknown },
  reply: { code: (n: number) => { send: (body: unknown) => unknown } },
  field: 'dismissed' | 'acted',
) {
  const params = z.object({ id: z.string().uuid() }).parse(request.params);
  const updateField = field === 'dismissed' ? { dismissedAt: new Date() } : { actedAt: new Date() };
  const updated = await db
    .update(insights)
    .set({ ...updateField, updatedAt: new Date() })
    .where(
      and(
        eq(insights.id, params.id),
        eq(insights.userId, DEFAULT_USER_ID),
        isNull(insights.dismissedAt),
        isNull(insights.actedAt),
      ),
    )
    .returning({ id: insights.id });
  if (updated.length === 0) {
    return reply.code(404).send({ error: 'Insight no encontrado o ya procesado' });
  }
  return { id: params.id, ok: true };
}
