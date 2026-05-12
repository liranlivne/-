# Handoff — tzrim-app

**Last updated:** 2026-05-11
**Production:** https://tazrimdom.vercel.app
**Repo:** https://github.com/liranlivne/-.git (branch `main`)
**Vercel project:** `-tazrim` (org `liranlivnes-projects`)
**Latest deployment:** `dpl_5oJ9CqWazht2bvDczfmdT5cnL7pb`

---

## ⚠️ Deploy mechanic (read first)

**GitHub auto-deploy does NOT fire for this project.** A `git push origin main` will sit on GitHub forever without ever reaching Vercel. Every chunk needs a manual CLI deploy:

```bash
git add <files> && git commit -m "..." && git push origin main

# Verify project link still points to -tazrim, not the orphan tzrim-app project:
cat .vercel/project.json | grep projectName
# Must say:  "projectName":"-tazrim"
# If it says tzrim-app, run:
#   rm -rf .vercel && npx vercel link --project=-tazrim --yes

npx vercel --prod --yes
# → copy the new "tazrim-XXXXXXXXX-liranlivnes-projects.vercel.app" URL

npx vercel alias set tazrim-XXXXXXXXX-liranlivnes-projects.vercel.app tazrimdom.vercel.app

# Sanity check (dpl id should match what CLI just printed):
curl -s https://tazrimdom.vercel.app/ | grep -oE 'dpl_[A-Za-z0-9]+' | head -1
```

The "wrong project" trap: `npx vercel --prod` from a checkout without `.vercel/` will silently create a NEW project called `tzrim-app` (no hyphen) that has zero env vars. The deploy succeeds but every Sheets API call returns "Missing GOOGLE_PRIVATE_KEY". This burned ~30 min mid-session.

---

## What shipped this session (2026-05-05 → 2026-05-11)

1. **Bulk change-date** in the multi-select bar. New "📅 שנה תאריך" button next to "🏷 שנה קטגוריה". Past rows moved to today/future auto-flip status to `future` (mirrors single-row edit behavior).

2. **Always-visible row checkboxes.** Replaced the old "☑ בחירה מרובה" toggle. Every row in the table now shows a checkbox on the right (RTL), the desktop grid has a "בחירה" column header, and the bulk-action bar appears the moment ≥1 row is checked. ESC / mobile-back clears active selection.

3. **Multi-select bug fix** — `mobile-back` useEffect had `selectedRows` in its dep array, so the cleanup fired `window.history.back()` on every checkbox click, which triggered popstate, which cleared the selection. Re-keyed the effect on a derived boolean `anyOverlayOpen` and moved state reads into a `useRef`. See `app/page.tsx` comment above the effect.

4. **Salary import from PDF.** New `📄 ייבוא משכורות` button in the header. Flow:
   - User drags a multi-page PDF into the modal.
   - `/api/salary-import` (route + `app/api/salary-import/route.ts`) sends it to Claude Haiku 4.5 via the existing `@anthropic-ai/sdk`, with a prompt locked to the "נטו לתשלום" line specifically (not "שכר נטו" or "סה\"כ תשלומים"). Bank + cash components for the same employee are summed.
   - Review step (`components/SalaryImportModal.tsx`) shows a per-employee checkbox + editable net amount + running total.
   - Approved rows → `createTransaction` loop with date=today, category="שכר עובדים", description=employee name, expense=net_pay, status='future'. Rows show up in תזרים and are highlighted as recently-updated for 24h until manually marked "בוצע".

5. **🚪 יציאה button** in the header. Confirms, then `window.close()` with `about:blank` fallback (no auth in the app — exit means dismiss the tab).

6. **Chat-panel selection UX.** Selecting messages in the floating chat now:
   - ESC layers: clears selection first; closes the chat only if nothing is selected.
   - Bulk-action bar has a "ביטול" button next to "🗑 מחק" (mobile users had no exit).

---

## Open / next-up

- **Salary import never tested with a real PDF.** All paths verified via dev preview, but the AI's ability to correctly find "נטו לתשלום" across the various slip layouts הילית נהמי produces is unproven. The Review-step amount fields are editable as a safety net. If false positives cluster on a specific layout, tighten the prompt with examples.
- **Salary PDF archive** (item 5 in the original spec — `salaries-archive/<חודש>.pdf`) was **skipped**. The app uses Vercel Blob, not a filesystem. If the user revisits this, plausible options: (a) Blob under a `salaries/` prefix; (b) attach URL to the first row's `imageUrl`. Owner agreed it can wait.
- **No `addSalaryRows()` helper** in `lib/sheets.ts` — by design. The page-level handler calls `createTransaction` in a loop, matching the BankImportModal pattern. If a future change demands single-shot batching for performance, would need a new sheets-level batch helper.

---

## Architecture pointers (for the next chat to skim)

- `app/page.tsx` — the single page. Holds all top-level state (snapshot, modals, selection, filters). Wires every handler.
- `components/BankImportModal.tsx` — original PDF/image-import template. Salary modal copied its 3-step structure.
- `components/SalaryImportModal.tsx` — new this session. Same 3-step flow (upload → review → done).
- `app/api/bank-import/route.ts` — image → Claude Sonnet 4.5 vision → transactions[].
- `app/api/salary-import/route.ts` — PDF → Claude Haiku 4.5 (document block) → `{month, employees:[{name, net_pay}]}`.
- `lib/sheets.ts` — Google Sheets I/O. Service-account auth, column layout `A=תאריך … K=imageUrl` (see RECOVERY.md §"עמודות הגיליון").
- `lib/dateUtils.ts` — ISO ⇄ DD/MM/YY conversions, `todayIso()`, etc.
- `lib/apiClient.ts` — frontend wrappers around `/api/*`.

Memory file with project rules: `C:\Users\dell\.claude\projects\C--Users-dell-OneDrive----------------------\memory\project_tzrim_auto_deploy.md`.

---

## Don't repeat these mistakes

- Don't push to GitHub and expect Vercel to deploy. It won't. Run `vercel --prod` + alias.
- Don't run `vercel --prod` without verifying `.vercel/project.json` says `-tazrim`. The orphan `tzrim-app` project will accept the deploy and break prod silently.
- Don't put a state object in a useEffect dep array if the cleanup has side effects (`history.back()`, etc.). Use a derived boolean + ref. See the comment in `app/page.tsx` above the mobile-back effect.
