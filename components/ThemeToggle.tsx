'use client';

import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const THEME_KEY = 'tzrim-theme';

/** Read the saved theme, or derive an initial value from system preference. */
function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  // No saved value yet — use the system preference as the starting point
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Apply theme by toggling the `dark` class on <html>. */
function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  // On mount: load whatever is saved (or derive from system) and apply it
  useEffect(() => {
    const t = readInitialTheme();
    setTheme(t);
    applyTheme(t);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  };

  return (
    <button
      onClick={toggle}
      className="px-2 py-1.5 rounded hover:bg-white/10 transition text-sm"
      title={theme === 'dark' ? 'עבור למצב בהיר' : 'עבור למצב כהה'}
      aria-label={theme === 'dark' ? 'עבור למצב בהיר' : 'עבור למצב כהה'}
    >
      {theme === 'dark' ? '🌙' : '☀'}
    </button>
  );
}
