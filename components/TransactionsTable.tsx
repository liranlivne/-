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
  selectMode: boolean;
  selectedRows: Set<number>;
  onToggleSelect: (rowNumber: number) => void;
}

export function TransactionsTable({
  pastTransactions,
  futureTransactions,
  runningBalances,
  onRowClick,
  onToggleDone,
  selectMode,
  selectedRows,
  onToggleSelect,
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
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 lg:pr-[304px]">
      {/* Past section header */}
      <div className="mb-2">
        <button
          onClick={() => setShowPast((s) => !s)}
          className="w-full text-right bg-white dark:bg-slate-800 border dark:border-slate-700 rounded px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between"
        >
          <span className="text-sm font-medium">
            {showPast ? '▲ הסתר עבר' : '▼ הצג עבר'}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {pastTransactions.length} רשומות בעבר
          </span>
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
            selectMode={selectMode}
            selectedRows={selectedRows}
            onToggleSelect={onToggleSelect}
          />
        </div>
      )}

      {/* Today divider */}
      <div className="my-4 flex items-center gap-3">
        <div className="flex-1 h-0.5 bg-[#2D3A8C]" />
        <div className="bg-[#2D3A8C] text-white px-4 py-1 rounded-full text-sm font-medium">
          היום — {formattedToday}
        </div>
        <div className="flex-1 h-0.5 bg-[#2D3A8C]" />
      </div>

      {/* Future rows */}
      <TableView
        rows={futureTransactions}
        runningBalances={runningBalances}
        onRowClick={onRowClick}
        onToggleDone={onToggleDone}
        showBalanceCol={true}
        selectMode={selectMode}
        selectedRows={selectedRows}
        onToggleSelect={onToggleSelect}
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
  selectMode,
  selectedRows,
  onToggleSelect,
}: {
  rows: Transaction[];
  runningBalances: Map<number, number>;
  onRowClick: (t: Transaction) => void;
  onToggleDone: (t: Transaction) => void;
  showBalanceCol: boolean;
  selectMode: boolean;
  selectedRows: Set<number>;
  onToggleSelect: (rowNumber: number) => void;
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
          selectMode={selectMode}
          selectedRows={selectedRows}
          onToggleSelect={onToggleSelect}
        />
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {rows.map((t) => (
          <MobileCard
            key={t.rowNumber}
            t={t}
            balance={runningBalances.get(t.rowNumber)}
            onRowClick={onRowClick}
            onToggleDone={onToggleDone}
            showBalance={showBalanceCol}
            selectMode={selectMode}
            selected={selectedRows.has(t.rowNumber)}
            onToggleSelect={onToggleSelect}
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
  selectMode,
  selectedRows,
  onToggleSelect,
}: {
  rows: Transaction[];
  runningBalances: Map<number, number>;
  onRowClick: (t: Transaction) => void;
  onToggleDone: (t: Transaction) => void;
  showBalanceCol: boolean;
  selectMode: boolean;
  selectedRows: Set<number>;
  onToggleSelect: (rowNumber: number) => void;
}) {
  // Grid template columns (visual order in RTL = logical order, since grid respects dir)
  // Order: [select?] date | category | description | income | expense | balance | frequency | done
  const baseCols = showBalanceCol
    ? '95px 140px minmax(120px,1fr) 120px 120px 130px 90px 60px'
    : '95px 140px minmax(120px,1fr) 120px 120px 90px 60px';
  const cols = selectMode ? `40px ${baseCols}` : baseCols;

  return (
    <div>
      {/* Header */}
      <div
        className="grid bg-[#2D3A8C] text-white text-sm font-medium"
        style={{ gridTemplateColumns: cols }}
      >
        {selectMode && (
          <div className="px-2 py-2 text-center">
            <input
              type="checkbox"
              checked={rows.length > 0 && rows.every((r) => selectedRows.has(r.rowNumber))}
              onChange={() => {
                const allSelected = rows.every((r) => selectedRows.has(r.rowNumber));
                for (const r of rows) {
                  if (allSelected) {
                    if (selectedRows.has(r.rowNumber)) onToggleSelect(r.rowNumber);
                  } else {
                    if (!selectedRows.has(r.rowNumber)) onToggleSelect(r.rowNumber);
                  }
                }
              }}
              className="w-4 h-4"
              title="סמן/בטל הכל"
            />
          </div>
        )}
        <div className="px-2 py-2 text-center">תאריך</div>
        <div className="px-2 py-2 text-right">קטגוריה</div>
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
          selectMode={selectMode}
          selected={selectedRows.has(t.rowNumber)}
          onToggleSelect={onToggleSelect}
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
  selectMode,
  selected,
  onToggleSelect,
}: {
  t: Transaction;
  balance: number | undefined;
  onRowClick: (t: Transaction) => void;
  onToggleDone: (t: Transaction) => void;
  showBalanceCol: boolean;
  cols: string;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: (rowNumber: number) => void;
}) {
  const highlighted = isRecentlyUpdated(t.updatedAt);
  const balColor = balance !== undefined ? getBalanceColor(balance) : null;
  const todayRow = isToday(t.date);
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div
      onClick={() => {
        if (selectMode) onToggleSelect(t.rowNumber);
        else onRowClick(t);
      }}
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
      {selectMode && (
        <div className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(t.rowNumber)}
            className="w-4 h-4 cursor-pointer"
          />
        </div>
      )}
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
  selectMode,
  selected,
  onToggleSelect,
}: {
  t: Transaction;
  balance: number | undefined;
  onRowClick: (t: Transaction) => void;
  onToggleDone: (t: Transaction) => void;
  showBalance: boolean;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: (rowNumber: number) => void;
}) {
  const highlighted = isRecentlyUpdated(t.updatedAt);
  const balColor = balance !== undefined ? getBalanceColor(balance) : null;
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div
      onClick={() => {
        if (selectMode) onToggleSelect(t.rowNumber);
        else onRowClick(t);
      }}
      className={`rounded border dark:border-slate-700 p-3 cursor-pointer flex gap-2 ${
        selected
          ? 'bg-blue-100 dark:bg-blue-900/50 ring-2 ring-[#2D3A8C]'
          : highlighted
          ? 'bg-[#FFF3CD] dark:bg-yellow-900/40 border-[#F0A500]'
          : 'bg-white dark:bg-slate-800'
      }`}
    >
      {selectMode && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(t.rowNumber)}
          className="w-5 h-5 mt-1 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-1">
          <div className="font-medium flex items-center gap-1.5">
            {t.category}
            {t.imageUrl && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewOpen(true);
                }}
                className="text-base"
                title="הצג קובץ מצורף"
              >
                📎
              </button>
            )}
          </div>
          <div className="text-xs text-slate-500 num">{formatDateHe(t.date)}</div>
        </div>
        {previewOpen && t.imageUrl && (
          <ImageLightbox
            url={t.imageUrl}
            isPdf={t.imageUrl.toLowerCase().endsWith('.pdf')}
            onClose={() => setPreviewOpen(false)}
          />
        )}
        {t.description && (
          <div className="text-sm text-slate-600 dark:text-slate-300 mb-2">{t.description}</div>
        )}
        <div className="flex justify-between items-center">
          <div className="flex gap-3 text-sm">
            {t.income ? (
              <span className="num text-[color:var(--color-income)] font-medium">
                +{formatShekel(t.income)}
              </span>
            ) : null}
            {t.expense ? (
              <span className="num text-[color:var(--color-expense)] font-medium">
                -{formatShekel(t.expense)}
              </span>
            ) : null}
          </div>
          {showBalance && balance !== undefined && (
            <div
              className="num font-bold text-sm"
              style={balColor ? { color: balColor.fg } : undefined}
            >
              {formatShekel(balance)}
            </div>
          )}
        </div>
        <div className="flex justify-between items-center mt-2 pt-2 border-t text-xs text-slate-500">
          <span>{t.frequency}</span>
          <label onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={t.done || t.status === 'past'}
              disabled={t.status === 'past'}
              onChange={() => onToggleDone(t)}
              className="w-4 h-4"
            />
            בוצע
          </label>
        </div>
      </div>
    </div>
  );
}
