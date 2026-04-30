export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { garment_img, model_index, prompt, garment_type } = req.body;
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

    // Upload garment to Imgur for clean public URL
    const base64Data = garment_img.replace(/^data:image\/\w+;base64,/, '');
    const imgurRes = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: { 'Authorization': 'Client-ID 546c25a59c58ad7', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Data, type: 'base64' })
    });
    const imgurData = await imgurRes.json();
    if (!imgurData.success) return res.status(500).json({ error: 'Image upload failed' });
    const garmentUrl = imgurData.data.link;

    // Build garment-specific prompt
    const isSaree = garment_type === 'saree';
    const garmentPrompt = isSaree
      ? 'Indian woman wearing an elegant saree with pallu draped gracefully, traditional look, full length'
      : 'Indian woman wearing a beautiful salwar suit with dupatta, full length';

    const finalPrompt = [garmentPrompt, prompt || ''].filter(Boolean).join(', ');

    const requestBody = {
      model_name: 'product-to-model',
      inputs: {
        product_image: garmentUrl,
        model_image: humanImg,
        resolution: '1k',
        generation_mode: 'balanced',
        output_format: 'jpeg',
        prompt: finalPrompt,
      }
    };

    console.log('Garment type:', garment_type, 'Prompt:', finalPrompt.substring(0, 80));

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
    console.log('Fashn response:', text.substring(0, 400));

    let data;
    try { data = JSON.parse(text); }
    catch(e) { return res.status(500).json({ error: 'Bad JSON: ' + text.substring(0, 200) }); }

    if (data.error) return res.status(500).json({ error: typeof data.error === 'object' ? JSON.stringify(data.error) : String(data.error) });
    if (!data.id) return res.status(500).json({ error: 'No ID: ' + JSON.stringify(data).substring(0, 200) });

    console.log('Success! ID:', data.id);
    return res.status(200).json({ prediction_id: data.id, status: data.status });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
