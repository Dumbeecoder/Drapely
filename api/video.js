export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, image, duration } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  try {
    console.log('Starting video, duration:', duration);

    const body = {
      input: {
        prompt: prompt,
        duration: duration || 5,
        aspect_ratio: '9:16',
        negative_prompt: 'blurry, low quality, distorted, ugly',
        cfg_scale: 0.5,
      }
    };

    // Add image if provided
    if (image) body.input.start_image = image;

    const response = await fetch('https://api.replicate.com/v1/models/kwaivgi/kling-v3-omni-video/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    const prediction = await response.json();
    console.log('Kling response:', prediction.id, prediction.status, prediction.error);

    if (!prediction.id) {
      return res.status(500).json({ 
        error: prediction.error || prediction.detail || 'Failed to start video generation',
        debug: JSON.stringify(prediction).substring(0, 200)
      });
    }

    return res.status(200).json({ prediction_id: prediction.id, status: prediction.status });

  } catch (err) {
    console.error('Video error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
