// ============================================
// FIXED: login-with-member-id Edge Function
// ============================================
// Save as: supabase/functions/login-with-member-id/index.ts
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // IMPORTANT: Use service role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { identifier } = await req.json()

    if (!identifier) {
      throw new Error('identifier is required')
    }

    console.log('Looking up member_id:', identifier)

    // Look up user by member_id (case-insensitive)
    const { data: user, error } = await supabase
      .from('users')
      .select('email, member_id, name, id')
      .ilike('member_id', identifier.trim()) // Trim whitespace
      .maybeSingle()

    if (error) {
      console.error('Database error:', error)
      throw new Error(`Database error: ${error.message}`)
    }

    if (!user) {
      console.log('No user found with member_id:', identifier)
      throw new Error('Invalid member ID')
    }

    console.log('Found user:', user.name, '-', user.email)

    return new Response(
      JSON.stringify({ 
        email: user.email,
        member_id: user.member_id,
        name: user.name
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An error occurred' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
