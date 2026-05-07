import { createCategorizationRuleSchema, updateCategorizationRuleSchema } from '@gp/shared';
import { Decimal } from 'decimal.js';
import { and, asc, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';
import { db } from '../db/index.js';
import { accounts, categories, categorizationRules, transactions } from '../db/schema.js';

const DEFAULT_USER_ID = '01951b00-0000-7000-8000-000000000001';

export const categorizationRulesRoutes: FastifyPluginAsync = async (app) => {
  // List rules with denormalized category/account labels and a "hits" count
  // (transactions in this category whose description matches the pattern).
  // Sorted by priority desc so high-pri rules surface first.
  app.get('/categorization-rules', async () => {
    const hitCountExpr = sql<number>`(
      SELECT COUNT(*)::int FROM ${transactions}
      WHERE ${transactions.userId} = ${categorizationRules.userId}
        AND ${transactions.deletedAt} IS NULL
        AND ${transactions.descriptionRaw} ~* ${categorizationRules.patternRegex}
        AND ${transactions.categoryId} = ${categorizationRules.categoryId}
    )`;

    const rows = await db
      .select({
        id: categorizationRules.id,
        patternRegex: categorizationRules.patternRegex,
        categoryId: categorizationRules.categoryId,
        accountId: categorizationRules.accountId,
        amountMin: categorizationRules.amountMin,
        amountMax: categorizationRules.amountMax,
        priority: categorizationRules.priority,
        active: categorizationRules.active,
        categoryName: categories.name,
        categoryColor: categories.color,
        accountName: accounts.name,
        hits: hitCountExpr,
      })
      .from(categorizationRules)
      .leftJoin(categories, eq(categorizationRules.categoryId, categories.id))
      .leftJoin(accounts, eq(categorizationRules.accountId, accounts.id))
      .where(
        and(eq(categorizationRules.userId, DEFAULT_USER_ID), isNull(categorizationRules.deletedAt)),
      )
      .orderBy(desc(categorizationRules.priority), asc(categorizationRules.patternRegex));

    return rows.map((r) => ({
      ...r,
      categoryName: r.categoryName ?? '—',
      hits: Number(r.hits ?? 0),
    }));
  });

  app.patch('/categorization-rules/:id', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const patch = updateCategorizationRuleSchema.parse(request.body);
    const [updated] = await db
      .update(categorizationRules)
      .set({ ...patch, updatedAt: new Date() })
      .where(
        and(
          eq(categorizationRules.id, params.id),
          eq(categorizationRules.userId, DEFAULT_USER_ID),
          isNull(categorizationRules.deletedAt),
        ),
      )
      .returning({ id: categorizationRules.id });
    if (!updated) {
      return reply.code(404).send({ error: 'Regla no encontrada' });
    }
    return { id: updated.id, ok: true };
  });

  app.delete('/categorization-rules/:id', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const [deleted] = await db
      .update(categorizationRules)
      .set({ deletedAt: new Date(), active: false, updatedAt: new Date() })
      .where(
        and(
          eq(categorizationRules.id, params.id),
          eq(categorizationRules.userId, DEFAULT_USER_ID),
          isNull(categorizationRules.deletedAt),
        ),
      )
      .returning({ id: categorizationRules.id });
    if (!deleted) {
      return reply.code(404).send({ error: 'Regla no encontrada' });
    }
    return { id: deleted.id, ok: true };
  });

  app.post('/categorization-rules', async (request, reply) => {
    const body = createCategorizationRuleSchema.parse(request.body);

    const id = uuidv7();
    const [created] = await db
      .insert(categorizationRules)
      .values({
        id,
        userId: DEFAULT_USER_ID,
        priority: body.priority ?? 0,
        patternRegex: body.patternRegex,
        accountId: body.accountId ?? null,
        amountMin: body.amountMin ?? null,
        amountMax: body.amountMax ?? null,
        categoryId: body.categoryId,
        suggestedFromTransactionId: body.suggestedFromTransactionId ?? null,
        active: true,
      })
      .returning({
        id: categorizationRules.id,
        patternRegex: categorizationRules.patternRegex,
        categoryId: categorizationRules.categoryId,
        accountId: categorizationRules.accountId,
        amountMin: categorizationRules.amountMin,
        amountMax: categorizationRules.amountMax,
        priority: categorizationRules.priority,
        active: categorizationRules.active,
      });

    if (!created) {
      return reply.code(500).send({ error: 'Failed to create rule' });
    }

    let appliedToCount = 0;
    if (body.applyToExisting) {
      // Apply to uncategorized transactions matching the regex
      // (and optional account/amount constraints).
      const matchConditions = [
        eq(transactions.userId, DEFAULT_USER_ID),
        isNull(transactions.categoryId),
        isNull(transactions.deletedAt),
        sql`${transactions.descriptionRaw} ~* ${body.patternRegex}`,
      ];
      if (body.accountId) matchConditions.push(eq(transactions.accountId, body.accountId));
      if (body.amountMin) matchConditions.push(gte(transactions.amount, body.amountMin));
      if (body.amountMax) matchConditions.push(lte(transactions.amount, body.amountMax));

      const result = await db
        .update(transactions)
        .set({ categoryId: body.categoryId, updatedAt: new Date() })
        .where(and(...matchConditions))
        .returning({ id: transactions.id });

      appliedToCount = result.length;
    }

    return {
      rule: {
        ...created,
        amountMin: created.amountMin,
        amountMax: created.amountMax,
      },
      appliedToCount,
    };
  });
};

// Helper exposed for callers that need to suggest a regex from a description.
export function suggestPatternFromDescription(description: string): string {
  // Strip leading/trailing whitespace, drop trailing reference numbers/dates,
  // collapse multiple spaces. Returned as a case-insensitive substring regex.
  const stripped = description
    .replace(/\d{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const firstWord = stripped.split(/\s+/)[0];
  return firstWord && firstWord.length >= 3 ? firstWord : stripped;
}
