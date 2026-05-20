'use client';

import { useEffect, useRef, useState } from 'react';
import type { Transaction } from '@/lib/types';
import { formatShekel } from '@/lib/balance';
import { todayIso, addMonthsIso } from '@/lib/dateUtils';

export interface SplitBucketSpec {
  date: string;
  amount: number;
  /** True → this part is already paid (row goes to "past"). False → stays in תזרים. */
  paid: boolean;
}

interface SplitBucket {
  id: number;
  date: string;
  /** Kept as string for input flexibility (user might be mid-typing). Parsed on submit. */
  amount: string;
  paid: boolean;
  /** Remembers the future-date the user picked, so toggling "שולם" off can restore it
   *  instead of leaving today's date stuck. */
  prevDate?: string;
}

interface Props {
  open: boolean;
  source: Transaction | null;
  onClose: () => void;
  /**
   * The handler is responsible for the actual API calls — typically updating
   * the source row to bucket[0] and creating new rows for bucket[1..]. The
   * modal stays in submitting state until the promise resolves; it closes
   * itself only on the success path (the handler calls onClose), so failures
   * leave the user's draft intact.
   */
  onConfirm: (buckets: SplitBucketSpec[]) => Promise<void>;
}

export function SplitTransactionModal({ open, source, onClose, onConfirm }: Props) {
  const [buckets, setBuckets] = useState<SplitBucket[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const nextIdRef = useRef(0);

  // Reset state whenever a new source opens
  useEffect(() => {
    if (!open || !source) return;
    const total = source.income !== null && source.income > 0 ? source.income : source.expense ?? 0;
    const half = Math.round(total / 2);
    nextIdRef.current = 0;
    setBuckets([
      {
        id: nextIdRef.current++,
        date: source.date,
        amount: String(half),
        paid: false,
      },
      {
        id: nextIdRef.current++,
        date: addMonthsIso(source.date, 1),
        amount: String(total - half),
        paid: false,
      },
    ]);
    setSubmitting(false);
  }, [open, source]);

  if (!open || !source) return null;

  const isIncome = source.income !== null && source.income > 0;
  const total = isIncome ? source.income! : source.expense ?? 0;
  const allocated = buckets.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const remaining = total - allocated;
  const balanced = Math.abs(remaining) < 0.5;

  const addBucket = () => {
    const defaultAmount = remaining > 0 ? Math.round(remaining) : 0;
    setBuckets((prev) => [
      ...prev,
      {
        id: nextIdRef.current++,
        date: addMonthsIso(source.date, prev.length),
        amount: String(defaultAmount),
        paid: false,
      },
    ]);
  };

  const updateBucket = (id: number, patch: Partial<SplitBucket>) =>
    setBuckets((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const togglePaid = (id: number, paid: boolean) => {
    setBuckets((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        if (paid) {
          // Switching ON: remember current date, default to today
          return { ...b, paid: true, prevDate: b.date, date: todayIso() };
        }
        // Switching OFF: restore the previously-stashed future date (or fallback)
        return { ...b, paid: false, date: b.prevDate || source.date, prevDate: undefined };
      })
    );
  };

  const removeBucket = (id: number) =>
    setBuckets((prev) => (prev.length <= 1 ? prev : prev.filter((b) => b.id !== id)));

  const canConfirm =
    balanced &&
    buckets.length >= 2 &&
    buckets.every(
      (b) => b.date && /^\d{4}-\d{2}-\d{2}$/.test(b.date) && Number(b.amount) > 0
    );

  const confirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      await onConfirm(
        buckets.map((b) => ({
          date: b.date,
          amount: Number(b.amount),
          paid: b.paid,
        }))
      );
      // Parent calls onClose on success; we don't close from here.
    } catch (err) {
      alert('שגיאה: ' + (err instanceof Error ? err.message : String(err)));
      setSubmitting(false);
    }
  };

  const paidCount = buckets.filter((b) => b.paid).length;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#2D3A8C] text-white px-4 py-2.5 flex items-center justify-between rounded-t-lg sticky top-0 z-10">
          <h2 className="font-bold text-lg">✂️ פיצול תנועה</h2>
          <button onClick={onClose} className="text-xl leading-none hover:opacity-75">
            ×
          </button>
        </div>

        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-700 text-sm">
          <div className="font-medium truncate">
            {source.description || source.category}
          </div>
          <div className="text-slate-600 dark:text-slate-300 mt-0.5 flex items-baseline gap-3 flex-wrap">
            <span>
              סה&quot;כ לפצל: <b className="num">{formatShekel(total)}</b>
            </span>
            <span className="text-xs opacity-70">
              סמן &quot;שולם&quot; כדי לרשום תשלום שכבר בוצע
            </span>
          </div>
        </div>

        <div className="p-3 space-y-2">
          {buckets.map((b, i) => (
            <div
              key={b.id}
              className={`flex items-center gap-2 p-2 rounded border ${
                b.paid
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
                  : 'bg-white dark:bg-slate-700/30 border-slate-200 dark:border-slate-600'
              }`}
            >
              <span className="text-xs text-slate-500 dark:text-slate-400 w-5 shrink-0">
                {i + 1}.
              </span>
              <label className="flex items-center gap-1 text-xs cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={b.paid}
                  onChange={(e) => togglePaid(b.id, e.target.checked)}
                  disabled={submitting}
                  className="w-4 h-4"
                />
                שולם
              </label>
              <input
                type="date"
                value={b.date}
                onChange={(e) => updateBucket(b.id, { date: e.target.value })}
                disabled={submitting}
                className="flex-1 min-w-0 px-2 py-1.5 border dark:border-slate-600 dark:bg-slate-700 rounded text-sm"
              />
              <input
                type="number"
                value={b.amount}
                onChange={(e) => updateBucket(b.id, { amount: e.target.value })}
                placeholder="0"
                min="0"
                disabled={submitting}
                className="w-24 px-2 py-1.5 border dark:border-slate-600 dark:bg-slate-700 rounded text-sm text-center num"
              />
              <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                ₪
              </span>
              {buckets.length > 1 && (
                <button
                  onClick={() => removeBucket(b.id)}
                  disabled={submitting}
                  className="text-red-600 hover:opacity-70 text-lg w-5 shrink-0"
                  title="הסר שורה"
                  aria-label="הסר שורה"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addBucket}
            disabled={submitting}
            className="w-full px-3 py-2 border border-dashed dark:border-slate-600 rounded text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            + הוסף תאריך
          </button>
        </div>

        <div className="border-t dark:border-slate-700 px-4 py-2 bg-slate-50 dark:bg-slate-900 text-sm flex items-center justify-between">
          <span>
            הוקצה: <b className="num">{formatShekel(allocated)}</b>
          </span>
          {balanced ? (
            <span className="text-green-700 dark:text-green-300 font-medium">
              מאוזן ✓
            </span>
          ) : (
            <span className="text-red-700 dark:text-red-300 font-medium">
              {remaining > 0
                ? `חסר ${formatShekel(remaining)}`
                : `עודף ${formatShekel(-remaining)}`}
            </span>
          )}
        </div>

        <div className="border-t dark:border-slate-700 p-3.5 flex justify-between items-center gap-2 sticky bottom-0 bg-white dark:bg-slate-800">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 border dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            onClick={confirm}
            disabled={!canConfirm || submitting}
            className="px-5 py-2 bg-[#2D3A8C] text-white rounded hover:bg-[#1f2a6b] disabled:opacity-50 font-medium"
            title={
              !balanced
                ? 'הסכומים לא מסתכמים לסה"כ'
                : paidCount > 0
                ? `${paidCount} מתוך ${buckets.length} יסומנו כבוצעו (יעברו לעבר)`
                : `כל ${buckets.length} השורות יישארו בתזרים`
            }
          >
            {submitting
              ? 'מפצל...'
              : `אשר פיצול ל-${buckets.length} שורות${
                  paidCount > 0 ? ` (${paidCount} שולם)` : ''
                }`}
          </button>
        </div>
      </div>
    </div>
  );
}
