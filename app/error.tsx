'use client';

/**
 * Root error boundary — caught by Next.js when any client component below
 * throws during render. Without this, an exception in (say) TransactionsTable
 * would white-screen the entire app. Hebrew copy + a single "טען מחדש"
 * action so the user can recover without browser DevTools.
 *
 * The error object also goes to the console for follow-up. The "digest" is
 * Next's stable hash of the original (sometimes-redacted) production error
 * — including it lets the operator quote it when reporting.
 */

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Tzrim app crashed:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-900">
      <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg shadow-lg max-w-md w-full p-6 text-center">
        <div className="text-5xl mb-3">⚠️</div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          משהו השתבש
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
          אירעה שגיאה בלתי צפויה ביישום. אפשר לנסות לטעון מחדש את האפליקציה —
          הנתונים נשמרים בגיליון ולא יאבדו.
        </p>
        {error.message && (
          <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 rounded p-2 mb-4 text-left dir-ltr break-words font-mono">
            {error.message}
            {error.digest && (
              <div className="mt-1 opacity-60">digest: {error.digest}</div>
            )}
          </div>
        )}
        <div className="flex gap-2 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2 bg-[#2D3A8C] text-white rounded hover:bg-[#1f2a6b] font-medium"
          >
            נסה שוב
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 border dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700 font-medium"
          >
            טען את הדף מחדש
          </button>
        </div>
      </div>
    </div>
  );
}
