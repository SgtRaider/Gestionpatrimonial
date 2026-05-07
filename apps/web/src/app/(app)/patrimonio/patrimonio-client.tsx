'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatEur } from '@/lib/format';
import type { NetWorthAccount, NetWorthSnapshot } from '@gp/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AddHoldingDialog } from './add-holding-dialog';
import { HoldingDetailDialog } from './holding-detail-dialog';

const ACCOUNT_TYPE_LABELS: Record<NetWorthAccount['type'], string> = {
  checking: 'Corriente',
  savings: 'Ahorro',
  brokerage: 'Inversión',
  pension: 'Pensiones',
  crypto: 'Crypto',
  real_estate: 'Inmueble',
  vehicle: 'Vehículo',
  other: 'Otro',
};

type Toast = { id: number; message: string; tone: 'success' | 'error' };

export function PatrimonioClient() {
  const queryClient = useQueryClient();
  const [showAddHolding, setShowAddHolding] = useState(false);
  const [openHoldingId, setOpenHoldingId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, 6000);
    return () => clearTimeout(t);
  }, [toast]);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['net-worth'],
    queryFn: api.getNetWorth,
  });
  const snapshotsQuery = useQuery({
    queryKey: ['net-worth-snapshots'],
    queryFn: api.getNetWorthSnapshots,
  });
  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: api.getAccounts,
    staleTime: 5 * 60_000,
  });

  const snapshotMutation = useMutation({
    mutationFn: () => api.createNetWorthSnapshot(),
    onSuccess: (snap) => {
      queryClient.invalidateQueries({ queryKey: ['net-worth-snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setToast({
        id: Date.now(),
        message: `✓ Foto guardada · ${snap.snapshotAt} · ${formatEur(snap.netWorth, { compact: true })}`,
        tone: 'success',
      });
    },
    onError: (err) => {
      setToast({
        id: Date.now(),
        message: `Error al guardar foto: ${err instanceof Error ? err.message : 'desconocido'}`,
        tone: 'error',
      });
    },
  });

  const createHoldingMutation = useMutation({
    mutationFn: async (input: {
      accountId: string;
      name: string;
      ticker: string | null;
      isin: string | null;
      currency: string;
      quantity: string;
      avgCost: string;
      nav?: string;
    }) => {
      const { nav, ...holdingInput } = input;
      const holding = await api.createHolding(holdingInput);
      if (nav) {
        await api.recordHoldingValuation(holding.id, {
          valuationAt: new Date().toISOString().slice(0, 10),
          nav,
        });
      }
      return holding;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['net-worth'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowAddHolding(false);
    },
  });

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
      <PageHeader
        title="Patrimonio"
        {...(data ? { subtitle: `Foto a ${data.asOf}` } : {})}
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowAddHolding(true)}
              className="text-sm px-3 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-card)]"
            >
              + Añadir posición
            </button>
            <button
              type="button"
              onClick={() => snapshotMutation.mutate()}
              disabled={snapshotMutation.isPending}
              className="text-sm px-3 py-1.5 rounded bg-[var(--color-accent)] text-white disabled:opacity-50"
            >
              {snapshotMutation.isPending ? 'Guardando…' : '📸 Materializar foto'}
            </button>
          </>
        }
      />

      {isLoading ? (
        <div className="p-12 text-center text-[var(--color-muted)]">Cargando…</div>
      ) : isError ? (
        <div className="p-12 text-center text-[var(--color-negative)]">
          Error: {error instanceof Error ? error.message : 'desconocido'}
        </div>
      ) : !data ? null : (
        <>
          <NetWorthHeadline totals={data.totals} />
          <SnapshotsChart snapshots={snapshotsQuery.data ?? []} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <AccountsCard accounts={data.accounts} />
            <HoldingsCard holdings={data.holdings} onOpen={setOpenHoldingId} />
            <LoansCard loans={data.loans} />
          </div>
        </>
      )}

      {showAddHolding ? (
        <AddHoldingDialog
          accounts={accountsQuery.data ?? []}
          isPending={createHoldingMutation.isPending}
          onConfirm={(input) => createHoldingMutation.mutate(input)}
          onDismiss={() => setShowAddHolding(false)}
        />
      ) : null}

      {openHoldingId ? (
        <HoldingDetailDialog holdingId={openHoldingId} onDismiss={() => setOpenHoldingId(null)} />
      ) : null}

      {toast ? (
        <output
          key={toast.id}
          className={cn(
            'fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm shadow-lg text-white',
            toast.tone === 'success' ? 'bg-[var(--color-positive)]' : 'bg-[var(--color-negative)]',
          )}
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
    </div>
  );
}

function SnapshotsChart({ snapshots }: { snapshots: NetWorthSnapshot[] }) {
  if (snapshots.length === 0) {
    return (
      <Card>
        <CardHeader title="Evolución" subtitle="Sin fotos guardadas todavía" />
        <p className="text-xs text-[var(--color-muted)] py-3">
          Pulsa <strong>Materializar foto</strong> para guardar la situación actual. Cada foto
          alimenta esta gráfica histórica.
        </p>
      </Card>
    );
  }
  // Recharts wants ascending dates.
  const data = [...snapshots]
    .sort((a, b) => a.snapshotAt.localeCompare(b.snapshotAt))
    .map((s) => ({
      date: s.snapshotAt,
      netWorth: Number(s.netWorth),
    }));
  return (
    <Card>
      <CardHeader title="Evolución" subtitle={`${snapshots.length} fotos`} />
      <div className="h-64 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="patNetFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
            <YAxis
              tickFormatter={(v) => formatEur(v, { compact: true })}
              tick={{ fontSize: 11 }}
              stroke="var(--color-muted)"
            />
            <Tooltip
              formatter={(v: number | string) => [formatEur(v, { compact: true }), 'Neto']}
            />
            <Area
              type="monotone"
              dataKey="netWorth"
              stroke="#2563eb"
              strokeWidth={2}
              fill="url(#patNetFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function NetWorthHeadline({
  totals,
}: {
  totals: NonNullable<
    ReturnType<typeof api.getNetWorth> extends Promise<infer T> ? T : never
  >['totals'];
}) {
  const negative = Number(totals.netWorth) < 0;
  return (
    <Card className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
          Patrimonio neto
        </div>
        <div
          className={cn(
            'text-4xl font-semibold tabular-nums mt-1',
            negative && 'text-[var(--color-negative)]',
          )}
        >
          {formatEur(totals.netWorth)}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
        <Stat label="Líquido" value={totals.liquid} />
        <Stat label="Invertido" value={totals.invested} />
        <Stat label="Inmuebles" value={totals.realEstate} />
        <Stat label="Otros" value={totals.other} />
        <Stat label="Pasivos" value={totals.liabilities} negative />
      </div>
    </Card>
  );
}

function Stat({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
      <div
        className={cn(
          'text-lg font-medium tabular-nums mt-0.5',
          negative && 'text-[var(--color-negative)]',
        )}
      >
        {formatEur(value, { compact: true })}
      </div>
    </div>
  );
}

function AccountsCard({ accounts }: { accounts: NetWorthAccount[] }) {
  return (
    <Card>
      <CardHeader title="Cuentas" subtitle={`${accounts.length} activas`} />
      {accounts.length === 0 ? (
        <p className="text-xs text-[var(--color-muted)] py-3">Sin cuentas activas.</p>
      ) : (
        <ul className="text-sm divide-y divide-[var(--color-border)]">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2">
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: a.institutionColor ?? '#999' }}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block truncate">{a.name}</span>
                  <span className="block text-[11px] text-[var(--color-muted)]">
                    {a.institutionName} · {ACCOUNT_TYPE_LABELS[a.type]}
                  </span>
                </span>
              </span>
              <span
                className={cn(
                  'tabular-nums font-medium shrink-0',
                  Number(a.balance) < 0 && 'text-[var(--color-negative)]',
                )}
              >
                {formatEur(a.balance)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function HoldingsCard({
  holdings,
  onOpen,
}: {
  holdings: {
    id: string;
    name: string;
    ticker: string | null;
    quantity: string;
    avgCost: string;
    marketValue: string;
  }[];
  onOpen: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader title="Inversiones" subtitle={`${holdings.length} posiciones`} />
      {holdings.length === 0 ? (
        <p className="text-xs text-[var(--color-muted)] py-3">
          Sin posiciones registradas. Pulsa <strong>+ Añadir posición</strong> para empezar.
        </p>
      ) : (
        <ul className="text-sm divide-y divide-[var(--color-border)]">
          {holdings.map((h) => {
            const cost = Number(h.quantity) * Number(h.avgCost);
            const value = Number(h.marketValue);
            const pnl = value - cost;
            const pnlPct = cost > 0 ? (pnl / cost) * 100 : null;
            return (
              <li key={h.id} className="py-2">
                <button
                  type="button"
                  onClick={() => onOpen(h.id)}
                  className="w-full flex items-center justify-between gap-3 text-left hover:bg-[var(--color-bg)]/30 -mx-2 px-2 rounded"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{h.name}</span>
                    <span className="block text-[11px] text-[var(--color-muted)]">
                      {h.ticker ?? '—'} · {Number(h.quantity).toFixed(4)} ud
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block tabular-nums font-medium">
                      {formatEur(h.marketValue)}
                    </span>
                    {pnlPct !== null ? (
                      <span
                        className={cn(
                          'block text-[11px] tabular-nums',
                          pnl >= 0
                            ? 'text-[var(--color-positive)]'
                            : 'text-[var(--color-negative)]',
                        )}
                      >
                        {pnl >= 0 ? '+' : ''}
                        {pnl.toFixed(2)} € ({pnl >= 0 ? '+' : ''}
                        {pnlPct.toFixed(1)}%)
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function LoansCard({
  loans,
}: {
  loans: { id: string; alias: string | null; lender: string; outstanding: string }[];
}) {
  return (
    <Card>
      <CardHeader title="Pasivos" subtitle={`${loans.length} préstamos`} />
      {loans.length === 0 ? (
        <p className="text-xs text-[var(--color-muted)] py-3">Sin pasivos.</p>
      ) : (
        <ul className="text-sm divide-y divide-[var(--color-border)]">
          {loans.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate font-medium">{l.alias ?? l.lender}</span>
                <span className="block text-[11px] text-[var(--color-muted)]">{l.lender}</span>
              </span>
              <span className="tabular-nums font-medium shrink-0 text-[var(--color-negative)]">
                {formatEur(l.outstanding)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
