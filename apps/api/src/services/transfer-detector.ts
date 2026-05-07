import { Decimal } from 'decimal.js';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { db } from '../db/index.js';
import { transactions } from '../db/schema.js';

const MAX_DAYS_BETWEEN = 3;

type Candidate = {
  id: string;
  accountId: string;
  bookedAt: Date;
  amount: string;
  currency: string;
};

// Spot internal transfers: a debit on account A and a credit on account B for
// the same |amount|, in the same currency, within MAX_DAYS_BETWEEN days. Each
// matched pair gets a fresh `transfer_pair_id`. Already-tagged transactions
// are left untouched (manual tags survive).
export async function detectInternalTransfers(userId: string): Promise<{ paired: number }> {
  const rows: Candidate[] = await db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      bookedAt: transactions.bookedAt,
      amount: transactions.amount,
      currency: transactions.currency,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        isNull(transactions.transferPairId),
        eq(transactions.isProjection, false),
      ),
    );

  // Bucket by abs(amount) so we only compare candidates that could possibly
  // pair. Same currency requirement is enforced inside the loop.
  const byAbs = new Map<string, Candidate[]>();
  for (const r of rows) {
    const key = new Decimal(r.amount).abs().toFixed(2);
    const list = byAbs.get(key) ?? [];
    list.push(r);
    byAbs.set(key, list);
  }

  const pairsToWrite: [string, string][] = [];
  const used = new Set<string>();
  for (const list of byAbs.values()) {
    if (list.length < 2) continue;
    for (const neg of list) {
      if (used.has(neg.id)) continue;
      if (!new Decimal(neg.amount).isNegative()) continue;
      let best: { tx: Candidate; diffMs: number } | null = null;
      for (const pos of list) {
        if (used.has(pos.id)) continue;
        if (pos.id === neg.id) continue;
        if (!new Decimal(pos.amount).isPositive()) continue;
        if (pos.currency !== neg.currency) continue;
        if (pos.accountId === neg.accountId) continue;
        const diffMs = Math.abs(pos.bookedAt.getTime() - neg.bookedAt.getTime());
        if (diffMs > MAX_DAYS_BETWEEN * 86400000) continue;
        if (!best || diffMs < best.diffMs) best = { tx: pos, diffMs };
      }
      if (best) {
        used.add(neg.id);
        used.add(best.tx.id);
        pairsToWrite.push([neg.id, best.tx.id]);
      }
    }
  }

  for (const [a, b] of pairsToWrite) {
    const pairId = uuidv7();
    await db
      .update(transactions)
      .set({ transferPairId: pairId, updatedAt: new Date() })
      .where(and(inArray(transactions.id, [a, b]), eq(transactions.userId, userId)));
  }

  return { paired: pairsToWrite.length };
}
