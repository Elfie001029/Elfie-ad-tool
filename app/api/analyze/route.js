import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function formatAd(ad) {
  const body = ad.ad_creative_bodies?.[0] || ad.ad_creative_body || 'No copy available';
  const title = ad.ad_creative_link_titles?.[0] || ad.ad_creative_link_title || '';
  return `Page: ${ad.page_name || 'Unknown'}\nHeadline: ${title}\nBody: ${body}\nDate: ${ad.ad_creation_time || 'Unknown'}`;
}

export async function POST(request) {
  const body = await request.json();

  try {
    let prompt;

    if (body.analyzeAll && body.ads) {
      const adSummaries = body.ads.slice(0, 5).map((ad, i) => `Ad ${i + 1}:\n${formatAd(ad)}`).join('\n\n---\n\n');
      prompt = `Analyze these Facebook ads from a creative strategy perspective:\n\n${adSummaries}\n\nProvide: 1) A breakdown of each ad's hook and copy angle, 2) Patterns you notice across all ads, 3) Three actionable takeaways a competitor brand can use for their own paid social.`;
    } else if (body.ad) {
      prompt = `Analyze this Facebook ad:\n\n${formatAd(body.ad)}`;
    } else {
      return NextResponse.json({ error: 'No ad data provided.' }, { status: 400 });
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: 'You are a senior creative strategist specializing in paid social advertising. Analyze Facebook ads concisely and specifically. For each ad cover: 1) Hook and scroll-stop strategy, 2) Copy angle and emotional trigger, 3) Likely target audience, 4) CTA and conversion strategy, 5) One key insight a competitor should learn. Be direct and actionable. Plain text only, no markdown symbols.',
      messages: [{ role: 'user', content: prompt }],
    });

    const analysis = message.content[0]?.text || 'Analysis unavailable.';
    return NextResponse.json({ analysis });
  } catch (err) {
    console.error('Anthropic error:', err);
    return NextResponse.json({ error: 'Analysis failed. Check your Anthropic API key.' }, { status: 500 });
  }
}
