export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = 'https://oqmoneclnirnhqpcdeqy.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const headers = {
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'apikey': SERVICE_KEY,
    'Content-Type': 'application/json',
  };

  // POST — add credits
  if (req.method === 'POST') {
    const { user_id, amount } = req.body;
    if (!user_id || !amount) return res.status(400).json({ error: 'Missing user_id or amount' });
    const getRes = await fetch(`${SUPABASE_URL}/rest/v1/credits?user_id=eq.${user_id}&select=balance`, { headers });
    const getRows = await getRes.json();
    const currentBalance = getRows[0]?.balance || 0;
    const newBalance = currentBalance + parseInt(amount);
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/credits?user_id=eq.${user_id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({ balance: newBalance }),
    });
    if (!upsertRes.ok) {
      const err = await upsertRes.text();
      return res.status(500).json({ error: err });
    }
    return res.status(200).json({ success: true, new_balance: newBalance });
  }

  // GET
  if (req.method === 'GET') {
    const { email, phone, list, user_id } = req.query;

    // ── GET CREDITS FOR SPECIFIC USER ──
    if (user_id) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/credits?user_id=eq.${user_id}&select=balance`, { headers });
      const rows = await r.json();
      return res.status(200).json({ balance: rows[0]?.balance || 0 });
    }

    // ── GET ALL CREDITS ──
    if (req.query.credits === 'true') {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/credits?select=user_id,balance`, { headers });
      const rows = await r.json();
      return res.status(200).json({ credits: rows });
    }

    // ── GET ALL TOPUPS (revenue) ──
    if (req.query.topups === 'true') {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/credit_topups?select=credits_added`, { headers });
      const rows = await r.json();
      return res.status(200).json({ topups: rows });
    }

    // ── GET TOPUPS FOR SPECIFIC USER ──
    if (req.query.user_topups) {
      const uid = req.query.user_topups;
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/credit_topups?user_id=eq.${uid}&order=created_at.desc`,
        { headers }
      );
      const rows = await r.json();
      return res.status(200).json({ topups: rows });
    }

    // ── GET PHOTOSHOOTS COUNT (for stat) ──
    if (req.query.photo_count === 'true') {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/photoshoots?select=user_id`,
        { headers }
      );
      const rows = await r.json();
      // Build photoMap: { user_id: count }
      const photoMap = {};
      (rows || []).forEach(function(p) {
        photoMap[p.user_id] = (photoMap[p.user_id] || 0) + 1;
      });
      return res.status(200).json({ total: (rows || []).length, photoMap });
    }

    // ── GET RECENT ACTIVITY FOR SPECIFIC USER ──
    if (req.query.activity) {
      const uid = req.query.activity;
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/photoshoots?user_id=eq.${uid}&order=created_at.desc&limit=5`,
        { headers }
      );
      const rows = await r.json();
      return res.status(200).json({ activity: rows });
    }

    // ── GET ALL USERS ──
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers });
    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.message || 'Supabase error' });

    const users = (data.users || []).map(u => ({
      id: u.id, email: u.email, phone: u.phone,
      user_metadata: u.user_metadata,
      created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
    }));

    if (list === 'true') return res.status(200).json({ users });

    if (email) {
      const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.status(200).json({ user });
    }

    if (phone) {
      const norm = p => p.replace(/[\s\-()]/g, '');
      const q = norm(phone);
      const user = users.find(u => {
        const meta = u.user_metadata || {};
        const p = norm(meta.phone || u.phone || '');
        return p && (p === q || p.endsWith(q) || q.endsWith(p));
      });
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.status(200).json({ user });
    }

    return res.status(400).json({ error: 'Missing param' });
  }
}
