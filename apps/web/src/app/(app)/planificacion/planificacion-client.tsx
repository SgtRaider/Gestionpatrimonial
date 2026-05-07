'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatEur } from '@/lib/format';
import type { GoalEnriched, PlannedEvent, PlannedEventKind } from '@gp/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AddEventDialog } from './add-event-dialog';
import { AddGoalDialog } from './add-goal-dialog';
import { EditEventDialog } from './edit-event-dialog';
import { EditGoalDialog } from './edit-goal-dialog';

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
  const [editingGoal, setEditingGoal] = useState<GoalEnriched | null>(null);
  const [editingEvent, setEditingEvent] = useState<PlannedEvent | null>(null);

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

  const updateGoalMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof api.updateGoal>[1] }) =>
      api.updateGoal(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setEditingGoal(null);
    },
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

  const updateEventMutation = useMutation({
    mutationFn: ({
      id,
      patch,
    }: { id: string; patch: Parameters<typeof api.updatePlannedEvent>[1] }) =>
      api.updatePlannedEvent(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-events'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setEditingEvent(null);
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
        onEdit={setEditingGoal}
      />

      <CashFlowProjection events={eventsQuery.data ?? []} />

      <EventsSection
        events={eventsQuery.data ?? []}
        goals={goalsQuery.data ?? []}
        loading={eventsQuery.isLoading}
        onDelete={(id) => deleteEventMutation.mutate(id)}
        onEdit={setEditingEvent}
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
          goals={goalsQuery.data ?? []}
          isPending={createEventMutation.isPending}
          onConfirm={(input) => createEventMutation.mutate({ ...input, currency: 'EUR' })}
          onDismiss={() => setShowAddEvent(false)}
        />
      ) : null}

      {editingGoal ? (
        <EditGoalDialog
          goal={editingGoal}
          isPending={updateGoalMutation.isPending}
          onConfirm={(patch) => updateGoalMutation.mutate({ id: editingGoal.id, patch })}
          onDismiss={() => setEditingGoal(null)}
        />
      ) : null}

      {editingEvent ? (
        <EditEventDialog
          event={editingEvent}
          goals={goalsQuery.data ?? []}
          isPending={updateEventMutation.isPending}
          onConfirm={(patch) => updateEventMutation.mutate({ id: editingEvent.id, patch })}
          onDismiss={() => setEditingEvent(null)}
        />
      ) : null}
    </div>
  );
}

// 24-month forward look. Each event accumulates from `scheduledAt` onwards;
// recurring events are expanded to 1 hit per occurrence inside the window
// using their declared frequency. The chart shows the running net cash impact
// — a forecast of "if every planned event happens, my balance moves like this
// over and above today's reality".
function CashFlowProjection({ events }: { events: PlannedEvent[] }) {
  const data = useMemo(() => projectCashFlow(events, 24), [events]);
  if (data.length === 0) return null;
  const lastNet = data[data.length - 1]?.cumulative ?? 0;
  return (
    <section className="space-y-2">
      <h2 className="text-sm uppercase tracking-wide text-[var(--color-muted)]">
        Proyección a 24 meses
      </h2>
      <Card>
        <CardHeader
          title="Impacto neto acumulado"
          subtitle={`Si todos los eventos se ejecutan, el saldo se mueve ${lastNet >= 0 ? '+' : ''}${formatEur(lastNet, { compact: true })}`}
        />
        <div className="h-64 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="planFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16a34a" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
              <YAxis
                tickFormatter={(v) => formatEur(v, { compact: true })}
                tick={{ fontSize: 11 }}
                stroke="var(--color-muted)"
              />
              <Tooltip
                formatter={(v: number | string) => [
                  formatEur(v, { compact: true }),
                  'Neto acumulado',
                ]}
              />
              <ReferenceLine y={0} stroke="var(--color-muted)" strokeDasharray="2 2" />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke={lastNet >= 0 ? '#16a34a' : '#dc2626'}
                strokeWidth={2}
                fill="url(#planFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </section>
  );
}

function projectCashFlow(events: PlannedEvent[], months: number) {
  const today = new Date();
  today.setUTCDate(1);
  const monthKey = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const buckets = new Map<string, number>();
  const labels: string[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(today);
    d.setUTCMonth(d.getUTCMonth() + i);
    const k = monthKey(d);
    buckets.set(k, 0);
    labels.push(k);
  }

  const horizon = new Date(today);
  horizon.setUTCMonth(horizon.getUTCMonth() + months - 1);

  for (const e of events) {
    if (e.status === 'cancelled') continue;
    const start = new Date(e.scheduledAt);
    if (start > horizon) continue;
    const amount = Number(e.amount);
    const occurrences: Date[] = [];
    if (!e.recurrenceFrequency || e.recurrenceFrequency === 'custom') {
      occurrences.push(start);
    } else {
      const until = e.recurrenceUntil ? new Date(e.recurrenceUntil) : horizon;
      const stop = until < horizon ? until : horizon;
      const cur = new Date(start);
      while (cur <= stop) {
        occurrences.push(new Date(cur));
        switch (e.recurrenceFrequency) {
          case 'weekly':
            cur.setUTCDate(cur.getUTCDate() + 7);
            break;
          case 'monthly':
            cur.setUTCMonth(cur.getUTCMonth() + 1);
            break;
          case 'bimonthly':
            cur.setUTCMonth(cur.getUTCMonth() + 2);
            break;
          case 'quarterly':
            cur.setUTCMonth(cur.getUTCMonth() + 3);
            break;
          case 'biannual':
            cur.setUTCMonth(cur.getUTCMonth() + 6);
            break;
          case 'yearly':
            cur.setUTCFullYear(cur.getUTCFullYear() + 1);
            break;
        }
      }
    }
    for (const occ of occurrences) {
      if (occ < today) continue;
      const key = monthKey(occ);
      const prior = buckets.get(key);
      if (prior === undefined) continue;
      buckets.set(key, prior + amount);
    }
  }

  let cumulative = 0;
  return labels.map((m) => {
    cumulative += buckets.get(m) ?? 0;
    return { month: m, cumulative };
  });
}

function GoalsSection({
  goals,
  loading,
  onDelete,
  onEdit,
}: {
  goals: GoalEnriched[];
  loading: boolean;
  onDelete: (id: string) => void;
  onEdit: (g: GoalEnriched) => void;
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
            <GoalCard key={g.id} goal={g} onDelete={onDelete} onEdit={onEdit} />
          ))}
        </div>
      )}
    </section>
  );
}

function GoalCard({
  goal,
  onDelete,
  onEdit,
}: {
  goal: GoalEnriched;
  onDelete: (id: string) => void;
  onEdit: (g: GoalEnriched) => void;
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
            onClick={() => onEdit(goal)}
            aria-label="Editar"
            className="text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            ✏️
          </button>
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
  goals,
  loading,
  onDelete,
  onEdit,
}: {
  events: PlannedEvent[];
  goals: GoalEnriched[];
  loading: boolean;
  onDelete: (id: string) => void;
  onEdit: (e: PlannedEvent) => void;
}) {
  // Bucket past, upcoming-3-months, beyond.
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => e.scheduledAt >= today);
  const goalById = new Map(goals.map((g) => [g.id, g]));
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
                      {e.goalId && goalById.has(e.goalId)
                        ? ` · 🎯 ${goalById.get(e.goalId)?.name}`
                        : ''}
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
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEdit(e)}
                      aria-label="Editar"
                      className="text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(e.id)}
                      aria-label="Eliminar"
                      className="text-[var(--color-muted)] hover:text-[var(--color-negative)]"
                    >
                      🗑
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </section>
  );
}
