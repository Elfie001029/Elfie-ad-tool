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
      "copy": "The exact words spoken or shown on screen in the first 3 seconds of the video",
      "visual": "What is visually happening in the first 3 seconds"
    },
    "opener": {
      "description": "What happens in the opening seconds visually",
      "timestamp": "00:00:00"
    },
    "brand_reveal": {
      "timestamp": "00:00:00",
      "description": "How and when the brand name is introduced"
    },
    "product_reveal": {
      "timestamp": "00:00:00",
      "description": "How and when the product is first shown"
    },
    "duration": "Total video duration as a timestamp e.g. 00:00:45",
    "cta": {
      "timestamp": "00:00:00",
      "text": "The actual CTA text or message shown"
    },
    "value_propositions": [
      "First VP mentioned e.g. clinically proven",
      "Second VP mentioned e.g. free shipping",
      "Third VP mentioned e.g. doctor-approved"
    ],
    "talent": {
      "appearance": "Physical description e.g. woman in her late 30s, natural makeup, brown hair",
      "clothing": "What they are wearing e.g. casual white t-shirt, no jewelry",
      "setting": "Where they are e.g. bright minimal bathroom, natural window light",
      "energy": "How they come across e.g. warm and relatable, slightly vulnerable, direct eye contact"
    },
    "ad_structure": [
      {
        "section": "Use only: Hook, Opener, Personal story, Pain point, Competitor mention, Scientific facts, Product introduction, Social proof, Price or offer, CTA",
        "start": "00:00:00",
        "end": "00:00:05"
      }
    ],
    "text_treatment": {
      "font_style": "e.g. bold sans-serif, script, all caps",
      "text_size": "e.g. large supers, small captions",
      "color_contrast": "e.g. white text on dark background",
      "motion": "e.g. animates in, static, fade",
      "captions": "e.g. auto-captions in white, styled captions with highlight words"
    }
  },
  "timeline": [
    {
      "timestamp": "00:00:00",
      "type": "talking_head",
      "visual": "What is on screen at this moment",
      "copy": "Exact words spoken or shown as text, empty string if silent"
    }
  ],
  "copy_only": [
    {
      "timestamp": "00:00:00",
      "text": "Exact words spoken or shown on screen at this moment"
    }
  ],
  "transferrable_copy": [
    {
      "original": "The exact original line from the video",
      "template": "The reusable format e.g. [target audience] need to try [product name]"
    }
  ],
  "broll_shots": [
    "Short production direction e.g. Woman holding product in good lighting against clean background",
    "Short production direction e.g. Close-up of product packaging on marble surface",
    "Short production direction e.g. Person looking at hair in bathroom mirror, natural light"
  ]
}`
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