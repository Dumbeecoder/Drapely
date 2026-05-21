export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(200).json({ error: 'Pass ?id=YOUR_REQUEST_ID' });

  const endpoint = 'fal-ai/kling-video/v2.1/standard/image-to-video';
  const key = process.env.FAL_KEY;

  if (!key) return res.status(200).json({ error: 'FAL_KEY not set' });

  try {
    // Check status
    const statusRes = await fetch(
      `https://queue.fal.run/${endpoint}/requests/${id}/status`,
      { headers: { 'Authorization': `Key ${key}` } }
    );
    const statusText = await statusRes.text();

    // Get result
    const resultRes = await fetch(
      `https://queue.fal.run/${endpoint}/requests/${id}`,
      { headers: { 'Authorization': `Key ${key}` } }
    );
    const resultText = await resultRes.text();

    return res.status(200).json({
      status_code: statusRes.status,
      status_body: JSON.parse(statusText),
      result_code: resultRes.status,
      result_body: JSON.parse(resultText)
    });
  } catch(e) {
    return res.status(200).json({ error: e.message });
  }
}
