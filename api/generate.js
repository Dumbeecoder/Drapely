export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { garment_img, model_index } = req.body;
  if (!garment_img) return res.status(400).json({ error: 'Missing suit image' });

  const models = [
    'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=768&q=80',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=768&q=80',
    'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=768&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=768&q=80',
    'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=768&q=80',
  ];

  const humanImg = models[model_index || 0];

  try {
    // Start prediction
    const response = await fetch('https://api.replicate.com/v1/models/cuuupid/idm-vton/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=60'
      },
      body: JSON.stringify({
        input: {
          garm_img: garment_img,
          human_img: humanImg,
          garment_des: 'Indian designer suit',
          is_checked: true,
          is_checked_crop: false,
          denoise_steps: 30,
          seed: 42
        }
      })
    });

    const prediction = await response.json();

    if (prediction.error) {
      return res.status(500).json({ error: prediction.error });
    }

    // If still processing, poll for result
    if (prediction.status !== 'succeeded') {
      let attempts = 0;
      let result = prediction;

      while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < 30) {
        await new Promise(r => setTimeout(r, 3000));
        const poll = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
          headers: { 'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}` }
        });
        result = await poll.json();
        attempts++;
      }

      if (result.status === 'failed') {
        return res.status(500).json({ error: result.error || 'Generation failed' });
      }

      return res.status(200).json({ output: result.output });
    }

    return res.status(200).json({ output: prediction.output });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
