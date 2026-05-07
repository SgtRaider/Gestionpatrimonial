import { Card, CardHeader } from '@/components/ui/card';
import { formatEur } from '@/lib/format';
import type { DashboardInsight } from '@gp/shared';

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

export function InsightsList({ insights }: { insights: DashboardInsight[] }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader title="Insights destacados" />
      {insights.length === 0 ? (
        <p className="text-xs text-[var(--color-muted)] py-3">No hay insights nuevos. Sigue así.</p>
      ) : (
        <ul className="space-y-3">
          {insights.map((i) => (
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
              {i.actionable ? (
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded bg-[var(--color-accent)] text-white whitespace-nowrap"
                >
                  Hacer
                </button>
              ) : (
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded border border-[var(--color-border)] whitespace-nowrap"
                >
                  Ver
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
