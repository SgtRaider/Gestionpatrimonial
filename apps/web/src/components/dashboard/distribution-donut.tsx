'use client';

import { Card, CardHeader } from '@/components/ui/card';
import { formatEur } from '@/lib/format';
import type { Distribution } from '@gp/shared';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const SLICE_COLORS = {
  liquid: '#3b82f6',
  invested: '#10b981',
  realEstate: '#f59e0b',
  other: '#a855f7',
};

const SLICE_LABELS = {
  liquid: 'Líquido',
  invested: 'Inversión',
  realEstate: 'Inmueble',
  other: 'Otros',
};

export function DistributionDonut({ distribution }: { distribution: Distribution }) {
  const liabilities = Number(distribution.liabilities);

  const slices = (['liquid', 'invested', 'realEstate', 'other'] as const).map((key) => ({
    key,
    name: SLICE_LABELS[key],
    value: Number(distribution[key]),
    color: SLICE_COLORS[key],
  }));

  const totalAssets = slices.reduce((acc, s) => acc + s.value, 0);
  const netWorth = totalAssets - liabilities;

  return (
    <Card>
      <CardHeader title="Distribución" />
      <div className="h-56 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
              startAngle={90}
              endAngle={-270}
            >
              {slices.map((s) => (
                <Cell key={s.key} fill={s.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => formatEur(v)} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-xs text-[var(--color-muted)] uppercase tracking-wide">Neto</div>
          <div className="text-xl font-semibold tabular-nums">
            {formatEur(netWorth, { compact: true })}
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {slices.map((s) => {
          const pct = totalAssets > 0 ? (s.value / totalAssets) * 100 : 0;
          return (
            <div key={s.key} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                <span>{s.name}</span>
              </div>
              <div className="text-[var(--color-muted)] tabular-nums">
                {formatEur(s.value, { compact: true })} · {pct.toFixed(0)}%
              </div>
            </div>
          );
        })}
        {liabilities > 0 ? (
          <div className="flex items-center justify-between text-xs pt-2 border-t border-[var(--color-border)]">
            <div className="flex items-center gap-2 text-[var(--color-negative)]">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-negative)]" />
              <span>Pasivos</span>
            </div>
            <div className="text-[var(--color-negative)] tabular-nums">
              −{formatEur(liabilities, { compact: true })}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
