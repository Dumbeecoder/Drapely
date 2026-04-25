export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { garment_img, model_img } = req.body;
  if (!garment_img || !model_img) return res.status(400).json({ error: 'Missing images' });

  try {
    // Retry up to 3 times — model may need to warm up
    let lastError = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
      const response = await fetch(
        'https://api-inference.huggingface.co/models/yisol/IDM-VTON',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.HUGGING_FACE_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: {
              garm_img: garment_img,
              human_img: model_img,
              garment_des: 'Indian designer suit',
              is_checked: true,
              denoise_steps: 25,
              seed: 42
            }
          })
        }
      );

      const contentType = response.headers.get('content-type') || '';

      // If we got an image back — success!
      if (contentType.includes('image')) {
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const imageUrl = `data:image/jpeg;base64,${base64}`;
        return res.status(200).json({ output: [imageUrl] });
      }

      // Otherwise read the error
      const text = await response.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = { error: text }; }

      // Model is loading — wait and retry
      if (parsed.error && parsed.error.includes('loading')) {
        const wait = (parsed.estimated_time || 20) * 1000;
        await new Promise(r => setTimeout(r, Math.min(wait, 25000)));
        continue;
      }

      lastError = parsed.error || text;
      break;
    }

    return res.status(500).json({ error: lastError || 'Model unavailable. Please try again in 1 minute.' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
