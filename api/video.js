export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image, duration, prompt } = req.body;
  if (!image) return res.status(400).json({ error: 'Missing image' });

  try {
    console.log('Starting Fashn.ai video, duration:', duration);

    const response = await fetch('https://api.fashn.ai/v1/run', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FASHN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_name: 'image-to-video',
        inputs: {
          image: image,
          duration: duration || 5,
          resolution: '720p',
          prompt: prompt || ''
        }
      })
    });

    const data = await response.json();
    console.log('Fashn video response:', JSON.stringify(data).substring(0, 200));

    if (data.error) return res.status(500).json({ error: data.error });
    if (!data.id) return res.status(500).json({ error: 'No prediction ID', debug: JSON.stringify(data) });

    return res.status(200).json({ prediction_id: data.id, status: data.status });

  } catch (err) {
    console.error('Video error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
