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
    // Upload garment image to Imgur to get a public URL
    const base64Data = garment_img.replace(/^data:image\/\w+;base64,/, '');
    
    const imgurRes = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        'Authorization': 'Client-ID 546c25a59c58ad7',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ image: base64Data, type: 'base64' })
    });
    
    const imgurData = await imgurRes.json();
    console.log('Imgur upload:', imgurData.success, imgurData.data?.link);
    
    if (!imgurData.success) {
      return res.status(500).json({ error: 'Failed to upload image: ' + imgurData.data?.error });
    }
    
    const garmentUrl = imgurData.data.link;
    console.log('Garment URL:', garmentUrl);
    console.log('Human URL:', humanImg);

    // Send to Replicate
    const response = await fetch('https://api.replicate.com/v1/models/cuuupid/idm-vton/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=60'
      },
      body: JSON.stringify({
        input: {
          garm_img: garmentUrl,
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
    console.log('Replicate status:', prediction.status, 'error:', prediction.error);

    if (prediction.error) {
      return res.status(500).json({ error: prediction.error });
    }

    // Poll for result
    let result = prediction;
    let attempts = 0;
    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < 40) {
      await new Promise(r => setTimeout(r, 4000));
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
        headers: { 'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}` }
      });
      result = await poll.json();
      console.log('Poll', attempts, ':', result.status);
      attempts++;
    }

    console.log('Final status:', result.status, 'output:', result.output);

    if (result.status === 'failed') {
      return res.status(500).json({ error: result.error || 'Generation failed' });
    }

    if (!result.output) {
      return res.status(500).json({ error: 'No image generated. Try again.' });
    }

    return res.status(200).json({ output: result.output });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
