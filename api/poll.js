export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const id = req.query.id || req.body?.id;
  const provider = req.query.provider || req.body?.provider;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  // 8 second timeout to stay within Vercel limits
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    if (provider === 'kling') {
      if (!process.env.FAL_KEY) {
        clearTimeout(timeout);
        return res.status(200).json({ status: 'processing', error: 'FAL_KEY missing' });
      }

      const endpoint = 'fal-ai/kling-video/v2.1/pro/image-to-video';
      let statusData;

      try {
        const statusRes = await fetch(
          `https://queue.fal.run/${endpoint}/requests/${id}/status`,
          {
            headers: { 'Authorization': `Key ${process.env.FAL_KEY}` },
            signal: controller.signal
          }
        );
        clearTimeout(timeout);

        if (!statusRes.ok) {
          const errText = await statusRes.text();
          console.error('Kling status HTTP error:', statusRes.status, errText.substring(0, 200));
          // Return processing so frontend keeps polling
          return res.status(200).json({ status: 'processing', debug: statusRes.status + ': ' + errText.substring(0, 100) });
        }
        statusData = await statusRes.json();
      } catch(fetchErr) {
        clearTimeout(timeout);
        console.error('Kling fetch error:', fetchErr.message);
        return res.status(200).json({ status: 'processing', debug: fetchErr.message });
      }

      console.log('Kling status:', JSON.stringify(statusData).substring(0, 200));

      if (statusData.status === 'COMPLETED') {
        const resultRes = await fetch(
          `https://queue.fal.run/${endpoint}/requests/${id}`,
          { headers: { 'Authorization': `Key ${process.env.FAL_KEY}` } }
        );
        const result = await resultRes.json();
        console.log('Kling result:', JSON.stringify(result).substring(0, 300));
        const videoUrl = result?.video?.url
          || result?.output?.video?.url
          || result?.videos?.[0]?.url
          || null;
        return res.status(200).json({ status: 'succeeded', output: videoUrl ? [videoUrl] : [] });
      }

      if (statusData.status === 'FAILED' || statusData.status === 'ERROR') {
        return res.status(200).json({ status: 'failed', error: statusData.error || 'Failed' });
      }

      return res.status(200).json({
        status: 'processing',
        queue_position: statusData.queue_position,
        kling_status: statusData.status
      });
    }

    // FASHN fallback
    const pollRes = await fetch(`https://api.fashn.ai/v1/status/${id}`, {
      headers: { 'Authorization': `Bearer ${process.env.FASHN_API_KEY}` },
      signal: controller.signal
    });
    clearTimeout(timeout);
    const data = await pollRes.json();

    if (data.status === 'completed') return res.status(200).json({ status: 'succeeded', output: data.output });
    if (data.status === 'failed') return res.status(200).json({ status: 'failed', error: data.error });
    return res.status(200).json({ status: data.status });

  } catch (err) {
    clearTimeout(timeout);
    console.error('Poll catch:', err.message);
    // Never return 500 — always return processing so frontend keeps trying
    return res.status(200).json({ status: 'processing', debug: err.message });
  }
}
