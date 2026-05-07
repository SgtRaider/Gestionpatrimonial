'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatEur } from '@/lib/format';
import type { GoalEnriched, PlannedEvent, PlannedEventKind } from '@gp/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AddEventDialog } from './add-event-dialog';
import { AddGoalDialog } from './add-goal-dialog';

const KIND_LABEL: Record<PlannedEventKind, string> = {
  expense: 'Gasto',
  income: 'Ingreso',
  transfer: 'Transferencia',
  asset_purchase: 'Compra',
  asset_sale: 'Venta',
  loan_origination: 'Préstamo',
  loan_payoff: 'Cancelación',
  life_event: 'Hito',
};

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function PlanificacionClient() {
  const queryClient = useQueryClient();
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);

  const goalsQuery = useQuery({ queryKey: ['goals'], queryFn: api.getGoals });
  const eventsQuery = useQuery({
    queryKey: ['planned-events'],
    queryFn: api.getPlannedEvents,
  });

  const createGoalMutation = useMutation({
    mutationFn: api.createGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setShowAddGoal(false);
    },
  });
  const deleteGoalMutation = useMutation({
    mutationFn: api.deleteGoal,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  });

  const createEventMutation = useMutation({
    mutationFn: api.createPlannedEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-events'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowAddEvent(false);
    },
  });
  const deleteEventMutation = useMutation({
    mutationFn: api.deletePlannedEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-events'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
      <PageHeader
        title="Planificación"
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowAddGoal(true)}
              className="text-sm px-3 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-card)]"
            >
              + Objetivo
            </button>
            <button
              type="button"
              onClick={() => setShowAddEvent(true)}
              className="text-sm px-3 py-1.5 rounded bg-[var(--color-accent)] text-white"
            >
              + Evento planificado
            </button>
          </>
        }
      />

      <GoalsSection
        goals={goalsQuery.data ?? []}
        loading={goalsQuery.isLoading}
        onDelete={(id) => deleteGoalMutation.mutate(id)}
      />

      <EventsSection
        events={eventsQuery.data ?? []}
        loading={eventsQuery.isLoading}
        onDelete={(id) => deleteEventMutation.mutate(id)}
      />

      {showAddGoal ? (
        <AddGoalDialog
          isPending={createGoalMutation.isPending}
          onConfirm={(input) =>
            createGoalMutation.mutate({ ...input, currency: 'EUR', priority: 0 })
          }
          onDismiss={() => setShowAddGoal(false)}
        />
      ) : null}

      {showAddEvent ? (
        <AddEventDialog
          isPending={createEventMutation.isPending}
          onConfirm={(input) => createEventMutation.mutate({ ...input, currency: 'EUR' })}
          onDismiss={() => setShowAddEvent(false)}
        />
      ) : null}
    </div>
  );
}

function GoalsSection({
  goals,
  loading,
  onDelete,
}: {
  goals: GoalEnriched[];
  loading: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm uppercase tracking-wide text-[var(--color-muted)]">Objetivos</h2>
      {loading ? (
        <div className="p-12 text-center text-[var(--color-muted)]">Cargando…</div>
      ) : goals.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)] py-3">
            Sin objetivos. Crea uno para empezar a planificar (fondo emergencia, entrada piso,
            jubilación…).
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} onDelete={onDelete} />
          ))}
        </div>
      )}
    </section>
  );
}

function GoalCard({
  goal,
  onDelete,
}: {
  goal: GoalEnriched;
  onDelete: (id: string) => void;
}) {
  const remaining = Math.max(0, Number(goal.targetAmount) - Number(goal.currentAmount));
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium truncate">{goal.name}</div>
          <div className="text-xs text-[var(--color-muted)]">
            {formatEur(goal.targetAmount)}{' '}
            {goal.targetDate ? `· para ${formatLongDate(goal.targetDate)}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'text-[10px] px-1.5 py-0.5 rounded',
              goal.onTrack
                ? 'bg-[var(--color-positive)]/15 text-[var(--color-positive)]'
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
            )}
          >
            {goal.onTrack ? 'En camino' : 'Apretado'}
          </span>
          <button
            type="button"
            onClick={() => onDelete(goal.id)}
            aria-label="Eliminar"
            className="text-[var(--color-muted)] hover:text-[var(--color-negative)]"
          >
            🗑
          </button>
        </div>
      </div>

      <div className="h-2 bg-[var(--color-bg)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--color-accent)]"
          style={{ width: `${goal.progressPct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-[var(--color-muted)]">
        <span>
          <strong className="text-[var(--color-fg)]">{goal.progressPct.toFixed(0)}%</strong> (
          {formatEur(goal.currentAmount)})
        </span>
        <span>Restan {formatEur(remaining.toFixed(2), { compact: true })}</span>
      </div>

      {goal.requiredMonthly ? (
        <div className="text-xs border-t border-[var(--color-border)] pt-2">
          <span className="text-[var(--color-muted)]">Necesario</span>:{' '}
          <strong className="tabular-nums">{formatEur(goal.requiredMonthly)}</strong>/mes
          {goal.monthlyContributionTarget ? (
            <>
              {' '}
              · declarado{' '}
              <span className="tabular-nums">{formatEur(goal.monthlyContributionTarget)}</span>
            </>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function EventsSection({
  events,
  loading,
  onDelete,
}: {
  events: PlannedEvent[];
  loading: boolean;
  onDelete: (id: string) => void;
}) {
  // Bucket past, upcoming-3-months, beyond.
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => e.scheduledAt >= today);
  return (
    <section className="space-y-2">
      <h2 className="text-sm uppercase tracking-wide text-[var(--color-muted)]">
        Eventos planificados
      </h2>
      {loading ? (
        <div className="p-12 text-center text-[var(--color-muted)]">Cargando…</div>
      ) : upcoming.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)] py-3">
            Sin eventos futuros. Añade vacaciones, bonus, compras grandes o hitos vitales para
            verlos en la línea de tiempo.
          </p>
        </Card>
      ) : (
        <Card>
          <CardHeader title={`${upcoming.length} eventos por venir`} />
          <ul className="text-sm divide-y divide-[var(--color-border)]">
            {upcoming.map((e) => {
              const negative = Number(e.amount) < 0;
              return (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{e.name}</span>
                    <span className="block text-[11px] text-[var(--color-muted)]">
                      {formatLongDate(e.scheduledAt)} · {KIND_LABEL[e.kind]} · certeza {e.certainty}
                      {e.recurrenceFrequency ? ` · 🔁 ${e.recurrenceFrequency}` : ''}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'tabular-nums font-medium shrink-0',
                      negative ? 'text-[var(--color-negative)]' : 'text-[var(--color-positive)]',
                    )}
                  >
                    {formatEur(e.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDelete(e.id)}
                    aria-label="Eliminar"
                    className="text-[var(--color-muted)] hover:text-[var(--color-negative)]"
                  >
                    🗑
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </section>
  );
}
