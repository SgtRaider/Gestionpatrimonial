import { Suspense } from 'react';
import { RecurrentesClient } from './recurrentes-client';

export const metadata = { title: 'Pagos recurrentes · Gestión Patrimonial' };

export default function RecurrentesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Cargando…</div>}>
      <RecurrentesClient />
    </Suspense>
  );
}
