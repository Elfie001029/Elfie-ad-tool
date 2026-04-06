import { GoogleGenAI } from '@google/genai';

export async function POST(request) {
  const { videoUrl, adContext } = await request.json();

  if (!videoUrl) return new Response(
    JSON.stringify({ error: 'Video URL is required.' }),
    { status: 400 }
  );

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    console.log('Fetching video from:', videoUrl);
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error(`Could not fetch video: ${videoRes.status}`);

    const videoBuffer = await videoRes.arrayBuffer();
    const videoBase64 = Buffer.from(videoBuffer).toString('base64');
    const contentType = videoRes.headers.get('content-type') || 'video/mp4';

    console.log('Video fetched, sending to Gemini...');

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: contentType,
                data: videoBase64,
              },
            },
            {
              text: `You are a senior creative strategist specializing in DTC paid social video ads.

Analyze this video ad. Ad context: ${adContext || 'DTC video ad'}

Return your response as a valid JSON object with EXACTLY this structure. No markdown, no backticks, no explanation — just raw JSON:

{
  "general": {
    "hook": {
      "summary": "One sentence describing the hook",
      "psychology": "The psychological principle being used and why it works to stop the scroll"
    },
    "opener": {
      "description": "What happens in the opening seconds",
      "product_relationship": "How the opener connects to the product being sold"
    },
    "brand_reveal": {
      "timestamp": "00:00:00",
      "description": "How and when the brand name is introduced"
    },
    "product_reveal": {
      "timestamp": "00:00:00",
      "description": "How and when the product is first shown"
    },
    "structure": "2-3 sentences describing the overall narrative arc of the ad",
    "cta": {
      "timestamp": "00:00:00",
      "text": "The actual CTA text or message shown",
      "strategy": "Why this CTA works and how it is framed"
    }
  },
  "timeline": [
    {
      "timestamp": "00:00:00",
      "type": "talking_head",
      "visual": "What is on screen at this moment",
      "copy": "What is being said or shown as text"
    }
  ]
}

For the timeline array, include one entry for every cut or scene change in the video. Use these types: talking_head, broll, text_overlay, product_shot, logo. If there is no copy/speech at a moment use an empty string for copy.`
            }
          ]
        }
      ]
    });

    const geminiAnalysis = response.text;

    let parsed = null;
    try {
      const clean = geminiAnalysis.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch(e) {
      console.log('JSON parse failed, returning raw:', e.message);
    }

    return new Response(JSON.stringify({
      analysis: parsed,
      raw: geminiAnalysis,
    }), { status: 200 });

  } catch (err) {
    console.error('Video analysis error:', err);
    return new Response(
      JSON.stringify({ error: 'Video analysis failed: ' + err.message }),
      { status: 500 }
    );
  }
}