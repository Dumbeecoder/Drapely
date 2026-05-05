export const maxDuration = 120;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image, duration, prompt } = req.body;
  if (!image) return res.status(400).json({ error: 'Missing image' });

  try {
    // Start video generation
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
          resolution: '1080p',
          prompt: prompt || ''
        }
      })
    });

    const data = await response.json();
    console.log('Fashn video start:', JSON.stringify(data).substring(0, 200));

    if (data.error) return res.status(500).json({ error: typeof data.error === 'object' ? JSON.stringify(data.error) : data.error });
    if (!data.id) return res.status(500).json({ error: 'No prediction ID', debug: JSON.stringify(data).substring(0, 200) });

    const predId = data.id;

    // Poll server-side — no Android browser throttling
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    let attempts = 0;

    while (attempts < 55) {
      await sleep(3000);

      const pollRes = await fetch(`https://api.fashn.ai/v1/status/${predId}`, {
        headers: { 'Authorization': `Bearer ${process.env.FASHN_API_KEY}` }
      });
      const pollData = await pollRes.json();
      console.log('Poll', attempts, 'status:', pollData.status);

      if (pollData.status === 'succeeded') {
        const videoUrl = Array.isArray(pollData.output) ? pollData.output[0] : pollData.output;
        return res.status(200).json({ video_url: videoUrl, status: 'succeeded' });
      }
      if (pollData.status === 'failed') {
        return res.status(500).json({ error: pollData.error || 'Video generation failed' });
      }

      attempts++;
    }

    return res.status(504).json({ error: 'Timed out — please try again' });

  } catch (err) {
    console.error('Video sync error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
