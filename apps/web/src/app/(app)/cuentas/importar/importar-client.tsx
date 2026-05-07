'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDelta } from '@/lib/format';
import type { ImportMapping, ImportPreviewResponse } from '@gp/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRef, useState } from 'react';

type Step = 'pick' | 'review' | 'done';

const FIELD_LABELS: Record<keyof ImportMapping | 'omit', string> = {
  date: 'Fecha',
  amount: 'Importe',
  description: 'Descripción',
  counterparty: 'Contraparte (opc.)',
  reference: 'Referencia (opc.)',
  decimalSeparator: '',
  dateFormat: '',
  omit: '',
};

export function ImportarClient() {
  const queryClient = useQueryClient();
  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: api.getAccounts,
    staleTime: 5 * 60_000,
  });

  const [step, setStep] = useState<Step>('pick');
  const [accountId, setAccountId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [mapping, setMapping] = useState<ImportMapping | null>(null);
  const [commitResult, setCommitResult] = useState<{
    inserted: number;
    duplicates: number;
    skipped: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const previewMutation = useMutation({
    mutationFn: api.importTransactionsPreview,
    onSuccess: (resp) => {
      setPreview(resp);
      setMapping(resp.detectedMapping ?? null);
      setStep('review');
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    },
  });

  const commitMutation = useMutation({
    mutationFn: api.importTransactionsCommit,
    onSuccess: (resp) => {
      setCommitResult(resp);
      setStep('done');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    },
  });

  function handleFile(f: File | null) {
    setFile(f);
    setError(null);
  }

  function startPreview() {
    setError(null);
    if (!file) {
      setError('Selecciona un fichero CSV');
      return;
    }
    if (!accountId) {
      setError('Selecciona la cuenta destino');
      return;
    }
    previewMutation.mutate({ file, accountId });
  }

  function refreshPreview(nextMapping: ImportMapping) {
    if (!file || !accountId) return;
    setMapping(nextMapping);
    previewMutation.mutate({ file, accountId, mapping: nextMapping });
  }

  function commit() {
    if (!file || !accountId) return;
    commitMutation.mutate({ file, accountId, ...(mapping ? { mapping } : {}) });
  }

  function reset() {
    setStep('pick');
    setFile(null);
    setPreview(null);
    setMapping(null);
    setCommitResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  const accounts = accountsQuery.data ?? [];

  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-4">
      <PageHeader
        title="Importar CSV"
        subtitle="Sube un fichero exportado por tu banco. Detectamos columnas y formato automáticamente."
        actions={
          <Link
            href="/cuentas/movimientos"
            className="text-sm px-3 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-card)]"
          >
            ← Movimientos
          </Link>
        }
      />

      {error ? (
        <Card className="border-[var(--color-negative)]/40 bg-[var(--color-negative)]/5">
          <p className="text-sm text-[var(--color-negative)]">⚠ {error}</p>
        </Card>
      ) : null}

      {step === 'pick' ? (
        <Card className="space-y-4">
          <CardHeader title="Paso 1 de 3" subtitle="Cuenta destino y fichero" />

          <label className="block">
            <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
              Cuenta
            </span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="mt-1 w-full h-9 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
            >
              <option value="">— Elige una cuenta —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.institution.name} · {a.name}
                  {a.ibanLast4 ? ` (${a.ibanLast4})` : ''}
                </option>
              ))}
            </select>
          </label>

          <FileDrop file={file} onChange={handleFile} inputRef={inputRef} />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={startPreview}
              disabled={!file || !accountId || previewMutation.isPending}
              className="text-sm px-4 py-1.5 rounded bg-[var(--color-accent)] text-white disabled:opacity-50"
            >
              {previewMutation.isPending ? 'Analizando…' : 'Continuar →'}
            </button>
          </div>
        </Card>
      ) : null}

      {step === 'review' && preview ? (
        <>
          <Card className="space-y-4">
            <CardHeader
              title="Paso 2 de 3"
              subtitle={`Detectadas ${preview.stats.totalRows} filas (${preview.stats.parsedRows} válidas, ${preview.stats.skippedRows} saltadas)`}
              action={
                <span
                  className={cn(
                    'text-xs px-2 py-1 rounded',
                    preview.format === 'unknown'
                      ? 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]'
                      : 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
                  )}
                >
                  {preview.formatLabel}
                </span>
              }
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Stat label="Ingresos" value={formatDelta(preview.stats.income)} tone="positive" />
              <Stat label="Gastos" value={formatDelta(preview.stats.expenses)} tone="negative" />
              <Stat label="Neto" value={formatDelta(preview.stats.net)} />
              <Stat
                label="Rango"
                value={
                  preview.stats.dateRange
                    ? `${preview.stats.dateRange.from} → ${preview.stats.dateRange.to}`
                    : '—'
                }
              />
            </div>

            {preview.headers.length > 0 && mapping ? (
              <div>
                <h4 className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-2">
                  Mapeo de columnas
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <MappingSelect
                    label={FIELD_LABELS.date}
                    value={mapping.date}
                    headers={preview.headers}
                    onChange={(v) => refreshPreview({ ...mapping, date: v })}
                  />
                  <MappingSelect
                    label={FIELD_LABELS.amount}
                    value={mapping.amount}
                    headers={preview.headers}
                    onChange={(v) => refreshPreview({ ...mapping, amount: v })}
                  />
                  <MappingSelect
                    label={FIELD_LABELS.description}
                    value={mapping.description}
                    headers={preview.headers}
                    onChange={(v) => refreshPreview({ ...mapping, description: v })}
                  />
                  <MappingSelect
                    label={FIELD_LABELS.counterparty}
                    value={mapping.counterparty ?? ''}
                    headers={preview.headers}
                    optional
                    onChange={(v) => {
                      const { counterparty: _omit, ...rest } = mapping;
                      const next: ImportMapping = v ? { ...rest, counterparty: v } : rest;
                      refreshPreview(next);
                    }}
                  />
                  <FormatSelect
                    label="Separador decimal"
                    value={mapping.decimalSeparator}
                    options={[
                      { value: 'auto', label: 'Auto-detectar' },
                      { value: ',', label: 'Coma (1.234,56)' },
                      { value: '.', label: 'Punto (1,234.56)' },
                    ]}
                    onChange={(v) =>
                      refreshPreview({
                        ...mapping,
                        decimalSeparator: v as ImportMapping['decimalSeparator'],
                      })
                    }
                  />
                  <FormatSelect
                    label="Formato de fecha"
                    value={mapping.dateFormat}
                    options={[
                      { value: 'auto', label: 'Auto-detectar' },
                      { value: 'iso', label: 'ISO (2026-05-04)' },
                      { value: 'dmy-slash', label: 'DD/MM/AAAA' },
                      { value: 'dmy-dash', label: 'DD-MM-AAAA' },
                      { value: 'mdy-slash', label: 'MM/DD/AAAA' },
                    ]}
                    onChange={(v) =>
                      refreshPreview({
                        ...mapping,
                        dateFormat: v as ImportMapping['dateFormat'],
                      })
                    }
                  />
                </div>
              </div>
            ) : null}

            <div>
              <h4 className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-2">
                Vista previa ({preview.sampleRows.length} primeras)
              </h4>
              <div className="overflow-x-auto rounded border border-[var(--color-border)]">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--color-bg)]/50 text-[var(--color-muted)]">
                    <tr>
                      <th className="text-left px-2 py-1 font-medium">Fecha</th>
                      <th className="text-right px-2 py-1 font-medium">Importe</th>
                      <th className="text-left px-2 py-1 font-medium">Descripción</th>
                      <th className="text-left px-2 py-1 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sampleRows.map((row, i) => (
                      <tr
                        key={`${row.date ?? i}-${row.amount ?? i}-${i}`}
                        className="border-t border-[var(--color-border)]"
                      >
                        <td className="px-2 py-1 whitespace-nowrap">{row.date ?? '—'}</td>
                        <td className="px-2 py-1 text-right tabular-nums">
                          {row.amount ? formatDelta(row.amount) : '—'}
                        </td>
                        <td className="px-2 py-1 truncate max-w-md">{row.description}</td>
                        <td
                          className={cn(
                            'px-2 py-1',
                            row.parseError && 'text-[var(--color-negative)]',
                          )}
                        >
                          {row.parseError ?? 'OK'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={reset}
                className="text-sm px-3 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)]"
              >
                ← Volver
              </button>
              <button
                type="button"
                onClick={commit}
                disabled={commitMutation.isPending || preview.stats.parsedRows === 0}
                className="text-sm px-4 py-1.5 rounded bg-[var(--color-accent)] text-white disabled:opacity-50"
              >
                {commitMutation.isPending
                  ? 'Importando…'
                  : `Importar ${preview.stats.parsedRows} movimientos →`}
              </button>
            </div>
          </Card>
        </>
      ) : null}

      {step === 'done' && commitResult ? (
        <Card className="space-y-4">
          <CardHeader title="Paso 3 de 3" subtitle="Listo" />
          <div className="text-center py-6 space-y-2">
            <div className="text-4xl">✅</div>
            <p className="text-sm">
              <strong>{commitResult.inserted}</strong> movimientos importados
              {commitResult.duplicates > 0 ? (
                <>
                  {' '}
                  ·{' '}
                  <span className="text-[var(--color-muted)]">
                    {commitResult.duplicates} duplicados ya existían
                  </span>
                </>
              ) : null}
              {commitResult.skipped > 0 ? (
                <>
                  {' '}
                  ·{' '}
                  <span className="text-[var(--color-muted)]">
                    {commitResult.skipped} con errores de parseo
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="text-sm px-3 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)]"
            >
              Importar otro
            </button>
            <Link
              href="/cuentas/movimientos"
              className="text-sm px-3 py-1.5 rounded bg-[var(--color-accent)] text-white"
            >
              Ver Movimientos →
            </Link>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function FileDrop({
  file,
  onChange,
  inputRef,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0] ?? null;
        if (f) onChange(f);
      }}
      className={cn(
        'border border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
        dragOver
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
          : 'border-[var(--color-border)] hover:bg-[var(--color-bg)]',
      )}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv,.txt,.pdf,application/pdf"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="hidden"
      />
      {file ? (
        <div>
          <p className="text-sm font-medium">{file.name}</p>
          <p className="text-xs text-[var(--color-muted)]">
            {(file.size / 1024).toFixed(1)} KB · click para cambiar
          </p>
        </div>
      ) : (
        <div className="text-[var(--color-muted)]">
          <p className="text-2xl mb-1">📄</p>
          <p className="text-sm">Arrastra el CSV o PDF aquí, o haz click</p>
          <p className="text-xs mt-1">
            CSV genérico · Caja Rural Extremadura PDF · MyInvestor PDF/CSV · Máx. 5 MB
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
}) {
  return (
    <div className="border border-[var(--color-border)] rounded p-2">
      <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
      <div
        className={cn(
          'text-sm font-medium tabular-nums mt-0.5',
          tone === 'positive' && 'text-[var(--color-positive)]',
          tone === 'negative' && 'text-[var(--color-negative)]',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function MappingSelect({
  label,
  value,
  headers,
  optional,
  onChange,
}: {
  label: string;
  value: string;
  headers: string[];
  optional?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-9 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
      >
        {optional ? <option value="">— Ninguna —</option> : null}
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </label>
  );
}

function FormatSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-9 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
