import type { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import {
  type ImportMapping,
  type ImportPreviewResponse,
  type ImportPreviewRow,
  importMappingSchema,
} from '@gp/shared';
import { Decimal } from 'decimal.js';
import { and, asc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';
import { db } from '../db/index.js';
import { accounts, categorizationRules, transactions } from '../db/schema.js';
import { parseFile } from '../imports/format.js';

const DEFAULT_USER_ID = '01951b00-0000-7000-8000-000000000001';
const MAX_PREVIEW_ROWS = 10;
const MAX_INSERT_ROWS = 5000;

const optionalMappingSchema = importMappingSchema.partial({
  decimalSeparator: true,
  dateFormat: true,
});

async function readMultipart(request: FastifyRequest): Promise<{
  fileBuffer: Buffer | null;
  fileName: string | null;
  fields: Record<string, string>;
}> {
  const parts = request.parts();
  let fileBuffer: Buffer | null = null;
  let fileName: string | null = null;
  const fields: Record<string, string> = {};
  for await (const part of parts) {
    if (part.type === 'file') {
      fileBuffer = await part.toBuffer();
      fileName = part.filename;
    } else {
      fields[part.fieldname] = String(part.value ?? '');
    }
  }
  return { fileBuffer, fileName, fields };
}

function dedupeKey(accountId: string, date: string, amount: string, description: string): string {
  return createHash('sha256')
    .update(`${accountId}|${date}|${amount}|${description.trim()}`)
    .digest('hex')
    .slice(0, 32);
}

async function ensureAccount(accountId: string) {
  const [acc] = await db
    .select({ id: accounts.id, currency: accounts.currency })
    .from(accounts)
    .where(
      and(
        eq(accounts.id, accountId),
        eq(accounts.userId, DEFAULT_USER_ID),
        isNull(accounts.deletedAt),
      ),
    );
  return acc ?? null;
}

function computeStats(rows: ImportPreviewRow[]) {
  let income = new Decimal(0);
  let expenses = new Decimal(0);
  let parsed = 0;
  let skipped = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;
  for (const r of rows) {
    if (r.parseError || !r.amount || !r.date) {
      skipped++;
      continue;
    }
    parsed++;
    const a = new Decimal(r.amount);
    if (a.isPositive()) income = income.plus(a);
    else expenses = expenses.plus(a);
    if (!minDate || r.date < minDate) minDate = r.date;
    if (!maxDate || r.date > maxDate) maxDate = r.date;
  }
  return {
    totalRows: rows.length,
    parsedRows: parsed,
    skippedRows: skipped,
    income: income.toFixed(2),
    expenses: expenses.toFixed(2),
    net: income.plus(expenses).toFixed(2),
    dateRange: minDate && maxDate ? { from: minDate, to: maxDate } : null,
  };
}

function parseMappingField(raw: string | undefined): ImportMapping | undefined {
  if (!raw) return undefined;
  return optionalMappingSchema.parse({
    decimalSeparator: 'auto',
    dateFormat: 'auto',
    ...JSON.parse(raw),
  }) as ImportMapping;
}

export const importsRoutes: FastifyPluginAsync = async (app) => {
  app.post('/imports/transactions/preview', async (request, reply) => {
    const { fileBuffer, fileName, fields } = await readMultipart(request);
    if (!fileBuffer) return reply.code(400).send({ error: 'Falta el fichero' });
    const accountId = fields.accountId;
    if (!accountId || !z.string().uuid().safeParse(accountId).success) {
      return reply.code(400).send({ error: 'accountId inválido' });
    }
    const acc = await ensureAccount(accountId);
    if (!acc) return reply.code(404).send({ error: 'Cuenta no encontrada' });

    const mapping = parseMappingField(fields.mapping);
    let result: Awaited<ReturnType<typeof parseFile>>;
    try {
      result = await parseFile(fileBuffer, fileName, mapping ? { mapping } : {});
    } catch (err) {
      return reply.code(400).send({
        error: `No se pudo procesar el fichero: ${err instanceof Error ? err.message : 'desconocido'}`,
      });
    }

    const stats = computeStats(result.rows);
    const response: ImportPreviewResponse = {
      headers: result.csv?.headers ?? [],
      ...(result.csv ? { detectedMapping: result.csv.detectedMapping } : {}),
      sampleRows: result.rows.slice(0, MAX_PREVIEW_ROWS),
      stats,
      format: result.format,
      formatLabel: result.label,
      ...(result.debugText ? { debugText: result.debugText } : {}),
    };
    return response;
  });

  app.post('/imports/transactions/commit', async (request, reply) => {
    const { fileBuffer, fileName, fields } = await readMultipart(request);
    if (!fileBuffer) return reply.code(400).send({ error: 'Falta el fichero' });
    const accountId = fields.accountId;
    if (!accountId || !z.string().uuid().safeParse(accountId).success) {
      return reply.code(400).send({ error: 'accountId inválido' });
    }
    const acc = await ensureAccount(accountId);
    if (!acc) return reply.code(404).send({ error: 'Cuenta no encontrada' });

    const mapping = parseMappingField(fields.mapping);
    let result: Awaited<ReturnType<typeof parseFile>>;
    try {
      result = await parseFile(fileBuffer, fileName, mapping ? { mapping } : {});
    } catch (err) {
      return reply.code(400).send({
        error: `No se pudo procesar el fichero: ${err instanceof Error ? err.message : 'desconocido'}`,
      });
    }

    if (result.rows.length > MAX_INSERT_ROWS) {
      return reply
        .code(400)
        .send({ error: `Demasiadas filas (${result.rows.length}); máximo ${MAX_INSERT_ROWS}` });
    }

    const valid = result.rows.filter((r) => !r.parseError && r.date && r.amount);
    const skipped = result.rows.length - valid.length;

    if (valid.length === 0) {
      return {
        inserted: 0,
        duplicates: 0,
        skipped,
        autoCategorized: 0,
        format: result.format,
      };
    }

    const importSource = `${result.format}:${fileName ?? 'unknown'}`;
    const values = valid.map((r) => ({
      id: uuidv7(),
      userId: DEFAULT_USER_ID,
      accountId,
      bookedAt: new Date(`${r.date}T10:00:00Z`),
      valueAt: new Date(`${r.date}T10:00:00Z`),
      amount: r.amount as string,
      currency: acc.currency,
      amountBaseCurrency: r.amount as string,
      descriptionRaw: r.description,
      counterparty: r.counterparty,
      normalizedMerchant: null,
      merchantAliasUser: null,
      categoryId: null,
      status: 'booked' as const,
      source: 'csv' as const,
      externalId: dedupeKey(accountId, r.date as string, r.amount as string, r.description),
      transferPairId: null,
      parentTransactionId: null,
      recurringRuleId: null,
      notes: importSource,
      isProjection: false,
    }));

    const inserted = await db
      .insert(transactions)
      .values(values)
      .onConflictDoNothing({ target: [transactions.accountId, transactions.externalId] })
      .returning({ id: transactions.id });

    // Apply active categorization rules in priority order against the rows we
    // just inserted. Same Postgres `~*` regex semantics as the rules POST
    // endpoint, so behaviour stays consistent. First-rule-wins via the
    // `category_id IS NULL` guard on each successive UPDATE.
    let autoCategorized = 0;
    if (inserted.length > 0) {
      const insertedIds = inserted.map((r) => r.id);
      const rules = await db
        .select({
          id: categorizationRules.id,
          patternRegex: categorizationRules.patternRegex,
          accountId: categorizationRules.accountId,
          amountMin: categorizationRules.amountMin,
          amountMax: categorizationRules.amountMax,
          categoryId: categorizationRules.categoryId,
        })
        .from(categorizationRules)
        .where(
          and(
            eq(categorizationRules.userId, DEFAULT_USER_ID),
            eq(categorizationRules.active, true),
            isNull(categorizationRules.deletedAt),
          ),
        )
        .orderBy(asc(categorizationRules.priority));

      for (const rule of rules) {
        const conditions = [
          inArray(transactions.id, insertedIds),
          eq(transactions.userId, DEFAULT_USER_ID),
          isNull(transactions.categoryId),
          sql`${transactions.descriptionRaw} ~* ${rule.patternRegex}`,
        ];
        if (rule.accountId) conditions.push(eq(transactions.accountId, rule.accountId));
        if (rule.amountMin) conditions.push(gte(transactions.amount, rule.amountMin));
        if (rule.amountMax) conditions.push(lte(transactions.amount, rule.amountMax));

        const updated = await db
          .update(transactions)
          .set({ categoryId: rule.categoryId, updatedAt: new Date() })
          .where(and(...conditions))
          .returning({ id: transactions.id });
        autoCategorized += updated.length;
      }
    }

    return {
      inserted: inserted.length,
      duplicates: values.length - inserted.length,
      skipped,
      autoCategorized,
      format: result.format,
    };
  });
};
