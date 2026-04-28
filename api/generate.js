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
    // Upload to Imgur
    const base64Data = garment_img.replace(/^data:image\/\w+;base64,/, '');
    const imgurRes = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: { 'Authorization': 'Client-ID 546c25a59c58ad7', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Data, type: 'base64' })
    });
    const imgurData = await imgurRes.json();
    if (!imgurData.success) return res.status(500).json({ error: 'Image upload failed' });

    // Create Replicate prediction — DON'T wait for it
    const createRes = await fetch('https://api.replicate.com/v1/models/cuuupid/idm-vton/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          garm_img: imgurData.data.link,
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
    if (!prediction.id) return res.status(500).json({ error: prediction.error || 'Failed to start' });

    // Return prediction ID immediately — browser will poll
    return res.status(200).json({ 
      prediction_id: prediction.id,
      status: prediction.status
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
