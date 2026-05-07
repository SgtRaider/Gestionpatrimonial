import { sql } from 'drizzle-orm';
import {
  accountsFixture,
  categoriesFixture,
  getTransactionsFixture,
  institutionsFixture,
} from '../fixtures/transactions.js';
import { db, pool } from './index.js';
import {
  accounts,
  categories,
  institutions,
  recurringRules,
  transactionTags,
  transactions,
  userSettings,
  users,
} from './schema.js';

const DEFAULT_USER_ID = '01951b00-0000-7000-8000-000000000001';

// Recurring-rule UUIDs referenced by transactions in the fixture.
// Keep in sync with apps/api/src/fixtures/transactions.ts.
const recurringRulesSeed = [
  {
    id: '01951b00-5000-7000-8000-000000000051',
    name: 'Netflix',
    kind: 'subscription' as const,
    expectedAmount: '13.99',
    frequency: 'monthly' as const,
    categorySlug: 'catStreaming',
  },
  {
    id: '01951b00-5000-7000-8000-000000000052',
    name: 'Spotify',
    kind: 'subscription' as const,
    expectedAmount: '10.99',
    frequency: 'monthly' as const,
    categorySlug: 'catStreaming',
  },
  {
    id: '01951b00-5000-7000-8000-000000000053',
    name: 'Hipoteca BBVA',
    kind: 'bill' as const,
    expectedAmount: '612.40',
    frequency: 'monthly' as const,
    categorySlug: 'catHipotecaCapital',
  },
  {
    id: '01951b00-5000-7000-8000-000000000054',
    name: 'Nómina EMPLEADOR SA',
    kind: 'salary' as const,
    expectedAmount: '2450.00',
    frequency: 'monthly' as const,
    categorySlug: 'catNomina',
  },
];

async function truncateAll() {
  await db.execute(sql`
    TRUNCATE TABLE
      transaction_tags,
      transaction_attachments,
      transactions,
      recurring_rules,
      categorization_rules,
      categories,
      balances,
      accounts,
      institutions,
      user_settings,
      users
    RESTART IDENTITY CASCADE
  `);
}

async function seed() {
  process.stdout.write('Truncating tables…\n');
  await truncateAll();

  process.stdout.write('Inserting default user…\n');
  await db.insert(users).values({
    id: DEFAULT_USER_ID,
    email: 'demo@gestionpatrimonial.local',
    passwordHash: '$argon2id$placeholder-not-for-prod',
    displayName: 'Demo',
  });
  await db.insert(userSettings).values({
    userId: DEFAULT_USER_ID,
  });

  process.stdout.write(`Inserting ${institutionsFixture.length} institutions…\n`);
  await db.insert(institutions).values(
    institutionsFixture.map((i) => ({
      id: i.id,
      userId: DEFAULT_USER_ID,
      name: i.name,
      type: i.type,
      country: i.country,
      color: i.color,
    })),
  );

  process.stdout.write(`Inserting ${accountsFixture.length} accounts…\n`);
  await db.insert(accounts).values(
    accountsFixture.map((a) => ({
      id: a.id,
      userId: DEFAULT_USER_ID,
      institutionId: a.institutionId,
      name: a.name,
      type: a.type as 'checking' | 'savings' | 'brokerage' | 'pension',
      currency: a.currency,
      ibanLast4: a.ibanLast4 ?? null,
      isActive: a.isActive,
    })),
  );

  process.stdout.write(`Inserting ${categoriesFixture.length} categories…\n`);
  // Insert in two passes: roots first, then children, to respect parent_id FK.
  const roots = categoriesFixture.filter((c) => c.parentId === null);
  const children = categoriesFixture.filter((c) => c.parentId !== null);
  await db.insert(categories).values(
    roots.map((c) => ({
      id: c.id,
      userId: DEFAULT_USER_ID,
      parentId: null,
      name: c.name,
      kind: c.kind,
      color: c.color,
      iconKey: c.iconKey,
    })),
  );
  await db.insert(categories).values(
    children.map((c) => ({
      id: c.id,
      userId: DEFAULT_USER_ID,
      parentId: c.parentId,
      name: c.name,
      kind: c.kind,
      color: c.color,
      iconKey: c.iconKey,
    })),
  );

  process.stdout.write(`Inserting ${recurringRulesSeed.length} recurring rules…\n`);
  const categoryByName = new Map(categoriesFixture.map((c) => [c.id, c]));
  await db.insert(recurringRules).values(
    recurringRulesSeed.map((r) => {
      const slugToId: Record<string, string> = {
        catStreaming: '01951b00-3000-7000-8000-000000000341',
        catHipotecaCapital: '01951b00-3000-7000-8000-000000000311',
        catNomina: '01951b00-3000-7000-8000-000000000361',
      };
      const categoryId = slugToId[r.categorySlug] ?? null;
      if (categoryId && !categoryByName.has(categoryId)) {
        throw new Error(`Recurring rule ${r.name} references unknown category`);
      }
      return {
        id: r.id,
        userId: DEFAULT_USER_ID,
        name: r.name,
        kind: r.kind,
        expectedAmount: r.expectedAmount,
        currency: 'EUR',
        frequency: r.frequency,
        categoryId,
        accountId: null,
        status: 'active' as const,
        detectedAutomatically: false,
      };
    }),
  );

  const fixtureTxs = getTransactionsFixture();
  process.stdout.write(`Inserting ${fixtureTxs.length} transactions…\n`);
  await db.insert(transactions).values(
    fixtureTxs.map((t) => ({
      id: t.id,
      userId: DEFAULT_USER_ID,
      accountId: t.accountId,
      bookedAt: new Date(t.bookedAt),
      valueAt: t.valueAt ? new Date(t.valueAt) : null,
      amount: t.amount,
      currency: t.currency,
      amountBaseCurrency: t.amountBaseCurrency,
      descriptionRaw: t.descriptionRaw,
      counterparty: t.counterparty,
      normalizedMerchant: t.normalizedMerchant,
      merchantAliasUser: t.merchantAliasUser,
      categoryId: t.categoryId,
      status: t.status,
      source: t.source,
      transferPairId: t.transferPairId,
      parentTransactionId: t.parentTransactionId,
      recurringRuleId: t.recurringRuleId,
      notes: t.notes,
      isProjection: t.isProjection,
    })),
  );

  // Tags: flatten tx → tag pairs
  const tagRows = fixtureTxs.flatMap((t) => t.tags.map((tag) => ({ transactionId: t.id, tag })));
  if (tagRows.length > 0) {
    process.stdout.write(`Inserting ${tagRows.length} transaction tags…\n`);
    await db.insert(transactionTags).values(tagRows);
  }

  process.stdout.write('Seed complete.\n');
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    process.stderr.write(`Seed failed: ${err instanceof Error ? err.stack : String(err)}\n`);
    pool.end().finally(() => process.exit(1));
  });
