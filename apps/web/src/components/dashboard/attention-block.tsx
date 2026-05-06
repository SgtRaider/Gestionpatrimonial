import type { AttentionAlert } from '@gp/shared';
import { Card, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/cn';

const SEVERITY_DOT: Record<AttentionAlert['severity'], string> = {
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  urgent: 'bg-red-500',
};

export function AttentionBlock({ alerts }: { alerts: AttentionAlert[] }) {
  const empty = alerts.length === 0;
  return (
    <Card
      className={cn(
        empty && 'border-[var(--color-positive)]/40 bg-[var(--color-positive)]/5',
      )}
    >
      <CardHeader title="Atención" />
      {empty ? (
        <p className="text-sm text-[var(--color-positive)] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--color-positive)]" />
          Todo en orden
        </p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li key={a.id} className="flex items-start gap-2 text-sm">
              <span
                className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', SEVERITY_DOT[a.severity])}
                aria-label={a.severity}
              />
              <span className="flex-1">{a.message}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
