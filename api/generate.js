export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { garment_img, model_index } = req.body;
  if (!garment_img) return res.status(400).json({ error: 'Missing image' });

  const models = [
    'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=512',
    'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=512',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=512',
    'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=512',
    'https://images.unsplash.com/photo-1483959651481-dc75b89291f1?w=512',
  ];

  try {
    const response = await fetch('https://api-inference.huggingface.co/models/Kwai-Kolors/Kolors-Virtual-Try-On', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGING_FACE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          human_image: models[model_index || 0],
          garment_image: garment_img,
        }
      })
    });

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('image')) {
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      return res.status(200).json({ output: [`data:image/jpeg;base64,${base64}`] });
    }

    const text = await response.text();
    let msg = text;
    try { msg = JSON.parse(text).error || text; } catch {}
    return res.status(500).json({ error: msg });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
