import { GoogleGenAI } from '@google/genai';

export const GEMINI_MODEL = 'gemini-3-flash-preview';

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

// Gemini occasionally wraps JSON in fences or prepends prose even in JSON
// mode — recover the payload instead of silently returning null to the UI.
export function parseGeminiJson(raw) {
  if (!raw) return null;
  const clean = raw.replace(/```json|```/g, '').trim();
  try { return JSON.parse(clean); } catch {}
  const candidates = [
    [clean.indexOf('{'), clean.lastIndexOf('}')],
    [clean.indexOf('['), clean.lastIndexOf(']')],
  ];
  for (const [start, end] of candidates) {
    if (start !== -1 && end > start) {
      try { return JSON.parse(clean.slice(start, end + 1)); } catch {}
    }
  }
  return null;
}
