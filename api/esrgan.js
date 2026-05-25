export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image_url } = req.body;
  if (!image_url) return res.status(400).json({ error: 'Missing image_url' });

  try {
    // Submit to fal.ai Real-ESRGAN (4x upscale + face enhancement)
    const submitRes = await fetch('https://queue.fal.run/fal-ai/esrgan', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url,
        scale: 2,              // 2x is enough — 4K from FASHN → true sharp 4K
        face_enhance: true,    // GFPGAN face restoration included
      })
    });

    if (!submitRes.ok) {
      const err = await submitRes.text();
      console.error('ESRGAN submit failed:', err);
      return res.status(200).json({ enhanced_url: null, error: 'ESRGAN submit failed' });
    }

    const submitData = await submitRes.json();
    const requestId = submitData.request_id;
    const responseUrl = submitData.response_url;
    const statusUrl = submitData.status_url;

    if (!requestId) {
      console.error('No request_id from fal.ai ESRGAN');
      return res.status(200).json({ enhanced_url: null });
    }

    // Poll for result (max 60s)
    const maxAttempts = 20;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 3000));

      const statusRes = await fetch(`${statusUrl}?cachebust=${Date.now()}`, {
        headers: { 'Authorization': `Key ${process.env.FAL_KEY}` },
        cache: 'no-store'
      });

      const statusData = await statusRes.json();
      console.log(`ESRGAN poll ${i+1}:`, statusData.status);

      if (statusData.status === 'COMPLETED') {
        // Fetch result
        const resultRes = await fetch(responseUrl, {
          headers: { 'Authorization': `Key ${process.env.FAL_KEY}` }
        });
        const result = await resultRes.json();
        const enhancedUrl = result?.image?.url || result?.output?.image?.url || null;
        console.log('ESRGAN result URL:', enhancedUrl);
        return res.status(200).json({ enhanced_url: enhancedUrl });
      }

      if (statusData.status === 'FAILED') {
        console.error('ESRGAN failed:', statusData);
        return res.status(200).json({ enhanced_url: null, error: 'ESRGAN processing failed' });
      }
    }

    // Timeout — return null so dashboard falls back to original
    console.log('ESRGAN timeout');
    return res.status(200).json({ enhanced_url: null, error: 'ESRGAN timeout' });

  } catch (err) {
    console.error('ESRGAN error:', err.message);
    // Always return 200 with null — dashboard falls back to original image
    return res.status(200).json({ enhanced_url: null, error: err.message });
  }
}
