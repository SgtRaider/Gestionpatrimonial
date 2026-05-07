'use client';

import { AddLoanDialog } from '@/components/deudas/add-loan-dialog';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatEur, formatPct } from '@/lib/format';
import type { LoanSummary } from '@gp/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const KIND_LABEL: Record<string, string> = {
  mortgage: 'Hipoteca',
  personal: 'Personal',
  car: 'Coche',
  student: 'Estudios',
  other: 'Otro',
};

function progressPct(loan: LoanSummary): number {
  const principal = Number(loan.outstanding);
  // We need the initial principal to compute % paid; not in summary, so we
  // approximate by using outstanding vs (total interest + outstanding)
  // — close enough for the bar.
  const totalToRepay = Number(loan.totalInterest) + principal;
  if (totalToRepay === 0) return 0;
  // Show % paid of remaining-to-be-repaid relative to current outstanding.
  const paidPortion = Math.max(0, 100 - (principal / totalToRepay) * 100);
  return Math.min(100, paidPortion);
}

export function DeudasClient() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [showAddLoan, setShowAddLoan] = useState(false);
  const loansQuery = useQuery({
    queryKey: ['loans'],
    queryFn: api.getLoans,
    staleTime: 60_000,
  });

  const createLoanMutation = useMutation({
    mutationFn: api.createLoan,
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowAddLoan(false);
      router.push(`/deudas/${resp.id}`);
    },
  });

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-8 space-y-4">
      <PageHeader
        title="Deudas"
        subtitle="Préstamos e hipotecas activos"
        actions={
          <button
            type="button"
            onClick={() => setShowAddLoan(true)}
            className="text-sm px-3 py-1.5 rounded bg-[var(--color-accent)] text-white"
          >
            + Añadir préstamo
          </button>
        }
      />

      {loansQuery.isLoading ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)] py-6 text-center">Cargando…</p>
        </Card>
      ) : loansQuery.isError ? (
        <Card>
          <p className="text-sm text-[var(--color-negative)] py-6 text-center">
            Error: {loansQuery.error instanceof Error ? loansQuery.error.message : 'desconocido'}
          </p>
        </Card>
      ) : (loansQuery.data ?? []).length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)] py-12 text-center">
            No tienes préstamos registrados.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(loansQuery.data ?? []).map((loan) => (
            <Link
              key={loan.id}
              href={`/deudas/${loan.id}`}
              className="block hover:scale-[1.005] transition-transform"
            >
              <Card className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
                      {KIND_LABEL[loan.kind] ?? loan.kind} · {loan.lender}
                    </div>
                    <h3 className="text-lg font-semibold">{loan.alias ?? loan.lender}</h3>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)]">
                    {formatPct(loan.currentRatePct)}
                  </span>
                </div>

                <div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {formatEur(loan.outstanding)}
                  </div>
                  <div className="text-xs text-[var(--color-muted)]">Capital pendiente</div>
                </div>

                <div className="h-1.5 bg-[var(--color-bg)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-accent)]"
                    style={{ width: `${progressPct(loan)}%` }}
                  />
                </div>

                <div className="flex justify-between text-xs text-[var(--color-muted)]">
                  <span>
                    {loan.nextPaymentDate ? (
                      <>
                        Próxima cuota{' '}
                        <strong className="text-[var(--color-fg)]">
                          {new Date(loan.nextPaymentDate).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </strong>{' '}
                        · {formatEur(loan.nextPaymentAmount ?? '0')}
                      </>
                    ) : (
                      'Sin cuotas pendientes'
                    )}
                  </span>
                  <span>{loan.termMonths} meses</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {showAddLoan ? (
        <AddLoanDialog
          isPending={createLoanMutation.isPending}
          onConfirm={(input) =>
            createLoanMutation.mutate({ ...input, currency: 'EUR', fiscalDeductible: false })
          }
          onDismiss={() => setShowAddLoan(false)}
        />
      ) : null}
    </div>
  );
}
