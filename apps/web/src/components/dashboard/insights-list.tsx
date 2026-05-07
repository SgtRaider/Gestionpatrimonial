'use client';

import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatEur } from '@/lib/format';
import type { DashboardInsight } from '@gp/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

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

type Cta = { href: string; label: string };

function ctaFor(insight: DashboardInsight): Cta | null {
  const p = insight.actionPayload;
  switch (insight.kind) {
    case 'mortgage_vs_invest':
      return p?.loanId ? { href: `/deudas/${p.loanId}?simulate=invest`, label: 'Simular' } : null;
    case 'unused_subscription':
      return p?.ruleId
        ? { href: `/cuentas/recurrentes?highlight=${p.ruleId}`, label: 'Revisar' }
        : null;
    case 'idle_liquidity':
      return { href: '/patrimonio', label: 'Ver' };
    case 'high_fees':
      return { href: '/cuentas/movimientos?search=comisi', label: 'Ver cargos' };
    case 'low_savings_rate':
      return { href: '/cuentas/movimientos', label: 'Ver mes' };
    default:
      return null;
  }
}

export function InsightsList({ insights }: { insights: DashboardInsight[] }) {
  const queryClient = useQueryClient();

  const dismissMutation = useMutation({
    mutationFn: api.dismissInsight,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  });

  const actMutation = useMutation({
    mutationFn: api.actInsight,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  });

  const isPending = dismissMutation.isPending || actMutation.isPending;

  return (
    <Card className="lg:col-span-2">
      <CardHeader title="Insights destacados" />
      {insights.length === 0 ? (
        <p className="text-xs text-[var(--color-muted)] py-3">No hay insights nuevos. Sigue así.</p>
      ) : (
        <ul className="space-y-3">
          {insights.map((i) => {
            const cta = ctaFor(i);
            return (
              <li
                key={i.id}
                className="flex items-start gap-3 border-b border-[var(--color-border)] last:border-0 pb-3 last:pb-0"
              >
                <span className="text-lg leading-tight">{KIND_ICON[i.kind] ?? '💡'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{i.title}</div>
                  {i.description ? (
                    <div className="text-xs text-[var(--color-muted)] mt-0.5">{i.description}</div>
                  ) : null}
                  {i.estimatedSavings ? (
                    <div className="text-xs text-[var(--color-positive)] mt-1 tabular-nums">
                      Ahorro estimado: {formatEur(i.estimatedSavings)}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {cta ? (
                    <Link
                      href={cta.href}
                      onClick={() => actMutation.mutate(i.id)}
                      className={
                        i.actionable
                          ? 'text-xs px-2 py-1 rounded bg-[var(--color-accent)] text-white whitespace-nowrap'
                          : 'text-xs px-2 py-1 rounded border border-[var(--color-border)] whitespace-nowrap'
                      }
                    >
                      {cta.label}
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => dismissMutation.mutate(i.id)}
                    disabled={isPending}
                    aria-label={`Descartar insight ${i.title}`}
                    title="Descartar"
                    className="text-xs px-1.5 py-1 rounded text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-bg)] disabled:opacity-50"
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
