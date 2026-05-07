'use client';

import { Card, CardHeader } from '@/components/ui/card';
import { formatEur } from '@/lib/format';
import type { CashFlowMonth } from '@gp/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function formatMonth(month: string): string {
  const [y, m] = month.split('-');
  if (!y || !m) return month;
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString('es-ES', { month: 'short' });
}

export function CashFlowChart({ data }: { data: CashFlowMonth[] }) {
  const chartData = data.map((d) => ({
    month: d.month,
    income: Number(d.income),
    expenses: Number(d.expenses),
    net: Number(d.net),
  }));

  const median6m =
    chartData.length >= 6 ? chartData.slice(-6).reduce((acc, p) => acc + p.net, 0) / 6 : 0;

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title="Cash flow mensual"
        subtitle={`Media de ahorro 6m: ${formatEur(median6m)}`}
      />
      <div className="h-56 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonth}
              tick={{ fontSize: 11 }}
              stroke="var(--color-muted)"
            />
            <YAxis
              tickFormatter={(v) => formatEur(v, { compact: true })}
              tick={{ fontSize: 11 }}
              stroke="var(--color-muted)"
            />
            <Tooltip formatter={(v: number) => formatEur(v)} labelFormatter={formatMonth} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="var(--color-border)" />
            <ReferenceLine
              y={median6m}
              stroke="var(--color-muted)"
              strokeDasharray="4 4"
              label={{ value: 'Media 6m', position: 'right', fontSize: 10 }}
            />
            <Bar dataKey="income" name="Ingresos" fill="#16a34a" radius={[2, 2, 0, 0]} />
            <Bar dataKey="expenses" name="Gastos" fill="#dc2626" radius={[0, 0, 2, 2]} />
            <Bar dataKey="net" name="Neto" hide>
              {chartData.map((p) => (
                <Cell key={p.month} fill={p.net >= 0 ? '#2563eb' : '#dc2626'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
