import { Suspense } from 'react';
import { PlanificacionClient } from './planificacion-client';

export const metadata = { title: 'Planificación · Gestión Patrimonial' };

export default function PlanificacionPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Cargando…</div>}>
      <PlanificacionClient />
    </Suspense>
  );
}
