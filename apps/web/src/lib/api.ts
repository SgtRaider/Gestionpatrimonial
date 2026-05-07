import {
  type AccountWithInstitution,
  type AddLoanRateHistoryInput,
  type BulkCategorizeInput,
  type BulkCategorizeResponse,
  type CategorizationQueueResponse,
  type CategorizationRuleEnriched,
  type Category,
  type CreateCategorizationRuleInput,
  type CreateCategorizationRuleResponse,
  type CreateGoalInput,
  type CreateHoldingInput,
  type CreateLoanInput,
  type CreatePlannedEventInput,
  type Dashboard,
  type DashboardPeriod,
  type DeleteRecurringRuleResponse,
  type GoalEnriched,
  type Holding,
  type HoldingDetail,
  type ImportCommitResponse,
  type ImportMapping,
  type ImportPreviewResponse,
  type InsightsListResponse,
  type LoanDetail,
  type LoanSummary,
  type MarkRecurringInput,
  type MarkRecurringResponse,
  type NetWorthBreakdown,
  type NetWorthSnapshot,
  type PlannedEvent,
  type PrepaymentSimulationInput,
  type PrepaymentSimulationResponse,
  type RecordHoldingTxInput,
  type RecordValuationInput,
  type RecurringRule,
  type RecurringRulesListResponse,
  type TransactionListResponse,
  type TransactionPatch,
  type UnlinkRecurringInput,
  type UnlinkRecurringResponse,
  type UpdateCategorizationRuleInput,
  type UpdateGoalInput,
  type UpdateLoanInput,
  type UpdatePlannedEventInput,
  type UpdateRecurringRuleInput,
  type UpdateUserSettingsInput,
  type UserSettings,
  accountWithInstitutionSchema,
  bulkCategorizeResponseSchema,
  categorizationQueueResponseSchema,
  categorizationRuleEnrichedSchema,
  categorySchema,
  createCategorizationRuleResponseSchema,
  dashboardSchema,
  deleteRecurringRuleResponseSchema,
  goalEnrichedSchema,
  holdingDetailSchema,
  holdingSchema,
  importCommitResponseSchema,
  importPreviewResponseSchema,
  insightsListResponseSchema,
  loanDetailSchema,
  loanSummarySchema,
  markRecurringResponseSchema,
  netWorthBreakdownSchema,
  netWorthSnapshotSchema,
  plannedEventSchema,
  prepaymentSimulationResponseSchema,
  recurringRuleSchema,
  recurringRulesListResponseSchema,
  transactionListResponseSchema,
  unlinkRecurringResponseSchema,
  userSettingsSchema,
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
  // Only attach content-type when we actually send a body — Fastify rejects
  // empty bodies declared as application/json with FST_ERR_CTP_EMPTY_JSON_BODY.
  const init: RequestInit =
    body === undefined
      ? { method }
      : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
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
  getDashboard: (period: DashboardPeriod = 'month'): Promise<Dashboard> =>
    get(`/api/dashboard?period=${period}`, (raw) => dashboardSchema.parse(raw)),

  getNetWorth: (): Promise<NetWorthBreakdown> =>
    get('/api/net-worth', (raw) => netWorthBreakdownSchema.parse(raw)),

  getNetWorthSnapshots: (): Promise<NetWorthSnapshot[]> =>
    get('/api/net-worth/snapshots', (raw) => z.array(netWorthSnapshotSchema).parse(raw)),

  createNetWorthSnapshot: (): Promise<NetWorthSnapshot> =>
    send('POST', '/api/net-worth/snapshots', undefined, (raw) => netWorthSnapshotSchema.parse(raw)),

  detectTransfers: (): Promise<{ paired: number }> =>
    send('POST', '/api/transfers/detect', undefined, (raw) =>
      z.object({ paired: z.number().int().nonnegative() }).parse(raw),
    ),

  getSettings: (): Promise<UserSettings> =>
    get('/api/settings', (raw) => userSettingsSchema.parse(raw)),

  updateSettings: (input: UpdateUserSettingsInput): Promise<UserSettings> =>
    send('PATCH', '/api/settings', input, (raw) => userSettingsSchema.parse(raw)),

  getHoldings: (): Promise<Holding[]> =>
    get('/api/holdings', (raw) => z.array(holdingSchema).parse(raw)),

  getHoldingDetail: (id: string): Promise<HoldingDetail> =>
    get(`/api/holdings/${id}`, (raw) => holdingDetailSchema.parse(raw)),

  createHolding: (input: CreateHoldingInput): Promise<Holding> =>
    send('POST', '/api/holdings', input, (raw) => holdingSchema.parse(raw)),

  recordHoldingValuation: (
    holdingId: string,
    input: RecordValuationInput,
  ): Promise<{ ok: boolean; totalValue: string }> =>
    send('POST', `/api/holdings/${holdingId}/valuations`, input, (raw) =>
      z.object({ ok: z.boolean(), totalValue: z.string() }).parse(raw),
    ),

  recordHoldingTransaction: (
    holdingId: string,
    input: RecordHoldingTxInput,
  ): Promise<{ ok: boolean; newQuantity: string; newAvgCost: string }> =>
    send('POST', `/api/holdings/${holdingId}/transactions`, input, (raw) =>
      z
        .object({
          ok: z.boolean(),
          newQuantity: z.string(),
          newAvgCost: z.string(),
        })
        .parse(raw),
    ),

  deleteHolding: (id: string): Promise<{ ok: boolean }> =>
    send('DELETE', `/api/holdings/${id}`, undefined, (raw) =>
      z.object({ ok: z.boolean() }).parse(raw),
    ),

  getGoals: (): Promise<GoalEnriched[]> =>
    get('/api/goals', (raw) => z.array(goalEnrichedSchema).parse(raw)),

  createGoal: (input: CreateGoalInput): Promise<GoalEnriched> =>
    send('POST', '/api/goals', input, (raw) => goalEnrichedSchema.parse(raw)),

  updateGoal: (id: string, patch: UpdateGoalInput): Promise<GoalEnriched> =>
    send('PATCH', `/api/goals/${id}`, patch, (raw) => goalEnrichedSchema.parse(raw)),

  deleteGoal: (id: string): Promise<{ ok: boolean }> =>
    send('DELETE', `/api/goals/${id}`, undefined, (raw) =>
      z.object({ ok: z.boolean() }).parse(raw),
    ),

  getPlannedEvents: (): Promise<PlannedEvent[]> =>
    get('/api/planned-events', (raw) => z.array(plannedEventSchema).parse(raw)),

  createPlannedEvent: (input: CreatePlannedEventInput): Promise<PlannedEvent> =>
    send('POST', '/api/planned-events', input, (raw) => plannedEventSchema.parse(raw)),

  updatePlannedEvent: (id: string, patch: UpdatePlannedEventInput): Promise<PlannedEvent> =>
    send('PATCH', `/api/planned-events/${id}`, patch, (raw) => plannedEventSchema.parse(raw)),

  deletePlannedEvent: (id: string): Promise<{ ok: boolean }> =>
    send('DELETE', `/api/planned-events/${id}`, undefined, (raw) =>
      z.object({ ok: z.boolean() }).parse(raw),
    ),

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

  getCategorizationQueue: (): Promise<CategorizationQueueResponse> =>
    get('/api/categorization-queue', (raw) => categorizationQueueResponseSchema.parse(raw)),

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

  createLoan: (input: CreateLoanInput): Promise<{ id: string; ok: boolean }> =>
    send('POST', '/api/loans', input, (raw) =>
      z.object({ id: z.string().uuid(), ok: z.boolean() }).parse(raw),
    ),

  updateLoan: (id: string, patch: UpdateLoanInput): Promise<{ ok: boolean }> =>
    send('PATCH', `/api/loans/${id}`, patch, (raw) => z.object({ ok: z.boolean() }).parse(raw)),

  deleteLoan: (id: string): Promise<{ ok: boolean }> =>
    send('DELETE', `/api/loans/${id}`, undefined, (raw) =>
      z.object({ ok: z.boolean() }).parse(raw),
    ),

  addLoanRateHistory: (
    loanId: string,
    input: AddLoanRateHistoryInput,
  ): Promise<{ effectiveAt: string; rate: string; source: string }> =>
    send('POST', `/api/loans/${loanId}/rate-history`, input, (raw) =>
      z
        .object({
          effectiveAt: z.string(),
          rate: z.string(),
          source: z.string(),
        })
        .parse(raw),
    ),

  manualMatchPayment: (
    loanId: string,
    period: number,
    transactionId: string,
  ): Promise<{ ok: boolean }> =>
    send('POST', `/api/loans/${loanId}/schedule/${period}/match`, { transactionId }, (raw) =>
      z.object({ ok: z.boolean() }).parse(raw),
    ),

  unlinkManualMatch: (loanId: string, period: number): Promise<{ ok: boolean; removed: number }> =>
    send('DELETE', `/api/loans/${loanId}/schedule/${period}/match`, undefined, (raw) =>
      z.object({ ok: z.boolean(), removed: z.number().int().nonnegative() }).parse(raw),
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

  listCategorizationRules: (): Promise<CategorizationRuleEnriched[]> =>
    get('/api/categorization-rules', (raw) => z.array(categorizationRuleEnrichedSchema).parse(raw)),

  updateCategorizationRule: (
    id: string,
    patch: UpdateCategorizationRuleInput,
  ): Promise<{ id: string; ok: boolean }> =>
    send('PATCH', `/api/categorization-rules/${id}`, patch, (raw) =>
      z.object({ id: z.string().uuid(), ok: z.boolean() }).parse(raw),
    ),

  deleteCategorizationRule: (id: string): Promise<{ id: string; ok: boolean }> =>
    send('DELETE', `/api/categorization-rules/${id}`, undefined, (raw) =>
      z.object({ id: z.string().uuid(), ok: z.boolean() }).parse(raw),
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

  listInsights: (): Promise<InsightsListResponse> =>
    get('/api/insights', (raw) => insightsListResponseSchema.parse(raw)),

  dismissInsight: (id: string): Promise<{ id: string; ok: boolean }> =>
    send('POST', `/api/insights/${id}/dismiss`, undefined, (raw) =>
      z.object({ id: z.string().uuid(), ok: z.boolean() }).parse(raw),
    ),

  actInsight: (id: string): Promise<{ id: string; ok: boolean }> =>
    send('POST', `/api/insights/${id}/act`, undefined, (raw) =>
      z.object({ id: z.string().uuid(), ok: z.boolean() }).parse(raw),
    ),

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
