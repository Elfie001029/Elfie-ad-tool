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
      "summary": "The exact words spoken or shown on screen in the first 3 seconds of the video",
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

    "text_treatment": {
  "font_style": "Description of font style used e.g. bold sans-serif, script, all caps",
  "text_size": "How text size is used e.g. large supers, small captions",
  "color_contrast": "How color contrast is used for text e.g. white text on dark background",
  "motion": "Whether text animates or is static",
  "captions": "Whether captions are used and how they are styled"
},
"duration": "Total video duration as a timestamp e.g. 00:00:45",
"ad_structure": [
  {
    "section": "Name of this section. Use only these options: Hook, Opener, Personal story, Pain point, Competitor mention, Scientific facts, Product introduction, Social proof, Price or offer, CTA",
    "start": "start timestamp of this section e.g. 00:00:00",
    "end": "end timestamp of this section e.g. 00:00:05",
    "color": "assign one of these colors based on section type: blue for Hook, orange for Opener, pink for Personal story, red for Pain point, yellow for Competitor mention, purple for Scientific facts, green for Product introduction, teal for Social proof, amber for Price or offer, gray for CTA"
  }
]
  "talent": {
  "type": "One of: talking_head, voiceover, ugc_creator, actor, animation, text_only",
  "apparent_age": "Estimated age range e.g. 25-35",
  "apparent_gender": "e.g. female, male, non-binary, mixed",
  "presentation_style": "e.g. casual at home, professional setting, outdoor lifestyle, clinical/authority",
  "speaks_directly_to_camera": true,
  "emotional_tone": "e.g. relatable and conversational, authoritative, excited, vulnerable and honest",
  "target_audience_signal": "What audience this talent is designed to attract e.g. women 35-50 experiencing perimenopause, young men interested in fitness"
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