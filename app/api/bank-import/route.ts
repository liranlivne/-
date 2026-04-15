import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30; // up to 30s for vision analysis

export interface ParsedTransaction {
  date: string; // ISO format YYYY-MM-DD
  description: string;
  category: string; // suggested category
  income: number | null;
  expense: number | null;
}

/**
 * POST /api/bank-import
 * Accepts a multipart/form-data upload with:
 *   - "file": screenshot of bank statement
 *   - "categories": JSON array of existing categories (for AI to choose from)
 *
 * Returns { transactions: ParsedTransaction[] }
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured (missing ANTHROPIC_API_KEY)' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const categoriesJson = formData.get('categories');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No image uploaded' }, { status: 400 });
    }

    let categories: string[] = [];
    try {
      categories = JSON.parse(String(categoriesJson ?? '[]'));
    } catch {
      categories = [];
    }

    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `התמונה גדולה מדי (${Math.round(file.size / 1024 / 1024)}MB). מקסימום 10MB.` },
        { status: 400 }
      );
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `סוג קובץ לא נתמך: ${file.type}. יש להעלות תמונה (JPG/PNG/WebP).` },
        { status: 400 }
      );
    }

    // Convert to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Build the prompt
    const categoryList = categories.length > 0 ? categories.join(', ') : '(אין קטגוריות)';
    const systemPrompt = `You are an expert at parsing Israeli bank statement screenshots.
Extract each transaction from the image and return ONLY a JSON array (no markdown, no explanation).

Each transaction should be:
{
  "date": "YYYY-MM-DD",
  "description": "string",
  "category": "best matching category from the list, or best guess",
  "income": number | null,
  "expense": number | null
}

Rules:
- Dates in the image are usually DD/MM/YY — convert to ISO format assuming 20YY.
- Amounts in the חובה (debit) column = expense.
- Amounts in the זכות (credit) column = income.
- Ignore the balance (יתרה) column — we compute it ourselves.
- The description should combine what's in "הפעולה" and "פרטים" columns into a readable summary.
- For category, match to one of these existing categories: ${categoryList}. If nothing matches well, use "אחר".
- Return ONLY the JSON array. No text before or after. No markdown fences.`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
                data: base64,
              },
            },
            {
              type: 'text',
              text: 'Extract all transactions from this bank statement. Return ONLY the JSON array of transactions.',
            },
          ],
        },
      ],
    });

    // Extract text from response
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'AI did not return text' }, { status: 500 });
    }

    let text = textBlock.text.trim();

    // Strip markdown fences if present
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let parsed: ParsedTransaction[];
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      console.error('AI returned invalid JSON:', text);
      return NextResponse.json(
        { error: 'AI לא החזיר JSON תקין. נסה שוב עם תמונה ברורה יותר.' },
        { status: 500 }
      );
    }

    if (!Array.isArray(parsed)) {
      return NextResponse.json({ error: 'AI response was not an array' }, { status: 500 });
    }

    // Basic validation & cleanup
    const cleaned = parsed
      .map((t) => ({
        date: String(t.date || ''),
        description: String(t.description || ''),
        category: String(t.category || 'אחר'),
        income: typeof t.income === 'number' ? t.income : null,
        expense: typeof t.expense === 'number' ? t.expense : null,
      }))
      .filter((t) => t.date && (t.income || t.expense));

    return NextResponse.json({ transactions: cleaned });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Bank import error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
