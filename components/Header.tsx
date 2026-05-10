'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ThemeToggle } from './ThemeToggle';
import type { OpeningBalance } from '@/lib/types';
import { formatShekel, getBalanceColor } from '@/lib/balance';

interface HeaderProps {
  /** ISO timestamp of last time the opening balance itself was updated. */
  balanceUpdatedAt?: string | null;
  opening: OpeningBalance;
  endOfPeriodBalance?: number;
  onUpdateOpening: (value: number) => Promise<void>;
  onBankImport: () => void;
  onSalaryImport: () => void;
}

function formatBalanceUpdated(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function Header({
  balanceUpdatedAt,
  opening,
  endOfPeriodBalance,
  onUpdateOpening,
  onBankImport,
  onSalaryImport,
}: HeaderProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(String(opening.balance));
  const [saving, setSaving] = useState(false);

  const openingColor = getBalanceColor(opening.balance);
  const endColor =
    endOfPeriodBalance !== undefined ? getBalanceColor(endOfPeriodBalance) : null;

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
    <header className="bg-[#2D3A8C] text-white shadow-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 flex flex-wrap items-center justify-center sm:justify-between gap-2 sm:gap-3">
        {/* Logo + title */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="bg-white rounded p-0.5 flex items-center">
            <Image
              src="/logo.png"
              alt="אויר הרים גגות"
              width={48}
              height={48}
              className="h-8 sm:h-10 w-auto"
              priority
            />
          </div>
          <div className="leading-tight">
            <div className="font-bold text-sm sm:text-base">תזרים מזומנים</div>
            <div className="text-[10px] text-blue-200 hidden sm:block">אויר הרים גגות</div>
          </div>
        </div>

        {/* Balance badges — enlarged */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <div
            className="rounded-md px-3 py-1.5 flex items-center gap-2"
            style={{ background: openingColor.bg, color: openingColor.fg }}
          >
            <span className="text-xs font-medium opacity-80">יתרה</span>
            {editing ? (
              <>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="num w-28 px-2 py-1 bg-white text-slate-900 rounded text-base font-bold"
                  disabled={saving}
                  autoFocus
                />
                <button
                  onClick={save}
                  disabled={saving}
                  className="text-sm bg-green-600 text-white px-2 py-1 rounded"
                  title="שמור"
                >
                  {saving ? '…' : '✓'}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setValue(String(opening.balance));
                  }}
                  disabled={saving}
                  className="text-sm bg-slate-500 text-white px-2 py-1 rounded"
                  title="ביטול"
                >
                  ✕
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="num font-bold text-lg hover:underline underline-offset-4 decoration-dotted cursor-pointer"
                title="לחץ לעדכון היתרה"
              >
                {formatShekel(opening.balance)}
              </button>
            )}
          </div>
          {endColor && endOfPeriodBalance !== undefined && (
            <div
              className="rounded-md px-3 py-1.5 flex items-center gap-2"
              style={{ background: endColor.bg, color: endColor.fg }}
              title="צפי יתרה לסוף החודש"
            >
              <span className="text-xs font-medium opacity-80">צפי סוף חודש</span>
              <span className="num font-bold text-lg">{formatShekel(endOfPeriodBalance)}</span>
            </div>
          )}
        </div>

        {/* Bank import + theme */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <button
            onClick={onBankImport}
            className="px-3 py-1.5 bg-[#F0A500] hover:bg-[#d49300] rounded text-sm font-medium flex items-center gap-1"
            title="ייבוא תנועות מצילום מסך של הבנק"
          >
            📸 ייבוא מהבנק
          </button>
          <button
            onClick={onSalaryImport}
            className="px-3 py-1.5 bg-[#F0A500] hover:bg-[#d49300] rounded text-sm font-medium flex items-center gap-1"
            title="ייבוא משכורות מקובץ PDF של תלושי שכר"
          >
            📄 ייבוא משכורות
          </button>
          <ThemeToggle />
        </div>

        {balanceUpdatedAt && (
          <div
            className="text-xs text-blue-200 w-full text-center sm:w-auto sm:text-right"
            title="התאריך והשעה בהם עודכנה היתרה בפעם האחרונה"
          >
            עדכון יתרה אחרון: {formatBalanceUpdated(balanceUpdatedAt)}
          </div>
        )}
      </div>
    </header>
  );
}
