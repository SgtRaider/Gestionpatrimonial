'use client';

import { PageHeader } from '@/components/layout/page-header';
import { BulkActionBar } from '@/components/movimientos/bulk-action-bar';
import { CreateRuleDialog } from '@/components/movimientos/create-rule-dialog';
import { MarkRecurringDialog } from '@/components/movimientos/mark-recurring-dialog';
import { TransactionDetail } from '@/components/movimientos/transaction-detail';
import { TransactionsTable } from '@/components/movimientos/transactions-table';
import { TransactionsToolbar } from '@/components/movimientos/transactions-toolbar';
import { type TransactionsQuery, api } from '@/lib/api';
import { formatDelta } from '@/lib/format';
import type { Category, TransactionListItem, TransactionListResponse } from '@gp/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type Toast = {
  id: number;
  message: string;
  tone: 'success' | 'error';
  action?: { label: string; onClick: () => void };
};

const TOAST_DURATION_MS = 8000;

type PendingRule = {
  tx: TransactionListItem;
  category: Category;
  suggestedRegex: string;
};

function suggestPatternFromDescription(description: string): string {
  const stripped = description
    .replace(/\d{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const firstWord = stripped.split(/\s+/)[0];
  return firstWord && firstWord.length >= 3 ? firstWord : stripped;
}

export function MovimientosClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [pendingRule, setPendingRule] = useState<PendingRule | null>(null);
  const [recurringSelection, setRecurringSelection] = useState<TransactionListItem[] | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  // Auto-dismiss toasts after a delay so they don't pile up.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, TOAST_DURATION_MS);
    return () => clearTimeout(t);
  }, [toast]);

  function showToast(t: Omit<Toast, 'id'>) {
    setToast({ ...t, id: Date.now() });
  }

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

  const categoryById = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categoriesQuery.data ?? []) map.set(c.id, c);
    return map;
  }, [categoriesQuery.data]);

  const patchMutation = useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string | null }) =>
      api.patchTransaction(id, { categoryId }),
    onMutate: async ({ id, categoryId }) => {
      await queryClient.cancelQueries({ queryKey: ['transactions'] });
      const snapshot = queryClient.getQueriesData<TransactionListResponse>({
        queryKey: ['transactions'],
      });
      queryClient.setQueriesData<TransactionListResponse>({ queryKey: ['transactions'] }, (old) => {
        if (!old) return old;
        const newCategory = categoryId ? (categoryById.get(categoryId) ?? null) : null;
        return {
          ...old,
          items: old.items.map((it) =>
            it.id === id ? { ...it, categoryId, category: newCategory } : it,
          ),
        };
      });
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) {
        for (const [key, data] of ctx.snapshot) {
          queryClient.setQueryData(key, data);
        }
      }
      showToast({ message: 'No se pudo guardar la categoría', tone: 'error' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const bulkCategorizeMutation = useMutation({
    mutationFn: api.bulkCategorize,
    onMutate: async ({ ids, categoryId }: { ids: string[]; categoryId: string | null }) => {
      await queryClient.cancelQueries({ queryKey: ['transactions'] });
      const snapshot = queryClient.getQueriesData<TransactionListResponse>({
        queryKey: ['transactions'],
      });
      const idSet = new Set(ids);
      const newCategory = categoryId ? (categoryById.get(categoryId) ?? null) : null;
      queryClient.setQueriesData<TransactionListResponse>({ queryKey: ['transactions'] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((it) =>
            idSet.has(it.id) ? { ...it, categoryId, category: newCategory } : it,
          ),
        };
      });
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) {
        for (const [key, data] of ctx.snapshot) {
          queryClient.setQueryData(key, data);
        }
      }
      showToast({ message: 'No se pudieron actualizar los movimientos', tone: 'error' });
    },
    onSuccess: (resp) => {
      showToast({
        message: `${resp.updated} ${resp.updated === 1 ? 'movimiento actualizado' : 'movimientos actualizados'}`,
        tone: 'success',
      });
      setSelectedIds(new Set());
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const ruleMutation = useMutation({
    mutationFn: api.createCategorizationRule,
    onSuccess: (resp) => {
      const extra =
        resp.appliedToCount > 0 ? ` · aplicada a ${resp.appliedToCount} mov. pasados` : '';
      showToast({ message: `Regla creada${extra}`, tone: 'success' });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setPendingRule(null);
    },
    onError: (err) => {
      showToast({
        message: `Error creando regla: ${err instanceof Error ? err.message : 'desconocido'}`,
        tone: 'error',
      });
    },
  });

  const markRecurringMutation = useMutation({
    mutationFn: api.markRecurring,
    onSuccess: (resp) => {
      showToast({
        message: `🔁 ${resp.rule.name} marcada como recurrente · ${resp.linkedCount} mov. vinculados`,
        tone: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setRecurringSelection(null);
      setSelectedIds(new Set());
    },
    onError: (err) => {
      showToast({
        message: `Error al marcar recurrente: ${err instanceof Error ? err.message : 'desconocido'}`,
        tone: 'error',
      });
    },
  });

  const unlinkRecurringMutation = useMutation({
    mutationFn: api.unlinkRecurring,
    onSuccess: (resp) => {
      const ruleNote = resp.rulesDeleted > 0 ? ' · regla eliminada' : '';
      showToast({
        message: `${resp.unlinkedCount} mov. desvinculados${ruleNote}`,
        tone: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => {
      showToast({
        message: `Error al quitar recurrente: ${err instanceof Error ? err.message : 'desconocido'}`,
        tone: 'error',
      });
    },
  });

  function handleCategoryChange(tx: TransactionListItem, newCategoryId: string | null) {
    if (newCategoryId === tx.categoryId) return;
    const wasUncategorized = tx.categoryId === null;
    patchMutation.mutate(
      { id: tx.id, categoryId: newCategoryId },
      {
        onSuccess: () => {
          if (wasUncategorized && newCategoryId) {
            const category = categoryById.get(newCategoryId);
            if (category) {
              showToast({
                message: 'Categoría aplicada',
                tone: 'success',
                action: {
                  label: 'Crear regla',
                  onClick: () =>
                    setPendingRule({
                      tx,
                      category,
                      suggestedRegex: suggestPatternFromDescription(tx.descriptionRaw),
                    }),
                },
              });
            }
          } else if (newCategoryId === null) {
            showToast({ message: 'Categoría retirada', tone: 'success' });
          } else {
            showToast({ message: 'Categoría actualizada', tone: 'success' });
          }
        },
      },
    );
  }

  const items = txQuery.data?.items ?? [];
  const summary = txQuery.data?.summary;
  const total = txQuery.data?.total ?? 0;
  const page = txQuery.data?.page ?? 1;
  const pageSize = txQuery.data?.pageSize ?? 50;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const selected = items.find((t) => t.id === selectedId) ?? null;

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function rangeSelect(anchorId: string, targetId: string) {
    const anchorIdx = items.findIndex((t) => t.id === anchorId);
    const targetIdx = items.findIndex((t) => t.id === targetId);
    if (anchorIdx === -1 || targetIdx === -1) return;
    const [from, to] = anchorIdx < targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx];
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (let i = from; i <= to; i++) {
        const it = items[i];
        if (it) next.add(it.id);
      }
      return next;
    });
  }

  function toggleAllVisible(visible: TransactionListItem[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = visible.length > 0 && visible.every((t) => next.has(t.id));
      if (allSelected) {
        for (const t of visible) next.delete(t.id);
      } else {
        for (const t of visible) next.add(t.id);
      }
      return next;
    });
  }

  function bulkCategorize(categoryId: string | null) {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    bulkCategorizeMutation.mutate({ ids, categoryId });
  }

  function openMarkRecurringFromBulk() {
    const selected = items.filter((t) => selectedIds.has(t.id));
    if (selected.length === 0) return;
    setRecurringSelection(selected);
  }

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
            <Link
              href="/cuentas/importar"
              className="text-sm px-3 py-1.5 rounded bg-[var(--color-accent)] text-white"
            >
              ↑ Importar CSV
            </Link>
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
              <TransactionsTable
                items={items}
                categories={categoriesQuery.data ?? []}
                selectedId={selectedId}
                selectedIds={selectedIds}
                onSelect={setSelectedId}
                onCategoryChange={handleCategoryChange}
                onToggleSelected={toggleSelected}
                onRangeSelect={rangeSelect}
                onToggleAllVisible={toggleAllVisible}
              />
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
          <TransactionDetail
            tx={selected}
            onClose={() => setSelectedId(null)}
            onMarkRecurring={(tx) => setRecurringSelection([tx])}
            onUnlinkRecurring={(tx) => unlinkRecurringMutation.mutate({ transactionIds: [tx.id] })}
            isRecurringPending={
              markRecurringMutation.isPending || unlinkRecurringMutation.isPending
            }
          />
        </div>
      </div>

      {selected ? (
        <div className="xl:hidden fixed inset-x-0 bottom-0 z-40 max-h-[70vh] overflow-auto bg-[var(--color-card)] border-t border-[var(--color-border)] rounded-t-2xl shadow-lg">
          <div className="p-4">
            <TransactionDetail
              tx={selected}
              onClose={() => setSelectedId(null)}
              onMarkRecurring={(tx) => setRecurringSelection([tx])}
              onUnlinkRecurring={(tx) =>
                unlinkRecurringMutation.mutate({ transactionIds: [tx.id] })
              }
              isRecurringPending={
                markRecurringMutation.isPending || unlinkRecurringMutation.isPending
              }
            />
          </div>
        </div>
      ) : null}

      {pendingRule ? (
        <CreateRuleDialog
          tx={pendingRule.tx}
          category={pendingRule.category}
          initialRegex={pendingRule.suggestedRegex}
          isCreating={ruleMutation.isPending}
          onConfirm={({ regex, applyToExisting, restrictAccount }) =>
            ruleMutation.mutate({
              patternRegex: regex,
              categoryId: pendingRule.category.id,
              accountId: restrictAccount ? pendingRule.tx.accountId : null,
              applyToExisting,
              suggestedFromTransactionId: pendingRule.tx.id,
            })
          }
          onDismiss={() => setPendingRule(null)}
        />
      ) : null}

      <BulkActionBar
        selectedCount={selectedIds.size}
        categories={categoriesQuery.data ?? []}
        isPending={bulkCategorizeMutation.isPending || markRecurringMutation.isPending}
        onCategorize={bulkCategorize}
        onMarkRecurring={openMarkRecurringFromBulk}
        onClear={() => setSelectedIds(new Set())}
      />

      {recurringSelection ? (
        <MarkRecurringDialog
          transactions={recurringSelection}
          isPending={markRecurringMutation.isPending}
          onConfirm={({ name, kind, frequency, amountKind, expectedAmount }) =>
            markRecurringMutation.mutate({
              transactionIds: recurringSelection.map((t) => t.id),
              name,
              kind,
              frequency,
              amountKind,
              expectedAmount,
            })
          }
          onDismiss={() => setRecurringSelection(null)}
        />
      ) : null}

      {toast ? (
        <output
          key={toast.id}
          className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm shadow-lg text-white ${
            toast.tone === 'success' ? 'bg-[var(--color-positive)]' : 'bg-[var(--color-negative)]'
          }`}
        >
          <span>{toast.message}</span>
          {toast.action ? (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick();
                setToast(null);
              }}
              className="px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 text-xs font-medium whitespace-nowrap"
            >
              {toast.action.label}
            </button>
          ) : null}
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
