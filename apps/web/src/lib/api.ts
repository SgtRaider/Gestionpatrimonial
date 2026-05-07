import {
  type AccountWithInstitution,
  type Category,
  type Dashboard,
  type TransactionListResponse,
  accountWithInstitutionSchema,
  categorySchema,
  dashboardSchema,
  transactionListResponseSchema,
} from '@gp/shared';
import { z } from 'zod';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

async function get<T>(path: string, parser: (raw: unknown) => T): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`API ${path} returned ${res.status}`);
  }
  const json: unknown = await res.json();
  return parser(json);
}

function buildQuery(params: Record<string, string | string[] | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    if (Array.isArray(value)) {
      for (const v of value) sp.append(key, v);
    } else {
      sp.set(key, value);
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export type TransactionsQuery = {
  from?: string;
  to?: string;
  accountIds?: string[];
  categoryIds?: string[];
  status?: 'booked' | 'pending';
  uncategorized?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
};

export const api = {
  getDashboard: (): Promise<Dashboard> =>
    get('/api/dashboard', (raw) => dashboardSchema.parse(raw)),

  getTransactions: (q: TransactionsQuery): Promise<TransactionListResponse> => {
    const qs = buildQuery({
      from: q.from,
      to: q.to,
      accountIds: q.accountIds,
      categoryIds: q.categoryIds,
      status: q.status,
      uncategorized: q.uncategorized ? '1' : undefined,
      search: q.search,
      page: q.page?.toString(),
      pageSize: q.pageSize?.toString(),
    });
    return get(`/api/transactions${qs}`, (raw) => transactionListResponseSchema.parse(raw));
  },

  getAccounts: (): Promise<AccountWithInstitution[]> =>
    get('/api/accounts', (raw) => z.array(accountWithInstitutionSchema).parse(raw)),

  getCategories: (): Promise<Category[]> =>
    get('/api/categories', (raw) => z.array(categorySchema).parse(raw)),
};
