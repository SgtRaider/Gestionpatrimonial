import { createCategorizationRuleSchema } from '@gp/shared';
import { Decimal } from 'decimal.js';
import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { v7 as uuidv7 } from 'uuid';
import { db } from '../db/index.js';
import { categorizationRules, transactions } from '../db/schema.js';

const DEFAULT_USER_ID = '01951b00-0000-7000-8000-000000000001';

export const categorizationRulesRoutes: FastifyPluginAsync = async (app) => {
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
