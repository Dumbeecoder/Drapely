export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image_url } = req.body;
  if (!image_url) return res.status(400).json({ error: 'Missing image_url' });

  try {
    // Fetch the image server-side and return as base64
    // This bypasses CORS so the browser can use it in canvas
    const response = await fetch(image_url);
    if (!response.ok) return res.status(500).json({ error: 'Failed to fetch image' });
    
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const dataUrl = `data:${contentType};base64,${base64}`;
    
    return res.status(200).json({ dataUrl });
  } catch (err) {
    console.error('Proxy error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
