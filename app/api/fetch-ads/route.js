export async function POST(request) {
  const body = await request.json();
  const { search, country, limit } = body;

  if (!search) return new Response(JSON.stringify({ error: 'Search term is required.' }), { status: 400 });

  const apifyToken = process.env.APIFY_API_KEY;
  const adLibraryUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=${country || 'US'}&q=${encodeURIComponent(search)}&search_type=keyword_unordered&media_type=all`;

  try {
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/memo23~facebook-ads-library-scraper-cheerio/run-sync-get-dataset-items?token=${apifyToken}&timeout=120`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(120000),
        body: JSON.stringify({
          startUrls: [adLibraryUrl],
          maxItems: parseInt(limit) || 5,
        }),
      }
    );

    const raw = await runRes.text();
    console.log('APIFY RAW:', raw.slice(0, 800));

    let results;
    try {
      const parsed = JSON.parse(raw);
      results = Array.isArray(parsed) ? parsed : parsed.items || parsed.data || parsed.results || [];
    } catch(e) {
      return new Response(JSON.stringify({ error: 'Could not parse Apify response.' }), { status: 500 });
    }

    if (!results || results.length === 0) {
      return new Response(JSON.stringify({ error: 'No ads found. Try a different search term.' }), { status: 200 });
    }

    const ads = results.slice(0, parseInt(limit) || 5).map(r => ({
      page_name: r.pageName || r.page_name || r.advertiserName || 'Unknown',
      ad_creative_body: r.adCreativeBody || r.bodyText || r.body || r.text || '',
      ad_creative_link_title: r.adCreativeLinkTitle || r.title || r.headline || '',
      ad_creation_time: r.adCreationTime || r.startDate || r.createdAt || '',
      ad_snapshot_url: r.adSnapshotUrl || r.snapshotUrl || r.url || '',
    }));

    return new Response(JSON.stringify({ ads }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch ads: ' + err.message }), { status: 500 });
  }
}