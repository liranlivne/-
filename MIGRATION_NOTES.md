# Migration notes — porting tzrim-app into the big CRM

> **For the Claude Code session that ports this app into the CRM (air-harim / synap)
> as one of its screens.** Read this first. The goal is a faithful port of the
> cash-flow screen onto the CRM's own data layer (Postgres/Supabase), not a
> rewrite. Behavior must match — the owner uses this daily.

---

## What this app is

A Hebrew, RTL cash-flow ("תזרים") manager for "אויר הרים גגות": one scrollable
screen of income/expense rows split at a **"היום" divider** (past above, future
below), with running balances, inline editing, undo/redo, bank-statement import
(Claude vision), salary-slip PDF import (Claude), an internal chat, and
**supplier-invoice tracking → sending to Morning (מורנינג)**.

Standalone today: Next.js 16 + React 19, **Google Sheets as the DB**, Vercel
Blob for attached files, Anthropic API for the import features. Lives at
`tazrimdom.vercel.app` (Vercel project `-tazrim`). Manual deploy only
(`vercel --prod` + `vercel alias`); GitHub auto-deploy does NOT fire.

---

## Data model (Google Sheet "תזרים", columns A–L)

| Col | Index | Field | Notes |
|-----|-------|-------|-------|
| A | 0 | date | stored D/M/YY; ISO internally |
| B | 1 | category | free text; must match category list for some logic |
| C | 2 | description | the "notes" column |
| D | 3 | income | number or '' |
| E | 4 | expense | number or '' |
| F | 5 | balance | NOT stored as source of truth — computed client-side |
| G | 6 | frequency | '' / 'חודשי' / 'דו-חודשי' |
| H | 7 | done | bool |
| I | 8 | updatedAt | ISO timestamp |
| J | 9 | status | 'past' (עבר) / 'future' (עתיד) / 'opening' (פתיחה) |
| K | 10 | imageUrl | attached file (invoice) — Vercel Blob URL |
| **L** | **11** | **morningSent** | **bool — invoice sent to Morning. ADDED 2026-06 for invoice tracking. The CRM port MUST add an equivalent column/field.** |

Row 1 = headers, row 2 = opening balance, rows 3+ = transactions. The
`Transaction` type is in `lib/types.ts`.

---

## What ports cleanly (pure, UI-free — copy almost as-is)

- **`lib/invoices.ts`** — the whole supplier-invoice model. See "Invoice feature"
  below. Pure functions over `Transaction`.
- **`lib/transactionStatus.ts`** — `statusAfterDateChange()`: past row moved to a
  date strictly after today flips back to future. Boundary is `>`, NOT `>=`
  (a past row dated *today* stays past — this was a real bug).
- **`lib/dateUtils.ts`**, **`lib/balance.ts`**, **`lib/highlight.ts`** — date
  conversion, running-balance computation, "recently updated" 24h highlight.
- **`components/*`** — TransactionsTable (desktop grid + mobile cards),
  TransactionModal, SplitTransactionModal, FiltersPanel, BalanceBar, Header,
  BankImportModal, SalaryImportModal, ChatPanel, ImageUploader. Presentational;
  they take data + callbacks. Rebind callbacks to the CRM's actions.

## What must be re-implemented on the CRM backend

- **`lib/sheets.ts`** — the entire Google Sheets read/write layer. Replace with
  the CRM's data source (Supabase). Map columns A–L to fields, including the new
  **`morningSent`**. Keep the API shape (`readSnapshot`, `appendTransaction`,
  `updateTransaction`, `deleteRow`, `updateOpeningBalance`).
- **`app/api/*`** routes — `/api/sheet`, `/api/transactions[...]`,
  `/api/bank-import`, `/api/salary-import`, `/api/upload`, `/api/chat`,
  `/api/file-proxy`. Re-point to CRM equivalents. The PUT route does
  read-modify-write to preserve unsent fields (imageUrl, morningSent) — preserve
  that pattern or use real column-level updates.
- **`lib/apiClient.ts`** — thin fetch wrappers; adjust endpoints.
- **File storage** — invoices live in **Vercel Blob** on the tzrim project. If the
  CRM uses different storage, historical invoice files need migration or
  cross-project access. `/api/file-proxy` streams blobs same-origin (CORS) for
  the WhatsApp Web Share — keep an equivalent if you keep the Morning send.

---

## Invoice tracking → Morning (the newest, least-obvious feature)

Owner's goal: every expense's supplier invoice ends up in **Morning** (greeninvoice).
Per-row state from `lib/invoices.ts::invoiceState(t)`:

| State | Color | Condition |
|-------|-------|-----------|
| `missing` | 🔴 | paid (past) expense, in scope, **no file** → get the invoice |
| `attachedNotSent` | 🟠 | file attached, **morningSent=false** → send to Morning |
| `sent` | 🟢 | file attached, **morningSent=true** → done |
| `neutral` | ⚪ | future expense, in scope, no file → hint only |
| `none` | — | income / exempt category / before cutoff |

- **Exempt categories** (`INVOICE_EXEMPT_CATEGORIES`, never tracked): שכר עובדים,
  לא ידוע בינתיים, הלוואה, ביטוח לאומי, מס הכנסה, הו"ק, הפרשות, ביטוח,
  כרטיס אשראי, מע"מ.
- **Cutoff** `INVOICE_TRACKING_START = '2026-06-01'` — earlier rows never turn
  red OR orange (back-catalog isn't chased). Gates both colors.
- **Filter** `onlyMissingInvoice` in FiltersPanel shows the 🔴 rows.
- **Send-to-Morning button** (Header, shown only when ≥1 orange): gathers the
  orange invoice files, then:
  - mobile → `navigator.share({files})` (OS share sheet → WhatsApp → Morning contact)
  - desktop → downloads the files + opens the Morning chat in **WhatsApp Business
    Desktop** via `whatsapp://send?phone=972506560837` (owner uses Business
    Desktop; do NOT use web.whatsapp.com). User drags files in, sends.
  - then a **non-blocking confirm banner** ("✓ נשלחו — סמן ירוק") marks rows
    `morningSent=true`. WhatsApp can't pre-fill recipient AND files, and the OS
    can't know the user actually pressed send — hence the manual confirm. Identity
    gate "רק לירן" (only Liran is recognized at Morning; the app has no real auth).
  - Morning WhatsApp number: **+972 50-656-0837**.

---

## Gotchas / invariants (don't regress these)

- **Balance is computed, never stored** (`lib/balance.ts`). Column F is ignored on read.
- **past→future flip uses strict `>`** today (see transactionStatus.ts).
- **The "היום" divider centers on load**; uses `window.scrollTo` with explicit math
  (element.scrollIntoView silently no-ops on initial load in Next; smooth scroll
  no-ops under prefers-reduced-motion). Retry loop handles layout settling.
- **Multi-row selection**: the mobile-back `useEffect` must key on a derived
  boolean (`anyOverlayOpen`), NOT on `selectedRows` — keying on the set made the
  cleanup fire `history.back()` per checkbox click, wiping the selection.
- **Empty server payload must not overwrite local state** — general app rule.
- Description column wraps (multi-line) at text-xs; row uses `items-start`.

## Env vars (standalone)

`GOOGLE_SHEET_ID`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`,
`ANTHROPIC_API_KEY`, `BLOB_READ_WRITE_TOKEN`. See RECOVERY.md for details.
The CRM port replaces the Google/Blob ones with its own stack; keep
`ANTHROPIC_API_KEY` for the import features.
