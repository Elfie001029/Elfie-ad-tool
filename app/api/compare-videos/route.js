import { GoogleGenAI } from '@google/genai';

export async function POST(request) {
  const { myVideos, competitorVideos, context } = await request.json();

  if (!myVideos?.length) return new Response(
    JSON.stringify({ error: 'Please add at least one video on your side.' }),
    { status: 400 }
  );
  if (!competitorVideos?.length) return new Response(
    JSON.stringify({ error: 'Please add at least one competitor video.' }),
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

    console.log('Fetching my videos...');
    const myVideoData = await Promise.all(myVideos.map(fetchVideoAsBase64));

    console.log('Fetching competitor videos...');
    const competitorVideoData = await Promise.all(competitorVideos.map(fetchVideoAsBase64));

    const parts = [];

    parts.push({
      text: `You are a senior creative strategist specializing in DTC paid social video ads.

I'm going to show you two groups of video ads.

GROUP A = My ads (the brand I work for)
GROUP B = Competitor ads

${context ? `Context: ${context}` : ''}

Watch all videos carefully. Then return your response as a valid JSON object with EXACTLY this structure. No markdown, no backticks, no explanation — just raw JSON:

{
  "trends": {
    "product_reveal": {
      "competitor_average": "average timestamp across all GROUP B videos e.g. 00:00:08",
      "my_average": "average timestamp across all GROUP A videos e.g. 00:00:15",
      "insight": "one sentence insight about what this difference means"
    },
    "brand_reveal": {
      "competitor_average": "average timestamp across all GROUP B videos",
      "my_average": "average timestamp across all GROUP A videos",
      "insight": "one sentence insight about what this difference means"
    },
    "attention_words": [
      "word or short phrase 1",
      "word or short phrase 2",
      "word or short phrase 3",
      "word or short phrase 4",
      "word or short phrase 5"
    ],
    "structural_pattern": "2-3 sentences describing the most common narrative structure used across GROUP B competitor ads"
  },
  "gaps": [
    {
      "dimension": "Hook strategy",
      "competitor": "What GROUP B is doing in this dimension",
      "mine": "What GROUP A is doing in this dimension",
      "gap": "The specific thing GROUP A is missing or should change"
    },
    {
      "dimension": "Pacing & editing",
      "competitor": "What GROUP B is doing",
      "mine": "What GROUP A is doing",
      "gap": "The specific gap"
    },
    {
      "dimension": "Product reveal timing",
      "competitor": "What GROUP B is doing",
      "mine": "What GROUP A is doing",
      "gap": "The specific gap"
    },
    {
      "dimension": "Brand name reveal",
      "competitor": "What GROUP B is doing",
      "mine": "What GROUP A is doing",
      "gap": "The specific gap"
    },
    {
      "dimension": "Social proof & trust signals",
      "competitor": "What GROUP B is doing",
      "mine": "What GROUP A is doing",
      "gap": "The specific gap"
    },
    {
      "dimension": "Emotional arc",
      "competitor": "What GROUP B is doing",
      "mine": "What GROUP A is doing",
      "gap": "The specific gap"
    },
    {
      "dimension": "CTA structure",
      "competitor": "What GROUP B is doing",
      "mine": "What GROUP A is doing",
      "gap": "The specific gap"
    }
  ],
  "top3": [
    {
      "priority": 1,
      "title": "Short title for this gap",
      "action": "Specific actionable thing GROUP A should do immediately"
    },
    {
      "priority": 2,
      "title": "Short title for this gap",
      "action": "Specific actionable thing GROUP A should do immediately"
    },
    {
      "priority": 3,
      "title": "Short title for this gap",
      "action": "Specific actionable thing GROUP A should do immediately"
    }
  ]
}`
    });

    parts.push({ text: `--- GROUP A: MY ADS (${myVideoData.length} video${myVideoData.length > 1 ? 's' : ''}) ---` });
    myVideoData.forEach((video, i) => {
      parts.push({ text: `My ad ${i + 1}:` });
      parts.push({ inlineData: { mimeType: video.contentType, data: video.base64 } });
    });

    parts.push({ text: `--- GROUP B: COMPETITOR ADS (${competitorVideoData.length} video${competitorVideoData.length > 1 ? 's' : ''}) ---` });
    competitorVideoData.forEach((video, i) => {
      parts.push({ text: `Competitor ad ${i + 1}:` });
      parts.push({ inlineData: { mimeType: video.contentType, data: video.base64 } });
    });

    console.log('Sending to Gemini for comparison...');

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts }]
    });

    const raw = response.text;
    console.log('RAW RESPONSE:', raw.slice(0, 500));

    let parsed = null;
    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch(e) {
      console.log('JSON parse failed:', e.message);
    }

    return new Response(JSON.stringify({
      result: parsed,
      raw,
    }), { status: 200 });

  } catch (err) {
    console.error('Comparison error:', err);
    return new Response(
      JSON.stringify({ error: 'Comparison failed: ' + err.message }),
      { status: 500 }
    );
  }
}