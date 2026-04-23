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
  "avg_duration": "Average video duration formatted as e.g. 00:00:52",
  "avg_cuts": 18,
  "format": [
    "Short format label describing the creative format used e.g. Painpoint comic picture, Before & After, Demo callout, Talking head confessional, Product unboxing"
  ],
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
  ],
  "video_analyses": [
    {
      "video_index": 0,
      "frames": [
        {
          "timestamp": "00:00:00",
          "type": "talking_head | talent_broll | product_broll | greenscreen",
          "visual": "What is on screen at this moment",
          "copy": "Exact words spoken or on-screen text at this moment. Empty string if neither.",
          "is_starred": true,
          "why_starred": "Why this frame is visually or strategically effective — max 12 words. null if not starred."
        }
      ]
    }
  ],
  "broll_logic": {
    "summary": "One paragraph describing the consistent B-roll pairing logic across all videos — what script content triggers each footage type and why this brand uses that pattern strategically",
    "rules": [
      {
        "trigger": "What in the script consistently triggers this footage type across these ads — e.g. 'Any mention of a specific ingredient, stat, or product name'",
        "footage_type": "talking_head | talent_broll | product_broll | greenscreen",
        "reason": "Why this pairing is strategically effective for this brand's audience"
      }
    ]
  }
}

IMPORTANT for video_analyses: for EACH video, select exactly 6 frames that best represent its structure and strategy — always include the very first frame (00:00:00), 1-2 emotionally strong moments, the product or brand reveal, and the CTA. Mark 1-2 frames per video as is_starred: true — these should be the most visually or strategically effective frames. Provide why_starred only for starred frames (null otherwise).`
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
