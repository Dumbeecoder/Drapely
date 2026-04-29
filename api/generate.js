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
    console.log('API Key:', process.env.FASHN_API_KEY ? 'exists (' + process.env.FASHN_API_KEY.substring(0,8) + '...)' : 'MISSING');
    console.log('Model:', humanImg);
    console.log('Garment size:', garment_img.length);

    // Fashn.ai valid categories: tops, bottoms, one-piece
    // For Indian suits - use tops (covers the kameez top part)
    const body = {
      model_image: humanImg,
      garment_image: garment_img,
      category: 'tops',
      mode: 'balanced',
      garment_photo_type: 'auto',
      nsfw_filter: true,
      cover_feet: false,
      adjust_hands: false,
      restore_background: false,
      restore_clothes: false,
      flat_lay: false,
    };

    const response = await fetch('https://api.fashn.ai/v1/run', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FASHN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    console.log('HTTP status:', response.status);
    const text = await response.text();
    console.log('Full Fashn response:', text.substring(0, 800));

    let data;
    try { data = JSON.parse(text); }
    catch(e) { return res.status(500).json({ error: 'Bad JSON: ' + text.substring(0, 200) }); }

    if (data.error) {
      const errMsg = typeof data.error === 'object' ? JSON.stringify(data.error) : String(data.error);
      return res.status(500).json({ error: errMsg });
    }

    if (!data.id) {
      return res.status(500).json({ error: 'No ID: ' + JSON.stringify(data).substring(0, 300) });
    }

    return res.status(200).json({ prediction_id: data.id, status: data.status });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
