export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { garment_img, model_index } = req.body;
  if (!garment_img) return res.status(400).json({ error: 'Missing image' });

  const models = [
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/fashn-export-1777461285245.jpeg',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/fashn-export-1777461108131.jpeg',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/fashn-export-1777461285245.jpeg',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/fashn-export-1777461108131.jpeg',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/fashn-export-1777461285245.jpeg',
  ];

  try {
    const humanImg = models[model_index || 0];
    console.log('API Key prefix:', process.env.FASHN_API_KEY?.substring(0, 10));
    console.log('Model img:', humanImg);
    console.log('Garment img size:', garment_img.length);

    // Correct Fashn.ai request format — model_name + inputs wrapper
    const { prompt } = req.body;

    const requestBody = {
      model_name: 'tryon-v1.6',
      inputs: {
        model_image: humanImg,
        garment_image: garment_img,
        category: 'one-pieces',
        mode: 'quality',
        garment_photo_type: 'auto',
        restore_background: true,
        cover_feet: true,
        adjust_hands: true,
        restore_clothes: false,
        long_top: true,
      }
    };

    // Add prompt if provided (for background/style)
    if (prompt) {
      requestBody.inputs.prompt = prompt;
    }

    const response = await fetch('https://api.fashn.ai/v1/run', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FASHN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    console.log('HTTP Status:', response.status);
    const text = await response.text();
    console.log('Fashn response:', text.substring(0, 600));

    let data;
    try { data = JSON.parse(text); }
    catch(e) { return res.status(500).json({ error: 'Bad JSON: ' + text.substring(0, 200) }); }

    if (data.error) {
      const errMsg = typeof data.error === 'object' ? JSON.stringify(data.error) : String(data.error);
      console.log('Fashn error:', errMsg);
      return res.status(500).json({ error: errMsg });
    }

    if (!data.id) {
      return res.status(500).json({ error: 'No ID returned: ' + JSON.stringify(data).substring(0, 300) });
    }

    console.log('Success! Prediction ID:', data.id);
    return res.status(200).json({ prediction_id: data.id, status: data.status });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
