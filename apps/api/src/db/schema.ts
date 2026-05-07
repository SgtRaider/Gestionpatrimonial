import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { v7 as uuidv7 } from 'uuid';

// =============================================================================
// CONVENTIONS
// -----------------------------------------------------------------------------
// - IDs:        UUID v7 (time-ordered).
// - Timestamps: timestamptz, never timestamp without zone.
// - Money:      numeric(15,2) for fiat, numeric(20,8) for crypto. Never float.
// - Soft delete: nullable `deleted_at` on user-owned logical entities.
// - Audit:      `created_at` and `updated_at` automatic via DB triggers (added
//               in a follow-up SQL migration since drizzle-kit doesn't generate
//               triggers natively).
// - FK policy:  default RESTRICT; soft-delete the parent and let children stay
//               queryable. Junction tables CASCADE.
// =============================================================================

const id = () =>
  uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7());
const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).defaultNow().notNull();
const deletedAt = () => timestamp('deleted_at', { withTimezone: true });

const money = (name: string) => numeric(name, { precision: 15, scale: 2 });
const moneyCrypto = (name: string) => numeric(name, { precision: 20, scale: 8 });
const pct = (name: string) => numeric(name, { precision: 8, scale: 4 });

// =============================================================================
// ENUMS
// =============================================================================

export const accountTypeEnum = pgEnum('account_type', [
  'checking',
  'savings',
  'brokerage',
  'pension',
  'crypto',
  'real_estate',
  'vehicle',
  'other',
]);

export const institutionTypeEnum = pgEnum('institution_type', [
  'bank',
  'broker',
  'insurer',
  'crypto_exchange',
  'real_estate',
  'manual',
]);

export const transactionStatusEnum = pgEnum('transaction_status', ['booked', 'pending']);

export const transactionSourceEnum = pgEnum('transaction_source', [
  'psd2',
  'csv',
  'scrape',
  'manual',
  'derived',
]);

export const categoryKindEnum = pgEnum('category_kind', ['expense', 'income', 'transfer']);

export const holdingTransactionKindEnum = pgEnum('holding_transaction_kind', [
  'buy',
  'sell',
  'transfer_in',
  'transfer_out',
  'dividend',
  'split',
  'fee',
  'tax',
]);

export const loanKindEnum = pgEnum('loan_kind', [
  'mortgage',
  'personal',
  'car',
  'student',
  'other',
]);

export const amortizationSystemEnum = pgEnum('amortization_system', [
  'french',
  'german',
  'american',
  'bullet',
]);

export const rateTypeEnum = pgEnum('rate_type', ['fixed', 'variable', 'mixed']);

export const rateSourceEnum = pgEnum('rate_source', ['contract', 'review', 'novation']);

export const prepaymentModeEnum = pgEnum('prepayment_mode', ['reduce_term', 'reduce_payment']);

export const recurringKindEnum = pgEnum('recurring_kind', [
  'subscription',
  'bill',
  'salary',
  'rent',
  'transfer',
  'other',
]);

export const recurringFrequencyEnum = pgEnum('recurring_frequency', [
  'weekly',
  'monthly',
  'bimonthly',
  'quarterly',
  'biannual',
  'yearly',
  'custom',
]);

export const recurringStatusEnum = pgEnum('recurring_status', ['active', 'paused', 'cancelled']);

export const recurringAmountKindEnum = pgEnum('recurring_amount_kind', ['fixed', 'variable']);

export const plannedEventKindEnum = pgEnum('planned_event_kind', [
  'expense',
  'income',
  'transfer',
  'asset_purchase',
  'asset_sale',
  'loan_origination',
  'loan_payoff',
  'life_event',
]);

export const certaintyEnum = pgEnum('certainty', ['low', 'medium', 'high', 'certain']);

export const plannedEventStatusEnum = pgEnum('planned_event_status', [
  'planned',
  'confirmed',
  'executed',
  'cancelled',
]);

export const goalStatusEnum = pgEnum('goal_status', ['active', 'achieved', 'abandoned']);

export const insightKindEnum = pgEnum('insight_kind', [
  'unused_subscription',
  'idle_liquidity',
  'mortgage_vs_invest',
  'high_fees',
  'modelo_720_alert',
  'category_spike',
  'low_savings_rate',
  'rebalance_suggestion',
  'other',
]);

export const insightSeverityEnum = pgEnum('insight_severity', ['info', 'warning', 'urgent']);

// =============================================================================
// IDENTITY
// =============================================================================

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  totpSecret: text('totp_secret'),
  totpEnabled: boolean('totp_enabled').default(false).notNull(),
  displayName: varchar('display_name', { length: 100 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: deletedAt(),
});

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  baseCurrency: varchar('base_currency', { length: 3 }).default('EUR').notNull(),
  fiscalYearStartMonth: integer('fiscal_year_start_month').default(1).notNull(),
  locale: varchar('locale', { length: 10 }).default('es-ES').notNull(),
  timezone: varchar('timezone', { length: 50 }).default('Europe/Madrid').notNull(),
  expectedPortfolioReturnDefault: pct('expected_portfolio_return_default').default('6.5').notNull(),
  largeExpenseThreshold: money('large_expense_threshold').default('200').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// =============================================================================
// FX RATES (multi-currency)
// =============================================================================

export const fxRates = pgTable(
  'fx_rates',
  {
    id: id(),
    fromCurrency: varchar('from_currency', { length: 3 }).notNull(),
    toCurrency: varchar('to_currency', { length: 3 }).notNull(),
    rate: numeric('rate', { precision: 20, scale: 10 }).notNull(),
    valuationDate: date('valuation_date').notNull(),
    source: varchar('source', { length: 50 }),
    createdAt: createdAt(),
  },
  (t) => ({
    fxUnique: uniqueIndex('fx_rates_unique').on(t.fromCurrency, t.toCurrency, t.valuationDate),
    fxDateIdx: index('fx_rates_date_idx').on(t.valuationDate.desc()),
  }),
);

// =============================================================================
// INSTITUTIONS & ACCOUNTS
// =============================================================================

export const institutions = pgTable('institutions', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  type: institutionTypeEnum('type').notNull(),
  country: varchar('country', { length: 2 }).default('ES').notNull(),
  psd2InstitutionId: varchar('psd2_institution_id', { length: 100 }),
  bic: varchar('bic', { length: 11 }),
  color: varchar('color', { length: 9 }),
  iconKey: varchar('icon_key', { length: 50 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: deletedAt(),
});

export const accounts = pgTable(
  'accounts',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id),
    name: varchar('name', { length: 100 }).notNull(),
    type: accountTypeEnum('type').notNull(),
    currency: varchar('currency', { length: 3 }).default('EUR').notNull(),
    ibanLast4: varchar('iban_last4', { length: 4 }),
    externalAccountId: varchar('external_account_id', { length: 100 }),
    openedAt: date('opened_at'),
    closedAt: date('closed_at'),
    isActive: boolean('is_active').default(true).notNull(),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    accountsUserIdx: index('accounts_user_idx').on(t.userId, t.isActive),
    externalUnique: uniqueIndex('accounts_external_unique').on(
      t.institutionId,
      t.externalAccountId,
    ),
  }),
);

export const balances = pgTable(
  'balances',
  {
    id: id(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull(),
    available: money('available').notNull(),
    booked: money('booked').notNull(),
    source: transactionSourceEnum('source').notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    balancesAccountIdx: index('balances_account_idx').on(t.accountId, t.snapshotAt.desc()),
    balancesUnique: uniqueIndex('balances_unique').on(t.accountId, t.snapshotAt),
  }),
);

// =============================================================================
// CATEGORIES & CATEGORIZATION RULES
// =============================================================================

export const categories = pgTable(
  'categories',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => categories.id),
    name: varchar('name', { length: 100 }).notNull(),
    kind: categoryKindEnum('kind').notNull(),
    color: varchar('color', { length: 9 }),
    iconKey: varchar('icon_key', { length: 50 }),
    sortOrder: integer('sort_order').default(0).notNull(),
    isSystem: boolean('is_system').default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    categoriesUserIdx: index('categories_user_idx').on(t.userId, t.kind),
    categoriesParentIdx: index('categories_parent_idx').on(t.parentId),
  }),
);

export const categorizationRules = pgTable(
  'categorization_rules',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    priority: integer('priority').default(0).notNull(),
    patternRegex: text('pattern_regex').notNull(),
    accountId: uuid('account_id').references(() => accounts.id),
    amountMin: money('amount_min'),
    amountMax: money('amount_max'),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    suggestedFromTransactionId: uuid('suggested_from_transaction_id'),
    active: boolean('active').default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    rulesUserPriorityIdx: index('categorization_rules_user_priority_idx').on(t.userId, t.priority),
  }),
);

// =============================================================================
// TRANSACTIONS
// =============================================================================

export const recurringRules = pgTable(
  'recurring_rules',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    kind: recurringKindEnum('kind').notNull(),
    expectedAmount: money('expected_amount').notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    frequency: recurringFrequencyEnum('frequency').notNull(),
    cronExpr: varchar('cron_expr', { length: 100 }),
    nextExpectedAt: date('next_expected_at'),
    categoryId: uuid('category_id').references(() => categories.id),
    accountId: uuid('account_id').references(() => accounts.id),
    status: recurringStatusEnum('status').default('active').notNull(),
    amountKind: recurringAmountKindEnum('amount_kind').default('fixed').notNull(),
    detectedAutomatically: boolean('detected_automatically').default(false).notNull(),
    confidence: pct('confidence'),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    recurringUserStatusIdx: index('recurring_user_status_idx').on(t.userId, t.status),
    recurringNextIdx: index('recurring_next_idx').on(t.nextExpectedAt),
  }),
);

export const transactions = pgTable(
  'transactions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    bookedAt: timestamp('booked_at', { withTimezone: true }).notNull(),
    valueAt: timestamp('value_at', { withTimezone: true }),
    amount: money('amount').notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    fxRateUsed: numeric('fx_rate_used', { precision: 20, scale: 10 }),
    amountBaseCurrency: money('amount_base_currency'),
    descriptionRaw: text('description_raw').notNull(),
    counterparty: varchar('counterparty', { length: 200 }),
    normalizedMerchant: varchar('normalized_merchant', { length: 200 }),
    merchantAliasUser: varchar('merchant_alias_user', { length: 200 }),
    categoryId: uuid('category_id').references(() => categories.id),
    status: transactionStatusEnum('status').default('booked').notNull(),
    source: transactionSourceEnum('source').notNull(),
    externalId: varchar('external_id', { length: 200 }),
    transferPairId: uuid('transfer_pair_id'),
    parentTransactionId: uuid('parent_transaction_id').references(
      (): AnyPgColumn => transactions.id,
    ),
    recurringRuleId: uuid('recurring_rule_id').references(() => recurringRules.id),
    notes: text('notes'),
    isProjection: boolean('is_projection').default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    txUserBookedIdx: index('transactions_user_booked_idx').on(t.userId, t.bookedAt.desc()),
    txAccountBookedIdx: index('transactions_account_booked_idx').on(t.accountId, t.bookedAt.desc()),
    txCategoryIdx: index('transactions_category_idx').on(t.categoryId),
    txTransferPairIdx: index('transactions_transfer_pair_idx').on(t.transferPairId),
    txExternalUnique: uniqueIndex('transactions_external_unique').on(t.accountId, t.externalId),
  }),
);

export const transactionTags = pgTable(
  'transaction_tags',
  {
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    tag: varchar('tag', { length: 50 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.transactionId, t.tag] }),
    tagIdx: index('transaction_tags_tag_idx').on(t.tag),
  }),
);

export const transactionAttachments = pgTable('transaction_attachments', {
  id: id(),
  transactionId: uuid('transaction_id')
    .notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  storagePath: text('storage_path').notNull(),
  mimeType: varchar('mime_type', { length: 100 }),
  sizeBytes: integer('size_bytes'),
  kind: varchar('kind', { length: 50 }).default('receipt').notNull(),
  createdAt: createdAt(),
  deletedAt: deletedAt(),
});

export const unidentifiedExpenses = pgTable(
  'unidentified_expenses',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    amount: money('amount').notNull(),
    currency: varchar('currency', { length: 3 }).default('EUR').notNull(),
    description: text('description'),
    categoryId: uuid('category_id').references(() => categories.id),
    location: varchar('location', { length: 200 }),
    geoLat: numeric('geo_lat', { precision: 9, scale: 6 }),
    geoLon: numeric('geo_lon', { precision: 9, scale: 6 }),
    transactionId: uuid('transaction_id').references(() => transactions.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    unidentifiedUserOccurredIdx: index('unidentified_user_occurred_idx').on(
      t.userId,
      t.occurredAt.desc(),
    ),
  }),
);

// =============================================================================
// INVESTMENTS
// =============================================================================

export const holdings = pgTable(
  'holdings',
  {
    id: id(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    isin: varchar('isin', { length: 12 }),
    ticker: varchar('ticker', { length: 20 }),
    name: varchar('name', { length: 200 }).notNull(),
    assetClass: varchar('asset_class', { length: 50 }),
    currency: varchar('currency', { length: 3 }).notNull(),
    quantity: moneyCrypto('quantity').notNull(),
    avgCost: numeric('avg_cost', { precision: 20, scale: 8 }).notNull(),
    openedAt: date('opened_at'),
    closedAt: date('closed_at'),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    holdingsAccountIdx: index('holdings_account_idx').on(t.accountId),
    holdingsIsinIdx: index('holdings_isin_idx').on(t.isin),
  }),
);

export const holdingValuations = pgTable(
  'holding_valuations',
  {
    id: id(),
    holdingId: uuid('holding_id')
      .notNull()
      .references(() => holdings.id, { onDelete: 'cascade' }),
    valuationAt: date('valuation_at').notNull(),
    nav: numeric('nav', { precision: 20, scale: 8 }).notNull(),
    totalValue: money('total_value').notNull(),
    source: varchar('source', { length: 50 }),
    createdAt: createdAt(),
  },
  (t) => ({
    valuationsUnique: uniqueIndex('holding_valuations_unique').on(t.holdingId, t.valuationAt),
  }),
);

export const holdingTransactions = pgTable(
  'holding_transactions',
  {
    id: id(),
    holdingId: uuid('holding_id')
      .notNull()
      .references(() => holdings.id),
    kind: holdingTransactionKindEnum('kind').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    quantity: moneyCrypto('quantity').notNull(),
    price: numeric('price', { precision: 20, scale: 8 }).notNull(),
    fees: money('fees').default('0').notNull(),
    taxes: money('taxes').default('0').notNull(),
    fiscalEventGroupId: uuid('fiscal_event_group_id'),
    transactionId: uuid('transaction_id').references(() => transactions.id),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    holdingTxHoldingIdx: index('holding_tx_holding_idx').on(t.holdingId, t.occurredAt.desc()),
    holdingTxFiscalGroupIdx: index('holding_tx_fiscal_group_idx').on(t.fiscalEventGroupId),
  }),
);

// =============================================================================
// NET WORTH SNAPSHOTS (materialized)
// =============================================================================

export const netWorthSnapshots = pgTable(
  'net_worth_snapshots',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    snapshotAt: date('snapshot_at').notNull(),
    assetsLiquid: money('assets_liquid').notNull(),
    assetsInvested: money('assets_invested').notNull(),
    assetsRealEstate: money('assets_real_estate').notNull(),
    assetsOther: money('assets_other').notNull(),
    liabilitiesTotal: money('liabilities_total').notNull(),
    netWorth: money('net_worth').notNull(),
    breakdown: jsonb('breakdown'),
    createdAt: createdAt(),
  },
  (t) => ({
    netWorthUnique: uniqueIndex('net_worth_unique').on(t.userId, t.snapshotAt),
    netWorthDateIdx: index('net_worth_date_idx').on(t.snapshotAt.desc()),
  }),
);

// =============================================================================
// LOANS (mortgages, personal, car...)
// =============================================================================

export const loans = pgTable(
  'loans',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id').references(() => accounts.id),
    linkedAssetAccountId: uuid('linked_asset_account_id').references(() => accounts.id),
    kind: loanKindEnum('kind').notNull(),
    alias: varchar('alias', { length: 100 }),
    lender: varchar('lender', { length: 100 }).notNull(),
    principalInitial: money('principal_initial').notNull(),
    currency: varchar('currency', { length: 3 }).default('EUR').notNull(),
    startedAt: date('started_at').notNull(),
    termMonths: integer('term_months').notNull(),
    amortizationSystem: amortizationSystemEnum('amortization_system').default('french').notNull(),
    rateType: rateTypeEnum('rate_type').notNull(),
    rateFixed: pct('rate_fixed'),
    rateIndex: varchar('rate_index', { length: 50 }),
    rateSpread: pct('rate_spread'),
    reviewFrequencyMonths: integer('review_frequency_months'),
    nextReviewAt: date('next_review_at'),
    prepaymentFeePct: pct('prepayment_fee_pct').default('0'),
    fiscalDeductible: boolean('fiscal_deductible').default(false).notNull(),
    linkedProducts: jsonb('linked_products'),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    loansUserIdx: index('loans_user_idx').on(t.userId),
  }),
);

export const loanRateHistory = pgTable(
  'loan_rate_history',
  {
    id: id(),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => loans.id, { onDelete: 'cascade' }),
    effectiveAt: date('effective_at').notNull(),
    rate: pct('rate').notNull(),
    indexValueAtReview: pct('index_value_at_review'),
    spread: pct('spread'),
    source: rateSourceEnum('source').notNull(),
    notes: text('notes'),
    createdAt: createdAt(),
  },
  (t) => ({
    rateHistoryLoanIdx: index('loan_rate_history_loan_idx').on(t.loanId, t.effectiveAt.desc()),
  }),
);

export const loanAmortizationSchedule = pgTable(
  'loan_amortization_schedule',
  {
    id: id(),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => loans.id, { onDelete: 'cascade' }),
    period: integer('period').notNull(),
    dueAt: date('due_at').notNull(),
    payment: money('payment').notNull(),
    principal: money('principal').notNull(),
    interest: money('interest').notNull(),
    outstandingAfter: money('outstanding_after').notNull(),
    isProjection: boolean('is_projection').default(true).notNull(),
    isGracePeriod: boolean('is_grace_period').default(false).notNull(),
    rateApplied: pct('rate_applied'),
    createdAt: createdAt(),
  },
  (t) => ({
    scheduleLoanPeriodUnique: uniqueIndex('schedule_loan_period_unique').on(t.loanId, t.period),
    scheduleLoanDueIdx: index('schedule_loan_due_idx').on(t.loanId, t.dueAt),
  }),
);

export const loanPrepayments = pgTable(
  'loan_prepayments',
  {
    id: id(),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => loans.id, { onDelete: 'cascade' }),
    occurredAt: date('occurred_at').notNull(),
    amount: money('amount').notNull(),
    mode: prepaymentModeEnum('mode').notNull(),
    feeAmount: money('fee_amount').default('0'),
    transactionId: uuid('transaction_id').references(() => transactions.id),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    prepaymentsLoanIdx: index('prepayments_loan_idx').on(t.loanId, t.occurredAt.desc()),
  }),
);

export const loanPayments = pgTable(
  'loan_payments',
  {
    id: id(),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => loans.id, { onDelete: 'cascade' }),
    transactionId: uuid('transaction_id').references(() => transactions.id),
    occurredAt: date('occurred_at').notNull(),
    period: integer('period'),
    principalPaid: money('principal_paid').notNull(),
    interestPaid: money('interest_paid').notNull(),
    feesPaid: money('fees_paid').default('0').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    paymentsLoanIdx: index('payments_loan_idx').on(t.loanId, t.occurredAt.desc()),
  }),
);

// =============================================================================
// PLANNING (goals, planned events, scenarios, forecasts)
// =============================================================================

export const goals = pgTable(
  'goals',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    targetAmount: money('target_amount').notNull(),
    currency: varchar('currency', { length: 3 }).default('EUR').notNull(),
    targetDate: date('target_date'),
    currentAmount: money('current_amount').default('0').notNull(),
    monthlyContributionTarget: money('monthly_contribution_target'),
    linkedAccountId: uuid('linked_account_id').references(() => accounts.id),
    priority: integer('priority').default(0).notNull(),
    status: goalStatusEnum('status').default('active').notNull(),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    goalsUserStatusIdx: index('goals_user_status_idx').on(t.userId, t.status),
  }),
);

export const plannedEvents = pgTable(
  'planned_events',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    kind: plannedEventKindEnum('kind').notNull(),
    amount: money('amount').notNull(),
    currency: varchar('currency', { length: 3 }).default('EUR').notNull(),
    scheduledAt: date('scheduled_at').notNull(),
    recurrenceFrequency: recurringFrequencyEnum('recurrence_frequency'),
    recurrenceUntil: date('recurrence_until'),
    certainty: certaintyEnum('certainty').default('medium').notNull(),
    categoryId: uuid('category_id').references(() => categories.id),
    accountId: uuid('account_id').references(() => accounts.id),
    goalId: uuid('goal_id').references(() => goals.id),
    notes: text('notes'),
    status: plannedEventStatusEnum('status').default('planned').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    plannedUserScheduledIdx: index('planned_user_scheduled_idx').on(t.userId, t.scheduledAt),
    plannedStatusIdx: index('planned_status_idx').on(t.status),
  }),
);

export const scenarios = pgTable(
  'scenarios',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    baseScenarioId: uuid('base_scenario_id').references((): AnyPgColumn => scenarios.id),
    modifications: jsonb('modifications'),
    isDefault: boolean('is_default').default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    scenariosUserIdx: index('scenarios_user_idx').on(t.userId),
  }),
);

export const forecastRuns = pgTable(
  'forecast_runs',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scenarioId: uuid('scenario_id').references(() => scenarios.id),
    runAt: timestamp('run_at', { withTimezone: true }).defaultNow().notNull(),
    horizonMonths: integer('horizon_months').notNull(),
    parameters: jsonb('parameters'),
    result: jsonb('result'),
    createdAt: createdAt(),
  },
  (t) => ({
    forecastUserRunIdx: index('forecast_user_run_idx').on(t.userId, t.runAt.desc()),
  }),
);

// =============================================================================
// INSIGHTS
// =============================================================================

export const insights = pgTable(
  'insights',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: insightKindEnum('kind').notNull(),
    severity: insightSeverityEnum('severity').default('info').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    estimatedSavings: money('estimated_savings'),
    actionPayload: jsonb('action_payload'),
    payload: jsonb('payload'),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
    actedAt: timestamp('acted_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    insightsUserActiveIdx: index('insights_user_active_idx').on(t.userId, t.dismissedAt, t.actedAt),
    insightsKindIdx: index('insights_kind_idx').on(t.kind),
  }),
);

// =============================================================================
// AUDIT LOG
// =============================================================================

export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
    entity: varchar('entity', { length: 50 }).notNull(),
    entityId: uuid('entity_id'),
    action: varchar('action', { length: 50 }).notNull(),
    diff: jsonb('diff'),
    actor: varchar('actor', { length: 100 }),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
  },
  (t) => ({
    auditEntityIdx: index('audit_entity_idx').on(t.entity, t.entityId),
    auditUserOccurredIdx: index('audit_user_occurred_idx').on(t.userId, t.occurredAt.desc()),
  }),
);

// =============================================================================
// EXPORTED TABLE GROUPS (for convenience)
// =============================================================================

export const allTables = {
  users,
  userSettings,
  fxRates,
  institutions,
  accounts,
  balances,
  categories,
  categorizationRules,
  recurringRules,
  transactions,
  transactionTags,
  transactionAttachments,
  unidentifiedExpenses,
  holdings,
  holdingValuations,
  holdingTransactions,
  netWorthSnapshots,
  loans,
  loanRateHistory,
  loanAmortizationSchedule,
  loanPrepayments,
  loanPayments,
  goals,
  plannedEvents,
  scenarios,
  forecastRuns,
  insights,
  auditLog,
} as const;

// Drizzle type helpers
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Loan = typeof loans.$inferSelect;
export type NewLoan = typeof loans.$inferInsert;
export type LoanAmortizationRow = typeof loanAmortizationSchedule.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Holding = typeof holdings.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type PlannedEvent = typeof plannedEvents.$inferSelect;
export type Insight = typeof insights.$inferSelect;

// SQL utility re-export so callers don't have to import from drizzle-orm
export { sql };
