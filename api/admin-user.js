export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { email, phone, list } = req.query;

  try {
    // Fetch all users from Supabase admin API
    const response = await fetch(
      `https://oqmoneclnirnhqpcdeqy.supabase.co/auth/v1/admin/users?per_page=1000`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          'apikey': process.env.SUPABASE_SERVICE_KEY,
        }
      }
    );

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.message || 'Supabase error' });

    const users = (data.users || []).map(u => ({
      id: u.id,
      email: u.email,
      phone: u.phone,
      user_metadata: u.user_metadata,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    }));

    // Return all users for list mode
    if (list === 'true') {
      return res.status(200).json({ users });
    }

    // Search by email
    if (email) {
      const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.status(200).json({ user });
    }

    // Search by phone
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

    return res.status(400).json({ error: 'Missing email, phone, or list param' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
