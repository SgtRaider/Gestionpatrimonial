'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatEur } from '@/lib/format';
import type { NetWorthAccount } from '@gp/shared';
import { useQuery } from '@tanstack/react-query';

const ACCOUNT_TYPE_LABELS: Record<NetWorthAccount['type'], string> = {
  checking: 'Corriente',
  savings: 'Ahorro',
  brokerage: 'Inversión',
  pension: 'Pensiones',
  crypto: 'Crypto',
  real_estate: 'Inmueble',
  vehicle: 'Vehículo',
  other: 'Otro',
};

export function PatrimonioClient() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['net-worth'],
    queryFn: api.getNetWorth,
  });

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
      <PageHeader title="Patrimonio" {...(data ? { subtitle: `Foto a ${data.asOf}` } : {})} />

      {isLoading ? (
        <div className="p-12 text-center text-[var(--color-muted)]">Cargando…</div>
      ) : isError ? (
        <div className="p-12 text-center text-[var(--color-negative)]">
          Error: {error instanceof Error ? error.message : 'desconocido'}
        </div>
      ) : !data ? null : (
        <>
          <NetWorthHeadline totals={data.totals} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <AccountsCard accounts={data.accounts} />
            <HoldingsCard holdings={data.holdings} />
            <LoansCard loans={data.loans} />
          </div>
        </>
      )}
    </div>
  );
}

function NetWorthHeadline({
  totals,
}: {
  totals: NonNullable<
    ReturnType<typeof api.getNetWorth> extends Promise<infer T> ? T : never
  >['totals'];
}) {
  const negative = Number(totals.netWorth) < 0;
  return (
    <Card className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
          Patrimonio neto
        </div>
        <div
          className={cn(
            'text-4xl font-semibold tabular-nums mt-1',
            negative && 'text-[var(--color-negative)]',
          )}
        >
          {formatEur(totals.netWorth)}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
        <Stat label="Líquido" value={totals.liquid} />
        <Stat label="Invertido" value={totals.invested} />
        <Stat label="Inmuebles" value={totals.realEstate} />
        <Stat label="Otros" value={totals.other} />
        <Stat label="Pasivos" value={totals.liabilities} negative />
      </div>
    </Card>
  );
}

function Stat({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
      <div
        className={cn(
          'text-lg font-medium tabular-nums mt-0.5',
          negative && 'text-[var(--color-negative)]',
        )}
      >
        {formatEur(value, { compact: true })}
      </div>
    </div>
  );
}

function AccountsCard({ accounts }: { accounts: NetWorthAccount[] }) {
  return (
    <Card>
      <CardHeader title="Cuentas" subtitle={`${accounts.length} activas`} />
      {accounts.length === 0 ? (
        <p className="text-xs text-[var(--color-muted)] py-3">Sin cuentas activas.</p>
      ) : (
        <ul className="text-sm divide-y divide-[var(--color-border)]">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2">
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: a.institutionColor ?? '#999' }}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block truncate">{a.name}</span>
                  <span className="block text-[11px] text-[var(--color-muted)]">
                    {a.institutionName} · {ACCOUNT_TYPE_LABELS[a.type]}
                  </span>
                </span>
              </span>
              <span
                className={cn(
                  'tabular-nums font-medium shrink-0',
                  Number(a.balance) < 0 && 'text-[var(--color-negative)]',
                )}
              >
                {formatEur(a.balance)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function HoldingsCard({
  holdings,
}: {
  holdings: {
    id: string;
    name: string;
    ticker: string | null;
    quantity: string;
    marketValue: string;
  }[];
}) {
  return (
    <Card>
      <CardHeader title="Inversiones" subtitle={`${holdings.length} posiciones`} />
      {holdings.length === 0 ? (
        <p className="text-xs text-[var(--color-muted)] py-3">
          Sin posiciones registradas. Próximamente: añadir holding manualmente o importar de
          MyInvestor.
        </p>
      ) : (
        <ul className="text-sm divide-y divide-[var(--color-border)]">
          {holdings.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate font-medium">{h.name}</span>
                <span className="block text-[11px] text-[var(--color-muted)]">
                  {h.ticker ?? '—'} · {Number(h.quantity).toFixed(4)} ud
                </span>
              </span>
              <span className="tabular-nums font-medium shrink-0">{formatEur(h.marketValue)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function LoansCard({
  loans,
}: {
  loans: { id: string; alias: string | null; lender: string; outstanding: string }[];
}) {
  return (
    <Card>
      <CardHeader title="Pasivos" subtitle={`${loans.length} préstamos`} />
      {loans.length === 0 ? (
        <p className="text-xs text-[var(--color-muted)] py-3">Sin pasivos.</p>
      ) : (
        <ul className="text-sm divide-y divide-[var(--color-border)]">
          {loans.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate font-medium">{l.alias ?? l.lender}</span>
                <span className="block text-[11px] text-[var(--color-muted)]">{l.lender}</span>
              </span>
              <span className="tabular-nums font-medium shrink-0 text-[var(--color-negative)]">
                {formatEur(l.outstanding)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
