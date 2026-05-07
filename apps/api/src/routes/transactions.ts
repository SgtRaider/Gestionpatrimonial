import { transactionListQuerySchema } from '@gp/shared';
import { Decimal } from 'decimal.js';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  accountsFixture,
  categoriesFixture,
  getTransactionsFixture,
  institutionsFixture,
} from '../fixtures/transactions.js';

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
    const filters = {
      ...parsed,
      accountIds: asArray(parsed.accountIds),
      categoryIds: asArray(parsed.categoryIds),
    };
    transactionListQuerySchema.partial().parse(filters);

    let all = getTransactionsFixture();

    const fromDate = filters.from;
    if (fromDate) {
      all = all.filter((t) => t.bookedAt.slice(0, 10) >= fromDate);
    }
    const toDate = filters.to;
    if (toDate) {
      all = all.filter((t) => t.bookedAt.slice(0, 10) <= toDate);
    }
    if (filters.accountIds && filters.accountIds.length > 0) {
      all = all.filter((t) => filters.accountIds?.includes(t.accountId));
    }
    if (filters.categoryIds && filters.categoryIds.length > 0) {
      all = all.filter((t) => t.categoryId && filters.categoryIds?.includes(t.categoryId));
    }
    if (filters.status) {
      all = all.filter((t) => t.status === filters.status);
    }
    if (filters.uncategorized) {
      all = all.filter((t) => t.categoryId === null);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      all = all.filter(
        (t) =>
          t.descriptionRaw.toLowerCase().includes(q) ||
          (t.counterparty?.toLowerCase().includes(q) ?? false) ||
          (t.normalizedMerchant?.toLowerCase().includes(q) ?? false) ||
          (t.notes?.toLowerCase().includes(q) ?? false) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }

    const summaryRows = all.filter((t) => t.transferPairId === null);
    const income = summaryRows
      .filter((t) => new Decimal(t.amount).isPositive())
      .reduce((acc, t) => acc.plus(t.amount), new Decimal(0));
    const expenses = summaryRows
      .filter((t) => new Decimal(t.amount).isNegative())
      .reduce((acc, t) => acc.plus(t.amount), new Decimal(0));

    const total = all.length;
    const start = (filters.page - 1) * filters.pageSize;
    const items = all.slice(start, start + filters.pageSize);

    return {
      items,
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      summary: {
        income: income.toFixed(2),
        expenses: expenses.toFixed(2),
        net: income.plus(expenses).toFixed(2),
        count: total,
      },
    };
  });

  app.get('/accounts', async () =>
    accountsFixture.map((a) => {
      const ins = institutionsFixture.find((i) => i.id === a.institutionId);
      if (!ins)
        throw new Error(`Account ${a.id} references unknown institution ${a.institutionId}`);
      return {
        ...a,
        institution: {
          id: ins.id,
          name: ins.name,
          type: ins.type,
          color: ins.color,
          country: ins.country,
        },
      };
    }),
  );

  app.get('/categories', async () => categoriesFixture);
};
