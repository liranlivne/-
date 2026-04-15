'use client';

import { useState } from 'react';
import type { OpeningBalance } from '@/lib/types';
import { formatShekel, getBalanceColor } from '@/lib/balance';

interface BalanceBarProps {
  opening: OpeningBalance;
  endOfPeriodBalance?: number; // e.g. end of current month
  onUpdateOpening: (value: number) => Promise<void>;
  onAddFuture: () => void;
  onAddPast: () => void;
  onBankImport: () => void;
}

export function BalanceBar({
  opening,
  endOfPeriodBalance,
  onUpdateOpening,
  onAddFuture,
  onAddPast,
  onBankImport,
}: BalanceBarProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(String(opening.balance));
  const [saving, setSaving] = useState(false);

  const openingColor = getBalanceColor(opening.balance);
  const endColor = endOfPeriodBalance !== undefined ? getBalanceColor(endOfPeriodBalance) : null;

  const save = async () => {
    const num = Number(value.replace(/[,₪\s]/g, ''));
    if (!Number.isFinite(num)) {
      alert('ערך לא תקין');
      return;
    }
    setSaving(true);
    try {
      await onUpdateOpening(num);
      setEditing(false);
    } catch (err) {
      alert('שגיאה בעדכון: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 shadow-sm border-b dark:border-slate-700 sticky top-[40px] sm:top-[56px] z-20">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Opening balance */}
        <div
          className="rounded px-2 sm:px-3 py-1 sm:py-2 flex items-center gap-1.5 sm:gap-2"
          style={{ background: openingColor.bg, color: openingColor.fg }}
        >
          <span className="text-[10px] sm:text-xs font-medium opacity-80">יתרה נוכחית</span>
          {editing ? (
            <>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="num w-24 sm:w-32 px-2 py-0.5 bg-white dark:bg-slate-700 dark:text-white rounded border dark:border-slate-600 text-slate-900 text-sm"
                disabled={saving}
              />
              <button
                onClick={save}
                disabled={saving}
                className="px-2 py-0.5 bg-green-600 text-white rounded text-xs"
              >
                {saving ? '...' : 'שמור'}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setValue(String(opening.balance));
                }}
                disabled={saving}
                className="px-2 py-0.5 bg-slate-500 text-white rounded text-xs"
              >
                בטל
              </button>
            </>
          ) : (
            <>
              <span className="num font-bold text-base sm:text-lg">{formatShekel(opening.balance)}</span>
              <button
                onClick={() => setEditing(true)}
                className="text-[10px] sm:text-xs opacity-70 hover:opacity-100 underline"
              >
                ערוך
              </button>
            </>
          )}
        </div>

        {/* End-of-period projection */}
        {endColor && endOfPeriodBalance !== undefined && (
          <div
            className="rounded px-2 sm:px-3 py-1 sm:py-2 flex items-center gap-1.5 sm:gap-2"
            style={{ background: endColor.bg, color: endColor.fg }}
          >
            <span className="text-[10px] sm:text-xs font-medium opacity-80">צפי לסוף החודש</span>
            <span className="num font-bold text-base sm:text-lg">{formatShekel(endOfPeriodBalance)}</span>
          </div>
        )}

        <div className="flex-1" />

        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <button
            onClick={onAddFuture}
            className="px-2.5 sm:px-4 py-1.5 sm:py-2 bg-[#2D3A8C] text-white rounded hover:bg-[#1f2a6b] transition font-medium text-xs sm:text-base"
            title="תנועה עתידית — תוזז לעבר בעת סימון 'בוצע'"
          >
            + הוסף לתזרים
          </button>
          <button
            onClick={onAddPast}
            className="px-2.5 sm:px-4 py-1.5 sm:py-2 border-2 border-[#2D3A8C] text-[#2D3A8C] dark:text-[#7583D8] rounded hover:bg-[#2D3A8C]/5 transition font-medium text-xs sm:text-base"
            title="הוסף תנועה שכבר בוצעה"
          >
            + הוסף לעבר
          </button>
          <button
            onClick={onBankImport}
            className="px-2.5 sm:px-4 py-1.5 sm:py-2 bg-[#F0A500] text-white rounded hover:bg-[#d49300] transition font-medium flex items-center gap-1 text-xs sm:text-base"
            title="ייבוא תנועות מצילום מסך של הבנק"
          >
            📸 ייבוא מהבנק
          </button>
        </div>
      </div>
    </div>
  );
}
