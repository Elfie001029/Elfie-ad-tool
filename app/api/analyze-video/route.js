import Anthropic from '@anthropic-ai/sdk';
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

Analyze this video ad in detail. Ad context: ${adContext || 'DTC video ad'}

Provide a structured analysis covering:

1) HOOK STRATEGY — What happens in the first 3 seconds? Why does it stop the scroll?

2) PACING & EDITING — How many cuts approximately? What does the editing rhythm tell us about the emotional strategy?

3) TALKING HEAD vs B-ROLL — Estimate the ratio. How do they work together to build trust and desire?

4) TRUST-BUILDING STRUCTURE — How is credibility established? What visual and verbal signals build confidence?

5) COPY & MESSAGING ANGLE — What is the core emotional trigger? What problem or desire is being addressed?

6) CTA STRATEGY — How does the ad earn the click? What is the offer and how is it framed?

7) THREE THINGS TO STEAL — The most specific, actionable takeaways a competitor DTC brand could use immediately.

Be specific — reference actual moments, visuals, and lines from the video in your analysis.`
            }
          ]
        }
      ]
    });

    const geminiAnalysis = response.text;

  return new Response(JSON.stringify({
  analysis: geminiAnalysis,
  stats: {
    duration: 'See analysis',
    totalCuts: null,
    talkingHeadPercent: null,
    brollPercent: null,
    hookType: 'See analysis',
  },
}), { status: 200 });

  } catch (err) {
    console.error('Video analysis error:', err);
    return new Response(
      JSON.stringify({ error: 'Video analysis failed: ' + err.message }),
      { status: 500 }
    );
  }
}