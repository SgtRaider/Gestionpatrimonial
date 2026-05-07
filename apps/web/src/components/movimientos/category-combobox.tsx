'use client';

import { cn } from '@/lib/cn';
import type { Category } from '@gp/shared';
import { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  categories: Category[];
  value: string | null;
  onSelect: (categoryId: string | null) => void;
  onCancel: () => void;
};

export function CategoryCombobox({ categories, value, onSelect, onCancel }: Props) {
  const [search, setSearch] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Click-outside / Escape closes.
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCancel();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [onCancel]);

  // Lookup map for hierarchical labels (e.g. "Alimentación › Supermercado").
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    const labelOf = (c: Category): string => {
      const parts: string[] = [c.name];
      let parent = c.parentId ? byId.get(c.parentId) : null;
      while (parent) {
        parts.unshift(parent.name);
        parent = parent.parentId ? byId.get(parent.parentId) : null;
      }
      return parts.join(' › ');
    };
    return categories
      .map((c) => ({ category: c, label: labelOf(c) }))
      .filter((it) => (q ? it.label.toLowerCase().includes(q) : true))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [categories, search, byId]);

  useEffect(() => {
    setHighlighted(0);
  }, []);

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = items[highlighted];
      if (pick) onSelect(pick.category.id);
    }
  }

  return (
    <div
      ref={containerRef}
      className="absolute z-40 left-0 top-full mt-1 w-72 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="p-2 border-b border-[var(--color-border)]">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Buscar categoría…"
          className="w-full h-8 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
        />
      </div>
      <ul className="max-h-72 overflow-y-auto py-1">
        {value ? (
          <li>
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="w-full text-left px-3 py-1.5 text-xs text-[var(--color-muted)] hover:bg-[var(--color-bg)] italic"
            >
              ✕ Quitar categoría
            </button>
          </li>
        ) : null}
        {items.length === 0 ? (
          <li className="px-3 py-3 text-xs text-[var(--color-muted)] text-center">
            Sin coincidencias
          </li>
        ) : (
          items.map((it, idx) => {
            const isActive = idx === highlighted;
            const isCurrent = it.category.id === value;
            return (
              <li key={it.category.id}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlighted(idx)}
                  onClick={() => onSelect(it.category.id)}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-sm flex items-center gap-2',
                    isActive && 'bg-[var(--color-accent)]/10',
                    isCurrent && 'font-medium',
                  )}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: it.category.color ?? '#999' }}
                  />
                  <span className="flex-1 truncate">{it.label}</span>
                  {isCurrent ? <span className="text-xs text-[var(--color-accent)]">✓</span> : null}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
