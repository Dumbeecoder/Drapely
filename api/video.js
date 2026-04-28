
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, image, duration } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  try {
    console.log('Starting video generation, duration:', duration);

    const response = await fetch('https://api.replicate.com/v1/models/kwaivgi/kling-v2.1-standard/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          prompt: prompt,
          start_image: image || undefined,
          duration: duration || 5,
          aspect_ratio: '9:16',
          negative_prompt: 'blurry, low quality, distorted, ugly, bad anatomy',
          cfg_scale: 0.5,
        }
      })
    });

    const prediction = await response.json();
    console.log('Kling response:', prediction.id, prediction.status, prediction.error);

    if (!prediction.id) {
      // Fallback to Wan 2.7 image-to-video
      const res2 = await fetch('https://api.replicate.com/v1/models/alibaba-cloud/wan-2.7-i2v/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            prompt: prompt,
            image: image || undefined,
            num_frames: duration === 10 ? 81 : 41,
            fps: 16,
            negative_prompt: 'blurry, low quality, distorted',
          }
        })
      });
      const p2 = await res2.json();
      console.log('Wan fallback:', p2.id, p2.status, p2.error);
      if (!p2.id) return res.status(500).json({ error: p2.error || 'Failed to start video generation' });
      return res.status(200).json({ prediction_id: p2.id, status: p2.status });
    }

    return res.status(200).json({ prediction_id: prediction.id, status: prediction.status });

  } catch (err) {
    console.error('Video error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
