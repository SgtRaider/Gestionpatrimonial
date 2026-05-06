// Fixture data for the dashboard. Replaced by real DB queries in a later phase.
// Keep shape in sync with packages/shared/src/schemas/dashboard.ts.

import type { Dashboard } from '@gp/shared';

// Helper: build a net-worth point with breakdown that sums to (assets - liabilities).
function point(
  date: string,
  liquid: number,
  invested: number,
  realEstate: number,
  other: number,
  liabilities: number,
) {
  const assets = liquid + invested + realEstate + other;
  const netWorth = assets - liabilities;
  return {
    date,
    netWorth: netWorth.toFixed(2),
    assets: assets.toFixed(2),
    liabilities: liabilities.toFixed(2),
    breakdown: {
      liquid: liquid.toFixed(2),
      invested: invested.toFixed(2),
      realEstate: realEstate.toFixed(2),
      other: other.toFixed(2),
    },
  };
}

const netWorthSeries = [
  point('2025-06-01', 24500, 38200, 145000, 2300, 131800),
  point('2025-07-01', 25100, 39400, 145000, 2300, 131500),
  point('2025-08-01', 26200, 40850, 145000, 2300, 131200),
  point('2025-09-01', 27300, 41950, 145000, 2300, 130800),
  point('2025-10-01', 27800, 42950, 145000, 2400, 130500),
  point('2025-11-01', 27500, 43800, 145000, 2400, 130200),
  point('2025-12-01', 28100, 44600, 145000, 2400, 129900),
  point('2026-01-01', 28400, 45350, 145000, 2400, 129600),
  point('2026-02-01', 28200, 45980, 145000, 2400, 129300),
  point('2026-03-01', 28600, 46550, 145000, 2400, 128950),
  point('2026-04-01', 27900, 46140, 145000, 2400, 128600),
  point('2026-05-01', 28100, 47200, 145000, 2400, 128280),
];

const latest = netWorthSeries[netWorthSeries.length - 1];
if (!latest?.breakdown) {
  throw new Error('Fixture invariant: latest net worth point must have breakdown');
}

export const dashboardFixture: Dashboard = {
  kpis: {
    netWorth: {
      value: latest.netWorth,
      delta30d: '2180.00',
      deltaPct30d: '2.6',
    },
    cashFlowMonth: {
      value: '1240.00',
      deltaVsMedian6m: '-380.00',
    },
    savingsRate: {
      value: '32',
      deltaPpVsMedian6m: '4',
    },
    nextLargeExpense: {
      label: 'Hipoteca BBVA',
      amount: '-612.40',
      scheduledAt: '2026-05-14',
    },
  },
  netWorthSeries,
  cashFlowSeries: [
    { month: '2025-06', income: '2450.00', expenses: '-1820.00', net: '630.00' },
    { month: '2025-07', income: '2450.00', expenses: '-1950.00', net: '500.00' },
    { month: '2025-08', income: '2450.00', expenses: '-2100.00', net: '350.00' },
    { month: '2025-09', income: '2680.00', expenses: '-1750.00', net: '930.00' },
    { month: '2025-10', income: '2450.00', expenses: '-1680.00', net: '770.00' },
    { month: '2025-11', income: '2450.00', expenses: '-1860.00', net: '590.00' },
    { month: '2025-12', income: '3200.00', expenses: '-2400.00', net: '800.00' },
    { month: '2026-01', income: '2450.00', expenses: '-1720.00', net: '730.00' },
    { month: '2026-02', income: '2450.00', expenses: '-1640.00', net: '810.00' },
    { month: '2026-03', income: '2580.00', expenses: '-1760.00', net: '820.00' },
    { month: '2026-04', income: '2450.00', expenses: '-2830.00', net: '-380.00' },
    { month: '2026-05', income: '2450.00', expenses: '-1210.00', net: '1240.00' },
  ],
  distribution: {
    liquid: latest.breakdown.liquid,
    invested: latest.breakdown.invested,
    realEstate: latest.breakdown.realEstate,
    other: latest.breakdown.other,
    liabilities: latest.liabilities ?? '0',
  },
  upcomingEvents: [
    {
      id: 'evt-1',
      label: 'Hipoteca BBVA',
      scheduledAt: '2026-05-14',
      amount: '-612.40',
      kind: 'loan_payment',
    },
    {
      id: 'evt-2',
      label: 'Netflix',
      scheduledAt: '2026-05-15',
      amount: '-13.99',
      kind: 'recurring',
    },
    {
      id: 'evt-3',
      label: 'Spotify',
      scheduledAt: '2026-05-22',
      amount: '-10.99',
      kind: 'recurring',
    },
    {
      id: 'evt-4',
      label: 'Nómina',
      scheduledAt: '2026-05-28',
      amount: '2450.00',
      kind: 'recurring',
    },
    {
      id: 'evt-5',
      label: 'ITV coche',
      scheduledAt: '2026-06-03',
      amount: '-45.00',
      kind: 'planned',
    },
  ],
  insights: [
    {
      id: '01951b00-0000-7000-8000-000000000001',
      kind: 'unused_subscription',
      title: '4 suscripciones sin uso en 60 días',
      description: 'Ahorro estimado: 47 €/mes',
      estimatedSavings: '564.00',
      actionable: true,
    },
    {
      id: '01951b00-0000-7000-8000-000000000002',
      kind: 'idle_liquidity',
      title: 'Liquidez ociosa: 18.200 € en BBVA',
      description: 'Oportunidad: ~540 €/año en monetario',
      estimatedSavings: '540.00',
      actionable: true,
    },
    {
      id: '01951b00-0000-7000-8000-000000000003',
      kind: 'mortgage_vs_invest',
      title: 'Amortizar 3.000 € ahorra 1.800 € en intereses',
      description: 'Resto hipoteca a tipo variable 3,52%',
      estimatedSavings: '1800.00',
      actionable: true,
    },
  ],
  alerts: [
    {
      id: 'alert-1',
      kind: 'uncategorized_transactions',
      severity: 'warning',
      message: '12 movimientos sin categorizar',
    },
    {
      id: 'alert-2',
      kind: 'consent_expiring',
      severity: 'urgent',
      message: 'Consentimiento PSD2 BBVA caduca en 5 días',
    },
    {
      id: 'alert-3',
      kind: 'sync_stale',
      severity: 'warning',
      message: 'MyInvestor sin sync desde hace 11 días',
    },
  ],
};
