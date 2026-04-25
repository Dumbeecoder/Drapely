export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { garment_img, model_index } = req.body;
  if (!garment_img) return res.status(400).json({ error: 'Missing suit image' });

  // Fixed model images hosted publicly
  const modelUrls = [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Gatto_europeo4.jpg/220px-Gatto_europeo4.jpg',
    'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=512&q=80',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=512&q=80',
    'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=512&q=80',
    'https://images.unsplash.com/photo-1483959651481-dc75b89291f1?w=512&q=80',
  ];

  const humanImgUrl = modelUrls[model_index || 0];

  try {
    // Use Gradio API for IDM-VTON which accepts URLs
    const response = await fetch(
      'https://yisol-idm-vton.hf.space/run/predict',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fn_index: 0,
          data: [
            { path: humanImgUrl },
            { path: humanImgUrl },
            { path: garment_img },
            { path: garment_img },
            true,
            false,
            'Indian designer suit',
            25,
            42
          ]
        })
      }
    );

    const data = await response.json();

    if (data.error) return res.status(500).json({ error: data.error });

    // Extract image from response
    const output = data.data;
    if (!output || !output[0]) return res.status(500).json({ error: 'No image returned. Try again.' });

    const imgData = output[0];
    const imageUrl = imgData.url || imgData.path || imgData;

    return res.status(200).json({ output: [imageUrl] });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
