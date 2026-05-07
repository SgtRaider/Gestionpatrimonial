import { CuentasSubNav } from '@/components/layout/cuentas-sub-nav';
import type { ReactNode } from 'react';

export default function CuentasLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CuentasSubNav />
      {children}
    </>
  );
}
