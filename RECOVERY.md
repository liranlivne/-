# מדריך שחזור ותחזוקה — אפליקציית תזרים מזומנים

> **מה זה המסמך הזה?** אם בעוד שנה/חמש תרצה לעשות שינוי באפליקציה, או שמשהו הפסיק לעבוד, וכבר אין התכתבות זמינה עם Claude — כל מה שצריך לדעת נמצא כאן.
>
> **הוא מתעדכן אוטומטית עם הקוד** כי הוא חלק מה-repo. בכל commit חדש הגרסה המעודכנת שלו נשמרת ב-GitHub.

---

## 🗂️ איפה נמצא הכל

| רכיב | איפה | הערות |
|---|---|---|
| **קוד המקור** | GitHub: https://github.com/liranlivne/-.git | כל ההיסטוריה שמורה. זה ה"גיבוי" האמיתי. |
| **האפליקציה החיה (production)** | Vercel — הפרויקט `tazrimdom` | https://tazrimdom.vercel.app |
| **בסיס הנתונים** | Google Sheets — גיליון "תזרים" | ראה `GOOGLE_SHEET_ID` ב-env |
| **קבצים מצורפים (תמונות, PDFs)** | Vercel Blob Store — בשם `tazrim_picture` | ראה `BLOB_READ_WRITE_TOKEN` |
| **AI לייבוא מהבנק** | Anthropic (Claude API) | ראה `ANTHROPIC_API_KEY` |

---

## 🔑 משתני סביבה (Environment Variables)

האפליקציה דורשת את המשתנים הבאים. הם מוגדרים בשני מקומות:

1. **לוקלית (לפיתוח):** קובץ `.env.local` בשורש הפרויקט (לא ב-git).
2. **ב-production:** ב-Vercel → Project Settings → Environment Variables.

```
GOOGLE_SHEET_ID          — ה-ID של גיליון Google Sheets (מופיע ב-URL)
GOOGLE_CLIENT_EMAIL      — אימייל של Service Account שקיבל הרשאה לגיליון
GOOGLE_PRIVATE_KEY       — מפתח פרטי של Service Account (עם \n בשורות)
ANTHROPIC_API_KEY        — מפתח Claude API (https://console.anthropic.com)
BLOB_READ_WRITE_TOKEN    — מתווסף אוטומטית כש-Blob Store מחובר לפרויקט ב-Vercel
```

**איפה אני שומר את הערכים עצמם?** בהחלט ממליץ לשמור אותם במקום בטוח בנפרד — למשל:
- תיקיית "סיסמאות" ב-OneDrive
- מנהל סיסמאות (Bitwarden, 1Password)
- קובץ מוצפן

---

## 🚀 איך לשחזר/לרוץ מאפס

### בהנחה שיש לך את ה-GitHub repo ואת משתני הסביבה:

```bash
# 1. Clone
git clone https://github.com/liranlivne/-.git tzrim-app
cd tzrim-app

# 2. התקן תלויות
npm install

# 3. צור .env.local עם המשתנים מלמעלה

# 4. הרץ לוקלית
npm run dev
# → פתח http://localhost:3000

# 5. Deploy ל-Vercel (אם יש חשבון)
# או: התחבר ל-Vercel דרך GitHub, יחבר את ה-repo ויעלה אוטומטית
```

### מה לעשות אם **אין לך את משתני הסביבה** אבל יש לך את החשבונות:

1. **Google Sheets credentials:** Google Cloud Console → פרויקט `fit-heaven-331119` (או דומה) → Service Accounts → צור מפתח JSON חדש. חלץ ממנו את `client_email` ו-`private_key`.
2. **Anthropic key:** console.anthropic.com → API Keys → צור חדש.
3. **Blob token:** ב-Vercel → Storage → tazrim_picture → התחבר לפרויקט, הטוקן נוסף אוטומטית.

---

## 🏗️ ארכיטקטורה בקצרה

**סטאק טכנולוגי:**
- **Next.js 16** (App Router) + React 19 — הפרונטאנד וה-backend באותו פרויקט
- **TypeScript** — סוג-חזק בכל הקוד
- **Tailwind CSS 4** — עיצוב
- **Google Sheets API** — כ-DB (יש API לקרוא ולעדכן שורות)
- **Vercel Blob** — אחסון קבצים מצורפים (תמונות/PDFs)
- **Anthropic Claude API** — Vision לייבוא תנועות מצילום מסך של דף חשבון

**מבנה תיקיות:**
```
app/                    — Next.js App Router
  page.tsx              — העמוד הראשי
  api/                  — Route Handlers (ה-backend)
    sheet/              — GET snapshot של כל הגיליון
    transactions/       — CRUD תנועות
      [row]/done/       — סימון "בוצע" (מעביר לעבר + יוצר חוזר)
    upload/             — העלאת קובץ ל-Blob
    chat/               — הצ'אט הפנימי
    bank-import/        — Claude Vision לפענוח דף חשבון
components/             — רכיבי React
  Header.tsx            — סרגל עליון (לוגו, יתרה, כפתורים)
  TransactionsTable.tsx — הטבלה המרכזית (desktop + mobile)
  TransactionModal.tsx  — דיאלוג הוספה/עריכה
  ChatPanel.tsx         — צ'אט פנימי צף
  BankImportModal.tsx   — ייבוא אוטומטי של תנועות מצילום מסך
  ImageUploader.tsx     — צירוף קובץ + תצוגה מקדימה
lib/                    — לוגיקה שאינה UI
  sheets.ts             — עבודה עם Google Sheets API
  types.ts              — טיפוסי TypeScript
  balance.ts            — חישוב יתרות
  apiClient.ts          — קריאות fetch מהפרונט ל-backend
  undoStack.ts          — מחסנית undo/redo
```

**איך המידע זורם:**

```
User browser
   │
   ├─ /api/sheet          → Google Sheets (readSnapshot)
   ├─ /api/transactions   → Google Sheets (append/update/delete)
   ├─ /api/upload         → Vercel Blob (put)
   ├─ /api/chat           → Google Sheets ("צ'אט" tab)
   └─ /api/bank-import    → Anthropic API → מחזיר JSON של תנועות
```

---

## 🧩 קונספטים חשובים לדעת לפני שינוי קוד

### 1. שורה 2 בגיליון היא "יתרת פתיחה"
שורות 3+ הן תנועות רגילות. הקוד מסתמך על זה. ב-`lib/sheets.ts` יש `readSnapshot` שקורא את שורה 2 כ-`openingBalance` ואת השאר כ-`transactions`.

### 2. עמודות הגיליון (לפי סדר):
`A=תאריך | B=קטגוריה | C=תיאור | D=הכנסה | E=הוצאה | F=יתרה | G=תדירות | H=בוצע | I=updatedAt | J=סטטוס | K=imageUrl`

עמודה F (יתרה) לא מאוחסנת — מחושבת ב-client.

### 3. סטטוס תנועה
יש 3 ערכים: `past` | `future` | `opening`. המשתמש רואה "עבר" ו"תזרים".

### 4. תדירות (חוזרות)
כש-`frequency = 'חודשי'` או `'דו-חודשי'`, סימון "בוצע" יוצר אוטומטית את המופע הבא בתאריך המתאים. הקוד ב-`app/api/transactions/[row]/done/route.ts`.

### 5. קבצים מצורפים
- קובץ נשמר ב-Vercel Blob ומקבל URL ציבורי.
- ה-URL נשמר בעמודה K של הגיליון.
- **שימו לב:** בכל פעם ששורה מתעדכנת חייבים להעביר את `imageUrl`, אחרת הוא יימחק. בעבר היה באג כזה ב-done route.

### 6. הדגשה צהובה של שורות שעודכנו
24 שעות אחרי `updatedAt`. מוגדר ב-`lib/highlight.ts`.

### 7. Undo/Redo
`lib/undoStack.ts` - מחסנית גלובלית שמאחסנת פעולות. Ctrl+Z / Ctrl+Y. לא נשמרת בין רענונים.

---

## ⚙️ איך לעשות שינוי לקוד בעתיד

### אופציה א' — עם Claude/AI (הכי פשוט)
1. פתח Claude Code (או כלי דומה) בתיקיית הפרויקט.
2. אמור: "קרא את RECOVERY.md כדי להבין את הפרויקט, ואז עזור לי ב-X".
3. המודל יבין את המבנה מהמסמך הזה + הקוד.

### אופציה ב' — ידני
1. Clone מ-GitHub.
2. `npm install` + `npm run dev` לבדיקה לוקלית.
3. ערוך, commit, push ל-main — Vercel יבצע deploy אוטומטית.

### אופציה ג' — שינוי קטן בלי לרוץ לוקלית
אפשר לערוך קבצים ישירות ב-GitHub web UI ו-Vercel יבנה אוטומטית. טוב לתיקוני טקסט או שינויים זעירים.

---

## 🔄 רשימת commits אחרונים (איך לקרוא את ההיסטוריה)

כל שינוי משמעותי מקבל הודעת commit תיאורית בעברית/אנגלית. אפשר לראות את ההיסטוריה ב:
- GitHub: https://github.com/liranlivne/-/commits/main
- מקומית: `git log --oneline`

אם משהו נשבר — `git log` + `git diff` מראים מה השתנה. אפשר לחזור אחורה עם `git revert <commit>`.

---

## 🆘 בעיות נפוצות ופתרונות

| תסמין | סיבה סבירה | תיקון |
|---|---|---|
| "No token found" כשמנסים לצרף קובץ | `BLOB_READ_WRITE_TOKEN` חסר | ב-Vercel Storage → חבר את `tazrim_picture` לפרויקט → Redeploy |
| "Missing scopes" בגוגל | Service Account לא שותף לגיליון | פתח את הגיליון → Share → הוסף את `GOOGLE_CLIENT_EMAIL` בהרשאת עריכה |
| ייבוא מהבנק לא עובד | `ANTHROPIC_API_KEY` לא תקף או ללא קרדיט | חדש מפתח ב-console.anthropic.com + ודא שיש יתרה |
| האפליקציה טוענת לנצח | Sheets API חסום או ה-ID שגוי | ודא את `GOOGLE_SHEET_ID` + שה-Service Account יש לו גישה |
| העלאת deploy ב-Vercel נכשלת | TypeScript error ב-build | הרץ `npx tsc --noEmit` לוקלית לפני push |

---

## 📦 רשימת דרישות Node.js

- Node.js 20+ (Vercel משתמש ב-22)
- npm 10+

---

## 📝 הערה אחרונה

הקובץ הזה מתעדכן ידנית רק אם תעשה שינוי מהותי בארכיטקטורה. כמה פעמים בשנה שווה לפתוח אותו ולוודא שהוא עדיין מדויק. אבל ברוב המקרים הקוד + ההיסטוריה ב-git מספיקים לעצמם.

**גיבוי פיזי (ZIP):** כדאי פעם בחצי שנה להוריד ZIP מ-GitHub (כפתור `Code` → `Download ZIP`) ולשמור ב-OneDrive, ליתר ביטחון.

---

*עודכן לאחרונה: אפריל 2026*
