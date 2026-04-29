export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { garment_img, model_index, prompt } = req.body;
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

    // Upload to Imgur for clean public URL
    const base64Data = garment_img.replace(/^data:image\/\w+;base64,/, '');
    console.log('Uploading to Imgur...');

    const imgurRes = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        'Authorization': 'Client-ID 546c25a59c58ad7',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ image: base64Data, type: 'base64' })
    });

    const imgurData = await imgurRes.json();
    if (!imgurData.success) {
      return res.status(500).json({ error: 'Image upload failed: ' + (imgurData.data?.error || 'unknown') });
    }

    const garmentUrl = imgurData.data.link;
    console.log('Garment URL:', garmentUrl);
    console.log('Model URL:', humanImg);

    // product-to-model: field is 'image' for product, 'model_image' for person
    const inputs = {
      image: garmentUrl,
      model_image: humanImg,
      prompt: prompt || 'Indian woman, full body, professional fashion photo, studio background',
    };

    const requestBody = {
      model_name: 'product-to-model',
      inputs: inputs
    };

    console.log('Sending to Fashn.ai product-to-model...');

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
    console.log('Fashn response:', text.substring(0, 800));

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

    console.log('Success! ID:', data.id);
    return res.status(200).json({ prediction_id: data.id, status: data.status });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
