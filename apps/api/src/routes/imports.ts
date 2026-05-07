import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import {
  type ImportMapping,
  type ImportPreviewResponse,
  type ImportPreviewRow,
  importMappingSchema,
} from '@gp/shared';
import { parse as parseCsv } from 'csv-parse/sync';
import { Decimal } from 'decimal.js';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';
import { db } from '../db/index.js';
import { accounts, transactions } from '../db/schema.js';

const DEFAULT_USER_ID = '01951b00-0000-7000-8000-000000000001';
const MAX_PREVIEW_ROWS = 10;
const MAX_INSERT_ROWS = 5000;

// ────────────────────────────────────────────────────────────────────────────
// Header detection
// ────────────────────────────────────────────────────────────────────────────

// Strip combining marks so 'Operación' matches 'operacion'.
// \p{M} is the Unicode "Mark" category (combining diacritics, etc.).
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim();
}

const HEADER_HINTS: Record<keyof ImportMapping, string[]> = {
  date: ['fecha operacion', 'fecha op', 'fecha', 'date', 'f. operacion', 'fecha valor'],
  amount: ['importe', 'amount', 'cantidad', 'monto', 'valor', 'importe eur'],
  description: ['concepto', 'descripcion', 'description', 'detalle', 'movimiento'],
  counterparty: ['contraparte', 'beneficiario', 'ordenante', 'counterparty'],
  reference: ['referencia', 'reference', 'id', 'codigo'],
  decimalSeparator: [],
  dateFormat: [],
};

function detectColumn(headers: string[], hints: string[]): string | undefined {
  const normHeaders = headers.map((h) => ({ raw: h, norm: normalize(h) }));
  for (const hint of hints) {
    const exact = normHeaders.find((h) => h.norm === hint);
    if (exact) return exact.raw;
  }
  for (const hint of hints) {
    const partial = normHeaders.find((h) => h.norm.includes(hint));
    if (partial) return partial.raw;
  }
  return undefined;
}

function detectMapping(headers: string[]): ImportMapping {
  return {
    date: detectColumn(headers, HEADER_HINTS.date) ?? headers[0] ?? '',
    amount: detectColumn(headers, HEADER_HINTS.amount) ?? headers[1] ?? '',
    description: detectColumn(headers, HEADER_HINTS.description) ?? headers[2] ?? '',
    ...(detectColumn(headers, HEADER_HINTS.counterparty) && {
      counterparty: detectColumn(headers, HEADER_HINTS.counterparty),
    }),
    ...(detectColumn(headers, HEADER_HINTS.reference) && {
      reference: detectColumn(headers, HEADER_HINTS.reference),
    }),
    decimalSeparator: 'auto',
    dateFormat: 'auto',
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Value parsers
// ────────────────────────────────────────────────────────────────────────────

function parseAmountValue(raw: string, sep: 'auto' | '.' | ','): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[€$\s]/g, '').replace(/^\+/, '');
  if (!cleaned || cleaned === '-') return null;

  let decimalSep: '.' | ',';
  if (sep === '.') decimalSep = '.';
  else if (sep === ',') decimalSep = ',';
  else {
    // Auto: pick whichever appears LAST as the decimal separator.
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    decimalSep = lastComma > lastDot ? ',' : '.';
  }

  const normalized =
    decimalSep === ',' ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
  try {
    return new Decimal(normalized).toFixed(2);
  } catch {
    return null;
  }
}

function parseDateValue(raw: string, fmt: ImportMapping['dateFormat']): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  function tryIso(s: string): string | null {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return `${m[1]}-${m[2]}-${m[3]}`;
  }
  function tryDMY(s: string, sep: '/' | '-'): string | null {
    const re = sep === '/' ? /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/ : /^(\d{1,2})-(\d{1,2})-(\d{2,4})/;
    const m = s.match(re);
    if (!m || !m[1] || !m[2] || !m[3]) return null;
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${month}-${day}`;
  }
  function tryMDY(s: string): string | null {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!m || !m[1] || !m[2] || !m[3]) return null;
    const month = m[1].padStart(2, '0');
    const day = m[2].padStart(2, '0');
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${month}-${day}`;
  }

  switch (fmt) {
    case 'iso':
      return tryIso(trimmed);
    case 'dmy-slash':
      return tryDMY(trimmed, '/');
    case 'dmy-dash':
      return tryDMY(trimmed, '-');
    case 'ymd-dash':
      return tryIso(trimmed);
    case 'mdy-slash':
      return tryMDY(trimmed);
    default:
      return tryIso(trimmed) ?? tryDMY(trimmed, '/') ?? tryDMY(trimmed, '-');
  }
}

// ────────────────────────────────────────────────────────────────────────────
// CSV parsing
// ────────────────────────────────────────────────────────────────────────────

type ParsedRow = ImportPreviewRow;

function parseCsvBuffer(buffer: Buffer): { headers: string[]; rows: Record<string, string>[] } {
  const text = buffer.toString('utf-8');
  // Auto-detect delimiter: count commas vs semicolons in the first line.
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';

  const records = parseCsv(text, {
    columns: true,
    delimiter,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
  }) as Record<string, string>[];

  const headers = Object.keys(records[0] ?? {});
  return { headers, rows: records };
}

function applyMapping(rows: Record<string, string>[], mapping: ImportMapping): ParsedRow[] {
  return rows.map((row): ParsedRow => {
    const dateRaw = row[mapping.date] ?? '';
    const amountRaw = row[mapping.amount] ?? '';
    const description = row[mapping.description] ?? '';
    const counterparty = mapping.counterparty ? (row[mapping.counterparty] ?? '') : '';
    const reference = mapping.reference ? (row[mapping.reference] ?? '') : '';

    const date = parseDateValue(dateRaw, mapping.dateFormat);
    const amount = parseAmountValue(amountRaw, mapping.decimalSeparator);

    let parseError: string | null = null;
    if (!date) parseError = `Fecha no parseable: "${dateRaw}"`;
    else if (!amount) parseError = `Importe no parseable: "${amountRaw}"`;
    else if (!description.trim()) parseError = 'Descripción vacía';

    return {
      date,
      amount,
      description: description.trim(),
      counterparty: counterparty.trim() || null,
      reference: reference.trim() || null,
      parseError,
    };
  });
}

function computeStats(rows: ParsedRow[]) {
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

// ────────────────────────────────────────────────────────────────────────────
// Multipart helpers
// ────────────────────────────────────────────────────────────────────────────

const optionalMappingSchema = importMappingSchema.partial({
  decimalSeparator: true,
  dateFormat: true,
});

async function readMultipart(request: import('fastify').FastifyRequest): Promise<{
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
      const chunks: Buffer[] = [];
      for await (const chunk of part.file) {
        chunks.push(chunk as Buffer);
      }
      fileBuffer = Buffer.concat(chunks);
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

// ────────────────────────────────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────────────────────────────────

export const importsRoutes: FastifyPluginAsync = async (app) => {
  app.post('/imports/transactions/preview', async (request, reply) => {
    const { fileBuffer, fields } = await readMultipart(request);
    if (!fileBuffer) return reply.code(400).send({ error: 'Falta el fichero' });
    const accountId = fields.accountId;
    if (!accountId || !z.string().uuid().safeParse(accountId).success) {
      return reply.code(400).send({ error: 'accountId inválido' });
    }
    const acc = await ensureAccount(accountId);
    if (!acc) return reply.code(404).send({ error: 'Cuenta no encontrada' });

    const { headers, rows } = parseCsvBuffer(fileBuffer);
    const mapping: ImportMapping = fields.mapping
      ? (optionalMappingSchema.parse({
          decimalSeparator: 'auto',
          dateFormat: 'auto',
          ...JSON.parse(fields.mapping),
        }) as ImportMapping)
      : detectMapping(headers);

    const parsed = applyMapping(rows, mapping);
    const stats = computeStats(parsed);

    const response: ImportPreviewResponse = {
      headers,
      detectedMapping: mapping,
      sampleRows: parsed.slice(0, MAX_PREVIEW_ROWS),
      stats,
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

    const { headers, rows } = parseCsvBuffer(fileBuffer);
    if (rows.length > MAX_INSERT_ROWS) {
      return reply
        .code(400)
        .send({ error: `Demasiadas filas (${rows.length}); máximo ${MAX_INSERT_ROWS}` });
    }

    const mapping: ImportMapping = fields.mapping
      ? (optionalMappingSchema.parse({
          decimalSeparator: 'auto',
          dateFormat: 'auto',
          ...JSON.parse(fields.mapping),
        }) as ImportMapping)
      : detectMapping(headers);

    const parsed = applyMapping(rows, mapping);
    const valid = parsed.filter((r) => !r.parseError && r.date && r.amount);
    const skipped = parsed.length - valid.length;

    if (valid.length === 0) {
      return { inserted: 0, duplicates: 0, skipped };
    }

    const importSource = `csv:${fileName ?? 'unknown'}`;
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

    // Insert with dedupe on (account_id, external_id) unique index.
    const inserted = await db
      .insert(transactions)
      .values(values)
      .onConflictDoNothing({ target: [transactions.accountId, transactions.externalId] })
      .returning({ id: transactions.id });

    return {
      inserted: inserted.length,
      duplicates: values.length - inserted.length,
      skipped,
    };
  });
};
