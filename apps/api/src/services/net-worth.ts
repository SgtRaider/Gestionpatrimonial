import { Decimal } from 'decimal.js';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  accounts,
  holdingValuations,
  holdings,
  institutions,
  loanRateHistory,
  loans,
  transactions,
} from '../db/schema.js';
import { buildSchedule } from './loan-helpers.js';

export type NetWorthAccount = {
  id: string;
  name: string;
  type:
    | 'checking'
    | 'savings'
    | 'brokerage'
    | 'pension'
    | 'crypto'
    | 'real_estate'
    | 'vehicle'
    | 'other';
  currency: string;
  institutionName: string;
  institutionColor: string | null;
  balance: string;
};

export type NetWorthHolding = {
  id: string;
  ticker: string | null;
  isin: string | null;
  name: string;
  accountId: string;
  currency: string;
  quantity: string;
  avgCost: string;
  lastNav: string | null;
  marketValue: string;
};

export type NetWorthLoan = {
  id: string;
  alias: string | null;
  lender: string;
  outstanding: string;
};

export type NetWorthBreakdown = {
  asOf: string;
  accounts: NetWorthAccount[];
  holdings: NetWorthHolding[];
  loans: NetWorthLoan[];
  totals: {
    liquid: string;
    invested: string;
    realEstate: string;
    other: string;
    liabilities: string;
    netWorth: string;
  };
};

const INVESTED_TYPES = new Set(['brokerage', 'pension', 'crypto']);
const LIQUID_TYPES = new Set(['checking', 'savings']);
const REAL_ESTATE_TYPES = new Set(['real_estate']);

export async function computeNetWorth(userId: string): Promise<NetWorthBreakdown> {
  const accountRows = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
      currency: accounts.currency,
      institutionName: institutions.name,
      institutionColor: institutions.color,
      balance: sql<string>`COALESCE(SUM(${transactions.amount}) FILTER (WHERE ${transactions.deletedAt} IS NULL AND ${transactions.isProjection} = false), 0)::text`,
    })
    .from(accounts)
    .innerJoin(institutions, eq(accounts.institutionId, institutions.id))
    .leftJoin(transactions, eq(transactions.accountId, accounts.id))
    .where(
      and(eq(accounts.userId, userId), eq(accounts.isActive, true), isNull(accounts.deletedAt)),
    )
    .groupBy(accounts.id, institutions.id)
    .orderBy(asc(institutions.name), asc(accounts.name));

  const holdingRows = await db
    .select({
      id: holdings.id,
      ticker: holdings.ticker,
      isin: holdings.isin,
      name: holdings.name,
      accountId: holdings.accountId,
      currency: holdings.currency,
      quantity: holdings.quantity,
      avgCost: holdings.avgCost,
      lastNav: sql<
        string | null
      >`(SELECT v.nav::text FROM ${holdingValuations} v WHERE v.holding_id = ${holdings.id} ORDER BY v.valuation_at DESC LIMIT 1)`,
    })
    .from(holdings)
    .innerJoin(accounts, eq(holdings.accountId, accounts.id))
    .where(and(eq(accounts.userId, userId), isNull(holdings.closedAt), isNull(holdings.deletedAt)))
    .orderBy(asc(holdings.name));

  const loanRows = await db
    .select()
    .from(loans)
    .where(and(eq(loans.userId, userId), isNull(loans.deletedAt)));

  const loanBreakdown: NetWorthLoan[] = [];
  let totalLiabilities = new Decimal(0);
  for (const loan of loanRows) {
    const rateRows = await db
      .select()
      .from(loanRateHistory)
      .where(eq(loanRateHistory.loanId, loan.id))
      .orderBy(asc(loanRateHistory.effectiveAt));
    const schedule = buildSchedule(loan, rateRows);
    const today = new Date().toISOString().slice(0, 10);
    const nextOrLast = schedule.find((r) => r.dueAt > today) ?? schedule[schedule.length - 1];
    const outstanding = nextOrLast?.outstandingAfter ?? loan.principalInitial;
    loanBreakdown.push({
      id: loan.id,
      alias: loan.alias,
      lender: loan.lender,
      outstanding,
    });
    totalLiabilities = totalLiabilities.plus(outstanding);
  }

  const accountBreakdown: NetWorthAccount[] = accountRows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    currency: r.currency,
    institutionName: r.institutionName,
    institutionColor: r.institutionColor,
    balance: new Decimal(r.balance).toFixed(2),
  }));

  const holdingBreakdown: NetWorthHolding[] = holdingRows.map((h) => {
    const qty = new Decimal(h.quantity);
    const nav = h.lastNav ? new Decimal(h.lastNav) : new Decimal(0);
    return {
      id: h.id,
      ticker: h.ticker,
      isin: h.isin,
      name: h.name,
      accountId: h.accountId,
      currency: h.currency,
      quantity: qty.toFixed(8),
      avgCost: h.avgCost,
      lastNav: h.lastNav,
      marketValue: qty.times(nav).toFixed(2),
    };
  });

  let liquid = new Decimal(0);
  let invested = new Decimal(0);
  let realEstate = new Decimal(0);
  let other = new Decimal(0);
  for (const a of accountBreakdown) {
    const b = new Decimal(a.balance);
    if (LIQUID_TYPES.has(a.type)) liquid = liquid.plus(b);
    else if (INVESTED_TYPES.has(a.type)) invested = invested.plus(b);
    else if (REAL_ESTATE_TYPES.has(a.type)) realEstate = realEstate.plus(b);
    else other = other.plus(b);
  }
  // Holdings sit on brokerage accounts but their market value is independent
  // of the cash balance — sum them on top of `invested`.
  for (const h of holdingBreakdown) {
    invested = invested.plus(h.marketValue);
  }

  const totalAssets = liquid.plus(invested).plus(realEstate).plus(other);
  const netWorth = totalAssets.minus(totalLiabilities);

  return {
    asOf: new Date().toISOString().slice(0, 10),
    accounts: accountBreakdown,
    holdings: holdingBreakdown,
    loans: loanBreakdown,
    totals: {
      liquid: liquid.toFixed(2),
      invested: invested.toFixed(2),
      realEstate: realEstate.toFixed(2),
      other: other.toFixed(2),
      liabilities: totalLiabilities.toFixed(2),
      netWorth: netWorth.toFixed(2),
    },
  };
}
