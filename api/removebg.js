export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image_url } = req.body;
  if (!image_url) return res.status(400).json({ error: 'Missing image_url' });

  try {
    // Fetch the generated image
    const imgRes = await fetch(image_url);
    const imgBuffer = await imgRes.arrayBuffer();
    const imgBlob = Buffer.from(imgBuffer);

    // Send to PhotoRoom API (500 free/month, best for fashion)
    const formData = new FormData();
    const blob = new Blob([imgBlob], { type: 'image/jpeg' });
    formData.append('image_file', blob, 'photo.jpg');

    const removeRes = await fetch('https://sdk.photoroom.com/v1/segment', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.PHOTOROOM_API_KEY,
      },
      body: formData,
    });

    if (!removeRes.ok) {
      const errText = await removeRes.text();
      console.log('PhotoRoom error:', removeRes.status, errText);
      return res.status(500).json({ error: 'PhotoRoom failed: ' + removeRes.status });
    }

    // Return as base64 PNG with transparent background
    const resultBuffer = await removeRes.arrayBuffer();
    const base64 = Buffer.from(resultBuffer).toString('base64');
    return res.status(200).json({ 
      cutout: 'data:image/png;base64,' + base64 
    });

  } catch (err) {
    console.error('removebg error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
