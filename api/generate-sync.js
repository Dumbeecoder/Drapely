export const maxDuration = 120; // Vercel max: 120s on Pro plan

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { garment_img, model_index, prompt, garment_type, custom_model } = req.body;
  if (!garment_img) return res.status(400).json({ error: 'Missing image' });

  const modelIdx = parseInt(model_index) || 0;
  const isSaree = garment_type === 'saree';

  const models = [
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/fashn-export-1777461285245.jpeg',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/fashn-export-1777461108131.jpeg',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/ChatGPT%20Image%20May%204,%202026,%2001_56_44%20AM.png',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/ChatGPT%20Image%20May%204,%202026,%2001_57_37%20AM.png',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/ChatGPT%20Image%20May%204,%202026,%2001_59_01%20AM.png',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/ChatGPT%20Image%20May%204,%202026,%2002_01_12%20AM.png',
  ];

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

    // Get model image
    let humanImg;
    if (custom_model && custom_model.startsWith('data:')) {
      const customBase64 = custom_model.replace(/^data:image\/\w+;base64,/, '');
      const customRes = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: { 'Authorization': 'Client-ID 546c25a59c58ad7', 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: customBase64, type: 'base64' })
      });
      const customData = await customRes.json();
      humanImg = customData.success ? customData.data.link : models[0];
    } else {
      humanImg = models[modelIdx] || models[0];
    }

    const garmentDesc = isSaree
      ? 'Indian woman wearing an elegant saree with pallu draped gracefully, full length'
      : 'Indian woman wearing a beautiful salwar suit with dupatta, full length';

    let finalPrompt = prompt || '';
    if (!finalPrompt || finalPrompt === 'custom_bg_upload') {
      finalPrompt = garmentDesc + ', standing straight, professional Indian fashion photography, high quality';
    }

    // Start generation
    const startRes = await fetch('https://api.fashn.ai/v1/run', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FASHN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_name: 'product-to-model',
        inputs: {
          product_image: garmentUrl,
          model_image: humanImg,
          resolution: '1k',
          generation_mode: 'balanced',
          output_format: 'jpeg',
          prompt: finalPrompt,
        }
      })
    });

    const startData = await startRes.json();
    if (startData.error) return res.status(500).json({ error: String(startData.error) });
    if (!startData.id) return res.status(500).json({ error: 'No prediction ID' });

    const predId = startData.id;

    // Poll server-side — no Android browser throttling
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    let attempts = 0;
    while (attempts < 55) {
      await sleep(2000);
      const pollRes = await fetch(`https://api.fashn.ai/v1/status/${predId}`, {
        headers: { 'Authorization': `Bearer ${process.env.FASHN_API_KEY}` }
      });
      const pollData = await pollRes.json();

      if (pollData.status === 'succeeded') {
        const output = Array.isArray(pollData.output) ? pollData.output[0] : pollData.output;
        return res.status(200).json({ image_url: output, status: 'succeeded' });
      }
      if (pollData.status === 'failed') {
        return res.status(500).json({ error: pollData.error || 'Generation failed' });
      }
      attempts++;
    }

    return res.status(504).json({ error: 'Timed out — try again' });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
