export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image, duration, prompt, end_image } = req.body;
  if (!image) return res.status(400).json({ error: 'Missing image' });

  try {
    // fal.ai accepts base64 data URIs directly - no upload needed
    const imageUrl = image; // pass base64 data URL directly

    // Build Kling input
    const input = {
      prompt: prompt || 'model walking gracefully, showing full outfit, Indian fashion photography',
      start_image_url: imageUrl,
      duration: String(duration || 5),
      cfg_scale: 0.5,
    };

    // Optional end frame - pass base64 directly
    if (end_image) {
      input.end_image_url = end_image;
    }

    console.log('Kling video — duration:', duration, 'prompt:', (prompt||'').substring(0,60));

    // Step 2: Submit to Kling 2.1 Pro via fal queue
    const submitRes = await fetch('https://queue.fal.run/fal-ai/kling-video/v2.1/pro/image-to-video', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input })
    });

    const submitData = await submitRes.json();
    console.log('Kling submit response:', JSON.stringify(submitData).substring(0, 300));

    if (!submitData.request_id) {
      return res.status(500).json({ error: 'No request_id from Kling', debug: JSON.stringify(submitData).substring(0, 200) });
    }

    return res.status(200).json({
      prediction_id: submitData.request_id,
      status: 'starting',
      provider: 'kling'
    });

  } catch (err) {
    console.error('Kling video error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
