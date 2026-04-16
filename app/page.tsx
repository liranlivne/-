'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SheetSnapshot, Transaction } from '@/lib/types';
import { Header } from '@/components/Header';
import { BalanceBar } from '@/components/BalanceBar';
import { FiltersPanel, emptyFilters, applyFilters, type FiltersState } from '@/components/FiltersPanel';
import { TransactionsTable } from '@/components/TransactionsTable';
import { TransactionModal } from '@/components/TransactionModal';
import { CategoryManager } from '@/components/CategoryManager';
import { ExportButton } from '@/components/ExportButton';
import { ChatPanel } from '@/components/ChatPanel';
import { BankImportModal } from '@/components/BankImportModal';
import { BulkActionBar } from '@/components/BulkActionBar';
import { buildCsv, downloadCsv, defaultCsvFilename, printTransactions } from '@/lib/export';
import {
  fetchSnapshot,
  createTransaction,
  updateTransactionApi,
  deleteTransactionApi,
  markDoneApi,
  updateOpeningBalanceApi,
  replaceCategoriesApi,
} from '@/lib/apiClient';
import { computeRunningBalances } from '@/lib/balance';
import { todayIso, addMonthsIso } from '@/lib/dateUtils';
import {
  pushUndo,
  performUndo,
  performRedo,
  canUndo,
  canRedo,
  peekUndoLabel,
  peekRedoLabel,
  subscribeHistory,
} from '@/lib/undoStack';

const POLL_INTERVAL_MS = 30_000; // 30 seconds

function hasActiveFilter(f: FiltersState): boolean {
  return !!(
    f.dateFrom ||
    f.dateTo ||
    f.category ||
    f.amountMin ||
    f.amountMax ||
    f.text ||
    f.type !== 'all' ||
    f.onlyRecent
  );
}

function describeFilters(f: FiltersState): string {
  if (!hasActiveFilter(f)) return '';
  const parts: string[] = [];
  if (f.dateFrom || f.dateTo) parts.push(`תאריכים: ${f.dateFrom || '...'} עד ${f.dateTo || '...'}`);
  if (f.category) parts.push(`קטגוריה: ${f.category}`);
  if (f.text) parts.push(`חיפוש: "${f.text}"`);
  if (f.amountMin || f.amountMax)
    parts.push(`סכום: ${f.amountMin || '0'}—${f.amountMax || '∞'}`);
  if (f.type === 'income') parts.push('רק הכנסות');
  if (f.type === 'expense') parts.push('רק הוצאות');
  if (f.onlyRecent) parts.push('רק עדכונים אחרונים');
  return 'סינון: ' + parts.join(' | ');
}

export default function HomePage() {
  const [snapshot, setSnapshot] = useState<SheetSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FiltersState>(emptyFilters);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [createAsPast, setCreateAsPast] = useState(false);
  const [bankImportOpen, setBankImportOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [catsOpen, setCatsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [undoVersion, setUndoVersion] = useState(0);

  // Keep latest snapshot in a ref for handlers that don't need to re-render
  const snapshotRef = useRef<SheetSnapshot | null>(null);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  // ---------- Data loading ----------

  const reload = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchSnapshot();
      setSnapshot(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    reload(false);
  }, [reload]);

  // Auto-refresh every 30s. Pause while a modal is open so background
  // refreshes don't disturb the user's typing.
  useEffect(() => {
    if (modalOpen || catsOpen) return;
    const id = setInterval(() => {
      reload(true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [reload, modalOpen, catsOpen]);

  // Re-render when undo/redo stacks change
  useEffect(() => {
    return subscribeHistory(() => setUndoVersion((v) => v + 1));
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const doUndo = useCallback(async () => {
    const snap = snapshotRef.current;
    if (!snap) return;
    try {
      const label = await performUndo(snap.transactions);
      if (label) {
        showToast(`בוטל: ${label}`);
        await reload(true);
      }
    } catch (err) {
      alert('שגיאה בביטול: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, [reload, showToast]);

  const doRedo = useCallback(async () => {
    const snap = snapshotRef.current;
    if (!snap) return;
    try {
      const label = await performRedo(snap.transactions);
      if (label) {
        showToast(`בוצע מחדש: ${label}`);
        await reload(true);
      }
    } catch (err) {
      alert('שגיאה בביצוע מחדש: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, [reload, showToast]);

  // ---------- Ctrl+Z / Ctrl+Y handler ----------

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      const key = e.key.toLowerCase();

      // Ctrl+Z or Cmd+Z = undo
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        doUndo();
        return;
      }

      // Ctrl+Y or Cmd+Shift+Z = redo
      if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        doRedo();
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [doUndo, doRedo]);

  // ---------- Derived state ----------

  const filtered = useMemo(() => {
    if (!snapshot) return { past: [], future: [], runningBalances: new Map<number, number>() };
    const all = applyFilters(snapshot.transactions, filters);
    const past = all
      .filter((t) => t.status === 'past')
      .sort((a, b) => a.date.localeCompare(b.date)); // oldest first, newest at bottom
    const future = all
      .filter((t) => t.status !== 'past')
      .sort((a, b) => a.date.localeCompare(b.date));
    const runningBalances = computeRunningBalances(future, snapshot.openingBalance);
    return { past, future, runningBalances };
  }, [snapshot, filters]);

  const endOfMonthBalance = useMemo(() => {
    if (!snapshot) return undefined;
    const today = todayIso();
    const firstOfNextMonth = addMonthsIso(today.slice(0, 8) + '01', 1);
    const relevant = snapshot.transactions
      .filter((t) => t.status !== 'past' && t.date < firstOfNextMonth)
      .sort((a, b) => a.date.localeCompare(b.date));
    let running = snapshot.openingBalance.balance;
    for (const t of relevant) running += (t.income ?? 0) - (t.expense ?? 0);
    return running;
  }, [snapshot]);

  // ---------- Mutations ----------

  const handleSave = async (data: {
    date: string;
    category: string;
    description: string;
    income: number | null;
    expense: number | null;
    frequency: '' | 'חודשי' | 'דו-חודשי';
  }) => {
    if (editing) {
      const prev = editing;
      const prevStatus = prev.status === 'opening' ? 'future' : prev.status;
      await updateTransactionApi(editing.rowNumber, data);
      pushUndo({
        kind: 'update',
        rowNumber: editing.rowNumber,
        before: {
          date: prev.date,
          category: prev.category,
          description: prev.description,
          income: prev.income,
          expense: prev.expense,
          frequency: prev.frequency,
          done: prev.done,
          status: prevStatus,
        },
        after: {
          date: data.date,
          category: data.category,
          description: data.description,
          income: data.income,
          expense: data.expense,
          frequency: data.frequency,
          done: prev.done,
          status: prevStatus,
        },
        label: `עדכון "${prev.category}"`,
      });
      showToast('התנועה עודכנה');
    } else {
      const res = await createTransaction({
        ...data,
        status: createAsPast ? 'past' : 'future',
      });
      pushUndo({
        kind: 'create',
        createdRowNumber: res.rowNumber,
        data: {
          date: data.date,
          category: data.category,
          description: data.description,
          income: data.income,
          expense: data.expense,
          frequency: data.frequency,
          status: createAsPast ? 'past' : 'future',
        },
        label: createAsPast
          ? `הוספת "${data.category}" לעבר`
          : `הוספת "${data.category}" לתזרים`,
      });
      showToast(createAsPast ? 'התנועה נוספה לעבר' : 'התנועה נוספה לתזרים');
    }
    setModalOpen(false);
    setEditing(null);
    await reload(true);
  };

  const handleDelete = async () => {
    if (!editing) return;
    const prev = editing;
    await deleteTransactionApi(editing.rowNumber);
    pushUndo({
      kind: 'delete',
      originalRowNumber: prev.rowNumber,
      data: {
        date: prev.date,
        category: prev.category,
        description: prev.description,
        income: prev.income,
        expense: prev.expense,
        frequency: prev.frequency,
        status: prev.status === 'opening' ? 'future' : prev.status,
      },
      label: `מחיקת "${prev.category}"`,
    });
    showToast('השורה נמחקה');
    setModalOpen(false);
    setEditing(null);
    await reload(true);
  };

  const handleToggleDone = async (t: Transaction) => {
    if (t.status === 'past') return; // already done
    try {
      const execDate = todayIso();
      const res = await markDoneApi(t.rowNumber, execDate);
      pushUndo({
        kind: 'done',
        rowNumber: t.rowNumber,
        before: {
          date: res.previousState.date,
          status: res.previousState.status as 'future' | 'past',
          done: res.previousState.done,
        },
        executionDate: execDate,
        createdRowNumber: res.createdRowNumber,
        createdData: res.createdRowNumber
          ? {
              date:
                t.frequency === 'חודשי'
                  ? addMonthsIso(t.date, 1)
                  : t.frequency === 'דו-חודשי'
                  ? addMonthsIso(t.date, 2)
                  : t.date,
              category: t.category,
              description: t.description,
              income: t.income,
              expense: t.expense,
              frequency: t.frequency,
            }
          : undefined,
        label: `סימון "${t.category}" כבוצע`,
      });
      showToast('התנועה סומנה כבוצעה');
      await reload(true);
    } catch (err) {
      alert('שגיאה: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleUpdateOpening = async (value: number) => {
    if (!snapshot) return;
    const prevBalance = snapshot.openingBalance.balance;
    await updateOpeningBalanceApi(value);
    pushUndo({
      kind: 'balance',
      before: prevBalance,
      after: value,
      label: 'עדכון יתרת פתיחה',
    });
    showToast('יתרת פתיחה עודכנה');
    await reload(true);
  };

  const handleBulkDelete = async () => {
    if (!snapshot || selectedRows.size === 0) return;
    // Sort rows descending so deleting doesn't shift indexes for subsequent deletes
    const rows = Array.from(selectedRows).sort((a, b) => b - a);
    let successCount = 0;
    for (const row of rows) {
      try {
        await deleteTransactionApi(row);
        successCount++;
      } catch (err) {
        console.error('Failed to delete row', row, err);
      }
    }
    showToast(`נמחקו ${successCount} שורות`);
    setSelectedRows(new Set());
    setSelectMode(false);
    await reload(true);
  };

  const handleBulkChangeCategory = async (newCategory: string) => {
    if (!snapshot || selectedRows.size === 0) return;
    let successCount = 0;
    for (const row of selectedRows) {
      try {
        await updateTransactionApi(row, { category: newCategory });
        successCount++;
      } catch (err) {
        console.error('Failed to update row', row, err);
      }
    }
    showToast(`${successCount} שורות עודכנו לקטגוריה "${newCategory}"`);
    setSelectedRows(new Set());
    setSelectMode(false);
    await reload(true);
  };

  const handleBankImport = async (
    rows: Array<{
      date: string;
      category: string;
      description: string;
      income: number | null;
      expense: number | null;
    }>
  ) => {
    let successCount = 0;
    for (const row of rows) {
      try {
        await createTransaction({
          date: row.date,
          category: row.category,
          description: row.description,
          income: row.income,
          expense: row.expense,
          frequency: '',
          status: 'past',
        });
        successCount++;
      } catch (err) {
        console.error('Failed to import row:', row, err);
      }
    }
    // Note: bulk import is NOT added to undo stack (too complex to reverse safely)
    showToast(`נוספו ${successCount} תנועות לעבר`);
    await reload(true);
  };

  const handleSaveCategories = async (list: string[]) => {
    if (!snapshot) return;
    const prev = snapshot.categories;
    await replaceCategoriesApi(list);
    pushUndo({
      kind: 'categories',
      before: prev,
      after: list,
      label: 'עדכון קטגוריות',
    });
    showToast('הקטגוריות עודכנו');
    await reload(true);
  };

  // ---------- Render ----------

  return (
    <>
        <Header
          onOpenCategories={() => setCatsOpen(true)}
          onRefresh={() => reload(true)}
          lastUpdated={lastUpdated}
          isLoading={refreshing}
        />

        {snapshot && (
          <>
            <BalanceBar
              opening={snapshot.openingBalance}
              endOfPeriodBalance={endOfMonthBalance}
              onUpdateOpening={handleUpdateOpening}
              onAddFuture={() => {
                setEditing(null);
                setCreateAsPast(false);
                setModalOpen(true);
              }}
              onAddPast={() => {
                setEditing(null);
                setCreateAsPast(true);
                setModalOpen(true);
              }}
              onBankImport={() => setBankImportOpen(true)}
            />
            <FiltersPanel
              filters={filters}
              onChange={setFilters}
              categories={snapshot.categories}
              rightSlot={
                <>
                  <button
                    onClick={() => {
                      setSelectMode((prev) => !prev);
                      setSelectedRows(new Set());
                    }}
                    className={`px-3 py-1 text-sm rounded border dark:border-slate-600 ${
                      selectMode
                        ? 'bg-[#F0A500] text-white border-[#F0A500]'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                    title="בחר מספר שורות לביצוע פעולות מרובות"
                  >
                    {selectMode ? '✕ סגור בחירה' : '☑ בחירה מרובה'}
                  </button>
                  <ExportButton
                    hasFilter={hasActiveFilter(filters)}
                    onExportCsv={() => {
                      const csv = buildCsv(
                        filtered.past,
                        filtered.future,
                        filtered.runningBalances,
                        snapshot.openingBalance
                      );
                      downloadCsv(csv, defaultCsvFilename());
                      showToast('הקובץ הורד');
                    }}
                    onPrint={() => {
                      printTransactions(
                        filtered.past,
                        filtered.future,
                        filtered.runningBalances,
                        snapshot.openingBalance,
                        describeFilters(filters)
                      );
                    }}
                  />
                </>
              }
            />
          </>
        )}

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-slate-500">טוען נתונים מגוגל שיטס...</div>
        </div>
      )}

      {error && (
        <div className="max-w-7xl mx-auto w-full px-4 py-3">
          <div className="bg-red-50 border border-red-300 text-red-800 rounded p-3">
            שגיאה: {error}
          </div>
        </div>
      )}

      {snapshot && (
        <TransactionsTable
          pastTransactions={filtered.past}
          futureTransactions={filtered.future}
          runningBalances={filtered.runningBalances}
          onRowClick={(t) => {
            setEditing(t);
            setModalOpen(true);
          }}
          onToggleDone={handleToggleDone}
          selectMode={selectMode}
          selectedRows={selectedRows}
          onToggleSelect={(rowNumber) => {
            setSelectedRows((prev) => {
              const next = new Set(prev);
              if (next.has(rowNumber)) next.delete(rowNumber);
              else next.add(rowNumber);
              return next;
            });
          }}
        />
      )}

      {/* Undo / Redo indicators */}
      {(canUndo() || canRedo()) && (
        <div className="fixed bottom-4 left-4 z-40 flex gap-2">
          {canUndo() && (
            <button
              onClick={doUndo}
              className="bg-slate-800 text-white px-3 py-2 rounded-full shadow-lg hover:bg-slate-900 text-sm flex items-center gap-2"
              title="Ctrl+Z"
            >
              ↶ בטל: {peekUndoLabel()}
              <span className="text-xs opacity-60">Ctrl+Z</span>
            </button>
          )}
          {canRedo() && (
            <button
              onClick={doRedo}
              className="bg-[#F0A500] text-white px-3 py-2 rounded-full shadow-lg hover:bg-[#d49300] text-sm flex items-center gap-2"
              title="Ctrl+Y"
            >
              ↷ בצע מחדש: {peekRedoLabel()}
              <span className="text-xs opacity-60">Ctrl+Y</span>
            </button>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* Modals */}
      {snapshot && (
        <>
          <TransactionModal
            mode={editing ? 'edit' : 'create'}
            open={modalOpen}
            initial={editing}
            categories={snapshot.categories}
            createContext={editing ? undefined : createAsPast ? 'past' : 'future'}
            onClose={() => {
              setModalOpen(false);
              setEditing(null);
            }}
            onSave={handleSave}
            onDelete={editing ? handleDelete : undefined}
          />
          <CategoryManager
            open={catsOpen}
            categories={snapshot.categories}
            onClose={() => setCatsOpen(false)}
            onSave={handleSaveCategories}
          />
          <BankImportModal
            open={bankImportOpen}
            categories={snapshot.categories}
            existingTransactions={snapshot.transactions}
            onClose={() => setBankImportOpen(false)}
            onImport={handleBankImport}
          />
        </>
      )}

      {/* Bulk actions bar */}
      {selectMode && snapshot && (
        <BulkActionBar
          count={selectedRows.size}
          categories={snapshot.categories}
          onCancel={() => {
            setSelectMode(false);
            setSelectedRows(new Set());
          }}
          onDelete={handleBulkDelete}
          onChangeCategory={handleBulkChangeCategory}
        />
      )}

      {/* Chat panel (floating) */}
      <ChatPanel />

      <span hidden>{undoVersion}</span>
    </>
  );
}
