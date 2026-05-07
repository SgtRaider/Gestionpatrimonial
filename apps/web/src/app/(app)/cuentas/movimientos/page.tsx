import { Suspense } from 'react';
import { MovimientosClient } from './movimientos-client';

export const metadata = { title: 'Movimientos · Gestión Patrimonial' };

export default function MovimientosPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Cargando…</div>}>
      <MovimientosClient />
    </Suspense>
  );
}
