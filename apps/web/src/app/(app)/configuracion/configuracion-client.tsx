'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { UpdateUserSettingsInput, UserSettings } from '@gp/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

const CURRENCY_OPTIONS = ['EUR', 'USD', 'GBP', 'CHF'] as const;
const LOCALE_OPTIONS = [
  { value: 'es-ES', label: 'Español (España)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
];
const TIMEZONE_OPTIONS = [
  'Europe/Madrid',
  'Europe/London',
  'Europe/Lisbon',
  'America/New_York',
  'UTC',
];
const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

type Toast = { id: number; message: string; tone: 'success' | 'error' };

export function ConfiguracionClient() {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<Toast | null>(null);
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: api.getSettings });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const updateMutation = useMutation({
    mutationFn: (patch: UpdateUserSettingsInput) => api.updateSettings(patch),
    onSuccess: (next) => {
      queryClient.setQueryData(['settings'], next);
      // Dashboard depends on largeExpenseThreshold and on locale/currency for formatting,
      // so invalidate it too.
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setToast({ id: Date.now(), message: '✓ Cambios guardados', tone: 'success' });
    },
    onError: (err) => {
      setToast({
        id: Date.now(),
        message: `Error al guardar: ${err instanceof Error ? err.message : 'desconocido'}`,
        tone: 'error',
      });
    },
  });

  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-6">
      <PageHeader title="Configuración" subtitle="Preferencias del usuario" />

      {settingsQuery.isLoading ? (
        <div className="p-12 text-center text-[var(--color-muted)]">Cargando…</div>
      ) : settingsQuery.isError || !settingsQuery.data ? (
        <div className="p-12 text-center text-[var(--color-negative)]">
          Error al cargar la configuración
        </div>
      ) : (
        <SettingsForm
          settings={settingsQuery.data}
          onSubmit={(patch) => updateMutation.mutate(patch)}
          isPending={updateMutation.isPending}
        />
      )}

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

function SettingsForm({
  settings,
  onSubmit,
  isPending,
}: {
  settings: UserSettings;
  onSubmit: (patch: UpdateUserSettingsInput) => void;
  isPending: boolean;
}) {
  const [draft, setDraft] = useState<UserSettings>(settings);

  // Re-sync local state when the server returns a fresh row (after a save).
  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const dirty =
    draft.baseCurrency !== settings.baseCurrency ||
    draft.fiscalYearStartMonth !== settings.fiscalYearStartMonth ||
    draft.locale !== settings.locale ||
    draft.timezone !== settings.timezone ||
    draft.expectedPortfolioReturnDefault !== settings.expectedPortfolioReturnDefault ||
    draft.largeExpenseThreshold !== settings.largeExpenseThreshold;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(draft);
      }}
      className="space-y-6"
    >
      <Card>
        <CardHeader title="Regional" subtitle="Moneda, idioma y zona horaria" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Moneda base">
            <select
              value={draft.baseCurrency}
              onChange={(e) => setDraft({ ...draft, baseCurrency: e.target.value })}
              className={inputCls}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Idioma">
            <select
              value={draft.locale}
              onChange={(e) => setDraft({ ...draft, locale: e.target.value })}
              className={inputCls}
            >
              {LOCALE_OPTIONS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Zona horaria">
            <select
              value={draft.timezone}
              onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
              className={inputCls}
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Inicio del año fiscal">
            <select
              value={draft.fiscalYearStartMonth}
              onChange={(e) => setDraft({ ...draft, fiscalYearStartMonth: Number(e.target.value) })}
              className={inputCls}
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Umbrales del dashboard"
          subtitle="Controlan qué se considera un gran gasto y la rentabilidad esperada"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Gran gasto desde (€)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={draft.largeExpenseThreshold}
              onChange={(e) => setDraft({ ...draft, largeExpenseThreshold: e.target.value })}
              className={inputCls}
            />
            <p className="text-xs text-[var(--color-muted)] mt-1">
              El KPI "Próximo gran gasto" del Inicio sólo muestra eventos por encima de este
              importe.
            </p>
          </Field>
          <Field label="Rentabilidad esperada cartera (% anual)">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={draft.expectedPortfolioReturnDefault}
              onChange={(e) =>
                setDraft({ ...draft, expectedPortfolioReturnDefault: e.target.value })
              }
              className={inputCls}
            />
            <p className="text-xs text-[var(--color-muted)] mt-1">
              Usado por el comparador "amortizar vs invertir" cuando no se especifica un retorno
              concreto.
            </p>
          </Field>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setDraft(settings)}
          disabled={!dirty || isPending}
          className="text-sm px-3 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-card)] disabled:opacity-50"
        >
          Descartar
        </button>
        <button
          type="submit"
          disabled={!dirty || isPending}
          className="text-sm px-3 py-1.5 rounded bg-[var(--color-accent)] text-white disabled:opacity-50"
        >
          {isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  'w-full px-3 h-9 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-sm';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide mb-1.5">
        {label}
      </span>
      {children}
    </div>
  );
}
