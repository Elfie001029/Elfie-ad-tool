import { put } from '@vercel/blob';
import { spawn } from 'child_process';
import { chmodSync, existsSync } from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';

export const maxDuration = 60;

function getYtDlpPath(): string {
  if (process.platform === 'linux') {
    return path.join(process.cwd(), 'bin', 'yt-dlp');
  }
  // Local Mac dev: requires `brew install yt-dlp`
  return 'yt-dlp';
}

function extractDirectUrl(fbUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ytDlpPath = getYtDlpPath();

    if (process.platform === 'linux' && existsSync(ytDlpPath)) {
      try { chmodSync(ytDlpPath, 0o755); } catch {}
    }

    const proc = spawn(ytDlpPath, [
      '--get-url',
      '--no-playlist',
      '-f', 'best[ext=mp4]/mp4/best',
      '--no-check-certificates',
      fbUrl,
    ]);

    let output = '';
    let errorOutput = '';
    proc.stdout.on('data', (d: Buffer) => { output += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { errorOutput += d.toString(); });
    proc.on('close', (code: number) => {
      const url = output.trim().split('\n').find(l => l.startsWith('http'));
      if (code !== 0 || !url) reject(new Error(errorOutput || 'yt-dlp could not extract a URL'));
      else resolve(url);
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== 'string') {
      return Response.json({ error: 'No URL provided' }, { status: 400 });
    }

    const cdnUrl = await extractDirectUrl(url);

    const videoRes = await fetch(cdnUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
    });
    if (!videoRes.ok || !videoRes.body) {
      return Response.json({ error: 'Failed to fetch video from Facebook CDN' }, { status: 502 });
    }

    const blob = await put(`fb-ad-${Date.now()}.mp4`, videoRes.body, {
      access: 'public',
      contentType: 'video/mp4',
    });

    return Response.json({ url: blob.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[process-fb-url]', message);
    return Response.json({ error: message }, { status: 500 });
  }
}
