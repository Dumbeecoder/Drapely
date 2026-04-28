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
    // Upload garment to Imgur
    const base64Data = garment_img.replace(/^data:image\/\w+;base64,/, '');
    const imgurRes = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: { 'Authorization': 'Client-ID 546c25a59c58ad7', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Data, type: 'base64' })
    });
    const imgurData = await imgurRes.json();
    if (!imgurData.success) return res.status(500).json({ error: 'Image upload failed' });
    const garmentUrl = imgurData.data.link;
    console.log('Garment URL:', garmentUrl);

    // Create prediction
    const createRes = await fetch('https://api.replicate.com/v1/models/cuuupid/idm-vton/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          garm_img: garmentUrl,
          human_img: humanImg,
          garment_des: 'Indian designer suit',
          is_checked: true,
          is_checked_crop: false,
          denoise_steps: 20,
          seed: 42
        }
      })
    });

    const prediction = await createRes.json();
    console.log('Created prediction:', prediction.id, 'status:', prediction.status);

    if (!prediction.id) return res.status(500).json({ error: prediction.error || 'Failed to create prediction' });
    if (prediction.status === 'succeeded') return res.status(200).json({ output: prediction.output });

    // Poll — max 55 seconds total (Vercel limit is 60s on hobby)
    const startTime = Date.now();
    let result = prediction;

    while (Date.now() - startTime < 55000) {
      await new Promise(r => setTimeout(r, 3000));
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
        headers: { 'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}` }
      });
      result = await pollRes.json();
      console.log('Status:', result.status, 'time:', Math.round((Date.now()-startTime)/1000) + 's');

      if (result.status === 'succeeded') {
        console.log('Output:', result.output);
        return res.status(200).json({ output: result.output });
      }
      if (result.status === 'failed') {
        return res.status(500).json({ error: result.error || 'Generation failed' });
      }
    }

    // Timed out — return prediction ID so client can poll
    return res.status(202).json({ 
      pending: true, 
      prediction_id: result.id,
      message: 'Still processing — use prediction_id to check status'
    });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
