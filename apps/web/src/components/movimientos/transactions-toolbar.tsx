'use client';

import { cn } from '@/lib/cn';
import type { AccountWithInstitution, Category } from '@gp/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export function TransactionsToolbar({
  accounts,
  categories,
}: {
  accounts: AccountWithInstitution[];
  categories: Category[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const accountId = searchParams.get('accountId') ?? '';
  const categoryId = searchParams.get('categoryId') ?? '';
  const uncategorized = searchParams.get('uncategorized') === '1';
  const status = searchParams.get('status') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';

  // Debounce search updates to URL.
  // Intentionally omits searchParams/router from deps: rerunning every navigation
  // causes a feedback loop. The effect only needs to fire when the user types.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  useEffect(() => {
    const handle = setTimeout(() => {
      const sp = new URLSearchParams(searchParams.toString());
      if (search) sp.set('search', search);
      else sp.delete('search');
      sp.delete('page');
      router.replace(`?${sp.toString()}`, { scroll: false });
    }, 350);
    return () => clearTimeout(handle);
  }, [search]);

  function update(key: string, value: string | null) {
    const sp = new URLSearchParams(searchParams.toString());
    if (value === null || value === '') sp.delete(key);
    else sp.set(key, value);
    sp.delete('page');
    router.replace(`?${sp.toString()}`, { scroll: false });
  }

  function clearAll() {
    setSearch('');
    router.replace('?', { scroll: false });
  }

  const hasFilters =
    !!search || !!accountId || !!categoryId || uncategorized || !!status || !!from || !!to;

  const inputClass =
    'h-8 px-2.5 text-sm rounded border border-[var(--color-border)] bg-[var(--color-card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40';

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Buscar contraparte, descripción, notas…"
        className={cn(inputClass, 'flex-1 min-w-[260px]')}
      />
      <select
        value={accountId}
        onChange={(e) => update('accountId', e.target.value || null)}
        className={inputClass}
      >
        <option value="">🏦 Todas las cuentas</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.institution.name} · {a.name}
            {a.ibanLast4 ? ` (${a.ibanLast4})` : ''}
          </option>
        ))}
      </select>
      <select
        value={categoryId}
        onChange={(e) => update('categoryId', e.target.value || null)}
        className={inputClass}
      >
        <option value="">🏷 Todas las categorías</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.parentId ? '— ' : ''}
            {c.name}
          </option>
        ))}
      </select>
      <select
        value={status}
        onChange={(e) => update('status', e.target.value || null)}
        className={inputClass}
      >
        <option value="">Estado: todos</option>
        <option value="booked">● Booked</option>
        <option value="pending">⏳ Pending</option>
      </select>
      <input
        type="date"
        value={from}
        onChange={(e) => update('from', e.target.value || null)}
        className={inputClass}
        title="Desde"
      />
      <input
        type="date"
        value={to}
        onChange={(e) => update('to', e.target.value || null)}
        className={inputClass}
        title="Hasta"
      />
      <label className="flex items-center gap-1.5 text-sm cursor-pointer ml-1">
        <input
          type="checkbox"
          checked={uncategorized}
          onChange={(e) => update('uncategorized', e.target.checked ? '1' : null)}
        />
        Sin categorizar
      </label>
      {hasFilters ? (
        <button
          type="button"
          onClick={clearAll}
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] underline ml-auto"
        >
          ✕ Limpiar
        </button>
      ) : null}
    </div>
  );
}
