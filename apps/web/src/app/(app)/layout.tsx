import { TopNav } from '@/components/layout/top-nav';
import type { ReactNode } from 'react';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <TopNav />
      <main>{children}</main>
    </div>
  );
}
