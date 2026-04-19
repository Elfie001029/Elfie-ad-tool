import { GoogleGenAI } from '@google/genai';

export async function POST(request) {
  const { videoUrls, context } = await request.json();

  if (!videoUrls?.length || videoUrls.length < 2) return new Response(
    JSON.stringify({ error: 'Add at least 2 video URLs to run a group analysis.' }),
    { status: 400 }
  );

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    async function fetchVideoAsBase64(url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Could not fetch video: ${url}`);
      const buffer = await res.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const contentType = res.headers.get('content-type') || 'video/mp4';
      return { base64, contentType };
    }

    console.log('Fetching videos for group analysis...');
    const videoData = await Promise.all(videoUrls.map(fetchVideoAsBase64));

    const parts = [];

    parts.push({
      text: `You are a senior creative strategist specializing in DTC paid social video ads.

I'm going to show you ${videoData.length} video ads from the same brand or creative trend.

${context ? `Context: ${context}` : ''}

Watch all videos carefully. Identify what they have in common — patterns, repeated elements, consistent creative choices. This is a pattern brief, not a gap analysis.

Return your response as a valid JSON object with EXACTLY this structure. No markdown, no backticks, no explanation — just raw JSON:

{
  "common_hooks": [
    {
      "copy": "The hook line itself, exact or close paraphrase",
      "appears_in": 2,
      "strategy": "The psychological approach e.g. fear of missing out, identity statement, surprising claim"
    }
  ],
  "keyword_clusters": [
    {
      "word": "e.g. perimenopause",
      "frequency": "high"
    }
  ],
  "visual_pattern": {
    "setting": "Recurring settings across the videos e.g. bright bathroom, outdoor lifestyle, kitchen counter",
    "text_treatment": "Common text style e.g. bold white supers, highlighted keywords, animated captions",
    "color_palette": "Recurring visual tones e.g. warm neutrals, clinical white, saturated lifestyle",
    "editing_pace": "e.g. fast cuts every 1-2s, slow and cinematic, mixed with text cards"
  },
  "ad_structure_template": [
    {
      "section": "Use only: Hook, Opener, Personal story, Pain point, Competitor mention, Scientific facts, Product introduction, Social proof, Price or offer, CTA",
      "description": "How this brand typically executes this section"
    }
  ],
  "talent_pattern": {
    "appearance": "What talent typically looks like across these ads",
    "clothing": "Typical clothing style",
    "setting": "Where they typically film",
    "energy": "Common tone and delivery style"
  },
  "strongest_patterns": [
    {
      "title": "Short label e.g. Always opens with a mirror selfie",
      "observation": "What this brand consistently does and why it likely works for their audience"
    }
  ]
}`
    });

    videoData.forEach((video, i) => {
      parts.push({ text: `Video ${i + 1}:` });
      parts.push({ inlineData: { mimeType: video.contentType, data: video.base64 } });
    });

    console.log('Sending to Gemini for group analysis...');

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts }]
    });

    const raw = response.text;

    let parsed = null;
    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch (e) {
      console.log('JSON parse failed:', e.message);
    }

    return new Response(JSON.stringify({ result: parsed, raw }), { status: 200 });

  } catch (err) {
    console.error('Group analysis error:', err);
    return new Response(
      JSON.stringify({ error: 'Group analysis failed: ' + err.message }),
      { status: 500 }
    );
  }
}
