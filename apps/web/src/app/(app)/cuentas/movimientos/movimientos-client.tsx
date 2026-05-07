'use client';

import { PageHeader } from '@/components/layout/page-header';
import { TransactionDetail } from '@/components/movimientos/transaction-detail';
import { TransactionsTable } from '@/components/movimientos/transactions-table';
import { TransactionsToolbar } from '@/components/movimientos/transactions-toolbar';
import { type TransactionsQuery, api } from '@/lib/api';
import { formatDelta, formatEur } from '@/lib/format';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

export function MovimientosClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query: TransactionsQuery = useMemo(() => {
    const q: TransactionsQuery = {
      page: Number(searchParams.get('page') ?? '1'),
      pageSize: 50,
    };
    const from = searchParams.get('from');
    if (from) q.from = from;
    const to = searchParams.get('to');
    if (to) q.to = to;
    const accountId = searchParams.get('accountId');
    if (accountId) q.accountIds = [accountId];
    const categoryId = searchParams.get('categoryId');
    if (categoryId) q.categoryIds = [categoryId];
    const status = searchParams.get('status');
    if (status === 'booked' || status === 'pending') q.status = status;
    if (searchParams.get('uncategorized') === '1') q.uncategorized = true;
    const search = searchParams.get('search');
    if (search) q.search = search;
    return q;
  }, [searchParams]);

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: api.getAccounts,
    staleTime: 5 * 60_000,
  });
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories,
    staleTime: 5 * 60_000,
  });
  const txQuery = useQuery({
    queryKey: ['transactions', query],
    queryFn: () => api.getTransactions(query),
    placeholderData: (prev) => prev,
  });

  const items = txQuery.data?.items ?? [];
  const summary = txQuery.data?.summary;
  const total = txQuery.data?.total ?? 0;
  const page = txQuery.data?.page ?? 1;
  const pageSize = txQuery.data?.pageSize ?? 50;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const selected = items.find((t) => t.id === selectedId) ?? null;

  function changePage(next: number) {
    const sp = new URLSearchParams(searchParams.toString());
    if (next <= 1) sp.delete('page');
    else sp.set('page', String(next));
    router.replace(`?${sp.toString()}`, { scroll: false });
  }

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-4">
      <PageHeader
        title="Movimientos"
        actions={
          <>
            <button
              type="button"
              className="text-sm px-3 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-card)]"
            >
              ↻ Sync
            </button>
            <button
              type="button"
              className="text-sm px-3 py-1.5 rounded bg-[var(--color-accent)] text-white"
            >
              ↑ Importar CSV
            </button>
          </>
        }
      />

      <TransactionsToolbar
        accounts={accountsQuery.data ?? []}
        categories={categoriesQuery.data ?? []}
      />

      {summary ? (
        <div className="text-sm text-[var(--color-muted)] tabular-nums">
          {summary.count} movs · Ingresos{' '}
          <span className="text-[var(--color-positive)]">{formatDelta(summary.income)}</span> ·
          Gastos{' '}
          <span className="text-[var(--color-negative)]">{formatDelta(summary.expenses)}</span> ·
          Neto{' '}
          <span className="font-medium text-[var(--color-fg)]">{formatDelta(summary.net)}</span>
          <span className="text-xs ml-2">(transferencias internas excluidas)</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 items-start">
        <div className="space-y-3">
          {txQuery.isLoading ? (
            <div className="p-12 text-center text-[var(--color-muted)]">Cargando…</div>
          ) : txQuery.isError ? (
            <div className="p-12 text-center text-[var(--color-negative)]">
              Error: {txQuery.error instanceof Error ? txQuery.error.message : 'desconocido'}
            </div>
          ) : (
            <>
              <TransactionsTable items={items} selectedId={selectedId} onSelect={setSelectedId} />
              {pageCount > 1 ? (
                <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
                  <span>
                    Página {page} de {pageCount} · {total} movimientos
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => changePage(page - 1)}
                      disabled={page <= 1}
                      className="px-2 py-1 rounded border border-[var(--color-border)] disabled:opacity-40"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => changePage(page + 1)}
                      disabled={page >= pageCount}
                      className="px-2 py-1 rounded border border-[var(--color-border)] disabled:opacity-40"
                    >
                      ›
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="hidden xl:block">
          <TransactionDetail tx={selected} onClose={() => setSelectedId(null)} />
        </div>
      </div>

      {selected ? (
        <div className="xl:hidden fixed inset-x-0 bottom-0 z-40 max-h-[70vh] overflow-auto bg-[var(--color-card)] border-t border-[var(--color-border)] rounded-t-2xl shadow-lg">
          <div className="p-4">
            <TransactionDetail tx={selected} onClose={() => setSelectedId(null)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
