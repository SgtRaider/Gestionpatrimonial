'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatEur } from '@/lib/format';
import type { CategorizationRuleEnriched, UpdateCategorizationRuleInput } from '@gp/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

type Toast = { id: number; message: string; tone: 'success' | 'error' };

export function ReglasClient() {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<Toast | null>(null);
  const [editing, setEditing] = useState<CategorizationRuleEnriched | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const rulesQuery = useQuery({
    queryKey: ['categorization-rules'],
    queryFn: api.listCategorizationRules,
  });
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories,
    staleTime: 5 * 60_000,
  });
  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: api.getAccounts,
    staleTime: 5 * 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['categorization-rules'] });
  };

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.updateCategorizationRule(id, { active }),
    onSuccess: (_, vars) => {
      invalidate();
      setToast({
        id: Date.now(),
        message: vars.active ? '✓ Regla reactivada' : '✓ Regla pausada',
        tone: 'success',
      });
    },
    onError: (err) => {
      setToast({
        id: Date.now(),
        message: `Error: ${err instanceof Error ? err.message : 'desconocido'}`,
        tone: 'error',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteCategorizationRule,
    onSuccess: () => {
      invalidate();
      setToast({ id: Date.now(), message: '✓ Regla eliminada', tone: 'success' });
    },
    onError: (err) => {
      setToast({
        id: Date.now(),
        message: `Error: ${err instanceof Error ? err.message : 'desconocido'}`,
        tone: 'error',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateCategorizationRuleInput }) =>
      api.updateCategorizationRule(id, patch),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      setToast({ id: Date.now(), message: '✓ Regla actualizada', tone: 'success' });
    },
    onError: (err) => {
      setToast({
        id: Date.now(),
        message: `Error: ${err instanceof Error ? err.message : 'desconocido'}`,
        tone: 'error',
      });
    },
  });

  const rules = rulesQuery.data ?? [];
  const totalHits = rules.reduce((sum, r) => sum + r.hits, 0);
  const activeCount = rules.filter((r) => r.active).length;

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
      <PageHeader
        title="Reglas de categorización"
        subtitle={`${activeCount} activas · ${totalHits} categorizaciones aplicadas`}
      />

      {rulesQuery.isLoading ? (
        <div className="p-12 text-center text-[var(--color-muted)]">Cargando…</div>
      ) : rules.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)] text-center py-8">
            Aún no has creado reglas. Desde un movimiento sin categorizar puedes crear una con
            "Crear regla" para que futuras transacciones similares se categoricen solas.
          </p>
        </Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-[var(--color-muted)] border-b border-[var(--color-border)]">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Patrón</th>
                  <th className="text-left font-medium px-4 py-3">Categoría</th>
                  <th className="text-left font-medium px-4 py-3">Cuenta</th>
                  <th className="text-right font-medium px-4 py-3">Importe</th>
                  <th className="text-right font-medium px-4 py-3">Prio.</th>
                  <th className="text-right font-medium px-4 py-3">Aciertos</th>
                  <th className="text-right font-medium px-4 py-3">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr
                    key={r.id}
                    className={cn(
                      'border-b border-[var(--color-border)] last:border-0',
                      !r.active && 'opacity-50',
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{r.patternRegex}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: r.categoryColor ?? '#888' }}
                        />
                        {r.categoryName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">
                      {r.accountName ?? 'Cualquiera'}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--color-muted)] tabular-nums">
                      {r.amountMin || r.amountMax ? (
                        <>
                          {r.amountMin ? formatEur(r.amountMin) : '—'}
                          {' / '}
                          {r.amountMax ? formatEur(r.amountMax) : '—'}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.priority}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.hits}</td>
                    <td className="px-4 py-3 text-right">
                      {r.active ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-positive)]/10 text-[var(--color-positive)]">
                          Activa
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-muted)]/10 text-[var(--color-muted)]">
                          Pausada
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setEditing(r)}
                        className="text-xs px-2 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)] mr-1"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleMutation.mutate({ id: r.id, active: !r.active })}
                        disabled={toggleMutation.isPending}
                        className="text-xs px-2 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)] mr-1 disabled:opacity-50"
                      >
                        {r.active ? 'Pausar' : 'Reactivar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`¿Eliminar la regla "${r.patternRegex}"?`)) {
                            deleteMutation.mutate(r.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="text-xs px-2 py-1 rounded text-[var(--color-negative)] hover:bg-[var(--color-negative)]/10 disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {editing ? (
        <EditRuleDialog
          rule={editing}
          categories={categoriesQuery.data ?? []}
          accounts={accountsQuery.data ?? []}
          isPending={updateMutation.isPending}
          onConfirm={(patch) => updateMutation.mutate({ id: editing.id, patch })}
          onDismiss={() => setEditing(null)}
        />
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

function EditRuleDialog({
  rule,
  categories,
  accounts,
  isPending,
  onConfirm,
  onDismiss,
}: {
  rule: CategorizationRuleEnriched;
  categories: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
  isPending: boolean;
  onConfirm: (patch: UpdateCategorizationRuleInput) => void;
  onDismiss: () => void;
}) {
  const [patternRegex, setPattern] = useState(rule.patternRegex);
  const [categoryId, setCategory] = useState(rule.categoryId);
  const [accountId, setAccount] = useState(rule.accountId ?? '');
  const [priority, setPriority] = useState(String(rule.priority));
  const [amountMin, setAmountMin] = useState(rule.amountMin ?? '');
  const [amountMax, setAmountMax] = useState(rule.amountMax ?? '');

  const dirty =
    patternRegex !== rule.patternRegex ||
    categoryId !== rule.categoryId ||
    (accountId || null) !== (rule.accountId ?? null) ||
    Number(priority) !== rule.priority ||
    (amountMin || null) !== (rule.amountMin ?? null) ||
    (amountMax || null) !== (rule.amountMax ?? null);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onDismiss}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDismiss();
      }}
      aria-modal="true"
      tabIndex={-1}
    >
      <div
        className="bg-[var(--color-card)] rounded-xl p-6 w-full max-w-lg shadow-xl border border-[var(--color-border)]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">Editar regla</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm({
              patternRegex,
              categoryId,
              accountId: accountId === '' ? null : accountId,
              priority: Number(priority),
              amountMin: amountMin === '' ? null : amountMin,
              amountMax: amountMax === '' ? null : amountMax,
            });
          }}
          className="space-y-3"
        >
          <Field label="Patrón (regex)">
            <input
              type="text"
              value={patternRegex}
              onChange={(e) => setPattern(e.target.value)}
              required
              className="w-full px-3 h-9 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-sm font-mono"
            />
          </Field>
          <Field label="Categoría">
            <select
              value={categoryId}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="w-full px-3 h-9 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cuenta (opcional)">
            <select
              value={accountId}
              onChange={(e) => setAccount(e.target.value)}
              className="w-full px-3 h-9 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-sm"
            >
              <option value="">Cualquiera</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Prio.">
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 h-9 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-sm tabular-nums"
              />
            </Field>
            <Field label="Importe min">
              <input
                type="number"
                step="0.01"
                value={amountMin}
                onChange={(e) => setAmountMin(e.target.value)}
                placeholder="—"
                className="w-full px-3 h-9 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-sm tabular-nums"
              />
            </Field>
            <Field label="Importe máx">
              <input
                type="number"
                step="0.01"
                value={amountMax}
                onChange={(e) => setAmountMax(e.target.value)}
                placeholder="—"
                className="w-full px-3 h-9 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-sm tabular-nums"
              />
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onDismiss}
              className="text-sm px-3 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!dirty || isPending}
              className="text-sm px-3 py-1.5 rounded bg-[var(--color-accent)] text-white disabled:opacity-50"
            >
              {isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide mb-1">
        {label}
      </span>
      {children}
    </div>
  );
}
