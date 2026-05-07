import type { UpdateUserSettingsInput, UserSettings } from '@gp/shared';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { userSettings } from '../db/schema.js';

const DEFAULTS: UserSettings = {
  baseCurrency: 'EUR',
  fiscalYearStartMonth: 1,
  locale: 'es-ES',
  timezone: 'Europe/Madrid',
  expectedPortfolioReturnDefault: '6.5',
  largeExpenseThreshold: '200.00',
};

// Lazy-create on first read so the user always has a row to update.
export async function getUserSettings(userId: string): Promise<UserSettings> {
  const rows = await db
    .select({
      baseCurrency: userSettings.baseCurrency,
      fiscalYearStartMonth: userSettings.fiscalYearStartMonth,
      locale: userSettings.locale,
      timezone: userSettings.timezone,
      expectedPortfolioReturnDefault: userSettings.expectedPortfolioReturnDefault,
      largeExpenseThreshold: userSettings.largeExpenseThreshold,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  const existing = rows[0];
  if (existing) return existing;

  await db
    .insert(userSettings)
    .values({ userId, ...DEFAULTS })
    .onConflictDoNothing();
  return DEFAULTS;
}

export async function updateUserSettings(
  userId: string,
  patch: UpdateUserSettingsInput,
): Promise<UserSettings> {
  await getUserSettings(userId); // guarantees row exists
  await db
    .update(userSettings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(userSettings.userId, userId));
  return getUserSettings(userId);
}
