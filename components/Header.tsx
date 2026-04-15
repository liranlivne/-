'use client';

import Image from 'next/image';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  onOpenCategories: () => void;
  onRefresh: () => void;
  lastUpdated?: Date | null;
  isLoading?: boolean;
}

export function Header({ onOpenCategories, onRefresh, lastUpdated, isLoading }: HeaderProps) {
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
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="px-2 sm:px-3 py-1 sm:py-1.5 rounded hover:bg-white/10 transition disabled:opacity-50 text-xs sm:text-sm"
            title="רענון"
          >
            {isLoading ? '...' : '↻ רענן'}
          </button>
          <button
            onClick={onOpenCategories}
            className="px-2 sm:px-3 py-1 sm:py-1.5 rounded hover:bg-white/10 transition text-xs sm:text-sm"
          >
            קטגוריות
          </button>
          <ThemeToggle />
          {lastUpdated && (
            <div className="text-xs text-blue-200 hidden sm:block">
              עדכון אחרון: {lastUpdated.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
