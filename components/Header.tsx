'use client';

import Image from 'next/image';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  /** ISO timestamp of last time the opening balance itself was updated. */
  balanceUpdatedAt?: string | null;
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

export function Header({ balanceUpdatedAt }: HeaderProps) {
  return (
    <header className="bg-[#2D3A8C] text-white shadow-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-1.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
        {/* Right side in RTL: logo + title */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="bg-white rounded p-0.5 sm:p-1 flex items-center">
            <Image
              src="/logo.png"
              alt="אויר הרים גגות"
              width={48}
              height={48}
              className="h-7 sm:h-10 w-auto"
              priority
            />
          </div>
          <div>
            <div className="font-bold text-sm sm:text-lg leading-tight">תזרים מזומנים</div>
            <div className="text-[10px] sm:text-xs text-blue-200 leading-tight">אויר הרים גגות</div>
          </div>
        </div>

        {/* Left side: nav */}
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {balanceUpdatedAt && (
            <div className="text-xs text-blue-200 hidden sm:block" title="התאריך והשעה בהם עודכנה היתרה בפעם האחרונה">
              עדכון יתרה אחרון: {formatBalanceUpdated(balanceUpdatedAt)}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
