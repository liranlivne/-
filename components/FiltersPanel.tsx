'use client';

import { useState } from 'react';
import { isRecentlyUpdated } from '@/lib/highlight';

export interface FiltersState {
  dateFrom: string;
  dateTo: string;
  category: string;
  amountMin: string;
  amountMax: string;
  text: string;
  type: 'all' | 'income' | 'expense';
  /** When true, show only rows that are "recently updated" (yellow-highlighted). */
  onlyRecent: boolean;
}

export const emptyFilters: FiltersState = {
  dateFrom: '',
  dateTo: '',
  category: '',
  amountMin: '',
  amountMax: '',
  text: '',
  type: 'all',
  onlyRecent: false,
};

interface Props {
  filters: FiltersState;
  onChange: (f: FiltersState) => void;
  categories: string[];
  rightSlot?: React.ReactNode;
}

export function FiltersPanel({ filters, onChange, categories, rightSlot }: Props) {
  const [open, setOpen] = useState(false);

  const hasAny =
    filters.dateFrom ||
    filters.dateTo ||
    filters.category ||
    filters.amountMin ||
    filters.amountMax ||
    filters.text ||
    filters.type !== 'all' ||
    filters.onlyRecent;

  const clear = () => onChange(emptyFilters);

  const update = (patch: Partial<FiltersState>) => onChange({ ...filters, ...patch });

  return (
    <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 sm:sticky sm:top-[124px] sm:z-10">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-1.5 sm:py-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setOpen((o) => !o)}
            className="px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm border dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            {open ? '▲ סגור סינונים' : '▼ סינונים'}
            {hasAny && <span className="mr-2 bg-[#F0A500] text-white rounded-full px-1.5 text-xs">●</span>}
          </button>

          {/* Quick search always visible */}
          <input
            type="text"
            placeholder="חיפוש בתיאור..."
            value={filters.text}
            onChange={(e) => update({ text: e.target.value })}
            className="flex-1 px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm border dark:border-slate-600 dark:bg-slate-700 rounded"
          />

          {hasAny && (
            <button onClick={clear} className="text-xs text-red-600 hover:underline">
              נקה הכל
            </button>
          )}

          {rightSlot}
        </div>

        {open && (
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <label className="flex flex-col">
              <span className="text-xs text-slate-600 dark:text-slate-400 mb-0.5">מתאריך</span>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => update({ dateFrom: e.target.value })}
                className="px-2 py-1 border dark:border-slate-600 dark:bg-slate-700 rounded"
              />
            </label>
            <label className="flex flex-col">
              <span className="text-xs text-slate-600 dark:text-slate-400 mb-0.5">עד תאריך</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => update({ dateTo: e.target.value })}
                className="px-2 py-1 border dark:border-slate-600 dark:bg-slate-700 rounded"
              />
            </label>
            <label className="flex flex-col">
              <span className="text-xs text-slate-600 dark:text-slate-400 mb-0.5">קטגוריה</span>
              <select
                value={filters.category}
                onChange={(e) => update({ category: e.target.value })}
                className="px-2 py-1 border dark:border-slate-600 dark:bg-slate-700 rounded"
              >
                <option value="">הכל</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col">
              <span className="text-xs text-slate-600 dark:text-slate-400 mb-0.5">סוג</span>
              <select
                value={filters.type}
                onChange={(e) => update({ type: e.target.value as FiltersState['type'] })}
                className="px-2 py-1 border dark:border-slate-600 dark:bg-slate-700 rounded"
              >
                <option value="all">הכל</option>
                <option value="income">רק הכנסות</option>
                <option value="expense">רק הוצאות</option>
              </select>
            </label>
            <label className="flex flex-col">
              <span className="text-xs text-slate-600 dark:text-slate-400 mb-0.5">סכום מעל</span>
              <input
                type="number"
                value={filters.amountMin}
                onChange={(e) => update({ amountMin: e.target.value })}
                className="px-2 py-1 border dark:border-slate-600 dark:bg-slate-700 rounded num"
                placeholder="0"
              />
            </label>
            <label className="flex flex-col">
              <span className="text-xs text-slate-600 dark:text-slate-400 mb-0.5">סכום עד</span>
              <input
                type="number"
                value={filters.amountMax}
                onChange={(e) => update({ amountMax: e.target.value })}
                className="px-2 py-1 border dark:border-slate-600 dark:bg-slate-700 rounded num"
                placeholder="∞"
              />
            </label>
            <label className="flex items-center gap-2 md:col-span-2 bg-[#FFF3CD] dark:bg-yellow-900/30 border border-[#F0A500] rounded px-3 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.onlyRecent}
                onChange={(e) => update({ onlyRecent: e.target.checked })}
                className="w-4 h-4 accent-[#F0A500]"
              />
              <span className="text-sm">הצג רק שורות שעודכנו לאחרונה (צהובות)</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

/** Apply filters to a list of transactions. */
export function applyFilters<
  T extends {
    date: string;
    category: string;
    description: string;
    income: number | null;
    expense: number | null;
    done: boolean;
    updatedAt: string | null;
  }
>(items: T[], f: FiltersState): T[] {
  return items.filter((t) => {
    if (f.dateFrom && t.date < f.dateFrom) return false;
    if (f.dateTo && t.date > f.dateTo) return false;
    if (f.category && t.category !== f.category) return false;
    if (f.text && !t.description.includes(f.text) && !t.category.includes(f.text)) return false;

    const amount = Math.max(t.income ?? 0, t.expense ?? 0);
    if (f.amountMin && amount < Number(f.amountMin)) return false;
    if (f.amountMax && amount > Number(f.amountMax)) return false;

    if (f.type === 'income' && !t.income) return false;
    if (f.type === 'expense' && !t.expense) return false;

    if (f.onlyRecent && !isRecentlyUpdated(t.updatedAt)) return false;

    return true;
  });
}
