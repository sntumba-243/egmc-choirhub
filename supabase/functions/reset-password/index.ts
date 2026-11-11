import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// reset-password — an admin sets a new password for another account.
//
// AUTHORIZATION (resolved through `members`, never `public.users.role` alone —
// that role survived member deletion, so deleted admins could still reset ANY
// account, including the super admin):
//   • caller must have a members row (by login email)
//   • super admin (members.role = 'super_admin' or users.is_super_admin): any account
//   • church admin (members.role = 'admin'): only accounts whose member row is in
//     the SAME church, and never a super admin
//   • everyone else: 403
// `dry_run: true` runs every check and returns the decision without changing
// anything (used to verify authorization with real calls).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// Case-insensitive exact email match (members.email casing varies).
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c)

interface Person {
  authId: string
  email: string
  memberId: string | null
  role: string | null
  churchId: string | null
  isSuper: boolean
}

async function resolvePerson(admin: SupabaseClient, authId: string, email: string): Promise<Person> {
  const [{ data: member }, { data: userRow }] = await Promise.all([
    admin.from('members').select('id, role, church_id').ilike('email', escapeLike(email)).maybeSingle(),
    admin.from('users').select('is_super_admin').eq('id', authId).maybeSingle(),
  ])
  return {
    authId,
    email,
    memberId: member?.id ?? null,
    role: member?.role ?? null,
    churchId: member?.church_id ?? null,
    // Same definition as the DB helper msg_is_super(), but only for people who still have a member row.
    isSuper: !!member && (member.role === 'super_admin' || userRow?.is_super_admin === true),
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Caller
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user?.email) return json({ error: 'Unauthorized' }, 401)

    const caller = await resolvePerson(supabaseAdmin, user.id, user.email)
    if (!caller.memberId) {
      return json({ error: 'Only admins can reset passwords', reason: 'caller_has_no_member_record' }, 403)
    }
    if (!caller.isSuper && caller.role !== 'admin') {
      return json({ error: 'Only admins can reset passwords', reason: 'caller_not_admin' }, 403)
    }

    // 2. Request
    const { user_id, new_password, dry_run } = await req.json().catch(() => ({}))
    if (!user_id || (!new_password && !dry_run)) {
      return json({ error: 'user_id and new_password are required' }, 400)
    }

    // 3. Target
    const { data: targetAuth, error: targetError } = await supabaseAdmin.auth.admin.getUserById(user_id)
    if (targetError || !targetAuth?.user?.email) return json({ error: 'Account not found' }, 404)
    const target = await resolvePerson(supabaseAdmin, targetAuth.user.id, targetAuth.user.email)

    // 4. Decision
    if (!caller.isSuper) {
      if (target.isSuper) {
        return json({ error: 'Only a super admin can reset this account', reason: 'target_is_super_admin' }, 403)
      }
      if (!target.memberId || !target.churchId || target.churchId !== caller.churchId) {
        return json({ error: 'You can only reset passwords for members of your own church', reason: 'different_church' }, 403)
      }
    }

    if (dry_run) {
      return json({ authorized: true, dry_run: true, as: caller.isSuper ? 'super_admin' : 'church_admin' }, 200)
    }

    // 5. Reset
    const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password: new_password })
    if (resetError) throw resetError

    // Force a password change on next sign-in
    await supabaseAdmin
      .from('users')
      .update({ must_change_password: true, last_password_change: null })
      .eq('id', user_id)

    console.log(`[reset-password] ${caller.email} (${caller.isSuper ? 'super_admin' : 'admin'}) reset ${target.email}`)
    return json({ success: true }, 200)
  } catch (error) {
    console.error('Error resetting password:', error)
    return json({ error: (error as Error).message || 'Failed to reset password' }, 500)
  }
})
