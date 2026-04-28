export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { garment_img, model_index } = req.body;
  if (!garment_img) return res.status(400).json({ error: 'Missing image' });

  const models = [
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/alok_model_1.jpg',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/alok_model_2.jpg',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/alok_model_3.jpg',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/alok_model_4.jpg',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/alok_model_5.jpg',
  ];

  try {
    console.log('Starting, model:', model_index, 'img size:', garment_img.length);

    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: '3b032a70c29aef7b9c3222f2e40b71660201d8c288336475ba326f3ca278a3e1',
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
    console.log('Prediction created:', prediction.id, 'status:', prediction.status, 'error:', prediction.error);

    if (!prediction.id) {
      return res.status(500).json({
        error: prediction.error || prediction.detail || 'Failed to create prediction',
        debug: JSON.stringify(prediction).substring(0, 300)
      });
    }

    return res.status(200).json({
      prediction_id: prediction.id,
      status: prediction.status
    });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
