import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ error: 'userId and token required' });
    }

    const { data, error } = await supabase
      .from('device_tokens')
      .upsert(
        { user_id: userId, token, device_name: 'web' },
        { onConflict: 'user_id,token' }
      )
      .select();

    if (error) throw error;

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error registering device token:', error);
    return res.status(500).json({ error: 'Failed to register device' });
  }
}
