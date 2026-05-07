import { z } from 'zod';
import { decimalString } from './transaction.js';

export const userSettingsSchema = z.object({
  baseCurrency: z.string().length(3),
  fiscalYearStartMonth: z.number().int().min(1).max(12),
  locale: z.string().min(2).max(10),
  timezone: z.string().min(1).max(50),
  expectedPortfolioReturnDefault: decimalString,
  largeExpenseThreshold: decimalString,
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

export const updateUserSettingsSchema = userSettingsSchema.partial();
export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsSchema>;
