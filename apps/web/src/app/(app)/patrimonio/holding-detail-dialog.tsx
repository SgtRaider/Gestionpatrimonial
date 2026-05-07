'use client';

import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatEur } from '@/lib/format';
import type { HoldingDetail } from '@gp/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const KIND_LABELS: Record<string, string> = {
  buy: 'Compra',
  sell: 'Venta',
  transfer_in: 'Traspaso entrada',
  transfer_out: 'Traspaso salida',
  dividend: 'Dividendo',
  split: 'Split',
  fee: 'Comisión',
  tax: 'Impuesto',
};

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

type Props = {
  holdingId: string;
  onDismiss: () => void;
};

export function HoldingDetailDialog({ holdingId, onDismiss }: Props) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['holding', holdingId],
    queryFn: () => api.getHoldingDetail(holdingId),
  });

  const txMutation = useMutation({
    mutationFn: ({
      kind,
      occurredAt,
      quantity,
      price,
    }: {
      kind: 'buy' | 'sell';
      occurredAt: string;
      quantity: string;
      price: string;
    }) => api.recordHoldingTransaction(holdingId, { kind, occurredAt, quantity, price }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holding', holdingId] });
      queryClient.invalidateQueries({ queryKey: ['net-worth'] });
    },
  });

  const navMutation = useMutation({
    mutationFn: ({ valuationAt, nav }: { valuationAt: string; nav: string }) =>
      api.recordHoldingValuation(holdingId, { valuationAt, nav }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holding', holdingId] });
      queryClient.invalidateQueries({ queryKey: ['net-worth'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteHolding(holdingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['net-worth'] });
      onDismiss();
    },
  });

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="holding-detail-title"
      className="fixed inset-0 z-50 m-0 w-screen h-screen max-w-none max-h-none flex items-center justify-center bg-black/40 p-4 text-[var(--color-fg)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDismiss();
      }}
    >
      <div
        className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-2xl w-full max-w-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 id="holding-detail-title" className="text-lg font-semibold">
              {data?.name ?? 'Holding'}
            </h3>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              {data?.ticker ?? '—'} {data?.isin ? `· ${data.isin}` : ''}{' '}
              {data?.assetClass ? `· ${data.assetClass}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Cerrar"
            className="text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            ✕
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-[var(--color-muted)]">Cargando…</div>
        ) : isError || !data ? (
          <div className="p-8 text-center text-[var(--color-negative)]">
            Error: {error instanceof Error ? error.message : 'desconocido'}
          </div>
        ) : (
          <>
            <PnLPanel detail={data} />

            <RecordTxForm
              isPending={txMutation.isPending}
              onSubmit={(input) => txMutation.mutate(input)}
            />

            <RecordNavForm
              isPending={navMutation.isPending}
              onSubmit={(input) => navMutation.mutate(input)}
            />

            <div>
              <h4 className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-2">
                Transacciones
              </h4>
              {data.transactions.length === 0 ? (
                <p className="text-xs text-[var(--color-muted)]">Sin transacciones registradas.</p>
              ) : (
                <ul className="text-sm divide-y divide-[var(--color-border)]">
                  {data.transactions.map((t) => (
                    <li key={t.id} className="flex justify-between py-1.5 gap-2">
                      <span className="text-[var(--color-muted)] text-xs whitespace-nowrap">
                        {formatLongDate(t.occurredAt)}
                      </span>
                      <span className="flex-1 text-xs">
                        {KIND_LABELS[t.kind] ?? t.kind} · {Number(t.quantity).toFixed(4)} ud @{' '}
                        {formatEur(t.price)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4 className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-2">
                Valoraciones
              </h4>
              {data.valuations.length === 0 ? (
                <p className="text-xs text-[var(--color-muted)]">Sin valoraciones registradas.</p>
              ) : (
                <ul className="text-sm divide-y divide-[var(--color-border)]">
                  {data.valuations.slice(0, 8).map((v) => (
                    <li key={v.id} className="flex justify-between py-1.5 gap-2">
                      <span className="text-[var(--color-muted)] text-xs whitespace-nowrap">
                        {v.valuationAt}
                      </span>
                      <span className="text-xs">
                        NAV {formatEur(v.nav)} · valor {formatEur(v.totalValue)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-between pt-3 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => {
                  if (confirm(`¿Eliminar holding "${data.name}"?`)) deleteMutation.mutate();
                }}
                disabled={deleteMutation.isPending}
                className="text-xs px-2.5 py-1.5 rounded border border-[var(--color-negative)]/40 text-[var(--color-negative)] hover:bg-[var(--color-negative)]/10 disabled:opacity-50"
              >
                🗑 Eliminar
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="text-xs px-3 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)]"
              >
                Cerrar
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}

function PnLPanel({ detail }: { detail: HoldingDetail }) {
  const pnl = Number(detail.unrealisedPnL);
  const pct = detail.unrealisedPnLPct;
  return (
    <Card className="space-y-1.5">
      <div className="grid grid-cols-3 gap-3 text-sm">
        <Stat label="Cantidad" value={`${Number(detail.quantity).toFixed(4)} ud`} />
        <Stat label="Coste medio" value={formatEur(detail.avgCost)} />
        <Stat label="NAV" value={detail.lastNav ? formatEur(detail.lastNav) : '—'} />
        <Stat label="Coste base" value={formatEur(detail.costBasis)} />
        <Stat label="Valor mercado" value={formatEur(detail.marketValue)} highlight />
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">PnL</div>
          <div
            className={cn(
              'text-base font-semibold tabular-nums',
              pnl >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]',
            )}
          >
            {pnl >= 0 ? '+' : ''}
            {formatEur(detail.unrealisedPnL)}
            {pct !== null ? (
              <span className="ml-1 text-xs font-normal">
                ({pct >= 0 ? '+' : ''}
                {pct.toFixed(1)}%)
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
      <div className={cn('text-sm font-medium tabular-nums', highlight && 'text-base')}>
        {value}
      </div>
    </div>
  );
}

function RecordTxForm({
  isPending,
  onSubmit,
}: {
  isPending: boolean;
  onSubmit: (input: {
    kind: 'buy' | 'sell';
    occurredAt: string;
    quantity: string;
    price: string;
  }) => void;
}) {
  const [kind, setKind] = useState<'buy' | 'sell'>('buy');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');

  const numberValid = (s: string) => /^-?\d+(\.\d+)?$/.test(s);
  const canSubmit = numberValid(qty) && numberValid(price) && !isPending;

  return (
    <fieldset className="border border-[var(--color-border)] rounded-lg p-3 space-y-2">
      <legend className="px-1 text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
        Registrar transacción
      </legend>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <label className="block">
          <span className="text-[10px] text-[var(--color-muted)]">Tipo</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as 'buy' | 'sell')}
            className="mt-1 w-full h-8 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
          >
            <option value="buy">Compra</option>
            <option value="sell">Venta</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] text-[var(--color-muted)]">Fecha</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full h-8 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
          />
        </label>
        <label className="block">
          <span className="text-[10px] text-[var(--color-muted)]">Cantidad</span>
          <input
            type="text"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="5"
            className="mt-1 w-full h-8 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums"
          />
        </label>
        <label className="block">
          <span className="text-[10px] text-[var(--color-muted)]">Precio €</span>
          <input
            type="text"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="80.50"
            className="mt-1 w-full h-8 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={() => {
          if (!canSubmit) return;
          onSubmit({ kind, occurredAt: date, quantity: qty, price });
          setQty('');
          setPrice('');
        }}
        disabled={!canSubmit}
        className="text-xs px-3 py-1.5 rounded bg-[var(--color-accent)] text-white disabled:opacity-50"
      >
        {isPending ? 'Guardando…' : 'Registrar'}
      </button>
    </fieldset>
  );
}

function RecordNavForm({
  isPending,
  onSubmit,
}: {
  isPending: boolean;
  onSubmit: (input: { valuationAt: string; nav: string }) => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [nav, setNav] = useState('');

  const numberValid = (s: string) => /^-?\d+(\.\d+)?$/.test(s);
  const canSubmit = numberValid(nav) && !isPending;

  return (
    <fieldset className="border border-[var(--color-border)] rounded-lg p-3 space-y-2">
      <legend className="px-1 text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
        Actualizar NAV
      </legend>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <label className="block">
          <span className="text-[10px] text-[var(--color-muted)]">Fecha</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full h-8 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
          />
        </label>
        <label className="block">
          <span className="text-[10px] text-[var(--color-muted)]">NAV €</span>
          <input
            type="text"
            value={nav}
            onChange={(e) => setNav(e.target.value)}
            placeholder="82.30"
            className="mt-1 w-full h-8 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={() => {
          if (!canSubmit) return;
          onSubmit({ valuationAt: date, nav });
          setNav('');
        }}
        disabled={!canSubmit}
        className="text-xs px-3 py-1.5 rounded bg-[var(--color-accent)] text-white disabled:opacity-50"
      >
        {isPending ? 'Guardando…' : 'Guardar NAV'}
      </button>
    </fieldset>
  );
}
