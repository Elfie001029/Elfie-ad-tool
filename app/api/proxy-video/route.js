export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url');

  if (!videoUrl || !videoUrl.startsWith('https://')) {
    return new Response(JSON.stringify({ error: 'A valid https video URL is required.' }), { status: 400 });
  }

  try {
    const headers = {};
    const range = request.headers.get('range');
    if (range) headers['Range'] = range;

    const upstream = await fetch(videoUrl, { headers });

    const responseHeaders = {
      'Content-Type': upstream.headers.get('content-type') || 'video/mp4',
      'Access-Control-Allow-Origin': '*',
      'Accept-Ranges': 'bytes',
    };

    const contentRange = upstream.headers.get('content-range');
    if (contentRange) responseHeaders['Content-Range'] = contentRange;

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) responseHeaders['Content-Length'] = contentLength;

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to proxy video: ' + err.message }), { status: 500 });
  }
}
