import { z } from 'zod';
import { accountTypeSchema } from '../enums.js';
import { decimalString } from './transaction.js';

export const netWorthAccountSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: accountTypeSchema,
  currency: z.string().length(3),
  institutionName: z.string(),
  institutionColor: z.string().nullable(),
  balance: decimalString,
});
export type NetWorthAccount = z.infer<typeof netWorthAccountSchema>;

export const netWorthHoldingSchema = z.object({
  id: z.string().uuid(),
  ticker: z.string().nullable(),
  isin: z.string().nullable(),
  name: z.string(),
  accountId: z.string().uuid(),
  currency: z.string().length(3),
  quantity: decimalString,
  avgCost: decimalString,
  lastNav: decimalString.nullable(),
  marketValue: decimalString,
});
export type NetWorthHolding = z.infer<typeof netWorthHoldingSchema>;

export const netWorthLoanSchema = z.object({
  id: z.string().uuid(),
  alias: z.string().nullable(),
  lender: z.string(),
  outstanding: decimalString,
});
export type NetWorthLoan = z.infer<typeof netWorthLoanSchema>;

export const netWorthBreakdownSchema = z.object({
  asOf: z.string().date(),
  accounts: z.array(netWorthAccountSchema),
  holdings: z.array(netWorthHoldingSchema),
  loans: z.array(netWorthLoanSchema),
  totals: z.object({
    liquid: decimalString,
    invested: decimalString,
    realEstate: decimalString,
    other: decimalString,
    liabilities: decimalString,
    netWorth: decimalString,
  }),
});
export type NetWorthBreakdown = z.infer<typeof netWorthBreakdownSchema>;
