'use client';

import { InvestVsAmortizeDialog } from '@/components/deudas/invest-vs-amortize-dialog';
import { PrepaymentDialog } from '@/components/deudas/prepayment-dialog';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatEur, formatPct } from '@/lib/format';
import type { LoanDetail } from '@gp/shared';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

const SCHEDULE_PAGE_SIZE = 50;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    month: 'short',
    year: '2-digit',
  });
}

export function LoanDetailClient({ id }: { id: string }) {
  const loanQuery = useQuery({
    queryKey: ['loan', id],
    queryFn: () => api.getLoan(id),
    staleTime: 60_000,
  });

  if (loanQuery.isLoading) {
    return <div className="p-8 text-center text-[var(--color-muted)]">Cargando…</div>;
  }
  if (loanQuery.isError || !loanQuery.data) {
    return (
      <div className="p-8 text-center text-[var(--color-negative)]">
        Error: {loanQuery.error instanceof Error ? loanQuery.error.message : 'no encontrado'}
      </div>
    );
  }
  const loan = loanQuery.data;
  return <Body loan={loan} />;
}

function Body({ loan }: { loan: LoanDetail }) {
  const [pageIdx, setPageIdx] = useState(() => {
    // Start the schedule view centered roughly on the current period.
    const focus = Math.max(0, loan.lastPaidPeriod - 5);
    return Math.floor(focus / SCHEDULE_PAGE_SIZE);
  });
  const [showPrepayment, setShowPrepayment] = useState(false);
  const [showInvestCompare, setShowInvestCompare] = useState(false);

  const principalInitial = Number(loan.principalInitial);
  const outstandingNow = Number(loan.outstanding);
  const paidPrincipal = principalInitial - outstandingNow;
  const progressPct = principalInitial > 0 ? (paidPrincipal / principalInitial) * 100 : 0;

  const totalSchedule = loan.schedule.length;
  const pageCount = Math.max(1, Math.ceil(totalSchedule / SCHEDULE_PAGE_SIZE));
  const visibleSchedule = useMemo(
    () => loan.schedule.slice(pageIdx * SCHEDULE_PAGE_SIZE, (pageIdx + 1) * SCHEDULE_PAGE_SIZE),
    [loan.schedule, pageIdx],
  );

  const remainingMonths = totalSchedule - loan.lastPaidPeriod;

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-4">
      <PageHeader
        title={loan.alias ?? loan.lender}
        subtitle={`${loan.lender} · Hipoteca · ${loan.amortizationSystem === 'french' ? 'sistema francés' : loan.amortizationSystem}`}
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowPrepayment(true)}
              className="text-sm px-3 py-1.5 rounded bg-[var(--color-accent)] text-white"
            >
              💰 Simular amortización
            </button>
            <button
              type="button"
              onClick={() => setShowInvestCompare(true)}
              className="text-sm px-3 py-1.5 rounded border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
            >
              ⚖ ¿Amortizar o invertir?
            </button>
            <Link
              href="/deudas"
              className="text-sm px-3 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-card)]"
            >
              ← Deudas
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
            Capital pendiente
          </div>
          <div className="text-3xl font-semibold tabular-nums">{formatEur(loan.outstanding)}</div>
          <div className="h-2 bg-[var(--color-bg)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--color-accent)]" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-[var(--color-muted)]">
            <span>
              <strong className="text-[var(--color-fg)]">{progressPct.toFixed(0)}%</strong> pagado
            </span>
            <span>De {formatEur(loan.principalInitial)} iniciales</span>
          </div>
          <div className="text-xs text-[var(--color-muted)]">
            Restan {remainingMonths} cuotas (~{Math.floor(remainingMonths / 12)} a)
          </div>
        </Card>

        <Card className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
            Próxima cuota
          </div>
          {loan.nextPaymentDate ? (
            <>
              <div className="text-3xl font-semibold tabular-nums">
                {formatEur(loan.nextPaymentAmount ?? '0')}
              </div>
              <div className="text-sm text-[var(--color-muted)]">
                {formatDate(loan.nextPaymentDate)}
              </div>
            </>
          ) : (
            <div className="text-sm text-[var(--color-muted)]">Sin cuotas pendientes</div>
          )}
          <div className="pt-2 border-t border-[var(--color-border)] grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-[var(--color-muted)]">Tipo actual</div>
              <div className="font-medium tabular-nums">{formatPct(loan.currentRatePct)}</div>
            </div>
            <div>
              <div className="text-[var(--color-muted)]">Próxima revisión</div>
              <div className="font-medium">
                {loan.nextReviewAt ? formatDate(loan.nextReviewAt) : '—'}
              </div>
            </div>
            {loan.rateIndex ? (
              <div className="col-span-2 text-[var(--color-muted)]">
                {loan.rateIndex} + {loan.rateSpread ? formatPct(loan.rateSpread) : '—'}
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="space-y-2">
          <CardHeader title="Intereses" />
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs text-[var(--color-muted)]">Pagados</div>
              <div className="font-medium tabular-nums">{formatEur(loan.paidInterest)}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--color-muted)]">Pendientes</div>
              <div className="font-medium tabular-nums">{formatEur(loan.pendingInterest)}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--color-muted)]">Totales contrato</div>
              <div className="font-medium tabular-nums">{formatEur(loan.totalInterest)}</div>
            </div>
          </div>
        </Card>

        <Card className="space-y-2">
          <CardHeader title="Histórico de tipos" />
          {loan.rateHistory.length === 0 ? (
            <p className="text-xs text-[var(--color-muted)]">Sin cambios registrados</p>
          ) : (
            <ul className="text-sm space-y-1">
              {loan.rateHistory.map((r) => (
                <li
                  key={`${r.effectiveAt}-${r.rate}`}
                  className="flex justify-between border-b border-[var(--color-border)] last:border-0 pb-1 last:pb-0"
                >
                  <span>
                    {formatDate(r.effectiveAt)}{' '}
                    <span className="text-[var(--color-muted)] text-xs">({r.source})</span>
                  </span>
                  <span className="tabular-nums font-medium">{formatPct(r.rate)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="space-y-3">
        <CardHeader
          title="Tabla de amortización"
          subtitle={`${totalSchedule} cuotas · cuota ${loan.lastPaidPeriod + 1} es la próxima`}
          action={
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPageIdx((p) => Math.max(0, p - 1))}
                disabled={pageIdx === 0}
                className="px-2 py-1 rounded border border-[var(--color-border)] disabled:opacity-40"
              >
                ‹
              </button>
              <span className="tabular-nums text-[var(--color-muted)]">
                {pageIdx + 1} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPageIdx((p) => Math.min(pageCount - 1, p + 1))}
                disabled={pageIdx >= pageCount - 1}
                className="px-2 py-1 rounded border border-[var(--color-border)] disabled:opacity-40"
              >
                ›
              </button>
            </div>
          }
        />
        <div className="overflow-x-auto rounded border border-[var(--color-border)]">
          <table className="w-full text-xs">
            <thead className="bg-[var(--color-bg)]/50 text-[var(--color-muted)] uppercase tracking-wide">
              <tr>
                <th className="text-right px-2 py-1.5 font-medium w-12">#</th>
                <th className="text-left px-2 py-1.5 font-medium">Fecha</th>
                <th className="text-right px-2 py-1.5 font-medium">Cuota</th>
                <th className="text-right px-2 py-1.5 font-medium">Capital</th>
                <th className="text-right px-2 py-1.5 font-medium">Intereses</th>
                <th className="text-right px-2 py-1.5 font-medium">Pendiente</th>
                <th className="text-left px-2 py-1.5 font-medium w-20">Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibleSchedule.map((row) => {
                const past = row.period <= loan.lastPaidPeriod;
                const isNext = row.period === loan.lastPaidPeriod + 1;
                return (
                  <tr
                    key={row.period}
                    className={cn(
                      'border-t border-[var(--color-border)]',
                      past && 'text-[var(--color-muted)]',
                      isNext && 'bg-[var(--color-accent)]/5 font-medium',
                    )}
                  >
                    <td className="px-2 py-1.5 text-right tabular-nums">{row.period}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{formatMonth(row.dueAt)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatEur(row.payment)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatEur(row.principal)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatEur(row.interest)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatEur(row.outstandingAfter)}
                    </td>
                    <td className="px-2 py-1.5 text-xs">
                      {past ? 'pagada' : isNext ? '◀ siguiente' : 'proyectada'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {showPrepayment ? (
        <PrepaymentDialog loan={loan} onClose={() => setShowPrepayment(false)} />
      ) : null}
      {showInvestCompare ? (
        <InvestVsAmortizeDialog loan={loan} onClose={() => setShowInvestCompare(false)} />
      ) : null}
    </div>
  );
}
