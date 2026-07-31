/**
 * POST /api/activities/describe
 *
 * Drafts a short activity title + description for a detected place, using an
 * LLM. Runs server-side so the API key never reaches the browser — it reads
 * `ANTHROPIC_API_KEY` (server-only, same pattern as APPWRITE_API_KEY) and the
 * optional `ACTIVITY_LLM_MODEL`. The client (`lib/activities.ts`) POSTs the
 * resolved place; the user edits the returned draft before saving.
 *
 * Provider note: this talks to Anthropic's Messages API via plain `fetch` (no
 * SDK dependency). Swapping to another provider means changing only this file.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-4-5';

interface DescribeBody {
  placeName?: string;
  category?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  note?: string | null;
}

function buildPrompt(body: DescribeBody): string {
  const lines = [
    `Place: ${body.placeName}`,
    body.category ? `Type: ${body.category}` : null,
    body.address ? `Address: ${body.address}` : null,
    body.note ? `Traveller's note: ${body.note}` : null,
  ].filter(Boolean);

  return (
    'You are helping a traveller log an activity on a group trip. ' +
    'Given the place below, write a short, warm, first-person journal entry about visiting it. ' +
    "If a traveller's note is present, weave it in.\n\n" +
    lines.join('\n') +
    '\n\nRespond with ONLY a JSON object, no markdown fences, of the form ' +
    '{"title": string, "description": string}. ' +
    'The title must be at most 6 words. The description must be 1-3 sentences.'
  );
}

/** Pull a {title, description} object out of the model's text response. */
function parseDraft(text: string): { title: string; description: string } | null {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    if (typeof obj.title === 'string' && typeof obj.description === 'string') {
      return { title: obj.title.trim(), description: obj.description.trim() };
    }
  } catch {
    // fall through
  }
  return null;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI descriptions are not configured. Add ANTHROPIC_API_KEY to the web env.' },
      { status: 503 },
    );
  }

  let body: DescribeBody;
  try {
    body = (await req.json()) as DescribeBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!body.placeName || typeof body.placeName !== 'string') {
    return NextResponse.json({ error: 'A place name is required.' }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ACTIVITY_LLM_MODEL || DEFAULT_MODEL,
        max_tokens: 400,
        messages: [{ role: 'user', content: buildPrompt(body) }],
      }),
    });
  } catch {
    return NextResponse.json({ error: 'Could not reach the AI service.' }, { status: 502 });
  }

  if (!upstream.ok) {
    // Don't forward provider internals to the client; log for the server owner.
    console.error('[describe] Anthropic error', upstream.status, await upstream.text().catch(() => ''));
    return NextResponse.json({ error: 'The AI service returned an error.' }, { status: 502 });
  }

  const data = (await upstream.json()) as { content?: Array<{ text?: string }> };
  const text = data.content?.map((c) => c.text ?? '').join('') ?? '';
  const draft = parseDraft(text);
  if (!draft) {
    return NextResponse.json({ error: 'The AI response could not be parsed.' }, { status: 502 });
  }

  return NextResponse.json(draft);
}
