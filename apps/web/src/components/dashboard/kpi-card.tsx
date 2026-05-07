import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { formatDelta, formatEur, formatPct, isPositive } from '@/lib/format';

type Trend = 'positive' | 'negative' | 'neutral';

function trendColor(trend: Trend): string {
  if (trend === 'positive') return 'text-[var(--color-positive)]';
  if (trend === 'negative') return 'text-[var(--color-negative)]';
  return 'text-[var(--color-muted)]';
}

export function KpiCard({
  label,
  value,
  delta,
  deltaSuffix,
  trend = 'neutral',
}: {
  label: string;
  value: string;
  delta?: string;
  deltaSuffix?: string;
  trend?: Trend;
}) {
  return (
    <Card>
      <div className="text-xs uppercase tracking-wide text-[var(--color-muted)] font-medium mb-2">
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {delta ? (
        <div className={cn('text-xs mt-1 tabular-nums', trendColor(trend))}>
          {delta} {deltaSuffix}
        </div>
      ) : null}
    </Card>
  );
}

export function NetWorthKpi({
  value,
  delta30d,
  deltaPct30d,
}: {
  value: string;
  delta30d: string;
  deltaPct30d: string;
}) {
  const trend: Trend = isPositive(delta30d) ? 'positive' : 'negative';
  return (
    <KpiCard
      label="Patrimonio neto"
      value={formatEur(value, { compact: true })}
      delta={`${formatDelta(delta30d)} · ${formatPct(deltaPct30d)}`}
      deltaSuffix="(30 d)"
      trend={trend}
    />
  );
}

const PERIOD_LABEL: Record<'month' | 'quarter' | 'halfyear' | 'year', string> = {
  month: 'del mes',
  quarter: 'del trimestre',
  halfyear: '6 meses',
  year: 'del año',
};

export function CashFlowKpi({
  value,
  deltaVsMedian6m,
  period = 'month',
}: {
  value: string;
  deltaVsMedian6m: string;
  period?: 'month' | 'quarter' | 'halfyear' | 'year';
}) {
  const trend: Trend = isPositive(value) ? 'positive' : 'negative';
  return (
    <KpiCard
      label={`Cash flow ${PERIOD_LABEL[period]}`}
      value={formatDelta(value)}
      delta={`${formatDelta(deltaVsMedian6m)} vs media 6 periodos`}
      trend={isPositive(deltaVsMedian6m) ? 'positive' : 'negative'}
    />
  );
}

export function SavingsRateKpi({
  value,
  deltaPpVsMedian6m,
  period = 'month',
}: {
  value: string;
  deltaPpVsMedian6m: string;
  period?: 'month' | 'quarter' | 'halfyear' | 'year';
}) {
  const ppTrend: Trend = isPositive(deltaPpVsMedian6m) ? 'positive' : 'negative';
  return (
    <KpiCard
      label={`Tasa de ahorro ${PERIOD_LABEL[period]}`}
      value={`${value}%`}
      delta={`${isPositive(deltaPpVsMedian6m) ? '+' : ''}${deltaPpVsMedian6m} pp vs media 6 periodos`}
      trend={ppTrend}
    />
  );
}

export function NextLargeExpenseKpi({
  next,
}: {
  next: { label: string; amount: string; scheduledAt: string } | null;
}) {
  if (!next) {
    return (
      <KpiCard
        label="Próximo gran gasto"
        value="—"
        delta="Sin grandes gastos próximos"
        trend="neutral"
      />
    );
  }
  const date = new Date(next.scheduledAt);
  const formattedDate = date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  });
  return (
    <KpiCard
      label="Próximo gran gasto"
      value={next.label}
      delta={`${formattedDate} · ${formatDelta(next.amount)}`}
      trend="negative"
    />
  );
}
