import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60; // PDFs with many pages can take longer than image vision

export interface ParsedEmployeeSalary {
  /** Employee full name as it appears on the slip. */
  name: string;
  /** "נטו לתשלום" — final amount paid out, in NIS. */
  net_pay: number;
}

/**
 * POST /api/salary-import
 * Accepts a multipart/form-data upload with:
 *   - "file": multi-page PDF of salary slips (one employee per page)
 *
 * Returns { month: "MM/YYYY" | "", employees: ParsedEmployeeSalary[] }.
 *
 * The model is instructed to extract the "נטו לתשלום" line specifically (NOT
 * "שכר נטו" or "סה\"כ תשלומים"), and to skip employees with 0 pay. If a
 * single employee receives both a bank transfer and a cash component, the two
 * are summed into a single net_pay.
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

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'לא הועלה קובץ' }, { status: 400 });
    }

    const MAX_SIZE = 32 * 1024 * 1024; // Anthropic's PDF limit is 32MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        {
          error: `הקובץ גדול מדי (${Math.round(
            file.size / 1024 / 1024
          )}MB). מקסימום 32MB.`,
        },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: `יש להעלות PDF (סוג שהתקבל: ${file.type || 'לא ידוע'})` },
        { status: 400 }
      );
    }

    // Convert to base64 for the document block
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    const systemPrompt = `אתה מקבל קובץ PDF של תלושי שכר חודשיים מחברת "אויר הרים גגות".
לכל עובד יש עמוד נפרד (יכולים להיות גם כמה עמודים לעובד אם התלוש ארוך).

חלץ עבור כל עובד:
- שם מלא (השדה "שם עובד")
- סכום "נטו לתשלום" (מספר אחד, בש"ח, ללא פסיקים ולא סימן ש"ח)

החזר JSON בלבד (ללא הקדמה, ללא הסבר, ללא markdown fences) בפורמט:
{
  "month": "MM/YYYY",
  "employees": [
    {"name": "שם עובד", "net_pay": 15393}
  ]
}

חוקים חמורים:
- "נטו לתשלום" הוא הסכום הסופי המשולם לעובד (אחרי כל הניכויים). זה לא "שכר נטו" וזה לא "סה\"כ תשלומים" — חפש מילה במילה את "נטו לתשלום".
- אם עובד מקבל סכום במזומן + בנק, סכם אותם לסכום אחד ב-net_pay.
- אל תכלול עובדים עם נטו לתשלום של 0 או ללא תלוש.
- אם לא הצלחת לזהות את החודש (MM/YYYY), החזר "month": "".
- net_pay חייב להיות מספר (לא מחרוזת).
- החזר JSON תקין בלבד.`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: 'חלץ את שמות העובדים והסכום של "נטו לתשלום" מכל תלוש. החזר JSON בלבד.',
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'AI did not return text' }, { status: 500 });
    }

    let text = textBlock.text.trim();
    // Strip markdown fences if present (defensive — system prompt forbids them)
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let parsed: { month?: string; employees?: unknown };
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error('AI returned invalid JSON for salary slip:', text);
      return NextResponse.json(
        { error: 'AI לא החזיר JSON תקין. נסה שוב או PDF אחר.' },
        { status: 500 }
      );
    }

    if (!parsed || !Array.isArray(parsed.employees)) {
      return NextResponse.json(
        { error: 'תגובת AI חסרה רשימת עובדים' },
        { status: 500 }
      );
    }

    const employees: ParsedEmployeeSalary[] = parsed.employees
      .map((e) => {
        const obj = e as { name?: unknown; net_pay?: unknown };
        const name = typeof obj.name === 'string' ? obj.name.trim() : '';
        const net =
          typeof obj.net_pay === 'number'
            ? obj.net_pay
            : Number(String(obj.net_pay ?? '').replace(/[,₪\s]/g, ''));
        return { name, net_pay: Number.isFinite(net) ? net : 0 };
      })
      .filter((e) => e.name && e.net_pay > 0);

    return NextResponse.json({
      month: typeof parsed.month === 'string' ? parsed.month : '',
      employees,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Salary import error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
