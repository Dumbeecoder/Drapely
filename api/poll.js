export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing prediction id' });

  try {
    const response = await fetch(`https://api.fashn.ai/v1/status/${id}`, {
      headers: {
        'Authorization': `Bearer ${process.env.FASHN_API_KEY}`,
        'Cache-Control': 'no-cache',
      }
    });

    const text = await response.text();
    console.log('Poll response:', text.substring(0, 500));

    let data;
    try { data = JSON.parse(text); }
    catch(e) { return res.status(500).json({ error: 'Bad JSON: ' + text.substring(0, 200) }); }

    console.log('Status:', data.status, 'Output:', JSON.stringify(data.output));

    // Normalise completed -> succeeded
    if (data.status === 'completed') data.status = 'succeeded';

    // Ensure output is array
    if (data.output && !Array.isArray(data.output)) {
      data.output = [data.output];
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('Poll error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
