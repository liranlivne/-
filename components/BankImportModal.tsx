'use client';

import { useRef, useState } from 'react';
import type { Transaction } from '@/lib/types';
import { formatShekel } from '@/lib/balance';

interface ParsedTransaction {
  date: string;
  description: string;
  category: string;
  income: number | null;
  expense: number | null;
  // UI state:
  selected: boolean;
  duplicateOf?: number; // rowNumber of existing transaction that looks identical
}

interface Props {
  open: boolean;
  categories: string[];
  existingTransactions: Transaction[];
  onClose: () => void;
  onImport: (
    rows: Array<{
      date: string;
      category: string;
      description: string;
      income: number | null;
      expense: number | null;
    }>
  ) => Promise<void>;
}

export function BankImportModal({
  open,
  categories,
  existingTransactions,
  onClose,
  onImport,
}: Props) {
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsed, setParsed] = useState<ParsedTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const reset = () => {
    setStep('upload');
    setParsed([]);
    setError(null);
    setAnalyzing(false);
    setImporting(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const detectDuplicates = (items: ParsedTransaction[]): ParsedTransaction[] => {
    return items.map((p) => {
      const match = existingTransactions.find(
        (t) =>
          t.date === p.date &&
          ((p.income !== null && t.income === p.income) ||
            (p.expense !== null && t.expense === p.expense))
      );
      return {
        ...p,
        duplicateOf: match?.rowNumber,
        selected: !match, // auto-skip duplicates
      };
    });
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('categories', JSON.stringify(categories));

      const res = await fetch('/api/bank-import', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = (await res.json()) as { transactions: Omit<ParsedTransaction, 'selected'>[] };
      if (data.transactions.length === 0) {
        setError('לא נמצאו תנועות בתמונה. נסה תמונה ברורה יותר.');
        setAnalyzing(false);
        return;
      }

      const withFlags = data.transactions.map((t) => ({ ...t, selected: true }));
      setParsed(detectDuplicates(withFlags));
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const toggleRow = (i: number) => {
    setParsed((prev) => prev.map((p, idx) => (idx === i ? { ...p, selected: !p.selected } : p)));
  };

  const updateRow = (i: number, patch: Partial<ParsedTransaction>) => {
    setParsed((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };

  const removeRow = (i: number) => {
    setParsed((prev) => prev.filter((_, idx) => idx !== i));
  };

  const doImport = async () => {
    const toImport = parsed.filter((p) => p.selected);
    if (toImport.length === 0) {
      alert('בחר לפחות שורה אחת לייבוא');
      return;
    }

    setImporting(true);
    try {
      await onImport(
        toImport.map((p) => ({
          date: p.date,
          category: p.category,
          description: p.description,
          income: p.income,
          expense: p.expense,
        }))
      );
      close();
    } catch (err) {
      alert('שגיאה בייבוא: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = parsed.filter((p) => p.selected).length;
  const duplicateCount = parsed.filter((p) => p.duplicateOf).length;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={close}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#2D3A8C] text-white px-4 py-3 flex items-center justify-between rounded-t-lg sticky top-0 z-10">
          <h2 className="font-bold text-lg">📸 ייבוא תנועות מצילום מסך של הבנק</h2>
          <button onClick={close} className="text-xl leading-none hover:opacity-75">
            ×
          </button>
        </div>

        {step === 'upload' && (
          <div className="p-6 flex flex-col items-center gap-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileSelected}
              disabled={analyzing}
            />
            <div className="text-center text-slate-600 dark:text-slate-300 text-sm max-w-md">
              צרף צילום מסך של התנועות מאתר הבנק שלך. ה-AI יקרא אותו, יזהה את התנועות, ותוכל
              לאשר אילו להוסיף.
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={analyzing}
              className="px-8 py-6 bg-[#2D3A8C] text-white rounded-lg hover:bg-[#1f2a6b] disabled:opacity-50 font-bold text-lg flex flex-col items-center gap-2"
            >
              <span className="text-3xl">📤</span>
              <span>{analyzing ? 'מנתח את התמונה...' : 'בחר תמונה'}</span>
            </button>
            {analyzing && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                זה יכול לקחת 5-15 שניות. אני חושב...
              </div>
            )}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 text-red-800 dark:text-red-200 rounded p-3 text-sm max-w-md">
                {error}
              </div>
            )}
          </div>
        )}

        {step === 'review' && (
          <>
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-700 flex flex-wrap items-center gap-3 text-sm">
              <div>
                נמצאו <b>{parsed.length}</b> תנועות,{' '}
                <b className="text-[color:var(--color-income)]">{selectedCount} ייובאו</b>
                {duplicateCount > 0 && (
                  <span className="text-amber-700 dark:text-amber-400">
                    {' '}
                    ({duplicateCount} כבר קיימות - לא נבחרו)
                  </span>
                )}
              </div>
              <div className="flex-1" />
              <button
                onClick={() => setParsed((prev) => prev.map((p) => ({ ...p, selected: true })))}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                סמן הכל
              </button>
              <button
                onClick={() => setParsed((prev) => prev.map((p) => ({ ...p, selected: false })))}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                בטל הכל
              </button>
            </div>

            <div className="flex-1 overflow-auto p-2">
              <div className="space-y-1">
                {parsed.map((p, i) => (
                  <div
                    key={i}
                    className={`border dark:border-slate-700 rounded p-2 flex items-center gap-2 text-sm ${
                      p.duplicateOf
                        ? 'bg-amber-50 dark:bg-amber-900/20'
                        : p.selected
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : 'bg-slate-50 dark:bg-slate-800 opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={p.selected}
                      onChange={() => toggleRow(i)}
                      className="w-5 h-5 flex-shrink-0"
                    />
                    <input
                      type="date"
                      value={p.date}
                      onChange={(e) => updateRow(i, { date: e.target.value })}
                      className="px-2 py-1 border dark:border-slate-600 dark:bg-slate-700 rounded num text-xs w-32"
                    />
                    <select
                      value={p.category}
                      onChange={(e) => updateRow(i, { category: e.target.value })}
                      className="px-2 py-1 border dark:border-slate-600 dark:bg-slate-700 rounded text-xs w-32"
                    >
                      {!categories.includes(p.category) && (
                        <option value={p.category}>{p.category} (חדש)</option>
                      )}
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={p.description}
                      onChange={(e) => updateRow(i, { description: e.target.value })}
                      className="flex-1 min-w-[100px] px-2 py-1 border dark:border-slate-600 dark:bg-slate-700 rounded text-xs"
                      placeholder="תיאור"
                    />
                    <div className="num text-[color:var(--color-income)] font-medium text-xs w-24 text-center">
                      {p.income ? formatShekel(p.income) : ''}
                    </div>
                    <div className="num text-[color:var(--color-expense)] font-medium text-xs w-24 text-center">
                      {p.expense ? formatShekel(p.expense) : ''}
                    </div>
                    {p.duplicateOf && (
                      <span className="text-xs text-amber-700 dark:text-amber-400 whitespace-nowrap">
                        🔁 כפול
                      </span>
                    )}
                    <button
                      onClick={() => removeRow(i)}
                      className="text-red-600 hover:opacity-70 text-lg"
                      title="הסר"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t dark:border-slate-700 p-4 flex justify-between gap-2 sticky bottom-0 bg-white dark:bg-slate-800">
              <button
                onClick={() => setStep('upload')}
                disabled={importing}
                className="px-4 py-2 border dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-sm"
              >
                ← תמונה אחרת
              </button>
              <div className="flex gap-2">
                <button
                  onClick={close}
                  disabled={importing}
                  className="px-4 py-2 border dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  ביטול
                </button>
                <button
                  onClick={doImport}
                  disabled={importing || selectedCount === 0}
                  className="px-5 py-2 bg-[#2D3A8C] text-white rounded hover:bg-[#1f2a6b] disabled:opacity-50 font-medium"
                >
                  {importing ? 'מוסיף...' : `הוסף ${selectedCount} תנועות לעבר`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
