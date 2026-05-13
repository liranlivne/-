import type { Metadata } from 'next';
import { Heebo } from 'next/font/google';
import './globals.css';

// Only ship the weights actually referenced in the codebase:
//   400 (font-normal) / 500 (font-medium) / 700 (font-bold).
// 300, 600, 800 were loaded but never used — cuts ~3 font files (~80KB).
const heebo = Heebo({
  variable: '--font-heebo',
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: 'תזרים מזומנים | אויר הרים גגות',
  description: 'מערכת לניהול תזרים מזומנים',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Inline script: apply theme BEFORE React hydrates to avoid a flash.
  // Only 'light' or 'dark' are supported. On first visit (no saved value),
  // fall back to the system preference for the initial render.
  const themeScript = `
    (function() {
      try {
        var saved = localStorage.getItem('tzrim-theme');
        var useDark;
        if (saved === 'dark') useDark = true;
        else if (saved === 'light') useDark = false;
        else useDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (useDark) document.documentElement.classList.add('dark');
      } catch (e) {}
    })();
  `;

  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
