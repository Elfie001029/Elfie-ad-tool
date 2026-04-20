import { GoogleGenAI } from '@google/genai';

export async function POST(request) {
  const { script, brollLogic } = await request.json();

  if (!script?.trim()) return new Response(
    JSON.stringify({ error: 'Script is required.' }),
    { status: 400 }
  );

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const rulesText = brollLogic?.rules?.length
      ? brollLogic.rules.map(r => `- When: "${r.trigger}" → use ${r.footage_type} — ${r.reason}`).join('\n')
      : 'No specific rules — use general DTC ad conventions.';

    const prompt = `You are a creative director labeling a video ad script with footage directions.

${brollLogic?.summary ? `B-roll logic for this brand:\n${brollLogic.summary}\n\nRules:\n${rulesText}` : `Apply standard DTC ad B-roll conventions:\n${rulesText}`}

Now label each line of the script below. Split the script into individual sentences or short phrases — each line gets its own entry.

Script:
${script.trim()}

Return a JSON array with EXACTLY this structure. No markdown, no backticks, no explanation — just raw JSON:
[
  {
    "line": "The exact sentence or phrase",
    "footage_type": "talking_head | talent_broll | product_broll | greenscreen",
    "reason": "Why — max 8 words"
  }
]`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
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
    console.error('Label script error:', err);
    return new Response(
      JSON.stringify({ error: 'Script labeling failed: ' + err.message }),
      { status: 500 }
    );
  }
}
