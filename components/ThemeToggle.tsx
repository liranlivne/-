'use client';

import { useEffect, useRef, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';
const THEME_KEY = 'tzrim-theme';

/** Read the saved theme from localStorage (or 'system' by default). */
function readSavedTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  return 'system';
}

/** Apply a theme to <html> by toggling the `dark` class. */
function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const shouldBeDark = theme === 'dark' || (theme === 'system' && systemDark);
  root.classList.toggle('dark', shouldBeDark);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Load saved theme on mount and apply it
  useEffect(() => {
    const saved = readSavedTheme();
    setTheme(saved);
    applyTheme(saved);
  }, []);

  // Re-apply when system pref changes (only if theme=system)
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  // Close menu on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const choose = (t: Theme) => {
    setTheme(t);
    localStorage.setItem(THEME_KEY, t);
    applyTheme(t);
    setOpen(false);
  };

  const label = theme === 'dark' ? '🌙' : theme === 'light' ? '☀' : '🖥';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-2 py-1.5 rounded hover:bg-white/10 transition text-sm"
        title="ערכת נושא"
      >
        {label}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 end-0 bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100 border dark:border-slate-700 rounded shadow-lg min-w-[160px] overflow-hidden">
          <MenuItem
            active={theme === 'light'}
            onClick={() => choose('light')}
            icon="☀"
            label="בהיר"
          />
          <MenuItem
            active={theme === 'dark'}
            onClick={() => choose('dark')}
            icon="🌙"
            label="כהה"
          />
          <MenuItem
            active={theme === 'system'}
            onClick={() => choose('system')}
            icon="🖥"
            label="ברירת מחדל של המערכת"
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-right px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm flex items-center gap-2 ${
        active ? 'font-bold' : ''
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
      {active && <span className="ms-auto text-xs text-green-600 dark:text-green-400">✓</span>}
    </button>
  );
}
