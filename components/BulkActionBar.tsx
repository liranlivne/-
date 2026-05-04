'use client';

import { useState } from 'react';
import { todayIso } from '@/lib/dateUtils';

interface Props {
  count: number;
  categories: string[];
  onCancel: () => void;
  onDelete: () => Promise<void>;
  onChangeCategory: (newCategory: string) => Promise<void>;
  onChangeDate: (newDate: string) => Promise<void>;
}

/**
 * Floating bottom bar that appears when the user has selected transactions.
 * Shows bulk actions: delete, change category, change date.
 */
export function BulkActionBar({
  count,
  categories,
  onCancel,
  onDelete,
  onChangeCategory,
  onChangeDate,
}: Props) {
  const [pickCategoryOpen, setPickCategoryOpen] = useState(false);
  const [pickDateOpen, setPickDateOpen] = useState(false);
  const [dateInput, setDateInput] = useState<string>(todayIso());
  const [working, setWorking] = useState(false);

  const doDelete = async () => {
    if (!confirm(`למחוק ${count} שורות? הפעולה אינה הפיכה.`)) return;
    setWorking(true);
    try {
      await onDelete();
    } finally {
      setWorking(false);
    }
  };

  const applyCategory = async (cat: string) => {
    setWorking(true);
    try {
      await onChangeCategory(cat);
      setPickCategoryOpen(false);
    } finally {
      setWorking(false);
    }
  };

  const applyDate = async () => {
    if (!dateInput) return;
    setWorking(true);
    try {
      await onChangeDate(dateInput);
      setPickDateOpen(false);
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#2D3A8C] text-white shadow-2xl border-t-4 border-[#F0A500]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="font-medium">
            נבחרו <span className="text-[#F0A500] font-bold text-lg">{count}</span> שורות
          </div>

          <div className="flex-1" />

          <button
            onClick={() => setPickCategoryOpen(true)}
            disabled={working || count === 0}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded text-sm disabled:opacity-50"
          >
            🏷 שנה קטגוריה
          </button>

          <button
            onClick={() => {
              setDateInput(todayIso());
              setPickDateOpen(true);
            }}
            disabled={working || count === 0}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded text-sm disabled:opacity-50"
          >
            📅 שנה תאריך
          </button>

          <button
            onClick={doDelete}
            disabled={working || count === 0}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm disabled:opacity-50"
          >
            🗑 מחק {count}
          </button>

          <button
            onClick={onCancel}
            disabled={working}
            className="px-3 py-2 border border-white/30 hover:bg-white/10 rounded text-sm disabled:opacity-50"
          >
            ביטול בחירה
          </button>
        </div>
      </div>

      {/* Category picker modal */}
      {pickCategoryOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => !working && setPickCategoryOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-sm max-h-[70vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#2D3A8C] text-white px-4 py-3 flex items-center justify-between rounded-t-lg">
              <h3 className="font-bold">בחר קטגוריה חדשה</h3>
              <button
                onClick={() => !working && setPickCategoryOpen(false)}
                className="text-xl leading-none hover:opacity-75"
              >
                ×
              </button>
            </div>
            <div className="p-2 divide-y dark:divide-slate-700">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => applyCategory(cat)}
                  disabled={working}
                  className="w-full text-right px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 rounded"
                >
                  {cat}
                </button>
              ))}
              {categories.length === 0 && (
                <div className="p-4 text-center text-slate-500 text-sm">אין קטגוריות זמינות</div>
              )}
            </div>
            {working && (
              <div className="p-3 text-center text-sm text-slate-500 border-t dark:border-slate-700">
                ⏳ מעדכן {count} שורות...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Date picker modal */}
      {pickDateOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => !working && setPickDateOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#2D3A8C] text-white px-4 py-3 flex items-center justify-between rounded-t-lg">
              <h3 className="font-bold">בחר תאריך חדש</h3>
              <button
                onClick={() => !working && setPickDateOpen(false)}
                className="text-xl leading-none hover:opacity-75"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                כל {count} השורות הנבחרות יועברו לתאריך זה:
              </p>
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                disabled={working}
                className="w-full px-3 py-2 border rounded dark:bg-slate-700 dark:border-slate-600 text-base"
                autoFocus
              />
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => !working && setPickDateOpen(false)}
                  disabled={working}
                  className="px-4 py-2 border dark:border-slate-600 rounded text-sm hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  ביטול
                </button>
                <button
                  onClick={applyDate}
                  disabled={working || !dateInput}
                  className="px-4 py-2 bg-[#2D3A8C] text-white rounded text-sm hover:bg-[#243072] disabled:opacity-50"
                >
                  עדכן {count} שורות
                </button>
              </div>
              {working && (
                <div className="text-center text-sm text-slate-500">
                  ⏳ מעדכן {count} שורות...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
