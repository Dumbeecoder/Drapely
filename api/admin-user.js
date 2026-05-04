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

    // Get current balance
    const getRes = await fetch(`${SUPABASE_URL}/rest/v1/credits?user_id=eq.${user_id}&select=balance`, { headers });
    const getRows = await getRes.json();
    const currentBalance = getRows[0]?.balance || 0;
    const newBalance = currentBalance + parseInt(amount);

    // Upsert
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

  // GET — list, search by email/phone, or get credits for a user
  if (req.method === 'GET') {
    const { email, phone, list, user_id } = req.query;

    // Get credits for specific user
    if (user_id) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/credits?user_id=eq.${user_id}&select=balance`, { headers });
      const rows = await r.json();
      return res.status(200).json({ balance: rows[0]?.balance || 0 });
    }

    // Get all credits
    if (req.query.credits === 'true') {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/credits?select=user_id,balance`, { headers });
      const rows = await r.json();
      return res.status(200).json({ credits: rows });
    }

    // Fetch all auth users
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
