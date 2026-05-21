export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const id = req.query.id || req.body?.id;
  const provider = req.query.provider || req.body?.provider;
  const statusUrl = decodeURIComponent(req.query.status_url || req.body?.status_url || '');
  const responseUrl = decodeURIComponent(req.query.response_url || req.body?.response_url || '');
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    if (provider === 'kling') {
      if (!process.env.FAL_KEY) {
        clearTimeout(timeout);
        return res.status(200).json({ status: 'processing', debug: 'FAL_KEY missing' });
      }

      // Use URLs directly from submit response
      const sUrl = statusUrl || `https://queue.fal.run/fal-ai/kling-video/v2.1/standard/image-to-video/requests/${id}/status`;
      const rUrl = responseUrl || `https://queue.fal.run/fal-ai/kling-video/v2.1/standard/image-to-video/requests/${id}`;
      console.log('Polling status URL:', sUrl);

      let statusData;
      try {
        const statusRes = await fetch(sUrl, {
          headers: { 'Authorization': `Key ${process.env.FAL_KEY}` },
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (!statusRes.ok) {
          const errText = await statusRes.text();
          console.error('Kling status error:', statusRes.status, errText.substring(0, 200));
          return res.status(200).json({ status: 'processing', debug: statusRes.status + ': ' + errText.substring(0, 100) });
        }
        statusData = await statusRes.json();
      } catch(e) {
        clearTimeout(timeout);
        return res.status(200).json({ status: 'processing', debug: e.message });
      }

      console.log('Kling status response:', JSON.stringify(statusData).substring(0, 300));
      const st = (statusData.status || '').toUpperCase();

      if (st === 'COMPLETED') {
        const resultRes = await fetch(rUrl, { headers: { 'Authorization': `Key ${process.env.FAL_KEY}` } });
        const result = await resultRes.json();
        console.log('=== KLING FULL RESULT ===', JSON.stringify(result));
        // Try every possible path fal.ai might return the video URL
        const videoUrl = result?.video?.url
          || result?.output?.video?.url
          || result?.videos?.[0]?.url
          || result?.data?.video?.url
          || result?.data?.videos?.[0]?.url
          || (typeof result?.video === 'string' ? result.video : null)
          || null;
        return res.status(200).json({ status: 'succeeded', output: videoUrl ? [videoUrl] : [], raw: JSON.stringify(result).substring(0, 500) });
      }
      if (st === 'FAILED' || st === 'ERROR') {
        return res.status(200).json({ status: 'failed', error: statusData.error || 'Failed' });
      }
      return res.status(200).json({ status: 'processing', queue_position: statusData.queue_position, kling_status: st });
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

  } catch(err) {
    clearTimeout(timeout);
    console.error('Poll catch:', err.message);
    return res.status(200).json({ status: 'processing', debug: err.message });
  }
}
