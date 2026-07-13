import { getGeminiClient, parseGeminiJson, GEMINI_MODEL } from '@/lib/gemini';

// Synthesis pass: receives the structured per-video analyses produced by
// /api/analyze-video and finds cross-ad patterns. No video bytes are sent —
// the model reasons over transcripts, structures, and timelines as text.

function condense(analysis, i) {
  const g = analysis?.general || {};
  return {
    video_index: i,
    duration: g.duration,
    hook: g.hook,
    ad_structure: g.ad_structure,
    value_propositions: g.value_propositions,
    talent: g.talent,
    text_treatment: g.text_treatment,
    why_this_works: g.why_this_works,
    script: (analysis?.copy_only || []).map(l => `[${l.timestamp}] ${l.text}`).join('\n'),
    timeline: (analysis?.timeline || []).map(t => ({ timestamp: t.timestamp, type: t.type, visual: t.visual })),
    transferrable_copy: analysis?.transferrable_copy,
    broll_logic: analysis?.broll_logic,
  };
}

export async function POST(request) {
  const { analyses, context } = await request.json();

  if (!analyses?.length || analyses.length < 2) return new Response(
    JSON.stringify({ error: 'Add at least 2 analyzed videos to run a group analysis.' }),
    { status: 400 }
  );

  try {
    const ai = getGeminiClient();
    const condensed = analyses.map(condense);

    const prompt = `You are a senior creative strategist specializing in DTC paid social video ads.

Below are structured breakdowns of ${condensed.length} video ads from the same brand or creative trend. Each breakdown was produced by watching the full video: it includes the verbatim script with timestamps, the ad structure with section timings, every cut in the timeline, value propositions, talent and visual notes.

${context ? `Context from the strategist: ${context}\n` : ''}
Your job is to find what these ads have IN COMMON — the repeatable pattern behind them. This is a pattern brief that should read as a "how this brand builds a winning ad" guideline, not a gap analysis.

AD BREAKDOWNS:
${JSON.stringify(condensed, null, 1)}

Return a valid JSON object with EXACTLY this structure. No markdown, no backticks — just raw JSON:

{
  "format": [
    "Short format label describing the creative format used e.g. Painpoint comic picture, Before & After, Demo callout, Talking head confessional, Product unboxing"
  ],
  "keyword_clusters": [
    { "word": "e.g. perimenopause", "frequency": "high" }
  ],
  "common_hooks": [
    {
      "copy": "The hook line itself, exact or close paraphrase",
      "appears_in": 2,
      "strategy": "The psychological approach e.g. fear of missing out, identity statement, surprising claim"
    }
  ],
  "visual_pattern": {
    "setting": "Recurring settings across the videos",
    "text_treatment": "Common text style",
    "color_palette": "Recurring visual tones",
    "editing_pace": "e.g. fast cuts every 1-2s, slow and cinematic"
  },
  "talent_pattern": {
    "appearance": "What talent typically looks like across these ads",
    "clothing": "Typical clothing style",
    "setting": "Where they typically film",
    "energy": "Common tone and delivery style"
  },
  "sequence_pattern": "2-3 sentences describing the dominant section ORDERING and timing template across these ads — e.g. 'All ads open with a Hook into Pain point in the first 20%, introduce the product around the one-third mark, then stack Scientific facts and Social proof before a Price or offer CTA in the final 10%.' Mention how many of the ads follow it and which one deviates, if any.",
  "structure_notes": [
    {
      "section": "Use only: Hook, Opener, Personal story, Pain point, Competitor mention, Scientific facts, Product introduction, Social proof, Price or offer, CTA",
      "description": "How this brand typically executes this section, with a concrete example line or visual from the ads"
    }
  ],
  "talking_points": [
    {
      "title": "Short name for this recurring claim or message e.g. Hormone-related hair loss",
      "category": "pain_point | benefit | proof | objection | offer",
      "placement": "Where in the ad structure this talking point typically lands e.g. 'During Scientific facts, right before Product introduction'",
      "appearances": [
        { "video_index": 0, "quote": "The verbatim line from that video's script expressing this talking point" }
      ]
    }
  ],
  "copy_templates": [
    {
      "template": "A fill-in-the-blank line used across multiple ads, with [placeholders] e.g. 'If you're a [target audience] dealing with [pain point], you need to hear this'",
      "variants": [
        { "video_index": 0, "line": "The verbatim variant from that video" }
      ]
    }
  ],
  "strongest_patterns": [
    {
      "title": "Short label e.g. Always opens with a mirror selfie",
      "observation": "What this brand consistently does and why it likely works for their audience"
    }
  ],
  "broll_logic": {
    "summary": "One paragraph describing the consistent B-roll pairing logic across all videos — what script content triggers each footage type and why this brand uses that pattern strategically",
    "rules": [
      {
        "trigger": "What in the script consistently triggers this footage type across these ads",
        "footage_type": "talking_head | talent_broll | product_broll | greenscreen",
        "reason": "Why this pairing is strategically effective for this brand's audience"
      }
    ]
  },
  "starred_frames": [
    {
      "video_index": 0,
      "timestamp": "00:00:00",
      "why": "Why this moment is visually or strategically effective — max 12 words"
    }
  ]
}

RULES:
- talking_points is the most important output. Cluster the value propositions and script claims across ALL videos into 4-10 named talking points. Every quote must be VERBATIM from that video's script — never invent or paraphrase. Only list an appearance if the talking point genuinely occurs in that video. Order by how many videos each point appears in, descending.
- copy_templates: only include lines where 2+ videos use a recognizably similar formulation. 2-5 templates max.
- structure_notes: one entry per section that appears in these ads, in the typical order they occur.
- starred_frames: pick 1-2 moments per video. Timestamps must be copied exactly from that video's timeline entries.
- keyword_clusters: 5-10 words or short phrases that recur across scripts, frequency is high/medium/low.`;

    console.log('Sending to Gemini for group synthesis...');

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      config: { responseMimeType: 'application/json' },
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    const raw = response.text;
    const parsed = parseGeminiJson(raw);

    if (!parsed) {
      console.log('JSON parse failed for group synthesis');
      return new Response(
        JSON.stringify({ error: 'Pattern synthesis came back in an unreadable format. Please try again.', raw }),
        { status: 502 }
      );
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
