'use client';

import { useEffect, useRef, useState } from 'react';
import type { Transaction } from '@/lib/types';
import { formatDateHe, isToday, todayIso } from '@/lib/dateUtils';
import { formatShekel, getBalanceColor } from '@/lib/balance';
import { isRecentlyUpdated } from '@/lib/highlight';
import { ImageLightbox } from './ImageUploader';

interface Props {
  pastTransactions: Transaction[];
  futureTransactions: Transaction[];
  runningBalances: Map<number, number>;
  onRowClick: (t: Transaction) => void;
  onToggleDone: (t: Transaction) => void;
  selectedRows: Set<number>;
  onSetSelect: (rowNumber: number, selected: boolean) => void;
  onOpenCategories: () => void;
  onAddFuture: () => void;
  onAddPast: () => void;
}

export function TransactionsTable({
  pastTransactions,
  futureTransactions,
  runningBalances,
  onRowClick,
  onToggleDone,
  selectedRows,
  onSetSelect,
  onOpenCategories,
  onAddFuture,
  onAddPast,
}: Props) {
  const [showPast, setShowPast] = useState(false);
  const pastScrollRef = useRef<HTMLDivElement>(null);

  const formattedToday = formatDateHe(todayIso());

  // When the past section opens, scroll it to the bottom so the newest past rows
  // (closest to "today") are visible immediately. The user can scroll up to see older.
  useEffect(() => {
    if (!showPast) return;
    const el = pastScrollRef.current;
    if (!el) return;
    // Wait a tick for layout to settle
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [showPast, pastTransactions.length]);

  return (
    <div className="max-w-7xl mx-auto px-0 sm:px-4 py-2 sm:py-3 lg:mr-0 lg:pr-[304px]">
      {/* Past section header */}
      <div className="mb-2 flex items-stretch gap-2">
        <button
          onClick={() => setShowPast((s) => !s)}
          className="flex-1 text-right bg-white dark:bg-slate-800 border dark:border-slate-700 rounded px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between"
        >
          <span className="text-sm font-medium">
            {showPast ? '▲ הסתר עבר' : '▼ הצג עבר'}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {pastTransactions.length} רשומות בעבר
          </span>
        </button>
        <button
          onClick={onAddPast}
          className="shrink-0 px-3 bg-[#2D3A8C] text-white rounded hover:bg-[#1f2a6b] font-bold text-lg"
          title="הוסף תנועה לעבר"
        >
          +
        </button>
      </div>

      {/* Past rows (scrollable container, opacity reduced, starts scrolled to bottom) */}
      {showPast && pastTransactions.length > 0 && (
        <div
          ref={pastScrollRef}
          className="opacity-80 mb-2 max-h-[50vh] overflow-y-auto border dark:border-slate-700 rounded"
        >
          <TableView
            rows={pastTransactions}
            runningBalances={runningBalances}
            onRowClick={onRowClick}
            onToggleDone={onToggleDone}
            showBalanceCol={false}
            selectedRows={selectedRows}
            onSetSelect={onSetSelect}
            onOpenCategories={onOpenCategories}
          />
        </div>
      )}

      {/* Today divider + add-future button */}
      <div className="my-4 flex items-center gap-3">
        <div className="flex-1 h-0.5 bg-[#2D3A8C]" />
        <div className="bg-[#2D3A8C] text-white px-4 py-1 rounded-full text-sm font-medium">
          היום — {formattedToday}
        </div>
        <div className="flex-1 h-0.5 bg-[#2D3A8C]" />
        <button
          onClick={onAddFuture}
          className="shrink-0 w-9 h-9 bg-[#2D3A8C] text-white rounded-full hover:bg-[#1f2a6b] font-bold text-xl flex items-center justify-center shadow"
          title="הוסף תנועה לתזרים"
        >
          +
        </button>
      </div>

      {/* Future rows */}
      <TableView
        rows={futureTransactions}
        runningBalances={runningBalances}
        onRowClick={onRowClick}
        onToggleDone={onToggleDone}
        showBalanceCol={true}
        selectedRows={selectedRows}
        onSetSelect={onSetSelect}
        onOpenCategories={onOpenCategories}
      />
    </div>
  );
}

function TableView({
  rows,
  runningBalances,
  onRowClick,
  onToggleDone,
  showBalanceCol,
  selectedRows,
  onSetSelect,
  onOpenCategories,
}: {
  rows: Transaction[];
  runningBalances: Map<number, number>;
  onRowClick: (t: Transaction) => void;
  onToggleDone: (t: Transaction) => void;
  showBalanceCol: boolean;
  selectedRows: Set<number>;
  onSetSelect: (rowNumber: number, selected: boolean) => void;
  onOpenCategories: () => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded p-6 text-center text-slate-500 dark:text-slate-400 text-sm">
        אין תנועות
      </div>
    );
  }

  return (
    <>
      {/* Desktop table - using grid for reliable RTL alignment */}
      <div className="hidden md:block bg-white dark:bg-slate-800 border dark:border-slate-700 rounded overflow-hidden">
        <DesktopGrid
          rows={rows}
          runningBalances={runningBalances}
          onRowClick={onRowClick}
          onToggleDone={onToggleDone}
          showBalanceCol={showBalanceCol}
          selectedRows={selectedRows}
          onSetSelect={onSetSelect}
          onOpenCategories={onOpenCategories}
        />
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-0">
        {rows.map((t) => (
          <MobileCard
            key={t.rowNumber}
            t={t}
            balance={runningBalances.get(t.rowNumber)}
            onRowClick={onRowClick}
            onToggleDone={onToggleDone}
            showBalance={showBalanceCol}
            selected={selectedRows.has(t.rowNumber)}
            onSetSelect={onSetSelect}
          />
        ))}
      </div>
    </>
  );
}

function DesktopGrid({
  rows,
  runningBalances,
  onRowClick,
  onToggleDone,
  showBalanceCol,
  selectedRows,
  onSetSelect,
  onOpenCategories,
}: {
  rows: Transaction[];
  runningBalances: Map<number, number>;
  onRowClick: (t: Transaction) => void;
  onToggleDone: (t: Transaction) => void;
  showBalanceCol: boolean;
  selectedRows: Set<number>;
  onSetSelect: (rowNumber: number, selected: boolean) => void;
  onOpenCategories: () => void;
}) {
  // Grid template columns (visual order in RTL = logical order, since grid respects dir)
  // Order: select | date | category | description | income | expense | balance | frequency | done
  const cols = showBalanceCol
    ? '54px 95px 140px minmax(120px,1fr) 120px 120px 130px 90px 60px'
    : '54px 95px 140px minmax(120px,1fr) 120px 120px 90px 60px';

  return (
    <div>
      {/* Header */}
      <div
        className="grid bg-[#2D3A8C] text-white text-sm font-medium"
        style={{ gridTemplateColumns: cols }}
      >
        <div className="px-2 py-2 text-center flex flex-col items-center gap-0.5">
          <span className="text-[10px] opacity-80 leading-none">בחירה</span>
          <input
            type="checkbox"
            checked={rows.length > 0 && rows.every((r) => selectedRows.has(r.rowNumber))}
            onChange={(e) => {
              const next = e.target.checked;
              for (const r of rows) onSetSelect(r.rowNumber, next);
            }}
            className="w-4 h-4"
            title="סמן/בטל הכל"
          />
        </div>
        <div className="px-2 py-2 text-center">תאריך</div>
        <button
          type="button"
          onClick={onOpenCategories}
          className="px-2 py-2 text-right hover:bg-white/10 transition cursor-pointer underline-offset-2 hover:underline"
          title="נהל קטגוריות"
        >
          קטגוריה
        </button>
        <div className="px-2 py-2 text-right">תיאור</div>
        <div className="px-2 py-2 text-center">הכנסה</div>
        <div className="px-2 py-2 text-center">הוצאה</div>
        {showBalanceCol && <div className="px-2 py-2 text-center">יתרה</div>}
        <div className="px-2 py-2 text-center">תדירות</div>
        <div className="px-2 py-2 text-center">בוצע</div>
      </div>

      {/* Rows */}
      {rows.map((t) => (
        <DesktopGridRow
          key={t.rowNumber}
          t={t}
          balance={runningBalances.get(t.rowNumber)}
          onRowClick={onRowClick}
          onToggleDone={onToggleDone}
          showBalanceCol={showBalanceCol}
          cols={cols}
          selected={selectedRows.has(t.rowNumber)}
          onSetSelect={onSetSelect}
        />
      ))}
    </div>
  );
}

function DesktopGridRow({
  t,
  balance,
  onRowClick,
  onToggleDone,
  showBalanceCol,
  cols,
  selected,
  onSetSelect,
}: {
  t: Transaction;
  balance: number | undefined;
  onRowClick: (t: Transaction) => void;
  onToggleDone: (t: Transaction) => void;
  showBalanceCol: boolean;
  cols: string;
  selected: boolean;
  onSetSelect: (rowNumber: number, selected: boolean) => void;
}) {
  const highlighted = isRecentlyUpdated(t.updatedAt);
  const balColor = balance !== undefined ? getBalanceColor(balance) : null;
  const todayRow = isToday(t.date);
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div
      onClick={() => onRowClick(t)}
      className={`grid text-sm border-t dark:border-slate-700 cursor-pointer transition items-center ${
        selected
          ? 'bg-blue-100 dark:bg-blue-900/50 ring-1 ring-[#2D3A8C] ring-inset'
          : highlighted
          ? 'bg-[#FFF3CD] dark:bg-yellow-900/40'
          : todayRow
          ? 'bg-blue-50 dark:bg-blue-900/30'
          : 'hover:bg-slate-50 dark:hover:bg-slate-700'
      }`}
      style={{ gridTemplateColumns: cols }}
    >
      <div className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSetSelect(t.rowNumber, e.target.checked)}
          className="w-4 h-4 cursor-pointer"
        />
      </div>
      <div className="px-2 py-2 whitespace-nowrap num text-center">{formatDateHe(t.date)}</div>
      <div className="px-2 py-2 truncate flex items-center gap-1.5">
        <span className="truncate">{t.category}</span>
        {t.imageUrl && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPreviewOpen(true);
            }}
            className="text-base hover:scale-110 transition flex-shrink-0"
            title="הצג קובץ מצורף"
          >
            📎
          </button>
        )}
      </div>
      <div className="px-2 py-2 text-slate-700 dark:text-slate-300 truncate">{t.description}</div>
      <div className="px-2 py-2 num text-center text-[color:var(--color-income)] font-medium">
        {t.income ? formatShekel(t.income) : ''}
      </div>
      <div className="px-2 py-2 num text-center text-[color:var(--color-expense)] font-medium">
        {t.expense ? formatShekel(t.expense) : ''}
      </div>
      {showBalanceCol && (
        <div
          className="px-2 py-2 num text-center font-bold"
          style={balColor ? { color: balColor.fg } : undefined}
        >
          {balance !== undefined ? formatShekel(balance) : ''}
        </div>
      )}
      <div className="px-2 py-2 text-xs text-slate-600 dark:text-slate-400 text-center">{t.frequency}</div>
      <div className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={t.done || t.status === 'past'}
          disabled={t.status === 'past'}
          onChange={() => onToggleDone(t)}
          className="w-4 h-4 cursor-pointer"
        />
      </div>

      {previewOpen && t.imageUrl && (
        <ImageLightbox
          url={t.imageUrl}
          isPdf={t.imageUrl.toLowerCase().endsWith('.pdf')}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}

function MobileCard({
  t,
  balance,
  onRowClick,
  onToggleDone,
  showBalance,
  selected,
  onSetSelect,
}: {
  t: Transaction;
  balance: number | undefined;
  onRowClick: (t: Transaction) => void;
  onToggleDone: (t: Transaction) => void;
  showBalance: boolean;
  selected: boolean;
  onSetSelect: (rowNumber: number, selected: boolean) => void;
}) {
  const highlighted = isRecentlyUpdated(t.updatedAt);
  const balColor = balance !== undefined ? getBalanceColor(balance) : null;
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div
      onClick={() => onRowClick(t)}
      className={`border-b dark:border-slate-700 px-2 py-1.5 cursor-pointer flex items-center gap-1.5 ${
        selected
          ? 'bg-blue-100 dark:bg-blue-900/50 ring-1 ring-inset ring-[#2D3A8C]'
          : highlighted
          ? 'bg-[#FFF3CD] dark:bg-yellow-900/40'
          : 'bg-white dark:bg-slate-800'
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onSetSelect(t.rowNumber, e.target.checked)}
        className="w-4 h-4 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
        title="בחירה"
      />
      {/* Single horizontal row: date | category | amount | balance | done */}
      <span className="num text-[11px] text-slate-500 dark:text-slate-400 flex-shrink-0 w-[52px] text-center">{formatDateHe(t.date)}</span>
      <span className="text-xs font-medium truncate min-w-0 flex-1 flex items-center gap-0.5">
        {t.category}
        {t.imageUrl && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPreviewOpen(true);
            }}
            className="text-xs"
            title="📎"
          >
            📎
          </button>
        )}
      </span>
      {t.expense ? (
        <span className="num text-[color:var(--color-expense)] font-bold text-xs flex-shrink-0">
          {formatShekel(t.expense)}-
        </span>
      ) : t.income ? (
        <span className="num text-[color:var(--color-income)] font-bold text-xs flex-shrink-0">
          {formatShekel(t.income)}
        </span>
      ) : <span className="flex-shrink-0 w-12" />}
      {showBalance && balance !== undefined && (
        <span
          className="num font-bold text-[11px] flex-shrink-0 w-[60px] text-center"
          style={balColor ? { color: balColor.fg } : undefined}
        >
          {formatShekel(balance)}
        </span>
      )}
      {t.frequency && <span className="text-[10px] text-slate-400 flex-shrink-0">{t.frequency === 'חודשי' ? 'ח' : t.frequency === 'דו-חודשי' ? 'דח' : t.frequency}</span>}
      <label onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
        <input
          type="checkbox"
          checked={t.done || t.status === 'past'}
          disabled={t.status === 'past'}
          onChange={() => onToggleDone(t)}
          className="w-3.5 h-3.5"
        />
      </label>
      {previewOpen && t.imageUrl && (
        <ImageLightbox
          url={t.imageUrl}
          isPdf={t.imageUrl.toLowerCase().endsWith('.pdf')}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
