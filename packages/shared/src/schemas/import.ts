import { z } from 'zod';
import { decimalString } from './transaction.js';

// Which CSV column maps to which transaction field. Column refers to the header
// name (or numeric index if the file is headerless).
export const importMappingSchema = z.object({
  date: z.string().min(1),
  amount: z.string().min(1),
  description: z.string().min(1),
  counterparty: z.string().min(1).optional(),
  reference: z.string().min(1).optional(),
  // Heuristic for parsing the amount text.
  decimalSeparator: z.enum(['auto', '.', ',']).default('auto'),
  // Format hint for the date column. 'auto' tries common Spanish + ISO formats.
  dateFormat: z
    .enum(['auto', 'iso', 'dmy-slash', 'dmy-dash', 'ymd-dash', 'mdy-slash'])
    .default('auto'),
});
export type ImportMapping = z.infer<typeof importMappingSchema>;

// Stats computed during a dry-run preview.
export const importPreviewStatsSchema = z.object({
  totalRows: z.number().int().nonnegative(),
  parsedRows: z.number().int().nonnegative(),
  skippedRows: z.number().int().nonnegative(),
  income: decimalString,
  expenses: decimalString,
  net: decimalString,
  dateRange: z
    .object({
      from: z.string().date(),
      to: z.string().date(),
    })
    .nullable(),
});
export type ImportPreviewStats = z.infer<typeof importPreviewStatsSchema>;

// One row of the parsed sample preview the UI shows.
export const importPreviewRowSchema = z.object({
  date: z.string().date().nullable(),
  amount: decimalString.nullable(),
  description: z.string(),
  counterparty: z.string().nullable(),
  reference: z.string().nullable(),
  parseError: z.string().nullable(),
});
export type ImportPreviewRow = z.infer<typeof importPreviewRowSchema>;

export const importFormatSchema = z.enum([
  'caja-rural-extremadura-pdf',
  'myinvestor-pdf',
  'myinvestor-csv',
  'generic-csv',
  'unknown',
]);
export type ImportFormat = z.infer<typeof importFormatSchema>;

export const importPreviewResponseSchema = z.object({
  headers: z.array(z.string()),
  // Only present when the file is CSV-shaped (has columns to map). PDFs
  // return undefined here; the UI hides the mapping editor in that case.
  detectedMapping: importMappingSchema.optional(),
  sampleRows: z.array(importPreviewRowSchema),
  stats: importPreviewStatsSchema,
  format: importFormatSchema,
  formatLabel: z.string(),
  // Truncated raw text the parser saw — populated for PDFs to help diagnose
  // detection / parsing issues directly from the UI.
  debugText: z.string().optional(),
});
export type ImportPreviewResponse = z.infer<typeof importPreviewResponseSchema>;

export const importCommitResponseSchema = z.object({
  inserted: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  // Of the inserted rows, how many were auto-categorized by an active rule.
  autoCategorized: z.number().int().nonnegative().default(0),
  format: importFormatSchema.optional(),
});
export type ImportCommitResponse = z.infer<typeof importCommitResponseSchema>;
