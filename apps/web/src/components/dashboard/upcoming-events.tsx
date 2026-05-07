import { Card, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { formatDelta, isPositive } from '@/lib/format';
import type { UpcomingEvent } from '@gp/shared';

const KIND_ICON: Record<UpcomingEvent['kind'], string> = {
  loan_payment: '🏦',
  recurring: '🔁',
  planned: '📅',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  });
}

export function UpcomingEvents({ events }: { events: UpcomingEvent[] }) {
  return (
    <Card>
      <CardHeader title="Próximos eventos" subtitle="Próximos 30 días" />
      <ul className="space-y-2.5">
        {events.length === 0 ? (
          <li className="text-xs text-[var(--color-muted)] py-4 text-center">
            Sin eventos próximos
          </li>
        ) : (
          events.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between text-sm border-b border-[var(--color-border)] last:border-0 pb-2 last:pb-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base">{KIND_ICON[e.kind]}</span>
                <div className="min-w-0">
                  <div className="truncate">{e.label}</div>
                  <div className="text-xs text-[var(--color-muted)]">
                    {formatDate(e.scheduledAt)}
                  </div>
                </div>
              </div>
              <div
                className={cn(
                  'tabular-nums text-sm font-medium',
                  isPositive(e.amount) ? 'text-[var(--color-positive)]' : 'text-[var(--color-fg)]',
                )}
              >
                {formatDelta(e.amount)}
              </div>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}
