'use client';

import { Card } from '@/components/ui/card';
import { formatDelta, formatEur, isPositive } from '@/lib/format';
import type { TransactionListItem } from '@gp/shared';

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function TransactionDetail({
  tx,
  onClose,
  onMarkRecurring,
  onUnlinkRecurring,
  isRecurringPending,
}: {
  tx: TransactionListItem | null;
  onClose: () => void;
  onMarkRecurring: (tx: TransactionListItem) => void;
  onUnlinkRecurring: (tx: TransactionListItem) => void;
  isRecurringPending: boolean;
}) {
  if (!tx) {
    return (
      <Card className="h-full sticky top-20">
        <div className="text-sm text-[var(--color-muted)] py-12 text-center">
          Selecciona un movimiento para ver el detalle.
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full sticky top-20 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Detalle</div>
          <h3 className="text-lg font-semibold truncate">
            {tx.normalizedMerchant ?? tx.counterparty ?? tx.descriptionRaw}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          ✕
        </button>
      </div>

      <div
        className={`text-3xl font-semibold tabular-nums ${
          isPositive(tx.amount) ? 'text-[var(--color-positive)]' : ''
        }`}
      >
        {formatDelta(tx.amount)}
        {tx.currency !== 'EUR' ? (
          <span className="text-sm text-[var(--color-muted)] ml-2">{tx.currency}</span>
        ) : null}
      </div>

      <div className="text-sm text-[var(--color-muted)]">
        {formatLongDate(tx.bookedAt)} · {tx.institutionName}
        {tx.accountIbanLast4
          ? ` · ${tx.accountName} ✓${tx.accountIbanLast4}`
          : ` · ${tx.accountName}`}
      </div>

      <div className="space-y-3 pt-2 border-t border-[var(--color-border)]">
        <DetailRow label="Categoría">
          {tx.category ? (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs"
              style={{
                background: `${tx.category.color ?? '#999'}20`,
                color: tx.category.color ?? '#999',
              }}
            >
              {tx.category.name}
            </span>
          ) : (
            <span className="text-[var(--color-muted)] italic text-sm">Sin categorizar</span>
          )}
        </DetailRow>

        <DetailRow label="Estado">
          <span className="text-sm">
            {tx.status === 'pending' ? '⏳ Pendiente' : '● Booked'}
            {tx.transferPairId ? ' · ⇄ Transferencia interna' : ''}
            {tx.recurringRuleId ? ' · 🔁 Recurrente' : ''}
          </span>
        </DetailRow>

        <DetailRow label="Origen">
          <span className="text-sm capitalize">{tx.source}</span>
        </DetailRow>

        <DetailRow label="Descripción raw">
          <span className="text-xs text-[var(--color-muted)] font-mono">{tx.descriptionRaw}</span>
        </DetailRow>

        {tx.tags.length > 0 ? (
          <DetailRow label="Tags">
            <div className="flex flex-wrap gap-1">
              {tx.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </DetailRow>
        ) : null}

        {tx.notes ? (
          <DetailRow label="Notas">
            <p className="text-sm">{tx.notes}</p>
          </DetailRow>
        ) : null}

        {tx.amountBaseCurrency && tx.currency !== 'EUR' ? (
          <DetailRow label="Importe en EUR">
            <span className="text-sm tabular-nums">{formatEur(tx.amountBaseCurrency)}</span>
          </DetailRow>
        ) : null}
      </div>

      <div className="pt-3 border-t border-[var(--color-border)] flex flex-wrap gap-2 text-xs">
        {tx.recurringRuleId ? (
          <button
            type="button"
            onClick={() => onUnlinkRecurring(tx)}
            disabled={isRecurringPending}
            className="px-2.5 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)] disabled:opacity-50"
          >
            ✕ Quitar recurrente
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onMarkRecurring(tx)}
            disabled={isRecurringPending}
            className="px-2.5 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)] disabled:opacity-50"
          >
            🔁 Marcar recurrente
          </button>
        )}
        <button
          type="button"
          className="px-2.5 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)]"
        >
          ⇄ Marcar transfer
        </button>
        <button
          type="button"
          className="px-2.5 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)]"
        >
          ✂ Dividir
        </button>
      </div>
    </Card>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3 items-start">
      <div className="text-xs text-[var(--color-muted)] uppercase tracking-wide pt-0.5 shrink-0">
        {label}
      </div>
      <div className="text-right min-w-0">{children}</div>
    </div>
  );
}
