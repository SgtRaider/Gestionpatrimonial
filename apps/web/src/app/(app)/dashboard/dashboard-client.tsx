'use client';

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
import type { DashboardPeriod } from '@gp/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: 'month', label: 'Mes' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'halfyear', label: '6 meses' },
  { value: 'year', label: 'Año' },
];

type Toast = { id: number; message: string; tone: 'success' | 'error' };

export function DashboardClient() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [toast, setToast] = useState<Toast | null>(null);
  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['dashboard', period],
    queryFn: () => api.getDashboard(period),
  });

  // Auto-dismiss toasts.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, 6000);
    return () => clearTimeout(t);
  }, [toast]);

  // Sync runs side-effects that the user expects when they pull-to-refresh:
  // re-detects internal transfers (catches pairs imported separately),
  // materialises today's net-worth foto, and invalidates every query so
  // every panel refetches fresh data on next render.
  const syncMutation = useMutation({
    mutationFn: async () => {
      const transfers = await api.detectTransfers();
      const snapshot = await api.createNetWorthSnapshot();
      return { transfers, snapshot };
    },
    onSuccess: (resp) => {
      queryClient.invalidateQueries();
      const parts = [];
      if (resp.transfers.paired > 0)
        parts.push(
          `${resp.transfers.paired} par${resp.transfers.paired === 1 ? '' : 'es'} de transferencias`,
        );
      parts.push(`foto al ${resp.snapshot.snapshotAt}`);
      setToast({
        id: Date.now(),
        message: `✓ Sincronizado · ${parts.join(' · ')}`,
        tone: 'success',
      });
    },
    onError: (err) => {
      setToast({
        id: Date.now(),
        message: `Error al sincronizar: ${err instanceof Error ? err.message : 'desconocido'}`,
        tone: 'error',
      });
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-[var(--color-muted)]">Cargando…</div>;
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
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as DashboardPeriod)}
            aria-label="Periodo"
            className="px-3 h-9 rounded border border-[var(--color-border)] bg-[var(--color-card)] text-sm"
          >
            {PERIOD_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || isFetching}
            title="Detectar transferencias, guardar foto de patrimonio y refrescar todos los datos"
            className="px-3 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-card)] disabled:opacity-50"
          >
            {syncMutation.isPending ? '↻ Sincronizando…' : '↻ Sync'}
          </button>
        </div>
      </header>

      {toast ? (
        <output
          key={toast.id}
          className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm shadow-lg text-white ${
            toast.tone === 'success' ? 'bg-[var(--color-positive)]' : 'bg-[var(--color-negative)]'
          }`}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="opacity-70 hover:opacity-100"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </output>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <NetWorthKpi
          value={data.kpis.netWorth.value}
          delta30d={data.kpis.netWorth.delta30d}
          deltaPct30d={data.kpis.netWorth.deltaPct30d}
        />
        <CashFlowKpi
          value={data.kpis.cashFlowMonth.value}
          deltaVsMedian6m={data.kpis.cashFlowMonth.deltaVsMedian6m}
          period={data.kpis.cashFlowMonth.period}
        />
        <SavingsRateKpi
          value={data.kpis.savingsRate.value}
          deltaPpVsMedian6m={data.kpis.savingsRate.deltaPpVsMedian6m}
          period={data.kpis.cashFlowMonth.period}
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
