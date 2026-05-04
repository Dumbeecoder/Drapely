export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { email, phone } = req.query;
  if (!email && !phone) return res.status(400).json({ error: 'Missing email or phone' });

  try {
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

    const users = data.users || [];
    let user = null;

    if (email) {
      user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    } else if (phone) {
      const norm = p => p.replace(/[\s\-()]/g, '');
      const q = norm(phone);
      user = users.find(u => {
        const meta = u.user_metadata || {};
        const p = norm(meta.phone || u.phone || '');
        return p && (p === q || p.endsWith(q) || q.endsWith(p));
      });
    }

    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        user_metadata: user.user_metadata,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
      }
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
