'use client';

import { useEffect, useRef, useState } from 'react';
import type { Transaction, Frequency } from '@/lib/types';
import { todayIso } from '@/lib/dateUtils';
import { ImageUploader } from './ImageUploader';

type Mode = 'create' | 'edit';

interface Props {
  mode: Mode;
  open: boolean;
  initial?: Transaction | null;
  categories: string[];
  /** When creating, whether the new row will be 'future' (תזרים) or 'past' (היסטוריה). */
  createContext?: 'future' | 'past';
  onClose: () => void;
  onSave: (data: {
    date: string;
    category: string;
    description: string;
    income: number | null;
    expense: number | null;
    frequency: Frequency;
    imageUrl: string | null;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
  /** Move a past row back to תזרים (sets status=future, done=false). Only used in edit mode. */
  onRestoreToFuture?: () => Promise<void>;
  /** Duplicate the current row into a new row with the same fields. Only in edit mode. */
  onDuplicate?: () => Promise<void>;
  /** Split the current row into a paid part (past) + remaining (future). Only future rows. */
  onPartialPayment?: () => Promise<void>;
}

export function TransactionModal({
  mode,
  open,
  initial,
  categories,
  createContext,
  onClose,
  onSave,
  onDelete,
  onRestoreToFuture,
  onDuplicate,
  onPartialPayment,
}: Props) {
  const [date, setDate] = useState(todayIso());
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [income, setIncome] = useState('');
  const [expense, setExpense] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [splitting, setSplitting] = useState(false);

  // Only reset the form when the modal transitions from closed→open (or when switching
  // to editing a different row). Do NOT reset on every re-render when parent props
  // change (e.g. when background polling refreshes snapshot) — that would wipe typing.
  const openKey = open ? (initial ? `edit:${initial.rowNumber}` : 'create') : '';
  const lastOpenKeyRef = useRef<string>('');
  useEffect(() => {
    if (!open) {
      lastOpenKeyRef.current = '';
      return;
    }
    if (lastOpenKeyRef.current === openKey) return; // already initialized for this open
    lastOpenKeyRef.current = openKey;

    if (initial) {
      setDate(initial.date);
      setCategory(initial.category);
      setDescription(initial.description);
      setIncome(initial.income !== null ? String(initial.income) : '');
      setExpense(initial.expense !== null ? String(initial.expense) : '');
      setFrequency(initial.frequency);
      setImageUrl(initial.imageUrl);
    } else {
      setDate(todayIso());
      setCategory(categories[0] ?? '');
      setDescription('');
      setIncome('');
      setExpense('');
      setFrequency('');
      setImageUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, openKey]);

  if (!open) return null;

  const isCreatingPast = mode === 'create' && createContext === 'past';

  const onIncomeChange = (v: string) => {
    setIncome(v);
    if (v && Number(v) > 0) setExpense('');
  };
  const onExpenseChange = (v: string) => {
    setExpense(v);
    if (v && Number(v) > 0) setIncome('');
  };

  const save = async () => {
    if (!category) {
      alert('חובה לבחור קטגוריה');
      return;
    }
    const incomeNum = income ? Number(income) : null;
    const expenseNum = expense ? Number(expense) : null;
    if (!incomeNum && !expenseNum) {
      alert('חובה למלא הכנסה או הוצאה');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        date,
        category,
        description,
        income: incomeNum,
        expense: expenseNum,
        frequency,
        imageUrl,
      });
    } catch (err) {
      alert('שגיאה: ' + (err instanceof Error ? err.message : String(err)));
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  const del = async () => {
    if (!onDelete) return;
    if (!confirm('למחוק את השורה? הפעולה ניתנת לביטול עם Ctrl+Z.')) return;
    setDeleting(true);
    try {
      await onDelete();
    } catch (err) {
      alert('שגיאה במחיקה: ' + (err instanceof Error ? err.message : String(err)));
      setDeleting(false);
    }
  };

  const restore = async () => {
    if (!onRestoreToFuture) return;
    setRestoring(true);
    try {
      await onRestoreToFuture();
    } catch (err) {
      alert('שגיאה בהחזרה לתזרים: ' + (err instanceof Error ? err.message : String(err)));
      setRestoring(false);
    }
  };

  const duplicate = async () => {
    if (!onDuplicate) return;
    setDuplicating(true);
    try {
      await onDuplicate();
    } catch (err) {
      alert('שגיאה בשכפול: ' + (err instanceof Error ? err.message : String(err)));
      setDuplicating(false);
    }
  };

  const split = async () => {
    if (!onPartialPayment) return;
    setSplitting(true);
    try {
      await onPartialPayment();
    } catch (err) {
      alert('שגיאה: ' + (err instanceof Error ? err.message : String(err)));
      setSplitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#2D3A8C] text-white px-4 py-3 flex items-center justify-between rounded-t-lg">
          <h2 className="font-bold text-lg">
            {mode === 'create'
              ? isCreatingPast
                ? 'הוסף לעבר'
                : 'הוסף לתזרים'
              : 'עריכת תנועה'}
            {initial?.status === 'past' && (
              <span className="text-sm font-normal mr-2 opacity-80">(בעבר)</span>
            )}
          </h2>
          <button onClick={onClose} className="text-xl leading-none hover:opacity-75">×</button>
        </div>

        <div className="p-4 space-y-3">
          <label className="flex flex-col">
            <span className="text-sm text-slate-600 dark:text-slate-400 mb-1">תאריך</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2 border dark:border-slate-600 dark:bg-slate-700 rounded"
              disabled={saving || deleting || restoring || duplicating || splitting}
            />
          </label>

          <label className="flex flex-col">
            <span className="text-sm text-slate-600 dark:text-slate-400 mb-1">קטגוריה</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 border dark:border-slate-600 dark:bg-slate-700 rounded"
              disabled={saving || deleting || restoring || duplicating || splitting}
            >
              <option value="">-- בחר --</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col">
            <span className="text-sm text-slate-600 dark:text-slate-400 mb-1">תיאור</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="px-3 py-2 border dark:border-slate-600 dark:bg-slate-700 rounded"
              disabled={saving || deleting || restoring || duplicating || splitting}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col">
              <span className="text-sm text-[color:var(--color-income)] mb-1">הכנסה</span>
              <input
                type="number"
                value={income}
                onChange={(e) => onIncomeChange(e.target.value)}
                className="px-3 py-2 border dark:border-slate-600 dark:bg-slate-700 rounded num"
                disabled={saving || deleting || restoring || duplicating || splitting}
                placeholder="0"
              />
            </label>
            <label className="flex flex-col">
              <span className="text-sm text-[color:var(--color-expense)] mb-1">הוצאה</span>
              <input
                type="number"
                value={expense}
                onChange={(e) => onExpenseChange(e.target.value)}
                className="px-3 py-2 border dark:border-slate-600 dark:bg-slate-700 rounded num"
                disabled={saving || deleting || restoring || duplicating || splitting}
                placeholder="0"
              />
            </label>
          </div>

          <label className="flex flex-col">
            <span className="text-sm text-slate-600 dark:text-slate-400 mb-1">תדירות</span>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as Frequency)}
              className="px-3 py-2 border dark:border-slate-600 dark:bg-slate-700 rounded"
              disabled={saving || deleting || restoring || duplicating || splitting}
            >
              <option value="">חד פעמי</option>
              <option value="חודשי">חודשי</option>
              <option value="דו-חודשי">דו-חודשי</option>
            </select>
          </label>

          <div className="flex flex-col">
            <span className="text-sm text-slate-600 dark:text-slate-400 mb-1">קובץ מצורף</span>
            <ImageUploader
              value={imageUrl}
              onChange={setImageUrl}
              disabled={saving || deleting || restoring || duplicating || splitting}
            />
          </div>
        </div>

        <div className="border-t dark:border-slate-700 p-4 flex flex-wrap items-center justify-between gap-2">
          {mode === 'edit' && onDelete && (
            <button
              onClick={del}
              disabled={saving || deleting || restoring || duplicating || splitting}
              className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm disabled:opacity-50"
            >
              {deleting ? 'מוחק...' : '🗑 מחק שורה'}
            </button>
          )}
          {mode === 'edit' && initial?.status === 'past' && onRestoreToFuture && (
            <button
              onClick={restore}
              disabled={saving || deleting || restoring || duplicating || splitting}
              className="px-3 py-2 bg-[#F0A500] text-white rounded hover:bg-[#d49300] text-sm disabled:opacity-50 font-medium"
              title="החזר את השורה לתזרים (תיקון טעות של 'בוצע')"
            >
              {restoring ? 'מחזיר...' : '↩ החזר לתזרים'}
            </button>
          )}
          {mode === 'edit' && onDuplicate && (
            <button
              onClick={duplicate}
              disabled={saving || deleting || restoring || duplicating || splitting}
              className="px-3 py-2 border-2 border-[#2D3A8C] text-[#2D3A8C] dark:text-[#7583D8] dark:border-[#7583D8] rounded hover:bg-[#2D3A8C]/5 text-sm disabled:opacity-50 font-medium"
              title="צור עותק של השורה הזו"
            >
              {duplicating ? 'משכפל...' : '📋 שכפל'}
            </button>
          )}
          {mode === 'edit' && initial?.status !== 'past' && onPartialPayment && (
            <button
              onClick={split}
              disabled={saving || deleting || restoring || duplicating || splitting}
              className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm disabled:opacity-50 font-medium"
              title="שולם חלק מהסכום: יעבור לעבר את הסכום ששולם, וישאיר ביתרת התזרים את ההפרש"
            >
              {splitting ? '...' : '💰 שולם חלקית'}
            </button>
          )}
          <div className="flex gap-2 mr-auto">
            <button
              onClick={onClose}
              disabled={saving || deleting || restoring || duplicating || splitting}
              className="px-4 py-2 border dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              ביטול
            </button>
            <button
              onClick={save}
              disabled={saving || deleting || restoring || duplicating || splitting}
              className="px-4 py-2 bg-[#2D3A8C] text-white rounded hover:bg-[#1f2a6b] disabled:opacity-50 font-medium"
            >
              {saving ? 'שומר...' : 'שמור'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
