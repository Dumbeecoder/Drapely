export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing prediction id' });

  try {
    const response = await fetch(`https://api.fashn.ai/v1/status/${id}`, {
      headers: {
        'Authorization': `Bearer ${process.env.FASHN_API_KEY}`,
      }
    });

    const data = await response.json();
    console.log('Fashn poll:', id, data.status, data.error || '');

    // Normalise so dashboard works with both 'completed' and 'succeeded'
    if (data.status === 'completed') data.status = 'succeeded';

    return res.status(200).json(data);

  } catch (err) {
    console.error('Poll error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
