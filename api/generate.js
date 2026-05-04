export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { garment_img, model_index, prompt, garment_type, custom_model, custom_bg } = req.body;
  if (!garment_img) return res.status(400).json({ error: 'Missing image' });

  const models = [
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/fashn-export-1777461285245.jpeg',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/fashn-export-1777461108131.jpeg',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/ChatGPT%20Image%20May%204,%202026,%2001_57_37%20AM.png',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/ChatGPT%20Image%20May%204,%202026,%2001_59_01%20AM.png',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/ChatGPT%20Image%20May%204,%202026,%2002_01_12%20AM.png',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/ChatGPT%20Image%20May%204,%202026,%2002_03_27%20AM.png',
  ];

  // Declare isSaree early so it's available everywhere
  const isSaree = garment_type === 'saree';

  try {
    const base64Data = garment_img.replace(/^data:image\/\w+;base64,/, '');
    const imgurRes = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: { 'Authorization': 'Client-ID 546c25a59c58ad7', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Data, type: 'base64' })
    });
    const imgurData = await imgurRes.json();
    if (!imgurData.success) return res.status(500).json({ error: 'Image upload failed' });
    const garmentUrl = imgurData.data.link;

    // Handle mannequin (index 98 or 6) — use actual mannequin model image
    if (model_index === 98 || model_index === 6) {
      const mannequinImg = 'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/mannequin.jpg';
      const garmentDesc = isSaree ? 'elegant saree on mannequin' : 'salwar suit on mannequin';
      const scenePrompt = prompt || 'clean white studio background, soft studio lighting';
      const mannequinPrompt = garmentDesc + ', ' + scenePrompt + ', professional fashion photography, full length, high quality';
      const mannequinBody = {
        model_name: 'product-to-model',
        inputs: {
          product_image: garmentUrl,
          model_image: mannequinImg,
          resolution: '1k',
          generation_mode: 'balanced',
          output_format: 'jpeg',
          prompt: mannequinPrompt,
        }
      };
      const mannequinRes = await fetch('https://api.fashn.ai/v1/run', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.FASHN_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(mannequinBody)
      });
      const mannequinData = await mannequinRes.json();
      if (mannequinData.error) return res.status(500).json({ error: String(mannequinData.error) });
      if (!mannequinData.id) return res.status(500).json({ error: 'No ID returned' });
      return res.status(200).json({ prediction_id: mannequinData.id, status: mannequinData.status });
    }

    let humanImg;
    if (custom_model && custom_model.startsWith('data:')) {
      const customBase64 = custom_model.replace(/^data:image\/\w+;base64,/, '');
      const customImgurRes = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: { 'Authorization': 'Client-ID 546c25a59c58ad7', 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: customBase64, type: 'base64' })
      });
      const customImgurData = await customImgurRes.json();
      humanImg = customImgurData.success ? customImgurData.data.link : models[0];
    } else {
      humanImg = models[model_index] || models[0];
    }

    const garmentDesc = isSaree
      ? 'Indian woman wearing an elegant saree with pallu draped gracefully, full length'
      : 'Indian woman wearing a beautiful salwar suit with dupatta, full length';

    // Handle custom background image
    let bgPromptExtra = prompt || '';
    if (custom_bg && custom_bg.startsWith('data:')) {
      const bgBase64 = custom_bg.replace(/^data:image\/\w+;base64,/, '');
      const bgImgurRes = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: { 'Authorization': 'Client-ID 546c25a59c58ad7', 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: bgBase64, type: 'base64' })
      });
      const bgImgurData = await bgImgurRes.json();
      if (bgImgurData.success) {
        bgPromptExtra = 'background inspired by uploaded scene, professional Indian fashion photography';
      }
    }
    const finalPrompt = [garmentDesc, bgPromptExtra].filter(Boolean).join(', ');

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

    const response = await fetch('https://api.fashn.ai/v1/run', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FASHN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    const text = await response.text();
    console.log('Fashn status:', response.status, text.substring(0, 200));

    let data;
    try { data = JSON.parse(text); }
    catch(e) { return res.status(500).json({ error: 'Bad JSON: ' + text.substring(0, 200) }); }

    if (data.error) return res.status(500).json({ error: typeof data.error === 'object' ? JSON.stringify(data.error) : String(data.error) });
    if (!data.id) return res.status(500).json({ error: 'No ID: ' + JSON.stringify(data).substring(0, 200) });

    return res.status(200).json({ prediction_id: data.id, status: data.status });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
