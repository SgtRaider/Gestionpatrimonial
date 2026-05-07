import { and, asc, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accounts, categories, institutions, transactions } from '../db/schema.js';

type CategorySuggestion = {
  categoryId: string;
  name: string;
  color: string | null;
  iconKey: string | null;
  hits: number;
  source: 'merchant' | 'description' | 'recent';
};

type QueueItem = {
  id: string;
  bookedAt: string;
  amount: string;
  currency: string;
  descriptionRaw: string;
  counterparty: string | null;
  normalizedMerchant: string | null;
  accountId: string;
  accountName: string;
  institutionName: string;
  institutionColor: string | null;
};

export type CategorizationQueueResponse = {
  pending: number;
  next: QueueItem | null;
  suggestions: CategorySuggestion[];
};

// Find the user's next-most-recent uncategorized transaction (excludes
// transfers and projections), plus 3-5 category suggestions ranked by:
// 1. Past txs with the SAME normalized_merchant — strongest signal.
// 2. Past txs whose descriptionRaw contains the same first significant word.
// 3. The user's most-used categories in the last 90 days (fallback when
//    nothing matches the merchant/description).
export async function getCategorizationQueue(userId: string): Promise<CategorizationQueueResponse> {
  const [pendingRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        isNull(transactions.transferPairId),
        eq(transactions.isProjection, false),
        isNull(transactions.categoryId),
      ),
    );
  const pending = pendingRow?.count ?? 0;

  if (pending === 0) {
    return { pending: 0, next: null, suggestions: [] };
  }

  const [row] = await db
    .select({
      id: transactions.id,
      bookedAt: transactions.bookedAt,
      amount: transactions.amount,
      currency: transactions.currency,
      descriptionRaw: transactions.descriptionRaw,
      counterparty: transactions.counterparty,
      normalizedMerchant: transactions.normalizedMerchant,
      accountId: transactions.accountId,
      accountName: accounts.name,
      institutionName: institutions.name,
      institutionColor: institutions.color,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .innerJoin(institutions, eq(accounts.institutionId, institutions.id))
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        isNull(transactions.transferPairId),
        eq(transactions.isProjection, false),
        isNull(transactions.categoryId),
      ),
    )
    .orderBy(desc(transactions.bookedAt), asc(transactions.id))
    .limit(1);

  if (!row) return { pending, next: null, suggestions: [] };

  const next: QueueItem = {
    id: row.id,
    bookedAt: row.bookedAt.toISOString(),
    amount: row.amount,
    currency: row.currency,
    descriptionRaw: row.descriptionRaw,
    counterparty: row.counterparty,
    normalizedMerchant: row.normalizedMerchant,
    accountId: row.accountId,
    accountName: row.accountName,
    institutionName: row.institutionName,
    institutionColor: row.institutionColor,
  };

  const suggestions = await computeSuggestions(userId, next);
  return { pending, next, suggestions };
}

async function computeSuggestions(userId: string, tx: QueueItem): Promise<CategorySuggestion[]> {
  const out = new Map<string, CategorySuggestion>();

  // 1. Same merchant, already categorized.
  if (tx.normalizedMerchant) {
    const rows = await db
      .select({
        categoryId: transactions.categoryId,
        name: categories.name,
        color: categories.color,
        iconKey: categories.iconKey,
        hits: sql<number>`COUNT(*)::int`,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.normalizedMerchant, tx.normalizedMerchant),
          isNull(transactions.deletedAt),
        ),
      )
      .groupBy(transactions.categoryId, categories.name, categories.color, categories.iconKey)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(5);
    for (const r of rows) {
      if (!r.categoryId) continue;
      out.set(r.categoryId, {
        categoryId: r.categoryId,
        name: r.name,
        color: r.color,
        iconKey: r.iconKey,
        hits: r.hits,
        source: 'merchant',
      });
    }
  }

  // 2. First significant word of descriptionRaw (≥ 4 chars, alpha) appearing
  //    in past categorized descriptions.
  if (out.size < 5) {
    const firstWord = tx.descriptionRaw.split(/\s+/).find((w) => /^[A-Za-zÀ-ÿ]{4,}$/.test(w));
    if (firstWord) {
      const pattern = `%${firstWord}%`;
      const rows = await db
        .select({
          categoryId: transactions.categoryId,
          name: categories.name,
          color: categories.color,
          iconKey: categories.iconKey,
          hits: sql<number>`COUNT(*)::int`,
        })
        .from(transactions)
        .innerJoin(categories, eq(transactions.categoryId, categories.id))
        .where(
          and(
            eq(transactions.userId, userId),
            isNull(transactions.deletedAt),
            sql`${transactions.descriptionRaw} ILIKE ${pattern}`,
          ),
        )
        .groupBy(transactions.categoryId, categories.name, categories.color, categories.iconKey)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(5);
      for (const r of rows) {
        if (!r.categoryId) continue;
        if (out.has(r.categoryId)) continue;
        out.set(r.categoryId, {
          categoryId: r.categoryId,
          name: r.name,
          color: r.color,
          iconKey: r.iconKey,
          hits: r.hits,
          source: 'description',
        });
        if (out.size >= 5) break;
      }
    }
  }

  // 3. Recent activity fallback.
  if (out.size < 3) {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const rows = await db
      .select({
        categoryId: transactions.categoryId,
        name: categories.name,
        color: categories.color,
        iconKey: categories.iconKey,
        hits: sql<number>`COUNT(*)::int`,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.userId, userId),
          isNull(transactions.deletedAt),
          gte(transactions.bookedAt, ninetyDaysAgo),
        ),
      )
      .groupBy(transactions.categoryId, categories.name, categories.color, categories.iconKey)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(5);
    for (const r of rows) {
      if (!r.categoryId) continue;
      if (out.has(r.categoryId)) continue;
      out.set(r.categoryId, {
        categoryId: r.categoryId,
        name: r.name,
        color: r.color,
        iconKey: r.iconKey,
        hits: r.hits,
        source: 'recent',
      });
      if (out.size >= 5) break;
    }
  }

  return Array.from(out.values()).slice(0, 5);
}
