// Regenerate .env.local from the service account JSON (kept outside the project).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const jsonPath = path.join(projectRoot, '..', 'fit-heaven-331119-cc7a3e199027.json');
const envPath = path.join(projectRoot, '.env.local');

const sa = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Escape actual newlines as literal backslash-n so dotenv can load it on one line
const escapedKey = sa.private_key.replace(/\n/g, '\\n');

const lines = [
  'GOOGLE_SHEET_ID=1hkGmaPE1YTkfpalmGaZXhX2Jc8fk9m5Fg_qt2cwhSQ8',
  `GOOGLE_CLIENT_EMAIL=${sa.client_email}`,
  `GOOGLE_PRIVATE_KEY="${escapedKey}"`,
];

fs.writeFileSync(envPath, lines.join('\n') + '\n');
console.log('Wrote', envPath);
console.log('Lines:', fs.readFileSync(envPath, 'utf8').split('\n').length);
