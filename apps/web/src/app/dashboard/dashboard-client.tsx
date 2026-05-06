'use client';

import { useQuery } from '@tanstack/react-query';
import { AttentionBlock } from '@/components/dashboard/attention-block';
import { CashFlowChart } from '@/components/dashboard/cash-flow-chart';
import { DistributionDonut } from '@/components/dashboard/distribution-donut';
import { InsightsList } from '@/components/dashboard/insights-list';
import {
  CashFlowKpi,
  NetWorthKpi,
  NextLargeExpenseKpi,
  SavingsRateKpi,
} from '@/components/dashboard/kpi-card';
import { NetWorthChart } from '@/components/dashboard/net-worth-chart';
import { UpcomingEvents } from '@/components/dashboard/upcoming-events';
import { api } from '@/lib/api';

export function DashboardClient() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: api.getDashboard,
  });

  if (isLoading) {
    return (
      <div className="p-8 text-center text-[var(--color-muted)]">Cargando…</div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8 text-center text-[var(--color-negative)]">
        Error cargando el dashboard
        {error instanceof Error ? `: ${error.message}` : ''}
      </div>
    );
  }

  const today = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inicio</h1>
          <p className="text-sm text-[var(--color-muted)] capitalize">{today}</p>
        </div>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-card)]"
          >
            Mes ▾
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-card)]"
          >
            ↻ Sync
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <NetWorthKpi
          value={data.kpis.netWorth.value}
          delta30d={data.kpis.netWorth.delta30d}
          deltaPct30d={data.kpis.netWorth.deltaPct30d}
        />
        <CashFlowKpi
          value={data.kpis.cashFlowMonth.value}
          deltaVsMedian6m={data.kpis.cashFlowMonth.deltaVsMedian6m}
        />
        <SavingsRateKpi
          value={data.kpis.savingsRate.value}
          deltaPpVsMedian6m={data.kpis.savingsRate.deltaPpVsMedian6m}
        />
        <NextLargeExpenseKpi next={data.kpis.nextLargeExpense} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <NetWorthChart data={data.netWorthSeries} />
        <DistributionDonut distribution={data.distribution} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CashFlowChart data={data.cashFlowSeries} />
        <UpcomingEvents events={data.upcomingEvents} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <InsightsList insights={data.insights} />
        <AttentionBlock alerts={data.alerts} />
      </div>
    </div>
  );
}
