export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, provider } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    // Kling via fal.ai — correct queue status endpoint
    if (provider === 'kling') {
      const endpoint = 'fal-ai/kling-video/v2.1/pro/image-to-video';
      const statusRes = await fetch(
        `https://queue.fal.run/${endpoint}/requests/${id}/status`,
        { headers: { 'Authorization': `Key ${process.env.FAL_KEY}` } }
      );
      const data = await statusRes.json();
      console.log('Kling poll status:', data.status, 'queue pos:', data.queue_position);

      if (data.status === 'COMPLETED') {
        // Fetch result
        const resultRes = await fetch(
          `https://queue.fal.run/${endpoint}/requests/${id}`,
          { headers: { 'Authorization': `Key ${process.env.FAL_KEY}` } }
        );
        const result = await resultRes.json();
        const videoUrl = result?.video?.url || result?.output?.video?.url || null;
        console.log('Kling result video URL:', videoUrl);
        return res.status(200).json({
          status: 'succeeded',
          output: videoUrl ? [videoUrl] : []
        });
      }

      if (data.status === 'FAILED' || data.status === 'ERROR') {
        return res.status(200).json({ status: 'failed', error: data.error || 'Generation failed' });
      }

      // IN_QUEUE or IN_PROGRESS
      return res.status(200).json({
        status: 'processing',
        queue_position: data.queue_position,
        kling_status: data.status
      });
    }

    // Default: FASHN polling
    const pollRes = await fetch(`https://api.fashn.ai/v1/status/${id}`, {
      headers: { 'Authorization': `Bearer ${process.env.FASHN_API_KEY}` }
    });
    const data = await pollRes.json();

    if (data.status === 'completed') {
      return res.status(200).json({ status: 'succeeded', output: data.output });
    }
    if (data.status === 'failed') {
      return res.status(200).json({ status: 'failed', error: data.error });
    }
    return res.status(200).json({ status: data.status });

  } catch (err) {
    console.error('Poll error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
