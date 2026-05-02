export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { image_url } = req.body;
    if (!image_url) return res.status(400).json({ error: 'Missing image_url' });

    console.log('Fetching image:', image_url.substring(0, 80));

    const response = await fetch(image_url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Drapely/1.0)' }
    });

    if (!response.ok) {
      console.error('Fetch failed:', response.status, response.statusText);
      return res.status(500).json({ error: 'Failed to fetch image: ' + response.status });
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const dataUrl = `data:${contentType};base64,${base64}`;

    console.log('Success, dataUrl length:', dataUrl.length);
    return res.status(200).json({ dataUrl });

  } catch (err) {
    console.error('Watermark error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
