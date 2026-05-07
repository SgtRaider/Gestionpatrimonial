import type { Buffer } from 'node:buffer';
import type { ImportMapping, ImportPreviewRow } from '@gp/shared';
import { parse as parseCsv } from 'csv-parse/sync';
import { Decimal } from 'decimal.js';
import { decodeTextBuffer } from './decode.js';
import { extractPdfText } from './pdf.js';

// ────────────────────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────────────────────

export type FormatId =
  | 'caja-rural-extremadura-pdf'
  | 'myinvestor-pdf'
  | 'myinvestor-csv'
  | 'generic-csv'
  | 'unknown';

export type DetectionResult = {
  format: FormatId;
  label: string;
};

export type ParseResult = {
  format: FormatId;
  label: string;
  rows: ImportPreviewRow[];
  // For CSV-style formats only (allows the UI to expose mapping editor).
  csv?: {
    headers: string[];
    detectedMapping: ImportMapping;
  };
};

// ────────────────────────────────────────────────────────────────────────────
// Shared parsers
// ────────────────────────────────────────────────────────────────────────────

const COMBINING_DIACRITICS = /\p{M}/gu;
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(COMBINING_DIACRITICS, '').trim();
}

function parseSpanishAmount(raw: string): string | null {
  if (!raw) return null;
  let cleaned = raw.replace(/[€$\s]/g, '').replace(/^\+/, '');
  let trailingMinus = false;
  if (cleaned.endsWith('-')) {
    trailingMinus = true;
    cleaned = cleaned.slice(0, -1);
  }
  if (!cleaned || cleaned === '-') return null;

  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  const decimalSep: '.' | ',' = lastComma > lastDot ? ',' : '.';
  const normalized =
    decimalSep === ',' ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
  try {
    const dec = new Decimal(normalized);
    return trailingMinus ? dec.negated().toFixed(2) : dec.toFixed(2);
  } catch {
    return null;
  }
}

function parseDmyDash(raw: string): string | null {
  const m = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (!m || !m[1] || !m[2] || !m[3]) return null;
  const day = m[1].padStart(2, '0');
  const month = m[2].padStart(2, '0');
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${month}-${day}`;
}

function parseDmySlash(raw: string): string | null {
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m || !m[1] || !m[2] || !m[3]) return null;
  const day = m[1].padStart(2, '0');
  const month = m[2].padStart(2, '0');
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${month}-${day}`;
}

function parseIso(raw: string): string | null {
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function parseDateLoose(raw: string, fmt: ImportMapping['dateFormat']): string | null {
  const trimmed = raw.trim();
  switch (fmt) {
    case 'iso':
      return parseIso(trimmed);
    case 'dmy-slash':
      return parseDmySlash(trimmed);
    case 'dmy-dash':
      return parseDmyDash(trimmed);
    case 'ymd-dash':
      return parseIso(trimmed);
    default:
      return parseIso(trimmed) ?? parseDmySlash(trimmed) ?? parseDmyDash(trimmed);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Generic CSV parser (also handles MyInvestor CSV after encoding fix)
// ────────────────────────────────────────────────────────────────────────────

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
  const norm = headers.map((h) => ({ raw: h, n: normalize(h) }));
  for (const hint of hints) {
    const exact = norm.find((h) => h.n === hint);
    if (exact) return exact.raw;
  }
  for (const hint of hints) {
    const partial = norm.find((h) => h.n.includes(hint));
    if (partial) return partial.raw;
  }
  return undefined;
}

function detectMapping(headers: string[]): ImportMapping {
  const m: ImportMapping = {
    date: detectColumn(headers, HEADER_HINTS.date) ?? headers[0] ?? '',
    amount: detectColumn(headers, HEADER_HINTS.amount) ?? headers[1] ?? '',
    description: detectColumn(headers, HEADER_HINTS.description) ?? headers[2] ?? '',
    decimalSeparator: 'auto',
    dateFormat: 'auto',
  };
  const cp = detectColumn(headers, HEADER_HINTS.counterparty);
  if (cp) m.counterparty = cp;
  const ref = detectColumn(headers, HEADER_HINTS.reference);
  if (ref) m.reference = ref;
  return m;
}

export function parseCsvText(
  text: string,
  mapping?: ImportMapping,
): {
  headers: string[];
  records: Record<string, string>[];
  effectiveMapping: ImportMapping;
  rows: ImportPreviewRow[];
} {
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
  const effectiveMapping = mapping ?? detectMapping(headers);

  const rows: ImportPreviewRow[] = records.map((row) => {
    const dateRaw = row[effectiveMapping.date] ?? '';
    const amountRaw = row[effectiveMapping.amount] ?? '';
    const description = row[effectiveMapping.description] ?? '';
    const cp = effectiveMapping.counterparty ? (row[effectiveMapping.counterparty] ?? '') : '';
    const ref = effectiveMapping.reference ? (row[effectiveMapping.reference] ?? '') : '';
    const date = parseDateLoose(dateRaw, effectiveMapping.dateFormat);
    const amount = parseSpanishAmount(amountRaw);
    let parseError: string | null = null;
    if (!date) parseError = `Fecha no parseable: "${dateRaw}"`;
    else if (!amount) parseError = `Importe no parseable: "${amountRaw}"`;
    else if (!description.trim()) parseError = 'Descripción vacía';
    return {
      date,
      amount,
      description: description.trim(),
      counterparty: cp.trim() || null,
      reference: ref.trim() || null,
      parseError,
    };
  });

  return { headers, records, effectiveMapping, rows };
}

// ────────────────────────────────────────────────────────────────────────────
// Caja Rural de Extremadura PDF parser
// ────────────────────────────────────────────────────────────────────────────

// Pattern: `DD-MM-YYYY OOOO concepto DD-MM importe[-] saldo`
//   - OOOO = office code (4 digits)
//   - importe ends with '-' if negative
const CRE_ROW = /^(\d{2}-\d{2}-\d{4})\s+(\d{4})\s+(.+?)\s+(\d{2}-\d{2})\s+([\d.,]+-?)\s+([\d.,]+)$/;

function parseCajaRuralPdf(text: string): ImportPreviewRow[] {
  const rows: ImportPreviewRow[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    if (!line) continue;
    if (/^Saldo Anterior/i.test(line)) continue;
    if (/^REFERENCIA:/i.test(line)) continue;
    const m = line.match(CRE_ROW);
    if (!m) continue;
    const [, fechaRaw, , conceptoRaw, , importeRaw] = m;
    const date = parseDmyDash(fechaRaw ?? '');
    const amount = parseSpanishAmount(importeRaw ?? '');
    const description = (conceptoRaw ?? '').trim();
    rows.push({
      date,
      amount,
      description,
      counterparty: null,
      reference: null,
      parseError:
        !date || !amount || !description ? `Línea no parseable: ${line.slice(0, 80)}` : null,
    });
  }
  return rows;
}

// ────────────────────────────────────────────────────────────────────────────
// MyInvestor PDF parser
// ────────────────────────────────────────────────────────────────────────────

// Pattern: `DD/MM/YYYY DD/MM/YYYY <op + concept> <signed amount> <saldo> [€]`
const MI_ROW =
  /^(\d{2}\/\d{2}\/\d{4})\s+\d{2}\/\d{2}\/\d{4}\s+(.+?)\s+(-?[\d.,]+)\s+([\d.,]+)\s*€?\s*$/;

function parseMyInvestorPdf(text: string): ImportPreviewRow[] {
  const rows: ImportPreviewRow[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    if (!line) continue;
    const m = line.match(MI_ROW);
    if (!m) continue;
    const [, fechaRaw, descriptionRaw, importeRaw] = m;
    const date = parseDmySlash(fechaRaw ?? '');
    const amount = parseSpanishAmount(importeRaw ?? '');
    const description = (descriptionRaw ?? '').trim();
    rows.push({
      date,
      amount,
      description,
      counterparty: null,
      reference: null,
      parseError:
        !date || !amount || !description ? `Línea no parseable: ${line.slice(0, 80)}` : null,
    });
  }
  return rows;
}

// ────────────────────────────────────────────────────────────────────────────
// Detection + dispatch
// ────────────────────────────────────────────────────────────────────────────

function detectPdfFormat(text: string): FormatId {
  if (/CAJA\s+RURAL/i.test(text) || /BCOEESMM/i.test(text)) {
    return 'caja-rural-extremadura-pdf';
  }
  if (/myinvestor/i.test(text) || /SUSCRIPCION IIC|REEMBOLSO IIC|ABONO POR TRASPASO/i.test(text)) {
    return 'myinvestor-pdf';
  }
  return 'unknown';
}

function detectCsvFormat(headers: string[]): FormatId {
  const norm = headers.map(normalize);
  if (
    norm.includes('fecha de operacion') &&
    norm.includes('concepto') &&
    norm.includes('importe') &&
    norm.includes('divisa')
  ) {
    return 'myinvestor-csv';
  }
  return 'generic-csv';
}

const FORMAT_LABELS: Record<FormatId, string> = {
  'caja-rural-extremadura-pdf': 'Caja Rural de Extremadura · PDF',
  'myinvestor-pdf': 'MyInvestor · PDF',
  'myinvestor-csv': 'MyInvestor · CSV',
  'generic-csv': 'CSV genérico',
  unknown: 'Formato desconocido',
};

function isPdfBuffer(buffer: Buffer): boolean {
  return (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  );
}

export async function parseFile(
  buffer: Buffer,
  fileName: string | null,
  options: { mapping?: ImportMapping } = {},
): Promise<ParseResult> {
  const looksLikePdf = isPdfBuffer(buffer) || (fileName?.toLowerCase().endsWith('.pdf') ?? false);

  if (looksLikePdf) {
    const text = await extractPdfText(buffer);
    const format = detectPdfFormat(text);
    let rows: ImportPreviewRow[] = [];
    if (format === 'caja-rural-extremadura-pdf') {
      rows = parseCajaRuralPdf(text);
    } else if (format === 'myinvestor-pdf') {
      rows = parseMyInvestorPdf(text);
    } else {
      // Fallback: try both, keep whichever produced more rows.
      const cre = parseCajaRuralPdf(text);
      const mi = parseMyInvestorPdf(text);
      rows = mi.length > cre.length ? mi : cre;
    }
    return { format, label: FORMAT_LABELS[format], rows };
  }

  // CSV path
  const text = decodeTextBuffer(buffer);
  const { headers, effectiveMapping, rows } = parseCsvText(text, options.mapping);
  const format = detectCsvFormat(headers);
  return {
    format,
    label: FORMAT_LABELS[format],
    rows,
    csv: { headers, detectedMapping: effectiveMapping },
  };
}
