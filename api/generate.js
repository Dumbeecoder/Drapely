export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { garment_img, model_index } = req.body;
  if (!garment_img) return res.status(400).json({ error: 'Missing image' });

  const models = [
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/model1-removebg-preview.png',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/model2-removebg-preview.png',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/model3-removebg-preview.png',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/model4-removebg-preview.png',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/model5-removebg-preview.png',
  ];

  try {
    console.log('Starting generation, model_index:', model_index);
    console.log('Garment img size:', garment_img.length);
    console.log('Human img:', models[model_index || 0]);

    // Send base64 directly to Replicate
    const createRes = await fetch('https://api.replicate.com/v1/models/cuuupid/idm-vton/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          garm_img: garment_img,
          human_img: models[model_index || 0],
          garment_des: 'Indian designer suit',
          is_checked: true,
          is_checked_crop: false,
          denoise_steps: 20,
          seed: 42
        }
      })
    });

    const prediction = await createRes.json();
    console.log('Replicate response:', JSON.stringify(prediction).substring(0, 300));

    if (!prediction.id) {
      return res.status(500).json({ 
        error: prediction.error || prediction.detail || 'Failed to start — check Replicate API key',
        debug: JSON.stringify(prediction).substring(0, 200)
      });
    }

    return res.status(200).json({
      prediction_id: prediction.id,
      status: prediction.status
    });

  } catch (err) {
    console.error('Catch error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
