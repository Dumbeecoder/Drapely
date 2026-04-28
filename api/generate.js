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
    // Convert base64 to buffer and upload to Supabase
    const base64Data = garment_img.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = 'suit-' + Date.now() + '.jpg';

    // Upload to Supabase storage
    const uploadRes = await fetch(
      'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/suits/' + filename,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'image/jpeg',
          'x-upsert': 'true'
        },
        body: buffer
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.log('Supabase upload error:', errText);
      return res.status(500).json({ error: 'Upload failed: ' + errText });
    }

    const garmentUrl = 'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/suits/' + filename;
    console.log('Garment URL:', garmentUrl);
    console.log('Human URL:', models[model_index || 0]);

    // Create Replicate prediction
    const createRes = await fetch('https://api.replicate.com/v1/models/cuuupid/idm-vton/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          garm_img: garmentUrl,
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
    console.log('Prediction:', prediction.id, prediction.status, prediction.error);

    if (!prediction.id) {
      return res.status(500).json({ error: prediction.error || 'Failed to start generation' });
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
