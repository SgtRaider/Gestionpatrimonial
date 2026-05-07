import {
  type AccountWithInstitution,
  type BulkCategorizeInput,
  type BulkCategorizeResponse,
  type Category,
  type CreateCategorizationRuleInput,
  type CreateCategorizationRuleResponse,
  type Dashboard,
  type DeleteRecurringRuleResponse,
  type ImportCommitResponse,
  type ImportMapping,
  type ImportPreviewResponse,
  type LoanDetail,
  type LoanSummary,
  type MarkRecurringInput,
  type MarkRecurringResponse,
  type PrepaymentSimulationInput,
  type PrepaymentSimulationResponse,
  type RecurringRule,
  type RecurringRulesListResponse,
  type TransactionListResponse,
  type TransactionPatch,
  type UnlinkRecurringInput,
  type UnlinkRecurringResponse,
  type UpdateRecurringRuleInput,
  accountWithInstitutionSchema,
  bulkCategorizeResponseSchema,
  categorySchema,
  createCategorizationRuleResponseSchema,
  dashboardSchema,
  deleteRecurringRuleResponseSchema,
  importCommitResponseSchema,
  importPreviewResponseSchema,
  loanDetailSchema,
  loanSummarySchema,
  markRecurringResponseSchema,
  prepaymentSimulationResponseSchema,
  recurringRuleSchema,
  recurringRulesListResponseSchema,
  transactionListResponseSchema,
  unlinkRecurringResponseSchema,
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

async function send<T>(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body: unknown,
  parser: (raw: unknown) => T,
): Promise<T> {
  const init: RequestInit = {
    method,
    headers: { 'content-type': 'application/json' },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${path} ${method} returned ${res.status}: ${text}`);
  }
  const json: unknown = await res.json();
  return parser(json);
}

const patchTransactionResponseSchema = z.object({ id: z.string().uuid(), ok: z.boolean() });

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

  getLoans: (): Promise<LoanSummary[]> =>
    get('/api/loans', (raw) => z.array(loanSummarySchema).parse(raw)),

  getLoan: (id: string): Promise<LoanDetail> =>
    get(`/api/loans/${id}`, (raw) => loanDetailSchema.parse(raw)),

  simulatePrepayment: (
    loanId: string,
    input: PrepaymentSimulationInput,
  ): Promise<PrepaymentSimulationResponse> =>
    send('POST', `/api/loans/${loanId}/simulate-prepayment`, input, (raw) =>
      prepaymentSimulationResponseSchema.parse(raw),
    ),

  patchTransaction: (id: string, patch: TransactionPatch) =>
    send('PATCH', `/api/transactions/${id}`, patch, (raw) =>
      patchTransactionResponseSchema.parse(raw),
    ),

  bulkCategorize: (input: BulkCategorizeInput): Promise<BulkCategorizeResponse> =>
    send('POST', '/api/transactions/bulk-categorize', input, (raw) =>
      bulkCategorizeResponseSchema.parse(raw),
    ),

  createCategorizationRule: (
    input: CreateCategorizationRuleInput,
  ): Promise<CreateCategorizationRuleResponse> =>
    send('POST', '/api/categorization-rules', input, (raw) =>
      createCategorizationRuleResponseSchema.parse(raw),
    ),

  markRecurring: (input: MarkRecurringInput): Promise<MarkRecurringResponse> =>
    send('POST', '/api/recurring-rules', input, (raw) => markRecurringResponseSchema.parse(raw)),

  unlinkRecurring: (input: UnlinkRecurringInput): Promise<UnlinkRecurringResponse> =>
    send('POST', '/api/recurring-rules/unlink', input, (raw) =>
      unlinkRecurringResponseSchema.parse(raw),
    ),

  getRecurringRules: (): Promise<RecurringRulesListResponse> =>
    get('/api/recurring-rules', (raw) => recurringRulesListResponseSchema.parse(raw)),

  deleteRecurringRule: (id: string): Promise<DeleteRecurringRuleResponse> =>
    send('DELETE', `/api/recurring-rules/${id}`, undefined, (raw) =>
      deleteRecurringRuleResponseSchema.parse(raw),
    ),

  updateRecurringRule: (id: string, patch: UpdateRecurringRuleInput): Promise<RecurringRule> =>
    send('PATCH', `/api/recurring-rules/${id}`, patch, (raw) => recurringRuleSchema.parse(raw)),

  importTransactionsPreview: async (args: {
    file: File;
    accountId: string;
    mapping?: ImportMapping;
  }): Promise<ImportPreviewResponse> => {
    const fd = new FormData();
    fd.append('file', args.file);
    fd.append('accountId', args.accountId);
    if (args.mapping) fd.append('mapping', JSON.stringify(args.mapping));
    const res = await fetch(`${API_URL}/api/imports/transactions/preview`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Import preview failed (${res.status}): ${text}`);
    }
    const json: unknown = await res.json();
    return importPreviewResponseSchema.parse(json);
  },

  importTransactionsCommit: async (args: {
    file: File;
    accountId: string;
    mapping?: ImportMapping;
  }): Promise<ImportCommitResponse> => {
    const fd = new FormData();
    fd.append('file', args.file);
    fd.append('accountId', args.accountId);
    if (args.mapping) fd.append('mapping', JSON.stringify(args.mapping));
    const res = await fetch(`${API_URL}/api/imports/transactions/commit`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Import commit failed (${res.status}): ${text}`);
    }
    const json: unknown = await res.json();
    return importCommitResponseSchema.parse(json);
  },
};
