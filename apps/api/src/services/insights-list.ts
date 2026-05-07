import type { InsightFull, InsightsListResponse } from '@gp/shared';
import { Decimal } from 'decimal.js';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { insights as insightsTable } from '../db/schema.js';

// Surfaces the full insight history for /optimizacion. Same dataset feeds the
// dashboard's compact list, but here we expose dismissed/acted rows too so the
// user can see what they've already actioned and what they ignored.
export async function listInsights(userId: string): Promise<InsightsListResponse> {
  const rows = await db
    .select({
      id: insightsTable.id,
      kind: insightsTable.kind,
      severity: insightsTable.severity,
      title: insightsTable.title,
      description: insightsTable.description,
      estimatedSavings: insightsTable.estimatedSavings,
      actionPayload: insightsTable.actionPayload,
      dismissedAt: insightsTable.dismissedAt,
      actedAt: insightsTable.actedAt,
      createdAt: insightsTable.createdAt,
    })
    .from(insightsTable)
    .where(eq(insightsTable.userId, userId))
    .orderBy(desc(insightsTable.createdAt));

  let activeCount = 0;
  let activeSavings = new Decimal(0);
  let actedSavings = new Decimal(0);

  const out: InsightFull[] = rows.map((r) => {
    const status: InsightFull['status'] = r.actedAt
      ? 'acted'
      : r.dismissedAt
        ? 'dismissed'
        : 'active';
    const resolvedAt = r.actedAt ?? r.dismissedAt ?? null;
    if (status === 'active') {
      activeCount += 1;
      if (r.estimatedSavings) activeSavings = activeSavings.plus(r.estimatedSavings);
    }
    if (status === 'acted' && r.estimatedSavings) {
      actedSavings = actedSavings.plus(r.estimatedSavings);
    }

    const raw = (r.actionPayload as Record<string, unknown> | null) ?? null;
    const surfaced = raw
      ? {
          ...(typeof raw.loanId === 'string' ? { loanId: raw.loanId } : {}),
          ...(typeof raw.ruleId === 'string' ? { ruleId: raw.ruleId } : {}),
          ...(typeof raw.accountId === 'string' ? { accountId: raw.accountId } : {}),
          ...(typeof raw.merchant === 'string' ? { merchant: raw.merchant } : {}),
          ...(typeof raw.cadence === 'string' ? { cadence: raw.cadence } : {}),
        }
      : null;

    return {
      id: r.id,
      kind: r.kind,
      title: r.title,
      description: r.description,
      estimatedSavings: r.estimatedSavings,
      actionable: r.actionPayload !== null,
      actionPayload: surfaced,
      severity: r.severity,
      status,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: resolvedAt ? resolvedAt.toISOString() : null,
    };
  });

  return {
    insights: out,
    totals: {
      activeCount,
      activeSavings: activeSavings.toFixed(2),
      actedSavings: actedSavings.toFixed(2),
    },
  };
}
