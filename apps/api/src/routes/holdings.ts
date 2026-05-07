import {
  type Holding,
  createHoldingInputSchema,
  recordHoldingTxInputSchema,
  recordValuationInputSchema,
} from '@gp/shared';
import { Decimal } from 'decimal.js';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';
import { db } from '../db/index.js';
import { accounts, holdingTransactions, holdingValuations, holdings } from '../db/schema.js';

const DEFAULT_USER_ID = '01951b00-0000-7000-8000-000000000001';

function toHolding(h: typeof holdings.$inferSelect): Holding {
  return {
    id: h.id,
    accountId: h.accountId,
    isin: h.isin,
    ticker: h.ticker,
    name: h.name,
    assetClass: h.assetClass,
    currency: h.currency,
    quantity: h.quantity,
    avgCost: h.avgCost,
    openedAt: h.openedAt,
    closedAt: h.closedAt,
    notes: h.notes,
  };
}

async function ensureAccountOwned(accountId: string): Promise<boolean> {
  const [a] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.id, accountId),
        eq(accounts.userId, DEFAULT_USER_ID),
        isNull(accounts.deletedAt),
      ),
    );
  return !!a;
}

export const holdingsRoutes: FastifyPluginAsync = async (app) => {
  // List all holdings for the user (joined via accounts.userId).
  app.get('/holdings', async () => {
    const rows = await db
      .select()
      .from(holdings)
      .innerJoin(accounts, eq(holdings.accountId, accounts.id))
      .where(
        and(
          eq(accounts.userId, DEFAULT_USER_ID),
          isNull(holdings.deletedAt),
          isNull(accounts.deletedAt),
        ),
      )
      .orderBy(asc(holdings.name));
    return rows.map((r) => toHolding(r.holdings));
  });

  app.post('/holdings', async (request, reply) => {
    const body = createHoldingInputSchema.parse(request.body);
    if (!(await ensureAccountOwned(body.accountId))) {
      return reply.code(404).send({ error: 'Cuenta no encontrada' });
    }
    const id = uuidv7();
    const [inserted] = await db
      .insert(holdings)
      .values({
        id,
        accountId: body.accountId,
        isin: body.isin ?? null,
        ticker: body.ticker ?? null,
        name: body.name,
        assetClass: body.assetClass ?? null,
        currency: body.currency,
        quantity: body.quantity,
        avgCost: body.avgCost,
        openedAt: body.openedAt ?? null,
        notes: body.notes ?? null,
      })
      .returning();
    if (!inserted) return reply.code(500).send({ error: 'No se pudo crear el holding' });
    return toHolding(inserted);
  });

  // Record a NAV (net asset value) for a holding on a given date. The unique
  // constraint on (holding_id, valuation_at) lets us upsert by replacing.
  app.post('/holdings/:id/valuations', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = recordValuationInputSchema.parse(request.body);
    const [h] = await db
      .select()
      .from(holdings)
      .innerJoin(accounts, eq(holdings.accountId, accounts.id))
      .where(
        and(
          eq(holdings.id, params.id),
          eq(accounts.userId, DEFAULT_USER_ID),
          isNull(holdings.deletedAt),
        ),
      );
    if (!h) return reply.code(404).send({ error: 'Holding no encontrado' });

    const totalValue = new Decimal(h.holdings.quantity).times(body.nav).toFixed(2);

    // Replace any prior valuation for that date.
    await db
      .delete(holdingValuations)
      .where(
        and(
          eq(holdingValuations.holdingId, params.id),
          eq(holdingValuations.valuationAt, body.valuationAt),
        ),
      );

    await db.insert(holdingValuations).values({
      id: uuidv7(),
      holdingId: params.id,
      valuationAt: body.valuationAt,
      nav: body.nav,
      totalValue,
      source: 'manual',
    });
    return { ok: true, totalValue };
  });

  // Record a buy/sell/dividend/etc. and update the holding's running quantity
  // + avg cost (FIFO-style for buys; sells keep cost basis untouched per ES
  // convention — sells pull from the running cost basis).
  app.post('/holdings/:id/transactions', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = recordHoldingTxInputSchema.parse(request.body);
    const [h] = await db
      .select()
      .from(holdings)
      .innerJoin(accounts, eq(holdings.accountId, accounts.id))
      .where(
        and(
          eq(holdings.id, params.id),
          eq(accounts.userId, DEFAULT_USER_ID),
          isNull(holdings.deletedAt),
        ),
      );
    if (!h) return reply.code(404).send({ error: 'Holding no encontrado' });

    const txQty = new Decimal(body.quantity);
    const txPrice = new Decimal(body.price);
    const currentQty = new Decimal(h.holdings.quantity);
    const currentCost = new Decimal(h.holdings.avgCost);

    let newQty = currentQty;
    let newAvgCost = currentCost;

    if (body.kind === 'buy' || body.kind === 'transfer_in') {
      // Weighted-average cost basis update.
      const totalCostBefore = currentQty.times(currentCost);
      const totalCostAdded = txQty.times(txPrice);
      newQty = currentQty.plus(txQty);
      newAvgCost = newQty.greaterThan(0)
        ? totalCostBefore.plus(totalCostAdded).div(newQty)
        : currentCost;
    } else if (body.kind === 'sell' || body.kind === 'transfer_out') {
      newQty = currentQty.minus(txQty);
      // avg cost unchanged (the realised gain/loss is computed from cost basis).
    }
    // dividend / split / fee / tax: no effect on quantity/cost basis here.

    await db.insert(holdingTransactions).values({
      id: uuidv7(),
      holdingId: params.id,
      kind: body.kind,
      occurredAt: new Date(`${body.occurredAt}T10:00:00Z`),
      quantity: body.quantity,
      price: body.price,
      fees: body.fees ?? '0',
      taxes: body.taxes ?? '0',
      notes: body.notes ?? null,
    });

    if (
      body.kind === 'buy' ||
      body.kind === 'sell' ||
      body.kind === 'transfer_in' ||
      body.kind === 'transfer_out'
    ) {
      await db
        .update(holdings)
        .set({
          quantity: newQty.toFixed(8),
          avgCost: newAvgCost.toFixed(8),
          updatedAt: new Date(),
        })
        .where(eq(holdings.id, params.id));
    }

    return { ok: true, newQuantity: newQty.toFixed(8), newAvgCost: newAvgCost.toFixed(8) };
  });

  // Soft-delete a holding (its valuations and transactions stay for history).
  app.delete('/holdings/:id', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const updated = await db
      .update(holdings)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(holdings.id, params.id), isNull(holdings.deletedAt)))
      .returning({ id: holdings.id });
    if (updated.length === 0) {
      return reply.code(404).send({ error: 'Holding no encontrado' });
    }
    return { ok: true };
  });
};
