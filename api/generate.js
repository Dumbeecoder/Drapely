export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { garment_img, model_img } = req.body;
  if (!garment_img || !model_img) return res.status(400).json({ error: 'Missing images' });

  try {
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

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: err
