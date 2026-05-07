import {
  type TransactionListItem,
  bulkCategorizeInputSchema,
  transactionPatchSchema,
} from '@gp/shared';
import { Decimal } from 'decimal.js';
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { accounts, categories, institutions, transactionTags, transactions } from '../db/schema.js';

// Single-user mode for now. Later derived from JWT.
const DEFAULT_USER_ID = '01951b00-0000-7000-8000-000000000001';

const queryStringSchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  accountIds: z.union([z.string(), z.array(z.string())]).optional(),
  categoryIds: z.union([z.string(), z.array(z.string())]).optional(),
  status: z.enum(['booked', 'pending']).optional(),
  uncategorized: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

function asArray(v: string | string[] | undefined): string[] | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v : [v];
}

export const transactionsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/transactions', async (request) => {
    const parsed = queryStringSchema.parse(request.query);
    const accountIds = asArray(parsed.accountIds);
    const categoryIds = asArray(parsed.categoryIds);

    const conditions = [eq(transactions.userId, DEFAULT_USER_ID), isNull(transactions.deletedAt)];
    if (parsed.from)
      conditions.push(gte(transactions.bookedAt, new Date(`${parsed.from}T00:00:00Z`)));
    if (parsed.to) conditions.push(lte(transactions.bookedAt, new Date(`${parsed.to}T23:59:59Z`)));
    if (accountIds && accountIds.length > 0)
      conditions.push(inArray(transactions.accountId, accountIds));
    if (categoryIds && categoryIds.length > 0)
      conditions.push(inArray(transactions.categoryId, categoryIds));
    if (parsed.status) conditions.push(eq(transactions.status, parsed.status));
    if (parsed.uncategorized) conditions.push(isNull(transactions.categoryId));
    if (parsed.search) {
      const pattern = `%${parsed.search}%`;
      const searchClause = or(
        ilike(transactions.descriptionRaw, pattern),
        ilike(transactions.counterparty, pattern),
        ilike(transactions.normalizedMerchant, pattern),
        ilike(transactions.notes, pattern),
      );
      if (searchClause) conditions.push(searchClause);
    }
    const where = and(...conditions);

    const offset = (parsed.page - 1) * parsed.pageSize;

    // Pull rows with joins (account+institution+category nested) and tags aggregated.
    const rows = await db
      .select({
        id: transactions.id,
        accountId: transactions.accountId,
        bookedAt: transactions.bookedAt,
        valueAt: transactions.valueAt,
        amount: transactions.amount,
        currency: transactions.currency,
        amountBaseCurrency: transactions.amountBaseCurrency,
        descriptionRaw: transactions.descriptionRaw,
        counterparty: transactions.counterparty,
        normalizedMerchant: transactions.normalizedMerchant,
        merchantAliasUser: transactions.merchantAliasUser,
        categoryId: transactions.categoryId,
        status: transactions.status,
        source: transactions.source,
        transferPairId: transactions.transferPairId,
        parentTransactionId: transactions.parentTransactionId,
        recurringRuleId: transactions.recurringRuleId,
        notes: transactions.notes,
        isProjection: transactions.isProjection,
        accountName: accounts.name,
        accountIbanLast4: accounts.ibanLast4,
        institutionName: institutions.name,
        institutionColor: institutions.color,
        catId: categories.id,
        catParentId: categories.parentId,
        catName: categories.name,
        catKind: categories.kind,
        catColor: categories.color,
        catIconKey: categories.iconKey,
        tags: sql<
          string[]
        >`COALESCE(array_agg(DISTINCT ${transactionTags.tag}) FILTER (WHERE ${transactionTags.tag} IS NOT NULL), '{}')`,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .innerJoin(institutions, eq(accounts.institutionId, institutions.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(transactionTags, eq(transactionTags.transactionId, transactions.id))
      .where(where)
      .groupBy(transactions.id, accounts.id, institutions.id, categories.id)
      .orderBy(desc(transactions.bookedAt), asc(transactions.id))
      .limit(parsed.pageSize)
      .offset(offset);

    const items: TransactionListItem[] = rows.map((r) => ({
      id: r.id,
      accountId: r.accountId,
      bookedAt: r.bookedAt.toISOString(),
      valueAt: r.valueAt ? r.valueAt.toISOString() : null,
      amount: r.amount,
      currency: r.currency,
      amountBaseCurrency: r.amountBaseCurrency,
      descriptionRaw: r.descriptionRaw,
      counterparty: r.counterparty,
      normalizedMerchant: r.normalizedMerchant,
      merchantAliasUser: r.merchantAliasUser,
      categoryId: r.categoryId,
      status: r.status,
      source: r.source,
      transferPairId: r.transferPairId,
      parentTransactionId: r.parentTransactionId,
      recurringRuleId: r.recurringRuleId,
      notes: r.notes,
      isProjection: r.isProjection,
      accountName: r.accountName,
      accountIbanLast4: r.accountIbanLast4,
      institutionName: r.institutionName,
      institutionColor: r.institutionColor,
      category:
        r.catId && r.catName && r.catKind
          ? {
              id: r.catId,
              parentId: r.catParentId,
              name: r.catName,
              kind: r.catKind,
              color: r.catColor,
              iconKey: r.catIconKey,
            }
          : null,
      tags: r.tags,
    }));

    // Total count (separate query — cheaper than counting joined rows).
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(where);
    const total = countRow?.count ?? 0;

    // Summary (excludes transfer pairs from income/expenses).
    const summaryWhere = and(...conditions, isNull(transactions.transferPairId));
    const [summaryRow] = await db
      .select({
        income: sql<string>`COALESCE(SUM(${transactions.amount}) FILTER (WHERE ${transactions.amount} > 0), 0)::text`,
        expenses: sql<string>`COALESCE(SUM(${transactions.amount}) FILTER (WHERE ${transactions.amount} < 0), 0)::text`,
      })
      .from(transactions)
      .where(summaryWhere);
    const income = new Decimal(summaryRow?.income ?? '0');
    const expenses = new Decimal(summaryRow?.expenses ?? '0');

    return {
      items,
      total,
      page: parsed.page,
      pageSize: parsed.pageSize,
      summary: {
        income: income.toFixed(2),
        expenses: expenses.toFixed(2),
        net: income.plus(expenses).toFixed(2),
        count: total,
      },
    };
  });

  app.get('/accounts', async () => {
    const rows = await db
      .select({
        id: accounts.id,
        institutionId: accounts.institutionId,
        name: accounts.name,
        type: accounts.type,
        currency: accounts.currency,
        ibanLast4: accounts.ibanLast4,
        isActive: accounts.isActive,
        institutionName: institutions.name,
        institutionType: institutions.type,
        institutionColor: institutions.color,
        institutionCountry: institutions.country,
      })
      .from(accounts)
      .innerJoin(institutions, eq(accounts.institutionId, institutions.id))
      .where(
        and(
          eq(accounts.userId, DEFAULT_USER_ID),
          eq(accounts.isActive, true),
          isNull(accounts.deletedAt),
        ),
      )
      .orderBy(asc(institutions.name), asc(accounts.name));

    return rows.map((r) => ({
      id: r.id,
      institutionId: r.institutionId,
      name: r.name,
      type: r.type,
      currency: r.currency,
      ibanLast4: r.ibanLast4,
      isActive: r.isActive,
      institution: {
        id: r.institutionId,
        name: r.institutionName,
        type: r.institutionType,
        color: r.institutionColor,
        country: r.institutionCountry,
      },
    }));
  });

  app.patch('/transactions/:id', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = transactionPatchSchema.parse(request.body);

    if (Object.keys(body).length === 0) {
      return reply.code(400).send({ error: 'Empty patch' });
    }

    const updateFields: Record<string, unknown> = { updatedAt: new Date() };
    if ('categoryId' in body) updateFields.categoryId = body.categoryId;
    if ('notes' in body) updateFields.notes = body.notes;
    if ('merchantAliasUser' in body) updateFields.merchantAliasUser = body.merchantAliasUser;

    const updated = await db
      .update(transactions)
      .set(updateFields)
      .where(
        and(
          eq(transactions.id, params.id),
          eq(transactions.userId, DEFAULT_USER_ID),
          isNull(transactions.deletedAt),
        ),
      )
      .returning({ id: transactions.id });

    if (updated.length === 0) {
      return reply.code(404).send({ error: 'Transaction not found' });
    }

    // Replace tags wholesale if provided.
    if (body.tags) {
      await db.delete(transactionTags).where(eq(transactionTags.transactionId, params.id));
      if (body.tags.length > 0) {
        await db
          .insert(transactionTags)
          .values(body.tags.map((tag) => ({ transactionId: params.id, tag })));
      }
    }

    return { id: params.id, ok: true };
  });

  app.post('/transactions/bulk-categorize', async (request) => {
    const body = bulkCategorizeInputSchema.parse(request.body);
    const updated = await db
      .update(transactions)
      .set({ categoryId: body.categoryId, updatedAt: new Date() })
      .where(
        and(
          inArray(transactions.id, body.ids),
          eq(transactions.userId, DEFAULT_USER_ID),
          isNull(transactions.deletedAt),
        ),
      )
      .returning({ id: transactions.id });
    return { updated: updated.length };
  });

  app.get('/categories', async () => {
    const rows = await db
      .select({
        id: categories.id,
        parentId: categories.parentId,
        name: categories.name,
        kind: categories.kind,
        color: categories.color,
        iconKey: categories.iconKey,
      })
      .from(categories)
      .where(and(eq(categories.userId, DEFAULT_USER_ID), isNull(categories.deletedAt)))
      .orderBy(asc(categories.name));

    return rows;
  });
};
