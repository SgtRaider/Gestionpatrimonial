import { Decimal } from 'decimal.js';

const eur = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

const eurNoDecimals = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const pct = new Intl.NumberFormat('es-ES', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatEur(amount: string | number, opts: { compact?: boolean } = {}): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  return opts.compact ? eurNoDecimals.format(value) : eur.format(value);
}

export function formatDelta(amount: string): string {
  const value = Number(amount);
  const sign = value > 0 ? '+' : '';
  return `${sign}${eur.format(value)}`;
}

export function formatPct(value: string | number): string {
  const num = typeof value === 'string' ? Number(value) : value;
  return pct.format(num / 100);
}

export function decimalAdd(...values: string[]): string {
  return values.reduce((acc, v) => acc.plus(new Decimal(v)), new Decimal(0)).toFixed(2);
}

export function isPositive(amount: string): boolean {
  return new Decimal(amount).isPositive();
}
