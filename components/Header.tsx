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
  onAddFuture: () => void;
  onAddPast: () => void;
  onBankImport: () => void;
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
  onAddFuture,
  onAddPast,
  onBankImport,
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
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-1.5 flex flex-wrap items-center justify-center sm:justify-between gap-1.5 sm:gap-3">
        {/* Logo + title */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="bg-white rounded p-0.5 flex items-center">
            <Image
              src="/logo.png"
              alt="אויר הרים גגות"
              width={48}
              height={48}
              className="h-7 sm:h-9 w-auto"
              priority
            />
          </div>
          <div className="leading-tight">
            <div className="font-bold text-sm sm:text-base">תזרים מזומנים</div>
            <div className="text-[10px] text-blue-200 hidden sm:block">אויר הרים גגות</div>
          </div>
        </div>

        {/* Balance badges */}
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          <div
            className="rounded px-2 py-0.5 flex items-center gap-1"
            style={{ background: openingColor.bg, color: openingColor.fg }}
          >
            <span className="text-[10px] opacity-80">יתרה</span>
            {editing ? (
              <>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="num w-20 px-1 py-0 bg-white text-slate-900 rounded text-xs"
                  disabled={saving}
                  autoFocus
                />
                <button
                  onClick={save}
                  disabled={saving}
                  className="text-[10px] bg-green-600 text-white px-1.5 py-0.5 rounded"
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
                  className="text-[10px] bg-slate-500 text-white px-1.5 py-0.5 rounded"
                  title="ביטול"
                >
                  ✕
                </button>
              </>
            ) : (
              <>
                <span className="num font-bold text-sm">{formatShekel(opening.balance)}</span>
                <button
                  onClick={() => setEditing(true)}
                  className="text-[10px] opacity-70 hover:opacity-100 underline"
                >
                  ערוך
                </button>
              </>
            )}
          </div>
          {endColor && endOfPeriodBalance !== undefined && (
            <div
              className="rounded px-2 py-0.5 flex items-center gap-1"
              style={{ background: endColor.bg, color: endColor.fg }}
              title="צפי יתרה לסוף החודש"
            >
              <span className="text-[10px] opacity-80">צפי ח'</span>
              <span className="num font-bold text-sm">{formatShekel(endOfPeriodBalance)}</span>
            </div>
          )}
        </div>

        {/* Action buttons + theme */}
        <div className="flex items-center gap-1 flex-wrap justify-center">
          <button
            onClick={onAddFuture}
            className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-medium"
            title="תנועה עתידית — תוזז לעבר בעת סימון 'בוצע'"
          >
            + לתזרים
          </button>
          <button
            onClick={onAddPast}
            className="px-2 py-1 border border-white/40 hover:bg-white/10 rounded text-xs font-medium"
            title="הוסף תנועה שכבר בוצעה"
          >
            + לעבר
          </button>
          <button
            onClick={onBankImport}
            className="px-2 py-1 bg-[#F0A500] hover:bg-[#d49300] rounded text-xs font-medium"
            title="ייבוא תנועות מצילום מסך של הבנק"
          >
            📸 בנק
          </button>
          <ThemeToggle />
        </div>

        {balanceUpdatedAt && (
          <div
            className="text-[10px] text-blue-200 hidden lg:block"
            title="התאריך והשעה בהם עודכנה היתרה בפעם האחרונה"
          >
            עדכון יתרה: {formatBalanceUpdated(balanceUpdatedAt)}
          </div>
        )}
      </div>
    </header>
  );
}
