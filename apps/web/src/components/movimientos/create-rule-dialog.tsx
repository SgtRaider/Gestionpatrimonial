'use client';

import type { Category, TransactionListItem } from '@gp/shared';
import { useEffect, useState } from 'react';

type Props = {
  tx: TransactionListItem;
  category: Category;
  initialRegex: string;
  isCreating: boolean;
  onConfirm: (input: { regex: string; applyToExisting: boolean; restrictAccount: boolean }) => void;
  onDismiss: () => void;
};

export function CreateRuleDialog({
  tx,
  category,
  initialRegex,
  isCreating,
  onConfirm,
  onDismiss,
}: Props) {
  const [regex, setRegex] = useState(initialRegex);
  const [applyToExisting, setApplyToExisting] = useState(true);
  const [restrictAccount, setRestrictAccount] = useState(false);
  const [regexError, setRegexError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  function validate(value: string): boolean {
    try {
      new RegExp(value);
      setRegexError(null);
      return true;
    } catch (err) {
      setRegexError(err instanceof Error ? err.message : 'Regex inválido');
      return false;
    }
  }

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="create-rule-title"
      className="fixed inset-0 z-50 m-0 w-screen h-screen max-w-none max-h-none flex items-center justify-center bg-black/40 p-4 text-[var(--color-fg)]"
      onClick={onDismiss}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onDismiss();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl bg-[var(--color-card)] border border-[var(--color-border)] shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <h2 id="create-rule-title" className="text-lg font-semibold mb-1">
          ¿Crear regla de categorización?
        </h2>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          Asignaremos automáticamente{' '}
          <span
            className="px-1.5 py-0.5 rounded text-xs"
            style={{
              background: `${category.color ?? '#999'}20`,
              color: category.color ?? '#999',
            }}
          >
            {category.name}
          </span>{' '}
          a futuros movimientos cuya descripción coincida con el patrón.
        </p>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
              Patrón (regex case-insensitive)
            </span>
            <input
              type="text"
              value={regex}
              onChange={(e) => {
                setRegex(e.target.value);
                validate(e.target.value);
              }}
              className="mt-1 w-full h-9 px-2 text-sm font-mono rounded border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
              placeholder="MERCADONA"
            />
            {regexError ? (
              <span className="text-xs text-[var(--color-negative)] mt-1 block">
                ⚠ {regexError}
              </span>
            ) : (
              <span className="text-xs text-[var(--color-muted)] mt-1 block">
                Coincide contra <span className="font-mono">{tx.descriptionRaw}</span>
              </span>
            )}
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={restrictAccount}
              onChange={(e) => setRestrictAccount(e.target.checked)}
            />
            <span>
              Solo cuando es de <strong>{tx.institutionName}</strong> · {tx.accountName}
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={applyToExisting}
              onChange={(e) => setApplyToExisting(e.target.checked)}
            />
            <span>Aplicar también a movimientos pasados sin categoría</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onDismiss}
            disabled={isCreating}
            className="text-sm px-3 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)] disabled:opacity-50"
          >
            No, gracias
          </button>
          <button
            type="button"
            onClick={() => {
              if (validate(regex)) {
                onConfirm({ regex, applyToExisting, restrictAccount });
              }
            }}
            disabled={isCreating || !!regexError || regex.trim().length === 0}
            className="text-sm px-3 py-1.5 rounded bg-[var(--color-accent)] text-white disabled:opacity-50"
          >
            {isCreating ? 'Creando…' : 'Sí, crear regla'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
