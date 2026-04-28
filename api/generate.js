export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { garment_img, model_index } = req.body;
  if (!garment_img) return res.status(400).json({ error: 'Missing suit image' });

  const models = [
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/model1-removebg-preview.png',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/model2-removebg-preview.png',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/model3-removebg-preview.png',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/model4-removebg-preview.png',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/model5-removebg-preview.png',
  ];

  const humanImg = models[model_index || 0];

  try {
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
    console.log('Replicate response:', JSON.stringify(prediction).substring(0, 500));

    if (prediction.error) {
      return res.status(500).json({ error: prediction.error });
    }

    if (prediction.status !== 'succeeded') {
      let result = prediction;
      let attempts = 0;
      while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < 40) {
        await new Promise(r => setTimeout(r, 4000));
        const poll = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
          headers: { 'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}` }
        });
        result = await poll.json();
        console.log('Poll status:', result.status, 'attempt:', attempts);
        attempts++;
      }
      if (result.status === 'failed') return res.status(500).json({ error: result.error || 'Generation failed' });
      return res.status(200).json({ output: result.output });
    }

    return res.status(200).json({ output: prediction.output });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
