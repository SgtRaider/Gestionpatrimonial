'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDelta, isPositive } from '@/lib/format';
import type { CategorizationQueueItem, CategorySuggestion } from '@gp/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

const SOURCE_LABELS: Record<CategorySuggestion['source'], string> = {
  merchant: 'mismo comercio',
  description: 'descripción similar',
  recent: 'frecuente últimos 90d',
};

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function ColaClient() {
  const queryClient = useQueryClient();
  const queueQuery = useQuery({
    queryKey: ['categorization-queue'],
    queryFn: api.getCategorizationQueue,
  });

  const categorizeMutation = useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string | null }) =>
      api.patchTransaction(id, { categoryId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorization-queue'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const data = queueQuery.data;

  return (
    <div className="max-w-2xl mx-auto p-4 lg:p-8 space-y-6">
      <PageHeader
        title="Cola de categorización"
        {...(data
          ? {
              subtitle:
                data.pending === 0
                  ? 'Todo al día'
                  : `${data.pending} ${data.pending === 1 ? 'movimiento pendiente' : 'movimientos pendientes'}`,
            }
          : {})}
      />

      {queueQuery.isLoading ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)] py-12 text-center">Cargando…</p>
        </Card>
      ) : queueQuery.isError ? (
        <Card>
          <p className="text-sm text-[var(--color-negative)] py-12 text-center">
            Error: {queueQuery.error instanceof Error ? queueQuery.error.message : 'desconocido'}
          </p>
        </Card>
      ) : !data?.next ? (
        <EmptyState />
      ) : (
        <TxCard
          tx={data.next}
          suggestions={data.suggestions}
          isPending={categorizeMutation.isPending}
          onPick={(categoryId) =>
            categorizeMutation.mutate({ id: data.next?.id ?? '', categoryId })
          }
        />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardHeader title="🎉 Sin movimientos pendientes" />
      <p className="text-sm text-[var(--color-muted)] py-3">
        Todos tus movimientos están categorizados. Importa un nuevo extracto o vuelve cuando tengas
        cargos sin clasificar.
      </p>
      <div className="flex gap-2">
        <Link
          href="/cuentas/importar"
          className="text-sm px-3 py-1.5 rounded bg-[var(--color-accent)] text-white"
        >
          ↑ Importar CSV
        </Link>
        <Link
          href="/cuentas/movimientos"
          className="text-sm px-3 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)]"
        >
          Ver movimientos
        </Link>
      </div>
    </Card>
  );
}

function TxCard({
  tx,
  suggestions,
  isPending,
  onPick,
}: {
  tx: CategorizationQueueItem;
  suggestions: CategorySuggestion[];
  isPending: boolean;
  onPick: (categoryId: string | null) => void;
}) {
  const positive = isPositive(tx.amount);
  return (
    <Card className="space-y-5">
      <div>
        <div className="text-xs text-[var(--color-muted)]">
          {formatLongDate(tx.bookedAt)}
          {' · '}
          <span
            className="inline-flex items-center gap-1.5 align-middle"
            title={tx.institutionName}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: tx.institutionColor ?? '#999' }}
              aria-hidden
            />
            {tx.accountName}
          </span>
        </div>
        <div className="mt-1 text-xl font-semibold truncate">
          {tx.normalizedMerchant ?? tx.counterparty ?? tx.descriptionRaw}
        </div>
        <div className="text-xs text-[var(--color-muted)] truncate font-mono">
          {tx.descriptionRaw}
        </div>
        <div
          className={cn(
            'mt-2 text-3xl font-semibold tabular-nums',
            positive && 'text-[var(--color-positive)]',
          )}
        >
          {formatDelta(tx.amount)}
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-2">
          Sugerencias
        </div>
        {suggestions.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)]">
            Sin sugerencias automáticas. Usa el panel de detalle en{' '}
            <Link className="underline" href="/cuentas/movimientos">
              Movimientos
            </Link>{' '}
            para asignar la categoría a mano.
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {suggestions.map((s) => (
              <li key={s.categoryId}>
                <button
                  type="button"
                  onClick={() => onPick(s.categoryId)}
                  disabled={isPending}
                  className="w-full flex items-center justify-between gap-2 p-2.5 rounded border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/5 disabled:opacity-50 text-left"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="inline-block w-2 h-2 rounded-full shrink-0"
                      style={{ background: s.color ?? '#999' }}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{s.name}</span>
                      <span className="block text-[10px] text-[var(--color-muted)]">
                        {s.hits} {s.hits === 1 ? 'movimiento' : 'movimientos'} ·{' '}
                        {SOURCE_LABELS[s.source]}
                      </span>
                    </span>
                  </span>
                  <span className="text-[var(--color-muted)] shrink-0">→</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-between pt-3 border-t border-[var(--color-border)] text-xs">
        <Link
          href="/cuentas/movimientos"
          className="px-2.5 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)]"
        >
          Ver en Movimientos
        </Link>
        <button
          type="button"
          onClick={() => onPick(null)}
          disabled
          className="px-2.5 py-1.5 rounded text-[var(--color-muted)] cursor-not-allowed"
          title="El movimiento se queda sin categorizar y vuelve a aparecer en la próxima carga (no hay 'saltar' persistente todavía)"
        >
          Saltar (próximamente)
        </button>
      </div>
    </Card>
  );
}
