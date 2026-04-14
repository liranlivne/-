'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onExportCsv: () => void;
  onPrint: () => void;
  hasFilter: boolean;
}

export function ExportButton({ onExportCsv, onPrint, hasFilter }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-3 py-1 text-sm border rounded hover:bg-slate-50 flex items-center gap-1"
        title="ייצוא נתונים"
      >
        ⇩ ייצוא
        {hasFilter && (
          <span
            className="bg-[#F0A500] text-white rounded-full w-2 h-2 inline-block"
            title="סינון פעיל"
          />
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded shadow-lg min-w-[180px] end-0">
          <button
            onClick={() => {
              setOpen(false);
              onExportCsv();
            }}
            className="w-full text-right px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm flex items-center gap-2 border-b dark:border-slate-700"
          >
            <span className="text-lg">📊</span>
            <span>ייצוא לאקסל (CSV)</span>
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onPrint();
            }}
            className="w-full text-right px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm flex items-center gap-2"
          >
            <span className="text-lg">🖨</span>
            <span>הדפסה / PDF</span>
          </button>
          {hasFilter && (
            <div className="px-3 py-1.5 text-xs text-slate-500 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30 border-t dark:border-slate-700">
              ⚠ הייצוא כולל רק את הנתונים המסוננים
            </div>
          )}
        </div>
      )}
    </div>
  );
}
