import { GoogleGenAI } from '@google/genai';

export const GEMINI_MODEL = 'gemini-3-flash-preview';

// In JSON mode the only way Gemini produces invalid JSON is truncation at the
// output-token ceiling — parseGeminiJson repairs that, and generateParsedJson
// retries once before giving up.
export const JSON_CONFIG = { responseMimeType: 'application/json' };

export function getGeminiClient() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

export async function fetchVideoAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch video: ${url} (${res.status})`);
  const buffer = await res.arrayBuffer();
  return {
    base64: Buffer.from(buffer).toString('base64'),
    contentType: res.headers.get('content-type') || 'video/mp4',
  };
}

function tryParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

// Close any unterminated string and unbalanced brackets, then parse.
function closeAndParse(fragment) {
  let inStr = false, esc = false;
  const stack = [];
  for (let i = 0; i < fragment.length; i++) {
    const c = fragment[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') stack.pop();
  }
  let out = fragment;
  if (inStr) out += '"';
  out = out.replace(/,\s*$/, '');
  out = out.replace(/:\s*$/, ':null');
  while (stack.length) out += stack.pop();
  return tryParse(out);
}

// Gemini occasionally wraps JSON in fences, prepends prose, or truncates the
// tail when it runs out of output tokens. Recover as much as possible instead
// of returning null to the UI.
export function parseGeminiJson(raw) {
  if (!raw) return null;
  const clean = raw.replace(/```json|```/g, '').trim();
  const direct = tryParse(clean);
  if (direct) return direct;

  const starts = [clean.indexOf('{'), clean.indexOf('[')].filter(i => i !== -1);
  if (!starts.length) return null;
  const start = Math.min(...starts);
  const end = clean.lastIndexOf(clean[start] === '{' ? '}' : ']');
  if (end > start) {
    const sliced = tryParse(clean.slice(start, end + 1));
    if (sliced) return sliced;
  }

  // Truncated output: cut back to the last structural boundary until the
  // fragment closes cleanly. Loses only the tail of the response.
  let fragment = clean.slice(start);
  for (let i = 0; i < 40 && fragment.length > 2; i++) {
    const parsed = closeAndParse(fragment);
    if (parsed) return parsed;
    const cut = Math.max(fragment.lastIndexOf(','), fragment.lastIndexOf('{'), fragment.lastIndexOf('['));
    if (cut <= 0) break;
    fragment = fragment.slice(0, cut);
  }
  return null;
}

// Generate + parse with one automatic retry on unparseable output.
export async function generateParsedJson(ai, params, attempts = 2) {
  let raw = '';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await ai.models.generateContent(params);
    raw = response.text || '';
    const parsed = parseGeminiJson(raw);
    if (parsed) return { parsed, raw };
    console.log(`Gemini JSON parse failed (attempt ${attempt}/${attempts}), raw length ${raw.length}`);
  }
  return { parsed: null, raw };
}
