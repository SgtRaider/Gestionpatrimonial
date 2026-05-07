'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatEur } from '@/lib/format';
import type { InsightFull, InsightStatus } from '@gp/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

const KIND_ICON: Record<string, string> = {
  unused_subscription: '📺',
  idle_liquidity: '💰',
  mortgage_vs_invest: '⚖',
  high_fees: '💸',
  modelo_720_alert: '🇪🇸',
  category_spike: '📈',
  low_savings_rate: '🐌',
  rebalance_suggestion: '🔄',
  other: '💡',
};

const KIND_LABEL: Record<string, string> = {
  unused_subscription: 'Suscripciones sin uso',
  idle_liquidity: 'Liquidez ociosa',
  mortgage_vs_invest: 'Hipoteca vs invertir',
  high_fees: 'Comisiones altas',
  modelo_720_alert: 'Modelo 720',
  category_spike: 'Pico por categoría',
  low_savings_rate: 'Tasa de ahorro baja',
  rebalance_suggestion: 'Rebalancear cartera',
};

type Cta = { href: string; label: string };

function ctaFor(insight: InsightFull): Cta | null {
  const p = insight.actionPayload;
  switch (insight.kind) {
    case 'mortgage_vs_invest':
      return p?.loanId ? { href: `/deudas/${p.loanId}?simulate=invest`, label: 'Simular' } : null;
    case 'unused_subscription':
      return p?.ruleId
        ? { href: `/cuentas/recurrentes?highlight=${p.ruleId}`, label: 'Revisar' }
        : null;
    case 'idle_liquidity':
      return { href: '/patrimonio', label: 'Ver patrimonio' };
    case 'high_fees':
      return { href: '/cuentas/movimientos?search=comisi', label: 'Ver cargos' };
    case 'low_savings_rate':
      return { href: '/cuentas/movimientos', label: 'Ver mes' };
    case 'modelo_720_alert':
      return { href: '/patrimonio', label: 'Ver holdings' };
    default:
      return null;
  }
}

const STATUS_TABS: { value: InsightStatus; label: string }[] = [
  { value: 'active', label: 'Activos' },
  { value: 'acted', label: 'Aplicados' },
  { value: 'dismissed', label: 'Descartados' },
];

export function OptimizacionClient() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<InsightStatus>('active');
  const [kindFilter, setKindFilter] = useState<string | 'all'>('all');

  const query = useQuery({ queryKey: ['insights-list'], queryFn: api.listInsights });

  const dismissMutation = useMutation({
    mutationFn: api.dismissInsight,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
  const actMutation = useMutation({
    mutationFn: api.actInsight,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const insights = query.data?.insights ?? [];
  const totals = query.data?.totals ?? {
    activeCount: 0,
    activeSavings: '0.00',
    actedSavings: '0.00',
  };

  const visibleKinds = Array.from(
    new Set(insights.filter((i) => i.status === tab).map((i) => i.kind)),
  );
  const filtered = insights.filter(
    (i) => i.status === tab && (kindFilter === 'all' || i.kind === kindFilter),
  );

  const isPending = dismissMutation.isPending || actMutation.isPending;

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-6">
      <PageHeader
        title="Optimización"
        subtitle={`${totals.activeCount} oportunidades activas · ahorro estimado ${formatEur(totals.activeSavings)}`}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4">
        <SummaryCard
          label="Oportunidades activas"
          value={String(totals.activeCount)}
          tone="neutral"
        />
        <SummaryCard
          label="Ahorro estimado anual"
          value={formatEur(totals.activeSavings)}
          tone="positive"
        />
        <SummaryCard label="Ya aplicado" value={formatEur(totals.actedSavings)} tone="muted" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 text-sm">
          {STATUS_TABS.map((s) => {
            const count = insights.filter((i) => i.status === s.value).length;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => {
                  setTab(s.value);
                  setKindFilter('all');
                }}
                className={cn(
                  'px-3 py-1.5 rounded text-sm transition-colors',
                  tab === s.value
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]',
                )}
              >
                {s.label} <span className="text-[var(--color-muted)] tabular-nums">({count})</span>
              </button>
            );
          })}
        </div>
        {visibleKinds.length > 1 ? (
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="px-3 h-9 rounded border border-[var(--color-border)] bg-[var(--color-card)] text-sm"
          >
            <option value="all">Todos los tipos</option>
            {visibleKinds.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k] ?? k}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {query.isLoading ? (
        <div className="p-12 text-center text-[var(--color-muted)]">Cargando…</div>
      ) : query.isError ? (
        <div className="p-12 text-center text-[var(--color-negative)]">Error al cargar</div>
      ) : filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)] text-center py-8">
            {tab === 'active'
              ? 'Sin oportunidades activas. Buen momento para descansar.'
              : tab === 'acted'
                ? 'Aún no has aplicado ninguna recomendación.'
                : 'No has descartado nada.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((i) => (
            <InsightCard
              key={i.id}
              insight={i}
              isPending={isPending}
              onDismiss={() => dismissMutation.mutate(i.id)}
              onAct={() => actMutation.mutate(i.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'positive' | 'neutral' | 'muted';
}) {
  const valueClass =
    tone === 'positive'
      ? 'text-[var(--color-positive)]'
      : tone === 'muted'
        ? 'text-[var(--color-muted)]'
        : '';
  return (
    <Card>
      <div className="text-xs uppercase tracking-wide text-[var(--color-muted)] font-medium mb-2">
        {label}
      </div>
      <div className={cn('text-2xl font-semibold tabular-nums', valueClass)}>{value}</div>
    </Card>
  );
}

function InsightCard({
  insight,
  isPending,
  onDismiss,
  onAct,
}: {
  insight: InsightFull;
  isPending: boolean;
  onDismiss: () => void;
  onAct: () => void;
}) {
  const cta = ctaFor(insight);
  const severityClass =
    insight.severity === 'urgent'
      ? 'border-[var(--color-negative)]/40'
      : insight.severity === 'warning'
        ? 'border-[var(--color-accent)]/40'
        : 'border-[var(--color-border)]';

  return (
    <Card className={cn('!p-4', severityClass)}>
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">{KIND_ICON[insight.kind] ?? '💡'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-semibold">{insight.title}</div>
            <span className="text-[10px] uppercase text-[var(--color-muted)] whitespace-nowrap">
              {KIND_LABEL[insight.kind] ?? insight.kind}
            </span>
          </div>
          {insight.description ? (
            <div className="text-xs text-[var(--color-muted)] mt-1">{insight.description}</div>
          ) : null}
          {insight.estimatedSavings ? (
            <div className="text-sm text-[var(--color-positive)] mt-2 tabular-nums">
              Ahorro estimado · {formatEur(insight.estimatedSavings)}
            </div>
          ) : null}
          {insight.resolvedAt ? (
            <div className="text-[11px] text-[var(--color-muted)] mt-2">
              {insight.status === 'acted' ? 'Aplicado' : 'Descartado'} el{' '}
              {new Date(insight.resolvedAt).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </div>
          ) : null}
          {insight.status === 'active' ? (
            <div className="flex items-center gap-2 mt-3">
              {cta ? (
                <Link
                  href={cta.href}
                  onClick={onAct}
                  className="text-xs px-3 py-1.5 rounded bg-[var(--color-accent)] text-white"
                >
                  {cta.label}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={onAct}
                  disabled={isPending}
                  className="text-xs px-3 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)] disabled:opacity-50"
                >
                  Marcar como aplicado
                </button>
              )}
              <button
                type="button"
                onClick={onDismiss}
                disabled={isPending}
                className="text-xs px-3 py-1.5 rounded text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-bg)] disabled:opacity-50"
              >
                Descartar
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
