// Google Sheets API service layer.
// All Sheets reads/writes flow through this module.
// Runs only on the server (credentials never exposed to the client).

import { google, sheets_v4 } from 'googleapis';
import type {
  Transaction,
  OpeningBalance,
  SheetSnapshot,
  TransactionStatus,
  Frequency,
} from './types';
import { sheetDateToIso, isoToSheetDate } from './dateUtils';

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID!;
const TZRIM_SHEET = 'תזרים';
const CATEGORIES_SHEET = 'קטגוריות';
const CHAT_SHEET = 'צאט';

// Columns A..L  →  indexes 0..11
const COL = {
  DATE: 0,
  CATEGORY: 1,
  DESCRIPTION: 2,
  INCOME: 3,
  EXPENSE: 4,
  BALANCE: 5,
  FREQUENCY: 6,
  DONE: 7,
  UPDATED_AT: 8,
  STATUS: 9,
  IMAGE_URL: 10,
  MORNING_SENT: 11,
} as const;

const TZRIM_RANGE = `${TZRIM_SHEET}!A1:L`;
const CATEGORIES_RANGE = `${CATEGORIES_SHEET}!A1:A`;

let cachedClient: sheets_v4.Sheets | null = null;

function getSheetsClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;

  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

  if (!privateKey || !clientEmail) {
    throw new Error('Missing GOOGLE_PRIVATE_KEY or GOOGLE_CLIENT_EMAIL env vars');
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  cachedClient = google.sheets({ version: 'v4', auth });
  return cachedClient;
}

// ---------- Parsing helpers ----------

function parseNumber(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const s = String(v).replace(/[₪,\s]/g, '');
  const n = Number(s);
  return isFinite(n) ? n : null;
}

function parseBool(v: unknown): boolean {
  if (v === true || v === 'TRUE' || v === 'true') return true;
  return false;
}

function parseStatus(v: unknown): TransactionStatus {
  const raw = String(v ?? '').trim();
  const lower = raw.toLowerCase();
  // Accept both English and Hebrew values
  if (lower === 'past' || raw === 'עבר') return 'past';
  if (lower === 'opening' || raw === 'פתיחה') return 'opening';
  return 'future';
}

/** Serialize status back to Hebrew for storage (matching existing sheet style). */
function statusToSheet(s: TransactionStatus): string {
  if (s === 'past') return 'עבר';
  if (s === 'opening') return 'פתיחה';
  return 'עתיד';
}

function parseFrequency(v: unknown): Frequency {
  const s = String(v ?? '').trim();
  if (s === 'חודשי' || s === 'דו-חודשי') return s;
  return '';
}

// ---------- Read operations ----------

export async function readSnapshot(): Promise<SheetSnapshot> {
  const sheets = getSheetsClient();

  const [tzrimResp, categoriesResp] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: TZRIM_RANGE,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: CATEGORIES_RANGE,
    }),
  ]);

  const tzrimRows = tzrimResp.data.values ?? [];
  const catRows = categoriesResp.data.values ?? [];

  // Row 1 = headers, row 2 = opening balance, rows 3+ = transactions
  const openingRow = tzrimRows[1] ?? [];
  const openingBalance: OpeningBalance = {
    balance: parseNumber(openingRow[COL.BALANCE]) ?? 0,
    updatedAt: (openingRow[COL.UPDATED_AT] as string) || null,
  };

  const transactions: Transaction[] = [];
  for (let i = 2; i < tzrimRows.length; i++) {
    const row = tzrimRows[i];
    if (!row || row.length === 0) continue;

    // Skip fully empty rows
    const hasAnyValue = row.some((c) => c !== '' && c !== null && c !== undefined);
    if (!hasAnyValue) continue;

    const rawDate = String(row[COL.DATE] ?? '').trim();
    const isoDate = rawDate.includes('/') ? sheetDateToIso(rawDate) : rawDate;

    transactions.push({
      rowNumber: i + 1, // 1-based sheet row
      date: isoDate,
      category: String(row[COL.CATEGORY] ?? '').trim(),
      description: String(row[COL.DESCRIPTION] ?? '').trim(),
      income: parseNumber(row[COL.INCOME]),
      expense: parseNumber(row[COL.EXPENSE]),
      balance: parseNumber(row[COL.BALANCE]),
      frequency: parseFrequency(row[COL.FREQUENCY]),
      done: parseBool(row[COL.DONE]),
      updatedAt: (row[COL.UPDATED_AT] as string) || null,
      status: parseStatus(row[COL.STATUS]),
      imageUrl: String(row[COL.IMAGE_URL] ?? '').trim() || null,
      morningSent: parseBool(row[COL.MORNING_SENT]),
    });
  }

  // Categories: row 1 is header, rows 2+ are data
  const categories = catRows
    .slice(1)
    .map((r) => String(r[0] ?? '').trim())
    .filter((c) => c.length > 0);

  return { openingBalance, transactions, categories };
}

// ---------- Write operations ----------

function transactionToRow(t: {
  date: string;
  category: string;
  description: string;
  income: number | null;
  expense: number | null;
  balance: number | null;
  frequency: Frequency;
  done: boolean;
  updatedAt: string | null;
  status: TransactionStatus;
  imageUrl?: string | null;
  morningSent?: boolean;
}): (string | number | boolean)[] {
  return [
    isoToSheetDate(t.date),
    t.category,
    t.description,
    t.income ?? '',
    t.expense ?? '',
    t.balance ?? '',
    t.frequency,
    t.done,
    t.updatedAt ?? '',
    statusToSheet(t.status),
    t.imageUrl ?? '',
    t.morningSent ?? false,
  ];
}

/** Append a new row at the end of the data. */
export async function appendTransaction(
  t: Parameters<typeof transactionToRow>[0]
): Promise<number> {
  const sheets = getSheetsClient();
  const values = [transactionToRow(t)];

  const resp = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TZRIM_SHEET}!A:L`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });

  // Extract the row number that was written
  const updatedRange = resp.data.updates?.updatedRange ?? '';
  const match = updatedRange.match(/!A(\d+):/);
  return match ? parseInt(match[1], 10) : -1;
}

/** Update an entire transaction row. */
export async function updateTransaction(
  rowNumber: number,
  t: Parameters<typeof transactionToRow>[0]
): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TZRIM_SHEET}!A${rowNumber}:L${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [transactionToRow(t)] },
  });
}

/** Delete a row by clearing its content (keeping the row structure intact is handled elsewhere). */
export async function clearRow(rowNumber: number): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TZRIM_SHEET}!A${rowNumber}:L${rowNumber}`,
  });
}

/** Physically remove a row (shifts rows below up by one). */
export async function deleteRow(rowNumber: number): Promise<void> {
  const sheets = getSheetsClient();
  // We need the sheet's numeric ID (gid), not its title, for batchUpdate.
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetInfo = meta.data.sheets?.find((s) => s.properties?.title === TZRIM_SHEET);
  const sheetId = sheetInfo?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) {
    throw new Error(`Could not find sheet ID for "${TZRIM_SHEET}"`);
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowNumber - 1, // 0-based
              endIndex: rowNumber,
            },
          },
        },
      ],
    },
  });
}

/** Update only the opening balance cell and its timestamp. */
export async function updateOpeningBalance(
  balance: number,
  updatedAt: string
): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TZRIM_SHEET}!F2:I2`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[balance, '', '', updatedAt]] },
  });
}

// ---------- Category operations ----------

export async function addCategory(name: string): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${CATEGORIES_SHEET}!A:A`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[name]] },
  });
}

// ---------- Chat / notes ----------

export interface ChatMessage {
  rowNumber: number;
  timestamp: string; // ISO
  author: string;
  text: string;
}

/** Create the chat sheet with headers if it doesn't exist yet. Idempotent. */
async function ensureChatSheet(): Promise<void> {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === CHAT_SHEET);
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: CHAT_SHEET,
              rightToLeft: true,
            },
          },
        },
      ],
    },
  });

  // Add headers
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${CHAT_SHEET}!A1:C1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [['זמן', 'מאת', 'הודעה']],
    },
  });
}

export async function readChat(): Promise<ChatMessage[]> {
  await ensureChatSheet();
  const sheets = getSheetsClient();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${CHAT_SHEET}!A1:C`,
  });
  const rows = resp.data.values ?? [];
  const messages: ChatMessage[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    if (!r[0] && !r[1] && !r[2]) continue;
    messages.push({
      rowNumber: i + 1,
      timestamp: String(r[0] ?? '').trim(),
      author: String(r[1] ?? '').trim(),
      text: String(r[2] ?? '').trim(),
    });
  }
  return messages;
}

export async function appendChatMessage(author: string, text: string): Promise<number> {
  await ensureChatSheet();
  const sheets = getSheetsClient();
  const nowIso = new Date().toISOString();
  const resp = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${CHAT_SHEET}!A:C`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[nowIso, author, text]] },
  });
  const updatedRange = resp.data.updates?.updatedRange ?? '';
  const match = updatedRange.match(/!A(\d+):/);
  return match ? parseInt(match[1], 10) : -1;
}

export async function deleteChatMessage(rowNumber: number): Promise<void> {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetInfo = meta.data.sheets?.find((s) => s.properties?.title === CHAT_SHEET);
  const sheetId = sheetInfo?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        },
      ],
    },
  });
}

export async function overwriteCategories(names: string[]): Promise<void> {
  const sheets = getSheetsClient();
  // Keep header, overwrite from row 2
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${CATEGORIES_SHEET}!A2:A`,
  });
  if (names.length === 0) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${CATEGORIES_SHEET}!A2`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: names.map((n) => [n]) },
  });
}
