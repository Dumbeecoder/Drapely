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
    const humanImg = models[model_index || 0];
    console.log('Fashn photo - model:', model_index, 'human:', humanImg);

    const response = await fetch('https://api.fashn.ai/v1/run', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FASHN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_name: 'tryon-v1.6',
        inputs: {
          model_image: humanImg,
          garment_image: garment_img,
          category: 'tops',
          mode: 'balanced',
          garment_photo_type: 'auto',
          nsfw_filter: true,
        }
      })
    });

    const data = await response.json();
    console.log('Fashn response:', JSON.stringify(data).substring(0, 300));

    if (data.error) return res.status(500).json({ error: typeof data.error === 'object' ? JSON.stringify(data.error) : data.error });
    if (!data.id) return res.status(500).json({ error: 'No prediction ID returned', debug: JSON.stringify(data).substring(0, 200) });

    return res.status(200).json({ prediction_id: data.id, status: data.status });

  } catch (err) {
    console.error('Generate error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
