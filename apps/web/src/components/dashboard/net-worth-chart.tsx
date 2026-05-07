'use client';

import { Card, CardHeader } from '@/components/ui/card';
import { formatEur } from '@/lib/format';
import type { NetWorthPoint } from '@gp/shared';
import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Mode = 'net' | 'detailed' | 'stacked';

const MODES: { value: Mode; label: string }[] = [
  { value: 'net', label: 'Neto' },
  { value: 'detailed', label: 'Detallado' },
  { value: 'stacked', label: 'Apilado' },
];

const colors = {
  net: '#2563eb',
  assets: '#16a34a',
  liabilities: '#dc2626',
  liquid: '#3b82f6',
  invested: '#10b981',
  realEstate: '#f59e0b',
  other: '#a855f7',
};

function formatMonthShort(date: string): string {
  return new Date(date).toLocaleDateString('es-ES', {
    month: 'short',
    year: '2-digit',
  });
}

function tooltipFormatter(value: number | string): [string, string] {
  return [formatEur(value, { compact: true }), ''];
}

export function NetWorthChart({ data }: { data: NetWorthPoint[] }) {
  const [mode, setMode] = useState<Mode>('net');

  const chartData = data.map((p) => ({
    date: p.date,
    netWorth: Number(p.netWorth),
    assets: p.assets ? Number(p.assets) : null,
    liabilities: p.liabilities ? -Number(p.liabilities) : null,
    liquid: p.breakdown ? Number(p.breakdown.liquid) : 0,
    invested: p.breakdown ? Number(p.breakdown.invested) : 0,
    realEstate: p.breakdown ? Number(p.breakdown.realEstate) : 0,
    other: p.breakdown ? Number(p.breakdown.other) : 0,
  }));

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title="Evolución patrimonio"
        action={
          <div className="flex gap-1 text-xs">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                className={`px-2 py-1 rounded ${
                  mode === m.value
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        }
      />
      <div className="h-72 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          {mode === 'net' ? (
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.net} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={colors.net} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatMonthShort}
                tick={{ fontSize: 11 }}
                stroke="var(--color-muted)"
              />
              <YAxis
                tickFormatter={(v) => formatEur(v, { compact: true })}
                tick={{ fontSize: 11 }}
                stroke="var(--color-muted)"
              />
              <Tooltip formatter={tooltipFormatter} labelFormatter={(l) => formatMonthShort(l)} />
              <Area
                type="monotone"
                dataKey="netWorth"
                stroke={colors.net}
                strokeWidth={2}
                fill="url(#netFill)"
              />
            </AreaChart>
          ) : mode === 'detailed' ? (
            <LineChart data={chartData}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatMonthShort}
                tick={{ fontSize: 11 }}
                stroke="var(--color-muted)"
              />
              <YAxis
                tickFormatter={(v) => formatEur(v, { compact: true })}
                tick={{ fontSize: 11 }}
                stroke="var(--color-muted)"
              />
              <Tooltip formatter={tooltipFormatter} labelFormatter={(l) => formatMonthShort(l)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="assets"
                name="Activos"
                stroke={colors.assets}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="liabilities"
                name="Pasivos"
                stroke={colors.liabilities}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="netWorth"
                name="Neto"
                stroke={colors.net}
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          ) : (
            <AreaChart data={chartData}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatMonthShort}
                tick={{ fontSize: 11 }}
                stroke="var(--color-muted)"
              />
              <YAxis
                tickFormatter={(v) => formatEur(v, { compact: true })}
                tick={{ fontSize: 11 }}
                stroke="var(--color-muted)"
              />
              <Tooltip formatter={tooltipFormatter} labelFormatter={(l) => formatMonthShort(l)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="liquid"
                name="Líquido"
                stackId="assets"
                stroke={colors.liquid}
                fill={colors.liquid}
                fillOpacity={0.7}
              />
              <Area
                type="monotone"
                dataKey="invested"
                name="Inversión"
                stackId="assets"
                stroke={colors.invested}
                fill={colors.invested}
                fillOpacity={0.7}
              />
              <Area
                type="monotone"
                dataKey="realEstate"
                name="Inmueble"
                stackId="assets"
                stroke={colors.realEstate}
                fill={colors.realEstate}
                fillOpacity={0.7}
              />
              <Area
                type="monotone"
                dataKey="other"
                name="Otros"
                stackId="assets"
                stroke={colors.other}
                fill={colors.other}
                fillOpacity={0.7}
              />
              <Line
                type="monotone"
                dataKey="liabilities"
                name="Pasivos"
                stroke={colors.liabilities}
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
