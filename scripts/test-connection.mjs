// Quick connection test - verifies the service account can read the sheet.
// Run with: node scripts/test-connection.mjs

import { google } from 'googleapis';
import { readFileSync } from 'fs';

// Read credentials directly from the service account JSON (parent folder)
const sa = JSON.parse(
  readFileSync('../fit-heaven-331119-cc7a3e199027.json', 'utf8')
);

const SHEET_ID = '1hkGmaPE1YTkfpalmGaZXhX2Jc8fk9m5Fg_qt2cwhSQ8';

const auth = new google.auth.JWT({
  email: sa.client_email,
  key: sa.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

console.log('Testing connection...');
console.log('Sheet ID:', SHEET_ID);
console.log('Service account:', sa.client_email);
console.log('');

try {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  console.log('✅ Connected! Sheet title:', meta.data.properties?.title);
  console.log('');
  console.log('Sub-sheets found:');
  meta.data.sheets?.forEach((s) => {
    console.log(`  - "${s.properties?.title}" (gid: ${s.properties?.sheetId})`);
  });
  console.log('');

  // Read a sample of rows from תזרים
  const tzrim = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'תזרים!A1:J5',
  });
  console.log('First 5 rows of תזרים:');
  (tzrim.data.values ?? []).forEach((row, i) => {
    console.log(`  Row ${i + 1}:`, JSON.stringify(row));
  });
  console.log('');

  // Count categories
  const cats = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'קטגוריות!A:A',
  });
  console.log(`Found ${(cats.data.values?.length ?? 0) - 1} categories`);

  console.log('');
  console.log('🎉 All checks passed!');
} catch (err) {
  console.error('❌ Connection failed:');
  console.error(err.message);
  if (err.response?.data) console.error(err.response.data);
  process.exit(1);
}
