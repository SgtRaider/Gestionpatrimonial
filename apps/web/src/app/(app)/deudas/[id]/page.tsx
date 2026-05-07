import { LoanDetailClient } from './loan-detail-client';

export const metadata = { title: 'Detalle préstamo · Gestión Patrimonial' };

export default async function LoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LoanDetailClient id={id} />;
}
