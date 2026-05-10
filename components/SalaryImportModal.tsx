'use client';

import { useRef, useState } from 'react';
import { formatShekel } from '@/lib/balance';

interface ParsedEmployee {
  name: string;
  net_pay: number;
  selected: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * Imports each selected employee as a separate row in the sheet, with
   *   date = today (server-side), category = "שכר עובדים", description = name,
   *   expense = net_pay, status = "future".
   * Returns the count successfully written so the modal can show a summary.
   */
  onImport: (
    rows: Array<{ name: string; net_pay: number }>
  ) => Promise<{ successCount: number; failedCount: number }>;
}

export function SalaryImportModal({ open, onClose, onImport }: Props) {
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsed, setParsed] = useState<ParsedEmployee[]>([]);
  const [month, setMonth] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const reset = () => {
    setStep('upload');
    setParsed([]);
    setMonth('');
    setError(null);
    setAnalyzing(false);
    setImporting(false);
    setResult(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/salary-import', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = (await res.json()) as {
        month: string;
        employees: { name: string; net_pay: number }[];
      };
      if (!data.employees || data.employees.length === 0) {
        setError('לא נמצאו עובדים ב-PDF. נסה קובץ אחר או ודא שהוא תקין.');
        setAnalyzing(false);
        if (fileRef.current) fileRef.current.value = '';
        return;
      }

      setMonth(data.month || '');
      setParsed(data.employees.map((e) => ({ ...e, selected: true })));
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const toggleRow = (i: number) =>
    setParsed((prev) => prev.map((p, idx) => (idx === i ? { ...p, selected: !p.selected } : p)));

  const updateAmount = (i: number, value: number) =>
    setParsed((prev) => prev.map((p, idx) => (idx === i ? { ...p, net_pay: value } : p)));

  const removeRow = (i: number) =>
    setParsed((prev) => prev.filter((_, idx) => idx !== i));

  const doImport = async () => {
    const toImport = parsed.filter((p) => p.selected && p.net_pay > 0);
    if (toImport.length === 0) {
      alert('בחר לפחות עובד אחד עם סכום חיובי');
      return;
    }

    setImporting(true);
    try {
      const { successCount, failedCount } = await onImport(
        toImport.map((p) => ({ name: p.name, net_pay: p.net_pay }))
      );
      setResult({ ok: successCount, failed: failedCount });
      setStep('done');
    } catch (err) {
      alert('שגיאה בייבוא: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = parsed.filter((p) => p.selected).length;
  const totalSelected = parsed
    .filter((p) => p.selected)
    .reduce((sum, p) => sum + (p.net_pay || 0), 0);

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
          <h2 className="font-bold text-lg">📄 ייבוא משכורות מ-PDF</h2>
          <button onClick={close} className="text-xl leading-none hover:opacity-75">
            ×
          </button>
        </div>

        {step === 'upload' && (
          <div className="p-6 flex flex-col items-center gap-4">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={onFileSelected}
              disabled={analyzing}
            />
            <div className="text-center text-slate-600 dark:text-slate-300 text-sm max-w-md">
              צרף PDF של תלושי השכר. ה-AI יקרא את כל התלושים, יחלץ את שדה
              <b> &quot;נטו לתשלום&quot; </b> לכל עובד, ותוכל לאשר את הרשימה לפני
              ההזנה לתזרים.
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={analyzing}
              className="px-8 py-6 bg-[#2D3A8C] text-white rounded-lg hover:bg-[#1f2a6b] disabled:opacity-50 font-bold text-lg flex flex-col items-center gap-2"
            >
              <span className="text-3xl">📤</span>
              <span>{analyzing ? 'מנתח את ה-PDF...' : 'בחר קובץ PDF'}</span>
            </button>
            {analyzing && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                זה יכול לקחת 10–30 שניות תלוי במספר העמודים. אני חושב...
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
                נמצאו <b>{parsed.length}</b> עובדים
                {month && (
                  <span className="text-slate-500 dark:text-slate-400">
                    {' '}
                    (חודש: {month})
                  </span>
                )}
                ,{' '}
                <b className="text-[color:var(--color-income)]">
                  {selectedCount} ייובאו
                </b>
              </div>
              <div className="flex-1" />
              <button
                onClick={() =>
                  setParsed((prev) => prev.map((p) => ({ ...p, selected: true })))
                }
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                סמן הכל
              </button>
              <button
                onClick={() =>
                  setParsed((prev) => prev.map((p) => ({ ...p, selected: false })))
                }
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                בטל הכל
              </button>
            </div>

            <div className="flex-1 overflow-auto p-2">
              <div className="space-y-1">
                {parsed.map((p, i) => (
                  <div
                    key={`${p.name}-${i}`}
                    className={`border dark:border-slate-700 rounded p-2 flex items-center gap-2 text-sm ${
                      p.selected
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
                    <span className="flex-1 min-w-0 truncate font-medium">{p.name}</span>
                    <input
                      type="number"
                      value={p.net_pay}
                      onChange={(e) => updateAmount(i, Number(e.target.value) || 0)}
                      className="num w-32 px-2 py-1 border dark:border-slate-600 dark:bg-slate-700 rounded text-sm text-center text-[color:var(--color-expense)] font-medium"
                      step="1"
                      min="0"
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400 w-6 text-center">
                      ₪
                    </span>
                    <button
                      onClick={() => removeRow(i)}
                      className="text-red-600 hover:opacity-70 text-lg w-6"
                      title="הסר מהרשימה"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t dark:border-slate-700 px-4 py-2 bg-slate-50 dark:bg-slate-900 text-sm flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-300">
                סה&quot;כ {selectedCount} עובדים
              </span>
              <span className="num font-bold text-[color:var(--color-expense)] text-base">
                {formatShekel(totalSelected)}
              </span>
            </div>

            <div className="border-t dark:border-slate-700 p-4 flex justify-between gap-2 sticky bottom-0 bg-white dark:bg-slate-800">
              <button
                onClick={() => {
                  setStep('upload');
                  setParsed([]);
                  setMonth('');
                }}
                disabled={importing}
                className="px-4 py-2 border dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-sm"
              >
                ← קובץ אחר
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
                  {importing ? 'מוסיף...' : `אשר והזן לתזרים (${selectedCount})`}
                </button>
              </div>
            </div>
          </>
        )}

        {step === 'done' && result && (
          <div className="p-6 flex flex-col items-center gap-4 text-center">
            {result.failed === 0 ? (
              <>
                <div className="text-5xl">✅</div>
                <div className="text-lg font-bold text-green-700 dark:text-green-300">
                  נוספו {result.ok} שורות לתזרים
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300 max-w-md">
                  כל המשכורות שובצו לתאריך של היום, בקטגוריית &quot;שכר עובדים&quot;.
                  אפשר לסמן &quot;בוצע&quot; לכל שורה כשהמשכורת באמת שולמה.
                </div>
              </>
            ) : (
              <>
                <div className="text-5xl">⚠️</div>
                <div className="text-lg font-bold text-amber-700 dark:text-amber-300">
                  נוספו {result.ok} שורות, {result.failed} נכשלו
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300 max-w-md">
                  חלק מהשורות נכשלו. בדוק את הגיליון, ותוכל לחזור על הפעולה רק
                  עבור העובדים שלא נכנסו.
                </div>
              </>
            )}
            <button
              onClick={close}
              className="mt-2 px-5 py-2 bg-[#2D3A8C] text-white rounded hover:bg-[#1f2a6b]"
            >
              סגור
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
