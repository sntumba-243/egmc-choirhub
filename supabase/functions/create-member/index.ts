import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_PASSWORD = 'egmc@Choir';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('role, is_super_admin')
      .eq('email', user.email)
      .single()

    if (!userData || (userData.role !== 'admin' && userData.role !== 'super_admin' && !userData.is_super_admin)) {
      return new Response(
        JSON.stringify({ error: 'Only admins can create members' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const {
      email,
      password,
      name,
      member_id,
      role,
      voice_part,
      status,
      church_id
    } = await req.json()

    if (!email || !name) {
      return new Response(
        JSON.stringify({ error: 'Email and name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const finalPassword = password || DEFAULT_PASSWORD
    const useDefaultPassword = !password

    console.log('Creating member:', { email, name, member_id, role, church_id, useDefaultPassword })

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: finalPassword,
      email_confirm: true,
      user_metadata: { name, voice_part },
      app_metadata: { role: role || 'member' }
    })

    if (authError) {
      console.error('Auth error:', authError)
      throw authError
    }

    if (!authData.user) {
      throw new Error('Failed to create user')
    }

    console.log('Auth user created:', authData.user.id)

    const { data: dbData, error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        name,
        member_id: member_id || null,
        role: role || 'member',
        voice_part: voice_part || null,
        status: status || 'active',
        church_id: church_id || null,
        must_change_password: useDefaultPassword,
        last_password_change: useDefaultPassword ? null : new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw dbError
    }

    console.log('Database record created:', dbData)

    return new Response(
      JSON.stringify({
        success: true,
        data: dbData,
        password: useDefaultPassword ? DEFAULT_PASSWORD : finalPassword,
        mustChangePassword: useDefaultPassword
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error creating member:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create member' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
