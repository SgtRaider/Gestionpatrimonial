'use client';

import type { AccountWithInstitution, TransactionListItem } from '@gp/shared';
import { useEffect, useState } from 'react';

type Props = {
  tx: TransactionListItem;
  accounts: AccountWithInstitution[];
  isPending: boolean;
  onConfirm: (patch: {
    amount: string;
    bookedAt: string;
    accountId: string;
    descriptionRaw: string;
    counterparty: string | null;
  }) => void;
  onDismiss: () => void;
};

export function EditTransactionDialog({ tx, accounts, isPending, onConfirm, onDismiss }: Props) {
  const [amount, setAmount] = useState(tx.amount);
  const [date, setDate] = useState(tx.bookedAt.slice(0, 10));
  const [accountId, setAccountId] = useState(tx.accountId);
  const [description, setDescription] = useState(tx.descriptionRaw);
  const [counterparty, setCounterparty] = useState(tx.counterparty ?? '');

  useEffect(() => {
    setAmount(tx.amount);
    setDate(tx.bookedAt.slice(0, 10));
    setAccountId(tx.accountId);
    setDescription(tx.descriptionRaw);
    setCounterparty(tx.counterparty ?? '');
  }, [tx]);

  const numberValid = (s: string) => /^-?\d+(\.\d{1,2})?$/.test(s);
  const canSubmit =
    numberValid(amount) && date.length === 10 && description.trim().length > 0 && !isPending;

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="edit-tx-title"
      className="fixed inset-0 z-50 m-0 w-screen h-screen max-w-none max-h-none flex items-center justify-center bg-black/40 p-4 text-[var(--color-fg)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDismiss();
      }}
    >
      <div
        className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-2xl w-full max-w-md p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 id="edit-tx-title" className="text-lg font-semibold">
            Editar movimiento
          </h3>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Cerrar"
            className="text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            ✕
          </button>
        </div>

        <Field label="Descripción">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
          />
        </Field>

        <Field label="Contraparte" hint="opcional">
          <input
            type="text"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            maxLength={200}
            className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Importe €" hint="negativo = gasto">
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums"
            />
          </Field>
          <Field label="Fecha">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
            />
          </Field>
        </div>

        <Field label="Cuenta">
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="mt-1 w-full h-9 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.institution.name} · {a.name}
                {a.ibanLast4 ? ` (${a.ibanLast4})` : ''}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={onDismiss}
            disabled={isPending}
            className="px-3 py-1.5 text-sm rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm({
                amount,
                bookedAt: date,
                accountId,
                descriptionRaw: description.trim(),
                counterparty: counterparty.trim() || null,
              })
            }
            disabled={!canSubmit}
            className="px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] text-white disabled:opacity-50"
          >
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <span className="text-xs uppercase tracking-wide text-[var(--color-muted)] block">
        {label}
        {hint ? <span className="ml-1 text-[10px] normal-case">({hint})</span> : null}
      </span>
      {children}
    </div>
  );
}
