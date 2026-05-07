'use client';

import type { Category } from '@gp/shared';
import { useState } from 'react';
import { CategoryCombobox } from './category-combobox';

type Props = {
  selectedCount: number;
  categories: Category[];
  isPending: boolean;
  onCategorize: (categoryId: string | null) => void;
  onClear: () => void;
};

export function BulkActionBar({
  selectedCount,
  categories,
  isPending,
  onCategorize,
  onClear,
}: Props) {
  const [openCategorize, setOpenCategorize] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
      <div className="relative flex items-center gap-3 bg-[var(--color-card)] border border-[var(--color-border)] shadow-2xl rounded-full px-4 py-2 text-sm">
        <span className="font-medium tabular-nums">{selectedCount} seleccionados</span>
        <div className="w-px h-5 bg-[var(--color-border)]" />
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenCategorize((v) => !v)}
            disabled={isPending}
            className="px-3 py-1 rounded-full bg-[var(--color-accent)] text-white text-xs font-medium disabled:opacity-50"
          >
            🏷 Categorizar
          </button>
          {openCategorize ? (
            <div className="absolute bottom-full left-0 mb-2">
              <CategoryCombobox
                categories={categories}
                value={null}
                onSelect={(id) => {
                  setOpenCategorize(false);
                  onCategorize(id);
                }}
                onCancel={() => setOpenCategorize(false)}
              />
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onCategorize(null)}
          disabled={isPending}
          className="px-3 py-1 rounded-full border border-[var(--color-border)] text-xs hover:bg-[var(--color-bg)] disabled:opacity-50"
        >
          Quitar categoría
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={isPending}
          aria-label="Limpiar selección"
          className="text-[var(--color-muted)] hover:text-[var(--color-fg)] disabled:opacity-50"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
