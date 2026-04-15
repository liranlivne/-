'use client';

import { useState } from 'react';

interface Props {
  count: number;
  categories: string[];
  onCancel: () => void;
  onDelete: () => Promise<void>;
  onChangeCategory: (newCategory: string) => Promise<void>;
}

/**
 * Floating bottom bar that appears when the user has selected transactions.
 * Shows bulk actions: delete, change category.
 */
export function BulkActionBar({ count, categories, onCancel, onDelete, onChangeCategory }: Props) {
  const [pickCategoryOpen, setPickCategoryOpen] = useState(false);
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
    </>
  );
}
