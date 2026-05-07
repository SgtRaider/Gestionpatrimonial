import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle ? <p className="text-sm text-[var(--color-muted)] mt-0.5">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </header>
  );
}

export function ComingSoon({ section }: { section: string }) {
  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8">
      <PageHeader title={section} subtitle="En construcción" />
      <div className="border border-dashed border-[var(--color-border)] rounded-xl p-12 text-center text-[var(--color-muted)]">
        <p className="text-sm">
          Esta sección aún no está implementada. Volveremos por aquí pronto.
        </p>
      </div>
    </div>
  );
}
