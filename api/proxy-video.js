export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  try {
    const decodedUrl = decodeURIComponent(url);
    // Only allow fal.media URLs for security
    if (!decodedUrl.includes('fal.media') && !decodedUrl.includes('fal.run')) {
      return res.status(403).json({ error: 'URL not allowed' });
    }

    const videoRes = await fetch(decodedUrl);
    if (!videoRes.ok) {
      return res.status(videoRes.status).json({ error: 'Failed to fetch video' });
    }

    const contentType = videoRes.headers.get('content-type') || 'video/mp4';
    const contentLength = videoRes.headers.get('content-length');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    // Stream the video
    const buffer = await videoRes.arrayBuffer();
    res.status(200).send(Buffer.from(buffer));

  } catch(err) {
    console.error('Proxy error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
