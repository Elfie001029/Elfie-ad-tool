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
  "hook": {
    "competitor_hooks": [
      {
        "copy": "Exact hook copy from this competitor ad",
        "strategy": "The psychological strategy behind this hook"
      }
    ],
    "my_hooks": [
      {
        "copy": "Exact hook copy from this ad"
      }
    ],
    "analysis": "2-3 sentences comparing the hook strategies between GROUP A and GROUP B",
    "gap": "The specific thing GROUP A is missing in their hooks"
  },
  "ad_structure": {
    "my_average": [
      {
        "section": "Use only: Hook, Opener, Personal story, Pain point, Competitor mention, Scientific facts, Product introduction, Social proof, Price or offer, CTA",
        "percentage": 10
      }
    ],
    "competitor_average": [
      {
        "section": "Use only: Hook, Opener, Personal story, Pain point, Competitor mention, Scientific facts, Product introduction, Social proof, Price or offer, CTA",
        "percentage": 10
      }
    ],
    "gap": "What structural differences matter most"
  },
  "buzz_words": [
    {
      "word": "perimenopause",
      "frequency": "high"
    },
    {
      "word": "thinning",
      "frequency": "high"
    },
    {
      "word": "women in their 40s",
      "frequency": "medium"
    }
  ],
  "stats": {
    "my_avg_duration": "00:00:28",
    "competitor_avg_duration": "00:00:45",
    "my_avg_cuts": 8,
    "competitor_avg_cuts": 14,
    "my_brand_reveal": "00:00:02",
    "competitor_brand_reveal": "00:00:22",
    "my_product_reveal": "00:00:04",
    "competitor_product_reveal": "00:00:18"
  },
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
  ],
  "value_propositions": [
    {
      "vp": "Name of value proposition e.g. hormone-related hair loss",
      "competitor_has": true,
      "mine_has": false
    }
  ],
  "visual_comparison": {
    "mine": "2-3 sentences describing the visual style of GROUP A ads",
    "competitor": "2-3 sentences describing the visual style of GROUP B ads",
    "gap": "The key visual difference that matters most"
  },
  "talent": {
    "mine": {
      "appearance": "Physical description of talent in GROUP A ads",
      "clothing": "What they are wearing",
      "setting": "Where they are filming",
      "energy": "How they come across"
    },
    "competitor": {
      "appearance": "Physical description of talent in GROUP B ads",
      "clothing": "What they are wearing",
      "setting": "Where they are filming",
      "energy": "How they come across"
    }
  }
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