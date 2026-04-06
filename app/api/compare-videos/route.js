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

Your job is to do a gap analysis — identify what Group A is missing compared to Group B.

After watching all videos, analyze the following dimensions:

1) HOOK STRATEGY — How does each group open their ads? What is Group A missing in the first 3 seconds?

2) PACING & EDITING — Compare cut rates and editing rhythm. Is Group A faster/slower? What's the impact?

3) PRODUCT REVEAL TIMING — When does each group show the product? What is Group A doing differently?

4) BRAND NAME REVEAL — When and how does each group introduce the brand? What could Group A improve?

5) SOCIAL PROOF & TRUST SIGNALS — What credibility tactics does Group B use that Group A lacks?

6) EMOTIONAL ARC — How does the emotional journey differ between the two groups?

7) CTA STRUCTURE — How does Group B earn the click differently from Group A?

8) TOP 3 GAPS — The most important things Group A should immediately add or change based on what Group B is doing.

Be specific — reference actual moments and visuals from the videos. Be direct and actionable.

Here are the videos:`
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

    const result = response.text;

    return new Response(JSON.stringify({ result }), { status: 200 });

  } catch (err) {
    console.error('Comparison error:', err);
    return new Response(
      JSON.stringify({ error: 'Comparison failed: ' + err.message }),
      { status: 500 }
    );
  }
}