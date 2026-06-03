'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SheetSnapshot, Transaction } from '@/lib/types';
import { Header } from '@/components/Header';
import { FiltersPanel, emptyFilters, applyFilters, type FiltersState } from '@/components/FiltersPanel';
import { TransactionsTable, TODAY_DIVIDER_ID } from '@/components/TransactionsTable';
import { TransactionModal } from '@/components/TransactionModal';
import { CategoryManager } from '@/components/CategoryManager';
import { ExportButton } from '@/components/ExportButton';
import { ChatPanel } from '@/components/ChatPanel';
import { BankImportModal } from '@/components/BankImportModal';
import { SalaryImportModal } from '@/components/SalaryImportModal';
import { SplitTransactionModal, type SplitBucketSpec } from '@/components/SplitTransactionModal';
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
import { todayIso, addMonthsIso, formatDateHe } from '@/lib/dateUtils';
import { statusAfterDateChange } from '@/lib/transactionStatus';
import { isAwaitingMorning } from '@/lib/invoices';
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
    f.onlyRecent ||
    f.onlyMissingInvoice
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
  if (f.onlyMissingInvoice) parts.push('רק חשבונית חסרה');
  return 'סינון: ' + parts.join(' | ');
}

export default function HomePage() {
  const [snapshot, setSnapshot] = useState<SheetSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FiltersState>(emptyFilters);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [createAsPast, setCreateAsPast] = useState(false);
  const [bankImportOpen, setBankImportOpen] = useState(false);
  const [salaryImportOpen, setSalaryImportOpen] = useState(false);
  const [sendingToMorning, setSendingToMorning] = useState(false);
  // Rows whose files were just handed to WhatsApp, awaiting the user's
  // "yes I sent them" confirmation before flipping orange → green.
  const [morningConfirm, setMorningConfirm] = useState<Transaction[] | null>(null);
  const [splittingRow, setSplittingRow] = useState<Transaction | null>(null);
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
    if (!background) setLoading(true);
    setError(null);
    try {
      const data = await fetchSnapshot();
      setSnapshot(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload(false);
  }, [reload]);

  // Auto-refresh every 30s. Pause while a modal is open so background
  // refreshes don't disturb the user's typing.
  useEffect(() => {
    if (
      modalOpen ||
      catsOpen ||
      bankImportOpen ||
      salaryImportOpen ||
      splittingRow
    )
      return;
    const id = setInterval(() => {
      reload(true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [reload, modalOpen, catsOpen, bankImportOpen, salaryImportOpen, splittingRow]);

  // Re-render when undo/redo stacks change
  useEffect(() => {
    return subscribeHistory(() => setUndoVersion((v) => v + 1));
  }, []);

  // Default-position view: the "היום" divider sits at vertical center of the
  // viewport, so past is above and future is below in equal halves.
  //
  // Implementation note: we use window.scrollTo with an explicit computed
  // target instead of element.scrollIntoView({block:'center'}). The latter
  // silently no-ops in some Next.js conditions on initial load (likely
  // racing with the framework's scroll-restoration), even when called from
  // a click handler. The explicit math is bulletproof.
  const handleAddFuture = useCallback(() => {
    setEditing(null);
    setCreateAsPast(false);
    setModalOpen(true);
  }, []);

  const handleAddPast = useCallback(() => {
    setEditing(null);
    setCreateAsPast(true);
    setModalOpen(true);
  }, []);

  const scrollDividerToCenter = useCallback(() => {
    const el = document.getElementById(TODAY_DIVIDER_ID);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const target = r.top + window.scrollY - (window.innerHeight - r.height) / 2;
    // Always instant — smooth scroll silently no-ops in some browser
    // configurations (prefers-reduced-motion, embedded WebViews) and the
    // jarring snap is preferable to "nothing happened" on the button click.
    window.scrollTo({ top: Math.max(0, target), behavior: 'auto' });
  }, []);

  // Fires once on first snapshot arrival. Retries for ~1s because past can
  // be hundreds of rows — first paint may run before the row reflow has
  // settled or before Next.js's own scroll restoration has reset to (0,0).
  const hasCenteredOnLoadRef = useRef(false);
  useEffect(() => {
    if (!snapshot || hasCenteredOnLoadRef.current) return;
    hasCenteredOnLoadRef.current = true;
    let tries = 0;
    const tick = () => {
      const el = document.getElementById(TODAY_DIVIDER_ID);
      if (el) {
        const r = el.getBoundingClientRect();
        const target = r.top + window.scrollY - (window.innerHeight - r.height) / 2;
        const isCentered = Math.abs(window.scrollY - target) < 50;
        if (isCentered) return;
        window.scrollTo({ top: Math.max(0, target), behavior: 'auto' });
      }
      if (++tries < 10) setTimeout(tick, 150);
    };
    // First attempt deferred 200ms to let Next.js's scroll-restoration finish.
    setTimeout(tick, 200);
  }, [snapshot]);

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

  // ---------- ESC key + mobile back-button: close one layer at a time ----------
  // Priority (top → bottom = handled first):
  //   1. Bank-import modal
  //   2. Salary-import modal
  //   3. Category-manager modal
  //   4. Transaction edit/create modal
  //   5. Active multi-row selection (clears the selection)
  // The chat panel handles its own ESC inside ChatPanel.tsx. The handler stops
  // propagation when it consumes the event so chat doesn't ALSO close.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (bankImportOpen) {
        e.stopImmediatePropagation();
        e.preventDefault();
        setBankImportOpen(false);
        return;
      }
      if (salaryImportOpen) {
        e.stopImmediatePropagation();
        e.preventDefault();
        setSalaryImportOpen(false);
        return;
      }
      if (splittingRow) {
        e.stopImmediatePropagation();
        e.preventDefault();
        setSplittingRow(null);
        return;
      }
      if (catsOpen) {
        e.stopImmediatePropagation();
        e.preventDefault();
        setCatsOpen(false);
        return;
      }
      if (modalOpen) {
        e.stopImmediatePropagation();
        e.preventDefault();
        setModalOpen(false);
        setEditing(null);
        return;
      }
      if (selectedRows.size > 0) {
        e.stopImmediatePropagation();
        e.preventDefault();
        setSelectedRows(new Set());
        return;
      }
      // Otherwise: let other listeners handle it (e.g., chat panel)
    };
    // capture=true so we run before any window-level listener registered later
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [bankImportOpen, salaryImportOpen, splittingRow, catsOpen, modalOpen, selectedRows]);

  // Mobile back-button: each open overlay pushes a history entry. Pressing
  // "back" pops it and closes that overlay only — without leaving the app.
  //
  // Deps are intentionally `[anyOverlayOpen]` — a *boolean*, not the full
  // state objects. Re-running this effect on every selectedRows change would
  // make the cleanup fire `window.history.back()` mid-selection, which itself
  // triggers popstate and clears the selection. The onPop handler reads from
  // a ref so it always sees current state without re-subscribing.
  const overlayStateRef = useRef({
    bankImportOpen,
    salaryImportOpen,
    splittingRow,
    catsOpen,
    modalOpen,
    selectedRows,
  });
  overlayStateRef.current = {
    bankImportOpen,
    salaryImportOpen,
    splittingRow,
    catsOpen,
    modalOpen,
    selectedRows,
  };
  const anyOverlayOpen =
    bankImportOpen ||
    salaryImportOpen ||
    !!splittingRow ||
    catsOpen ||
    modalOpen ||
    selectedRows.size > 0;
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!anyOverlayOpen) return;
    window.history.pushState({ overlay: true }, '');
    const onPop = () => {
      const s = overlayStateRef.current;
      if (s.bankImportOpen) setBankImportOpen(false);
      else if (s.salaryImportOpen) setSalaryImportOpen(false);
      else if (s.splittingRow) setSplittingRow(null);
      else if (s.catsOpen) setCatsOpen(false);
      else if (s.modalOpen) {
        setModalOpen(false);
        setEditing(null);
      } else if (s.selectedRows.size > 0) {
        setSelectedRows(new Set());
      }
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (window.history.state?.overlay) {
        window.history.back();
      }
    };
  }, [anyOverlayOpen]);

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

  // Invoices attached but not yet sent to Morning (the orange ones).
  const morningQueue = useMemo(
    () => (snapshot ? snapshot.transactions.filter(isAwaitingMorning) : []),
    [snapshot]
  );

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

      const {
        status: nextStatus,
        done: nextDone,
        flippedToFuture: movingPastToFuture,
      } = statusAfterDateChange(prevStatus, prev.done, data.date);

      await updateTransactionApi(editing.rowNumber, {
        ...data,
        status: nextStatus,
        done: nextDone,
      });
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
          done: nextDone,
          status: nextStatus,
        },
        label: movingPastToFuture
          ? `החזרת "${prev.category}" לתזרים`
          : `עדכון "${prev.category}"`,
      });
      showToast(movingPastToFuture ? 'התנועה הוחזרה לתזרים' : 'התנועה עודכנה');
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

  /** Move a past row back to תזרים (fix a mistaken "בוצע" mark). */
  const handleRestoreToFuture = async () => {
    if (!editing) return;
    const prev = editing;
    await updateTransactionApi(editing.rowNumber, {
      status: 'future',
      done: false,
    });
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
        status: 'past',
      },
      after: {
        date: prev.date,
        category: prev.category,
        description: prev.description,
        income: prev.income,
        expense: prev.expense,
        frequency: prev.frequency,
        done: false,
        status: 'future',
      },
      label: `החזרת "${prev.category}" לתזרים`,
    });
    showToast('התנועה הוחזרה לתזרים');
    setModalOpen(false);
    setEditing(null);
    await reload(true);
  };

  /** Duplicate the currently-edited row into a new row with the same fields. */
  const handleDuplicate = async () => {
    if (!editing) return;
    const src = editing;
    const targetStatus: 'future' | 'past' = src.status === 'past' ? 'past' : 'future';
    const res = await createTransaction({
      date: src.date,
      category: src.category,
      description: src.description,
      income: src.income,
      expense: src.expense,
      frequency: src.frequency,
      status: targetStatus,
      imageUrl: src.imageUrl,
    });
    pushUndo({
      kind: 'create',
      createdRowNumber: res.rowNumber,
      data: {
        date: src.date,
        category: src.category,
        description: src.description,
        income: src.income,
        expense: src.expense,
        frequency: src.frequency,
        status: targetStatus,
      },
      label: `שכפול "${src.category}"`,
    });
    showToast('השורה שוכפלה');
    setModalOpen(false);
    setEditing(null);
    await reload(true);
  };

  /**
   * Open the split modal for the currently-edited row. Closes TransactionModal
   * so the user lands on the split UI cleanly. The actual mutations happen in
   * `executeSplit` once the user confirms.
   */
  const handleOpenSplit = () => {
    if (!editing) return;
    if (editing.status === 'past') {
      alert('שורה שכבר בעבר - לא ניתן לפצל.');
      return;
    }
    const total =
      editing.income !== null && editing.income > 0
        ? editing.income
        : editing.expense ?? 0;
    if (!total || total <= 0) {
      alert('אין סכום בשורה. עדכן הכנסה או הוצאה לפני פיצול.');
      return;
    }
    setSplittingRow(editing);
    setModalOpen(false);
    setEditing(null);
  };

  /**
   * Apply a multi-bucket split. Strategy: update the source row in place to
   * bucket[0] (preserves its rowNumber + attached image), then create new
   * rows for buckets 1..N. Each bucket can be marked `paid` — paid buckets
   * land in past (status='past'), un-paid buckets stay in תזרים (future).
   * No undo entry (multi-step; user can fix by editing rows manually).
   */
  const executeSplit = async (buckets: SplitBucketSpec[]) => {
    if (!splittingRow) return;
    const src = splittingRow;
    const isIncome = src.income !== null && src.income > 0;
    const total = isIncome ? src.income! : src.expense ?? 0;
    const sum = buckets.reduce((s, b) => s + b.amount, 0);
    if (Math.abs(sum - total) > 0.5) {
      throw new Error(`סך הסכומים (${sum}) לא תואם לסה"כ השורה (${total}).`);
    }

    const [first, ...rest] = buckets;

    // 1. Mutate the source row into bucket[0]
    await updateTransactionApi(src.rowNumber, {
      date: first.date,
      income: isIncome ? first.amount : null,
      expense: isIncome ? null : first.amount,
      status: first.paid ? 'past' : 'future',
      done: first.paid,
    });

    // 2. Create new rows for the rest. Sequential — Google Sheets append
    // can race when fired in parallel; the latency cost (a few hundred ms)
    // is acceptable for the small bucket counts this UI generates.
    for (const b of rest) {
      await createTransaction({
        date: b.date,
        category: src.category,
        description: src.description,
        income: isIncome ? b.amount : null,
        expense: isIncome ? null : b.amount,
        frequency: '',
        status: b.paid ? 'past' : 'future',
        imageUrl: null,
      });
    }

    const paidCount = buckets.filter((b) => b.paid).length;
    showToast(
      paidCount > 0
        ? `פוצל ל-${buckets.length} שורות, ${paidCount} בעבר`
        : `פוצל ל-${buckets.length} שורות`
    );
    setSplittingRow(null);
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
    await reload(true);
  };

  const handleBulkChangeDate = async (newDate: string) => {
    if (!snapshot || selectedRows.size === 0) return;
    let successCount = 0;
    for (const row of selectedRows) {
      try {
        const tx = snapshot.transactions.find((t) => t.rowNumber === row);
        const prevStatus = tx?.status === 'past' ? 'past' : 'future';
        const { status, done, flippedToFuture } = statusAfterDateChange(
          prevStatus,
          tx?.done ?? false,
          newDate
        );
        if (flippedToFuture) {
          // Only past→future flip needs to overwrite status/done; otherwise
          // leave them as-is to avoid wiping a manually-flipped "done".
          await updateTransactionApi(row, { date: newDate, status, done });
        } else {
          await updateTransactionApi(row, { date: newDate });
        }
        successCount++;
      } catch (err) {
        console.error('Failed to update row', row, err);
      }
    }
    showToast(`${successCount} שורות הועברו לתאריך ${formatDateHe(newDate)}`);
    setSelectedRows(new Set());
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

  /**
   * Salary-import flow: every approved employee → one row in תזרים, dated
   * today (the moment the import button was clicked), category "שכר עובדים",
   * description = employee name, expense = net pay. status='future' so the
   * row appears in the cash flow until marked "בוצע" when actually paid.
   */
  const handleSalaryImport = async (
    rows: Array<{ name: string; net_pay: number }>
  ): Promise<{ successCount: number; failedCount: number }> => {
    const today = todayIso();
    let successCount = 0;
    let failedCount = 0;
    for (const row of rows) {
      try {
        await createTransaction({
          date: today,
          category: 'שכר עובדים',
          description: row.name,
          income: null,
          expense: row.net_pay,
          frequency: '',
          status: 'future',
        });
        successCount++;
      } catch (err) {
        console.error('Failed to import salary row:', row, err);
        failedCount++;
      }
    }
    if (successCount > 0) {
      showToast(`נוספו ${successCount} משכורות לתזרים`);
    }
    await reload(true);
    return { successCount, failedCount };
  };

  /**
   * Send-to-Morning flow. Gathers every attached-but-not-sent invoice file,
   * then either shares them (mobile → WhatsApp) or downloads them + opens
   * WhatsApp Web on the Morning chat (desktop — the main case here). It does
   * NOT mark anything sent itself: a non-blocking confirmation banner
   * (morningConfirm) appears so the user can finish the WhatsApp send at their
   * own pace, then confirm — keeping the "marked-but-forgot" guard intact.
   *
   * WhatsApp can't be opened with both a recipient AND pre-attached files, so
   * on desktop the drag-drop into the chat is the one manual step.
   */
  const handleSendToMorning = async () => {
    if (!snapshot) return;
    const queue = snapshot.transactions.filter(isAwaitingMorning);
    if (queue.length === 0) {
      showToast('אין חשבוניות חדשות לשליחה למורנינג');
      return;
    }
    setSendingToMorning(true);
    try {
      // 1. Pull each invoice file through our same-origin proxy → File objects.
      const files: File[] = [];
      for (const t of queue) {
        if (!t.imageUrl) continue;
        try {
          const res = await fetch(`/api/file-proxy?url=${encodeURIComponent(t.imageUrl)}`);
          if (!res.ok) continue;
          const blob = await res.blob();
          const isPdf = t.imageUrl.toLowerCase().endsWith('.pdf');
          const ext = isPdf ? 'pdf' : (blob.type.split('/')[1] || 'jpg');
          const base = `${t.category}-${formatDateHe(t.date)}`.replace(/[\\/:*?"<>|]+/g, '_');
          files.push(new File([blob], `${base}.${ext}`, { type: blob.type }));
        } catch {
          /* skip a file we couldn't fetch; it'll just stay orange */
        }
      }

      // 2. Mobile: OS share sheet (files attached). Desktop: download the files
      //    and open WhatsApp Web on the Morning chat for drag-drop.
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      const canShareFiles =
        typeof nav.canShare === 'function' && files.length > 0 && nav.canShare({ files });

      if (canShareFiles) {
        try {
          await nav.share({ files, title: 'חשבוניות למורנינג' });
        } catch (err) {
          // User dismissed the share sheet → they didn't send; abort quietly.
          if ((err as Error)?.name === 'AbortError') {
            setSendingToMorning(false);
            return;
          }
          throw err;
        }
      } else {
        for (const f of files) {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(f);
          a.download = f.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
        // Open the Morning chat in the installed WhatsApp (Business) desktop
        // app via the whatsapp:// protocol — not web.whatsapp.com — since the
        // owner sends from WhatsApp Business Desktop.
        const wa = document.createElement('a');
        wa.href = 'whatsapp://send?phone=972506560837';
        document.body.appendChild(wa);
        wa.click();
        wa.remove();
      }

      // 3. Hand off to the non-blocking confirm banner (don't mark sent yet).
      setMorningConfirm(queue);
    } catch (err) {
      alert('שגיאה בשליחה למורנינג: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSendingToMorning(false);
    }
  };

  /** Confirm-banner action: mark the queued rows as sent to Morning. */
  const confirmMorningSent = async () => {
    const queue = morningConfirm;
    if (!queue) return;
    setMorningConfirm(null);
    let done = 0;
    for (const t of queue) {
      try {
        await updateTransactionApi(t.rowNumber, { morningSent: true });
        done++;
      } catch (err) {
        console.error('Failed to mark sent:', t.rowNumber, err);
      }
    }
    showToast(`${done} חשבוניות סומנו כנשלחו למורנינג ✓`);
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
        {snapshot && (
          <Header
            balanceUpdatedAt={snapshot.openingBalance.updatedAt}
            opening={snapshot.openingBalance}
            endOfPeriodBalance={endOfMonthBalance}
            onUpdateOpening={handleUpdateOpening}
            onBankImport={() => setBankImportOpen(true)}
            onSalaryImport={() => setSalaryImportOpen(true)}
            morningPendingCount={morningQueue.length}
            morningBusy={sendingToMorning}
            onSendToMorning={handleSendToMorning}
          />
        )}

        {snapshot && (
          <>
            <FiltersPanel
              filters={filters}
              onChange={setFilters}
              categories={snapshot.categories}
              onOpenCategories={() => setCatsOpen(true)}
              rightSlot={
                <>
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
          selectedRows={selectedRows}
          onSetSelect={(rowNumber, selected) => {
            // Idempotent — required because React Strict Mode invokes
            // setState updaters twice in dev, and a non-idempotent toggle
            // would cancel itself out on the second invocation.
            setSelectedRows((prev) => {
              if (selected === prev.has(rowNumber)) return prev;
              const next = new Set(prev);
              if (selected) next.add(rowNumber);
              else next.delete(rowNumber);
              return next;
            });
          }}
          onOpenCategories={() => setCatsOpen(true)}
        />
      )}

      {/* Left-middle floating quick-nav cluster.
          - עבר / עתיד = yellow (matches the import-from-bank button); they
            are the "add" actions that benefit from visual prominence.
          - אמצע = blue, secondary navigation action.
          - On mobile: narrower (px-1.5) + taller (py-4) so the cluster
            occupies a thin vertical strip rather than a chunky block.
          - On desktop: nudged a bit inward (left-6) so it hugs the table
            rather than the screen edge. */}
      <div className="fixed top-1/2 left-2 sm:left-20 -translate-y-1/2 z-40 flex flex-col gap-4 items-stretch">
        <button
          onClick={handleAddPast}
          className="bg-[#F0A500]/95 text-white px-1.5 py-4 sm:px-3 sm:py-2.5 rounded-full shadow text-[11px] sm:text-xs font-medium hover:bg-[#d49300] whitespace-nowrap"
          title="הוסף תנועה לעבר"
        >
          + עבר
        </button>
        <button
          onClick={scrollDividerToCenter}
          className="bg-[#2D3A8C]/95 text-white px-1.5 py-4 sm:px-3 sm:py-2.5 rounded-full shadow text-[11px] sm:text-xs font-medium hover:bg-[#1f2a6b] whitespace-nowrap"
          title="הצג את קו 'היום' במרכז המסך — חזור למצב ברירת המחדל"
        >
          ↕ אמצע
        </button>
        <button
          onClick={handleAddFuture}
          className="bg-[#F0A500]/95 text-white px-1.5 py-4 sm:px-3 sm:py-2.5 rounded-full shadow text-[11px] sm:text-xs font-medium hover:bg-[#d49300] whitespace-nowrap"
          title="הוסף תנועה לתזרים"
        >
          + עתיד
        </button>
      </div>

      {/* Bottom-left floating cluster: undo / redo only.
          The "↕ אמצע" button moved to the top-center cluster above. */}
      {(canUndo() || canRedo()) && (
        <div className="fixed bottom-4 left-4 z-40 flex gap-2 items-end flex-wrap">
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
            onRestoreToFuture={
              editing && editing.status === 'past' ? handleRestoreToFuture : undefined
            }
            onDuplicate={editing ? handleDuplicate : undefined}
            onOpenSplit={
              editing && editing.status !== 'past' ? handleOpenSplit : undefined
            }
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
          <SalaryImportModal
            open={salaryImportOpen}
            onClose={() => setSalaryImportOpen(false)}
            onImport={handleSalaryImport}
          />
          <SplitTransactionModal
            open={!!splittingRow}
            source={splittingRow}
            onClose={() => setSplittingRow(null)}
            onConfirm={executeSplit}
          />
        </>
      )}

      {/* Send-to-Morning confirmation banner. Non-blocking: it sits over the
          page while the user finishes the WhatsApp send, then they confirm. */}
      {morningConfirm && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setMorningConfirm(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-orange-500 text-white px-4 py-3 rounded-t-lg font-bold text-lg">
              📤 שליחה למורנינג
            </div>
            <div className="p-5 space-y-3 text-sm">
              <p>
                הקבצים של <b>{morningConfirm.length}</b> חשבוניות הורדו / שותפו.
                גרור אותם לצ׳אט של מורנינג בוואטסאפ ולחץ שלח.
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                <b>רק לירן</b> שולח למורנינג. אחרי שהשלמת את השליחה — לחץ
                &quot;נשלחו&quot; כדי לסמן אותן ירוק. אם עדיין לא שלחת, סגור
                והן יישארו כתומות.
              </p>
            </div>
            <div className="border-t dark:border-slate-700 p-4 flex justify-between gap-2">
              <button
                onClick={() => setMorningConfirm(null)}
                className="px-4 py-2 border dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                עדיין לא
              </button>
              <button
                onClick={confirmMorningSent}
                className="px-5 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium"
              >
                ✓ נשלחו — סמן ירוק ({morningConfirm.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk actions bar — appears when at least one row is selected */}
      {selectedRows.size > 0 && snapshot && (
        <BulkActionBar
          count={selectedRows.size}
          categories={snapshot.categories}
          onCancel={() => setSelectedRows(new Set())}
          onDelete={handleBulkDelete}
          onChangeCategory={handleBulkChangeCategory}
          onChangeDate={handleBulkChangeDate}
        />
      )}

      {/* Chat panel (floating) */}
      <ChatPanel />

      <span hidden>{undoVersion}</span>
    </>
  );
}
