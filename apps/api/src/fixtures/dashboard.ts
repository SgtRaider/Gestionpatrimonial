// Fixture data for the dashboard. Replaced by real DB queries in a later phase.
// Keep shape in sync with packages/shared/src/schemas/dashboard.ts.

import type { Dashboard } from '@gp/shared';

export const dashboardFixture: Dashboard = {
  kpis: {
    netWorth: {
      value: '87420.00',
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
  netWorthSeries: [
    { date: '2025-06-01', netWorth: '78200.00' },
    { date: '2025-07-01', netWorth: '79100.00' },
    { date: '2025-08-01', netWorth: '80450.00' },
    { date: '2025-09-01', netWorth: '81900.00' },
    { date: '2025-10-01', netWorth: '83100.00' },
    { date: '2025-11-01', netWorth: '83400.00' },
    { date: '2025-12-01', netWorth: '84200.00' },
    { date: '2026-01-01', netWorth: '84850.00' },
    { date: '2026-02-01', netWorth: '85240.00' },
    { date: '2026-03-01', netWorth: '85800.00' },
    { date: '2026-04-01', netWorth: '85240.00' },
    { date: '2026-05-01', netWorth: '87420.00' },
  ],
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
      label: 'Nómina',
      scheduledAt: '2026-05-28',
      amount: '2450.00',
      kind: 'recurring',
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
