'use client';

import type { AccountWithInstitution } from '@gp/shared';
import { useState } from 'react';

type Props = {
  accounts: AccountWithInstitution[];
  isPending: boolean;
  onConfirm: (input: {
    accountId: string;
    name: string;
    ticker: string | null;
    isin: string | null;
    currency: string;
    quantity: string;
    avgCost: string;
    nav?: string;
  }) => void;
  onDismiss: () => void;
};

export function AddHoldingDialog({ accounts, isPending, onConfirm, onDismiss }: Props) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [isin, setIsin] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [quantity, setQuantity] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [nav, setNav] = useState('');

  const numberValid = (s: string) => /^-?\d+(\.\d+)?$/.test(s);
  const canSubmit =
    accountId !== '' &&
    name.trim().length > 0 &&
    numberValid(quantity) &&
    numberValid(avgCost) &&
    (nav === '' || numberValid(nav)) &&
    !isPending;

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="add-holding-title"
      className="fixed inset-0 z-50 m-0 w-screen h-screen max-w-none max-h-none flex items-center justify-center bg-black/40 p-4 text-[var(--color-fg)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDismiss();
      }}
    >
      <div
        className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-2xl w-full max-w-lg p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 id="add-holding-title" className="text-lg font-semibold">
            Añadir posición
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

        <Field label="Cuenta">
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="mt-1 w-full h-9 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
          >
            <option value="">—</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.institution.name} · {a.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Nombre">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="MSCI World, Apple Inc, …"
            maxLength={200}
            className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Ticker">
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="IWDA"
              maxLength={20}
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
            />
          </Field>
          <Field label="ISIN" hint="12 caracteres">
            <input
              type="text"
              value={isin}
              onChange={(e) => setIsin(e.target.value.toUpperCase())}
              placeholder="IE00B4L5Y983"
              maxLength={12}
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
            />
          </Field>
          <Field label="Divisa">
            <input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              maxLength={3}
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Cantidad">
            <input
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="10.0"
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums"
            />
          </Field>
          <Field label="Coste medio">
            <input
              type="text"
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
              placeholder="75.50"
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums"
            />
          </Field>
          <Field label="NAV actual" hint="opcional">
            <input
              type="text"
              value={nav}
              onChange={(e) => setNav(e.target.value)}
              placeholder="82.30"
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums"
            />
          </Field>
        </div>

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
                accountId,
                name: name.trim(),
                ticker: ticker.trim() || null,
                isin: isin.trim() || null,
                currency: currency || 'EUR',
                quantity,
                avgCost,
                ...(nav ? { nav } : {}),
              })
            }
            disabled={!canSubmit}
            className="px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] text-white disabled:opacity-50"
          >
            {isPending ? 'Guardando…' : 'Crear'}
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
  // The actual <input>/<select> lives in `children` and carries its own
  // semantics; this wrapper just stacks label + control. Using a <div> with
  // the label as a sibling keeps biome's "label needs a control" rule happy
  // without changing focus behaviour.
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
