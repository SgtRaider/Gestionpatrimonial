import { Suspense } from 'react';
import { PatrimonioClient } from './patrimonio-client';

export const metadata = { title: 'Patrimonio · Gestión Patrimonial' };

export default function PatrimonioPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Cargando…</div>}>
      <PatrimonioClient />
    </Suspense>
  );
}
