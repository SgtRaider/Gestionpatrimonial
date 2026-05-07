import { Decimal } from 'decimal.js';

export type AmortizationSystem = 'french' | 'german' | 'american' | 'bullet';

export type RateChange = {
  // Effective from this date onward (inclusive). The first entry should match
  // the loan's start date.
  effectiveAt: Date;
  // Annual rate as a decimal (3.52% → "3.52" or "0.0352"; we accept either by
  // sniffing whether the value is > 1).
  rate: string;
};

export type AmortizationInput = {
  principalInitial: string;
  termMonths: number;
  // First payment due date. Subsequent payments use the same day-of-month.
  startDate: Date;
  amortizationSystem: AmortizationSystem;
  rates: RateChange[];
};

export type AmortizationRow = {
  period: number;
  dueAt: string; // YYYY-MM-DD
  payment: string;
  principal: string;
  interest: string;
  outstandingAfter: string;
  rateApplied: string; // annual rate, percent (e.g. "3.5200")
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function toAnnualPct(raw: string): Decimal {
  const v = new Decimal(raw);
  // If <= 1, treat as fraction (0.0352 → 3.52). Otherwise treat as percent
  // already (3.52 → 3.52). This lets callers be loose about format.
  return v.lessThanOrEqualTo(1) ? v.times(100) : v;
}

function powInt(base: Decimal, exp: number): Decimal {
  // Iterative integer pow keeps precision better than Decimal.pow with
  // fractional exponents.
  let result = new Decimal(1);
  let b = base;
  let e = exp;
  while (e > 0) {
    if (e & 1) result = result.times(b);
    b = b.times(b);
    e >>= 1;
  }
  return result;
}

function frenchPayment(outstanding: Decimal, monthlyRate: Decimal, months: number): Decimal {
  if (monthlyRate.isZero()) return outstanding.div(months);
  const factor = powInt(monthlyRate.plus(1), months);
  return outstanding.times(monthlyRate).times(factor).div(factor.minus(1));
}

function addMonths(d: Date, n: number): Date {
  const result = new Date(d);
  const targetMonth = d.getUTCMonth() + n;
  result.setUTCMonth(targetMonth);
  // Clamp day-of-month to last day if the target month is shorter
  // (e.g. Jan 31 + 1 month → Feb 28/29).
  if (result.getUTCMonth() !== ((targetMonth % 12) + 12) % 12) {
    result.setUTCDate(0);
  }
  return result;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function findRateAt(date: Date, rates: RateChange[]): Decimal {
  // Pick the latest rate change whose effectiveAt ≤ date.
  let active = rates[0];
  if (!active) return new Decimal(0);
  for (const r of rates) {
    if (r.effectiveAt <= date) active = r;
    else break;
  }
  return toAnnualPct(active.rate);
}

// ────────────────────────────────────────────────────────────────────────────
// Schedule generator
// ────────────────────────────────────────────────────────────────────────────

export function generateSchedule(input: AmortizationInput): AmortizationRow[] {
  const { principalInitial, termMonths, startDate, amortizationSystem, rates } = input;
  if (rates.length === 0) {
    throw new Error('At least one rate change must be provided (the initial rate)');
  }
  const sortedRates = [...rates].sort((a, b) => a.effectiveAt.getTime() - b.effectiveAt.getTime());

  const rows: AmortizationRow[] = [];
  let outstanding = new Decimal(principalInitial);
  // Pre-compute first cuota for French. Recomputed whenever the rate changes.
  let currentAnnualPct = findRateAt(startDate, sortedRates);
  let currentMonthlyRate = currentAnnualPct.div(100).div(12);
  let cuota: Decimal;
  if (amortizationSystem === 'french') {
    cuota = frenchPayment(outstanding, currentMonthlyRate, termMonths);
  } else if (amortizationSystem === 'bullet') {
    // Interest only every period; principal repaid at the end.
    cuota = outstanding.times(currentMonthlyRate);
  } else if (amortizationSystem === 'german') {
    // Constant principal repayment; interest on declining balance.
    cuota = outstanding.div(termMonths); // principal portion only here
  } else {
    // American: interest only, balloon at end. Same as bullet for our purposes.
    cuota = outstanding.times(currentMonthlyRate);
  }

  for (let period = 1; period <= termMonths; period++) {
    const dueAt = addMonths(startDate, period - 1);
    const annualPct = findRateAt(dueAt, sortedRates);
    if (!annualPct.equals(currentAnnualPct)) {
      // Rate change took effect; recompute cuota for the remaining schedule.
      currentAnnualPct = annualPct;
      currentMonthlyRate = currentAnnualPct.div(100).div(12);
      const remaining = termMonths - period + 1;
      if (amortizationSystem === 'french') {
        cuota = frenchPayment(outstanding, currentMonthlyRate, remaining);
      } else if (amortizationSystem === 'bullet' || amortizationSystem === 'american') {
        cuota = outstanding.times(currentMonthlyRate);
      }
      // German keeps constant principal — no cuota change; only interest moves.
    }

    let principalPart: Decimal;
    let interestPart: Decimal;
    let payment: Decimal;

    if (amortizationSystem === 'french') {
      interestPart = outstanding.times(currentMonthlyRate);
      principalPart = cuota.minus(interestPart);
      payment = cuota;
    } else if (amortizationSystem === 'german') {
      principalPart = cuota; // here cuota = constant principal
      interestPart = outstanding.times(currentMonthlyRate);
      payment = principalPart.plus(interestPart);
    } else {
      // bullet / american
      interestPart = outstanding.times(currentMonthlyRate);
      principalPart = period === termMonths ? outstanding : new Decimal(0);
      payment = interestPart.plus(principalPart);
    }

    // Last period clean-up: ensure outstanding hits zero exactly.
    if (period === termMonths && amortizationSystem === 'french') {
      principalPart = outstanding;
      payment = principalPart.plus(interestPart);
    }

    outstanding = outstanding.minus(principalPart);
    if (outstanding.isNegative()) outstanding = new Decimal(0);

    rows.push({
      period,
      dueAt: ymd(dueAt),
      payment: payment.toFixed(2),
      principal: principalPart.toFixed(2),
      interest: interestPart.toFixed(2),
      outstandingAfter: outstanding.toFixed(2),
      rateApplied: currentAnnualPct.toFixed(4),
    });
  }

  return rows;
}

// ────────────────────────────────────────────────────────────────────────────
// Aggregations a UI typically wants
// ────────────────────────────────────────────────────────────────────────────

export type ScheduleSummary = {
  totalPayments: string;
  totalInterest: string;
  totalPrincipal: string;
};

export function summarizeSchedule(rows: AmortizationRow[]): ScheduleSummary {
  let totalPayments = new Decimal(0);
  let totalInterest = new Decimal(0);
  let totalPrincipal = new Decimal(0);
  for (const r of rows) {
    totalPayments = totalPayments.plus(r.payment);
    totalInterest = totalInterest.plus(r.interest);
    totalPrincipal = totalPrincipal.plus(r.principal);
  }
  return {
    totalPayments: totalPayments.toFixed(2),
    totalInterest: totalInterest.toFixed(2),
    totalPrincipal: totalPrincipal.toFixed(2),
  };
}

// Walks the schedule once and reports current state given a "today" anchor.
// Returns the last paid period (or 0 if none) and the next pending period.
export function locateCurrentPeriod(
  rows: AmortizationRow[],
  today: Date,
): {
  lastPaidPeriod: number;
  nextPeriod: AmortizationRow | null;
  outstanding: string;
  paidPrincipal: string;
  paidInterest: string;
  pendingPrincipal: string;
  pendingInterest: string;
} {
  const todayYmd = ymd(today);
  let lastPaidPeriod = 0;
  let nextPeriod: AmortizationRow | null = null;
  let outstanding = '0.00';
  let paidPrincipal = new Decimal(0);
  let paidInterest = new Decimal(0);
  let pendingPrincipal = new Decimal(0);
  let pendingInterest = new Decimal(0);

  for (const r of rows) {
    if (r.dueAt <= todayYmd) {
      lastPaidPeriod = r.period;
      outstanding = r.outstandingAfter;
      paidPrincipal = paidPrincipal.plus(r.principal);
      paidInterest = paidInterest.plus(r.interest);
    } else {
      if (!nextPeriod) nextPeriod = r;
      pendingPrincipal = pendingPrincipal.plus(r.principal);
      pendingInterest = pendingInterest.plus(r.interest);
    }
  }

  return {
    lastPaidPeriod,
    nextPeriod,
    outstanding,
    paidPrincipal: paidPrincipal.toFixed(2),
    paidInterest: paidInterest.toFixed(2),
    pendingPrincipal: pendingPrincipal.toFixed(2),
    pendingInterest: pendingInterest.toFixed(2),
  };
}
