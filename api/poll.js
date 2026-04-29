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

    const text = await response.text();
    console.log('Fashn poll raw response:', text.substring(0, 800));

    let data;
    try { data = JSON.parse(text); }
    catch(e) { return res.status(500).json({ error: 'Bad JSON: ' + text.substring(0, 200) }); }

    console.log('Status:', data.status);
    console.log('Output:', JSON.stringify(data.output));
    console.log('Error:', data.error);

    // Fashn.ai uses 'completed' — normalise to 'succeeded' for dashboard
    if (data.status === 'completed') {
      data.status = 'succeeded';
    }

    // Extract output — Fashn.ai returns array of URLs
    // Make sure output is properly set
    if (data.status === 'succeeded' && data.output) {
      if (Array.isArray(data.output)) {
        console.log('Output URLs:', data.output);
      } else if (typeof data.output === 'string') {
        data.output = [data.output];
      }
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('Poll error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
