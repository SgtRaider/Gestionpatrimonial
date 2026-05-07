import {
  type MarkRecurringResponse,
  type RecurringRule,
  type UnlinkRecurringResponse,
  markRecurringInputSchema,
  unlinkRecurringInputSchema,
} from '@gp/shared';
import { Decimal } from 'decimal.js';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';
import { db } from '../db/index.js';
import { recurringRules, transactions } from '../db/schema.js';

const DEFAULT_USER_ID = '01951b00-0000-7000-8000-000000000001';

function toRecurringRule(r: typeof recurringRules.$inferSelect): RecurringRule {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    frequency: r.frequency,
    expectedAmount: r.expectedAmount,
    currency: r.currency,
    status: r.status,
    detectedAutomatically: r.detectedAutomatically,
    categoryId: r.categoryId,
    accountId: r.accountId,
    nextExpectedAt: r.nextExpectedAt ?? null,
    notes: r.notes,
  };
}

export const recurringRoutes: FastifyPluginAsync = async (app) => {
  // Create a recurring rule from one or several existing transactions and link
  // them to the new rule. The expectedAmount, currency, accountId and
  // categoryId are inferred from the selected transactions when possible.
  app.post('/recurring-rules', async (request, reply) => {
    const body = markRecurringInputSchema.parse(request.body);

    const txs = await db
      .select({
        id: transactions.id,
        amount: transactions.amount,
        currency: transactions.currency,
        accountId: transactions.accountId,
        categoryId: transactions.categoryId,
        bookedAt: transactions.bookedAt,
      })
      .from(transactions)
      .where(
        and(
          inArray(transactions.id, body.transactionIds),
          eq(transactions.userId, DEFAULT_USER_ID),
          isNull(transactions.deletedAt),
        ),
      );

    if (txs.length === 0) {
      return reply.code(404).send({ error: 'Ningún movimiento encontrado' });
    }

    const currencies = new Set(txs.map((t) => t.currency));
    if (currencies.size > 1) {
      return reply.code(400).send({ error: 'Las divisas no coinciden entre movimientos' });
    }
    const currency = txs[0]?.currency ?? 'EUR';

    const accountIds = new Set(txs.map((t) => t.accountId));
    const accountId = accountIds.size === 1 ? (txs[0]?.accountId ?? null) : null;

    const categoryIds = new Set(txs.map((t) => t.categoryId).filter((c): c is string => !!c));
    const categoryId = categoryIds.size === 1 ? (Array.from(categoryIds)[0] ?? null) : null;

    let expectedAmount: string;
    if (body.expectedAmount) {
      expectedAmount = body.expectedAmount;
    } else {
      const sum = txs.reduce((acc, t) => acc.plus(new Decimal(t.amount)), new Decimal(0));
      expectedAmount = sum.div(txs.length).toFixed(2);
    }

    const lastBooked = txs.reduce(
      (acc, t) => (t.bookedAt > acc ? t.bookedAt : acc),
      txs[0]?.bookedAt ?? new Date(),
    );
    const nextExpectedAt = computeNextExpectedAt(lastBooked, body.frequency);

    const ruleId = uuidv7();
    const [rule] = await db
      .insert(recurringRules)
      .values({
        id: ruleId,
        userId: DEFAULT_USER_ID,
        name: body.name,
        kind: body.kind,
        frequency: body.frequency,
        expectedAmount,
        currency,
        accountId,
        categoryId,
        status: 'active',
        detectedAutomatically: false,
        nextExpectedAt,
        notes: body.notes ?? null,
      })
      .returning();

    if (!rule) {
      return reply.code(500).send({ error: 'No se pudo crear la regla' });
    }

    const linked = await db
      .update(transactions)
      .set({ recurringRuleId: ruleId, updatedAt: new Date() })
      .where(
        and(
          inArray(
            transactions.id,
            txs.map((t) => t.id),
          ),
          eq(transactions.userId, DEFAULT_USER_ID),
        ),
      )
      .returning({ id: transactions.id });

    const response: MarkRecurringResponse = {
      rule: toRecurringRule(rule),
      linkedCount: linked.length,
    };
    return response;
  });

  // Unlink one or several transactions from their recurring rule. If a rule
  // ends up with zero linked transactions, the rule itself is soft-deleted.
  app.post('/recurring-rules/unlink', async (request) => {
    const body = unlinkRecurringInputSchema.parse(request.body);

    const affected = await db
      .select({ ruleId: transactions.recurringRuleId })
      .from(transactions)
      .where(
        and(
          inArray(transactions.id, body.transactionIds),
          eq(transactions.userId, DEFAULT_USER_ID),
          isNull(transactions.deletedAt),
        ),
      );

    const unlinked = await db
      .update(transactions)
      .set({ recurringRuleId: null, updatedAt: new Date() })
      .where(
        and(
          inArray(transactions.id, body.transactionIds),
          eq(transactions.userId, DEFAULT_USER_ID),
        ),
      )
      .returning({ id: transactions.id });

    // For each affected rule, soft-delete it if no transactions remain linked.
    const ruleIds = Array.from(
      new Set(affected.map((a) => a.ruleId).filter((r): r is string => !!r)),
    );
    let rulesDeleted = 0;
    for (const ruleId of ruleIds) {
      const [{ count } = { count: 0 }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(transactions)
        .where(and(eq(transactions.recurringRuleId, ruleId), isNull(transactions.deletedAt)));
      if (count === 0) {
        await db
          .update(recurringRules)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(eq(recurringRules.id, ruleId));
        rulesDeleted += 1;
      }
    }

    const response: UnlinkRecurringResponse = {
      unlinkedCount: unlinked.length,
      rulesDeleted,
    };
    return response;
  });

  // List rules (used by future "Pagos recurrentes" view; for now mostly for
  // verification and the detail panel to render the rule's name).
  app.get('/recurring-rules', async () => {
    const rows = await db
      .select()
      .from(recurringRules)
      .where(and(eq(recurringRules.userId, DEFAULT_USER_ID), isNull(recurringRules.deletedAt)))
      .orderBy(recurringRules.name);
    return rows.map(toRecurringRule);
  });

  app.get('/recurring-rules/:id', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const [row] = await db
      .select()
      .from(recurringRules)
      .where(
        and(
          eq(recurringRules.id, params.id),
          eq(recurringRules.userId, DEFAULT_USER_ID),
          isNull(recurringRules.deletedAt),
        ),
      );
    if (!row) return reply.code(404).send({ error: 'Regla no encontrada' });
    return toRecurringRule(row);
  });
};

function computeNextExpectedAt(
  lastBooked: Date,
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'biannual' | 'yearly' | 'custom',
): string | null {
  const d = new Date(lastBooked);
  switch (frequency) {
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case 'monthly':
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case 'quarterly':
      d.setUTCMonth(d.getUTCMonth() + 3);
      break;
    case 'biannual':
      d.setUTCMonth(d.getUTCMonth() + 6);
      break;
    case 'yearly':
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
    default:
      return null;
  }
  return d.toISOString().slice(0, 10);
}
