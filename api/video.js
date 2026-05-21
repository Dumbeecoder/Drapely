export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image, duration, prompt, end_image } = req.body;
  if (!image) return res.status(400).json({ error: 'Missing image' });

  try {
    // Compress image to reduce size - Vercel has 4.5MB body limit
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    console.log('Image size:', Math.round(buffer.length / 1024), 'KB');

    if (buffer.length > 3 * 1024 * 1024) {
      console.log('Image too large, rejecting');
      return res.status(400).json({ error: 'Image too large. Please use a smaller photo.' });
    }

    // Use image directly as data URL
    const imageUrl = image;

    // Build Kling input
    // V3 Standard uses start_image_url (different from v2.1)
    const input = {
      prompt: prompt || 'model walking gracefully, showing full outfit, Indian fashion photography',
      start_image_url: imageUrl,
      duration: String(duration || 5),
      cfg_scale: 0.5,
      generate_audio: false,
    };

    if (end_image) {
      input.end_image_url = end_image;
    }

    console.log('Kling V3 Standard video — duration:', duration, 'prompt:', (prompt||'').substring(0,60));

    // Submit to Kling V3 Standard via fal queue
    const submitRes = await fetch('https://queue.fal.run/fal-ai/kling-video/v3/standard/image-to-video', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input)  // send directly, not { input }
    });

    const submitData = await submitRes.json();
    console.log('Kling submit response:', JSON.stringify(submitData).substring(0, 300));

    if (!submitData.request_id) {
      return res.status(500).json({ error: 'No request_id from Kling', debug: JSON.stringify(submitData).substring(0, 200) });
    }

    return res.status(200).json({
      prediction_id: submitData.request_id,
      status_url: submitData.status_url,
      response_url: submitData.response_url,
      status: 'starting',
      provider: 'kling'
    });

  } catch (err) {
    console.error('Kling video error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
