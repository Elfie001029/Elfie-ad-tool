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
      "copy": "The exact words spoken aloud in the first 3 seconds. If no voice over, use on-screen text instead.",
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
      {
        "summary": "Short label for this VP e.g. Clinically proven",
        "copy": "The exact words spoken or shown in the video that express this VP e.g. 'Tested by 3 independent labs and proven to regrow hair in 90 days'"
      }
    ],
    "talent": {
      "appearance": "Physical description e.g. woman in her late 30s, natural makeup, brown hair",
      "clothing": "What they are wearing e.g. casual white t-shirt, no jewelry",
      "setting": "Where they are e.g. bright minimal bathroom, natural window light",
      "energy": "How they come across e.g. warm and relatable, slightly vulnerable, direct eye contact"
    },
    "ad_structure": [
      {
        "section": "Use only one of these exact labels: Hook, Opener, Personal story, Pain point, Competitor mention, Scientific facts, Product introduction, Social proof, Price or offer, CTA. Hook = the first attention-grabbing moment (question, bold claim, or pattern interrupt). Opener = the first visual scene before any claim is made. Personal story = talent sharing their own experience. Pain point = describing a problem the viewer has. Competitor mention = referencing another brand or old solution. Scientific facts = stats, studies, clinical data. Product introduction = first time the product is shown or named. Social proof = reviews, testimonials, before/after. Price or offer = discount, guarantee, free shipping. CTA = call to action.",
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
    },
    "why_this_works": "One paragraph explaining exactly why this ad performs well — what makes the hook effective, the emotional arc it follows, the structural technique used, and the psychological or behavioral mechanism that drives action."
  },
  "timeline": [
    {
      "timestamp": "00:00:00",
      "type": "Use only one of these exact values: talking_head = person speaking directly to camera and their words are transcribed; talent_broll = talent is on screen but not speaking directly to camera (doing something, reacting, walking etc); product_broll = shot that prominently features the product without talent speaking to camera; greenscreen = a person is composited over a different background or footage.",
      "visual": "What is on screen at this moment",
      "copy": "If talking_head: exact words spoken. If on-screen text only: exact text shown. Empty string if neither."
    }
  ],
  "_timeline_instruction": "EVERY visible cut must have its own entry. A cut is any moment the shot changes — new angle, new scene, new clip, transition, text overlay appearing on a new background. Do not group multiple cuts into one entry. A 20-second ad should typically have 8-20+ entries.",
  "copy_only": [
    {
      "timestamp": "00:00:00",
      "text": "PRIORITY: transcribe the spoken audio verbatim. Only use on-screen text if there is no voice over or spoken audio at this moment."
    }
  ],
  "transferrable_copy": [
    {
      "original": "The exact line from the audio transcript or on-screen copy",
      "template": "Rewrite this line as a fill-in-the-blank template replacing brand/product/audience-specific words with [placeholders] e.g. [target audience] need to try [product name]"
    }
  ],
  "broll_shots": [
    {
      "timestamp": "00:00:00",
      "description": "Short production direction e.g. Woman holding product in good lighting against clean background"
    }
  ],
  "broll_logic": {
    "summary": "One paragraph describing the overall pattern: what script content triggers each type of footage and why — e.g. 'This brand stays on talking head during personal story and emotional claims, then cuts to product B-roll the moment a specific ingredient or benefit is named, reinforcing the claim visually exactly when the viewer needs proof.'",
    "rules": [
      {
        "trigger": "What in the script triggers this footage type — e.g. 'Talent mentions a specific ingredient, product name, or quantified benefit'",
        "footage_type": "talking_head | talent_broll | product_broll | greenscreen",
        "reason": "Why this pairing works strategically — e.g. 'Visual proof lands exactly when the credibility claim is spoken'"
      }
    ]
  }
}

IMPORTANT for copy_only and transferrable_copy: cover the ENTIRE script from start to finish. Do not skip or summarise — every spoken line or on-screen text line must appear. transferrable_copy must be derived directly from copy_only and cover every line in order.`
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