export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image, duration, prompt, end_image } = req.body;
  if (!image) return res.status(400).json({ error: 'Missing image' });

  try {
    // Step 1: Upload image to fal storage to get a public URL
    // fal.ai requires public URLs, not base64
    const uploadRes = await fetch('https://fal.run/fal-ai/storage/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: image }) // base64 data URL
    });

    let imageUrl = image; // fallback
    if (uploadRes.ok) {
      const uploadData = await uploadRes.json();
      imageUrl = uploadData.url || image;
      console.log('Uploaded to fal storage:', imageUrl);
    } else {
      console.log('fal upload failed, using raw image');
    }

    // Build Kling input
    const input = {
      prompt: prompt || 'model walking gracefully, showing full outfit, Indian fashion photography',
      start_image_url: imageUrl,
      duration: String(duration || 5),
      cfg_scale: 0.5,
    };

    // Optional end frame
    if (end_image) {
      let endUrl = end_image;
      const endUpload = await fetch('https://fal.run/fal-ai/storage/upload', {
        method: 'POST',
        headers: { 'Authorization': `Key ${process.env.FAL_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: end_image })
      });
      if (endUpload.ok) {
        const ed = await endUpload.json();
        endUrl = ed.url || end_image;
      }
      input.end_image_url = endUrl;
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
