'use client';

import type { Category, TransactionListItem } from '@gp/shared';
import { useState } from 'react';
import { CategoryCombobox } from './category-combobox';

type Props = {
  tx: TransactionListItem;
  categories: Category[];
  onChange: (newCategoryId: string | null) => void;
};

export function CategoryCell({ tx, categories, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs hover:ring-1 hover:ring-[var(--color-accent)]/40 transition-shadow"
        style={
          tx.category
            ? {
                background: `${tx.category.color ?? '#999'}20`,
                color: tx.category.color ?? '#999',
              }
            : undefined
        }
      >
        {tx.category ? (
          tx.category.name
        ) : (
          <span className="text-[var(--color-muted)] italic">+ Categorizar</span>
        )}
      </button>
      {open ? (
        <CategoryCombobox
          categories={categories}
          value={tx.categoryId}
          onSelect={(id) => {
            setOpen(false);
            onChange(id);
          }}
          onCancel={() => setOpen(false)}
        />
      ) : null}
    </span>
  );
}
