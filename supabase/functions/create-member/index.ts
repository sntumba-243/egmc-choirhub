import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// create-member — an admin creates a member's account.
//
// AUTHORIZATION (through `members`, same as reset-password — never
// `public.users.role` alone, which survives member deletion):
//   • caller must have a members row (by login email, case-insensitive)
//   • super admin (members.role = 'super_admin' or users.is_super_admin): any church
//   • church admin (members.role = 'admin'): only their own church, never
//     creates or promotes an admin, never re-roles another admin
//   • nobody creates super admins here
//
// EMAIL: trimmed + lowercased (Auth stores logins lowercase; the DB trigger
// normalize_email does the same for members/users).
//
// TWO REQUEST SHAPES
//   • complete (`complete: true`, current app): creates the WHOLE account — login,
//     public.users row, members row (with a member_id) — and undoes every step
//     if any step fails. The password is returned only after all succeeded.
//     With `if_exists: 'link'` (super admin "Add Admin"), an EXISTING login is
//     linked instead: its member row in that church is created or promoted to
//     the requested role. The password is NOT changed (`existing: true`).
//   • legacy (no `complete`): login + users row only; the caller inserts the
//     members row itself. Kept so the deployed app keeps working until the
//     'account-fixes' app changes are live. Remove once they are.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const DEFAULT_PASSWORD = 'egmc@Choir'
// public.users.role CHECK constraint (super_admin is never created here).
const ALLOWED_ROLES = ['admin', 'member', 'guest']
const VOICE_PARTS = ['Soprano', 'Alto', 'Tenor', 'Bass']

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c)
const normEmail = (e: unknown) => (typeof e === 'string' ? e.trim().toLowerCase() : '')

interface Caller { memberId: string | null; role: string | null; churchId: string | null; isSuper: boolean }

async function resolveCaller(admin: SupabaseClient, authId: string, email: string): Promise<Caller> {
  const [{ data: member }, { data: userRow }] = await Promise.all([
    admin.from('members').select('id, role, church_id').ilike('email', escapeLike(email)).maybeSingle(),
    admin.from('users').select('is_super_admin').eq('id', authId).maybeSingle(),
  ])
  return {
    memberId: member?.id ?? null,
    role: member?.role ?? null,
    churchId: member?.church_id ?? null,
    isSuper: !!member && (member.role === 'super_admin' || userRow?.is_super_admin === true),
  }
}

// "Teresa Nsoki" → "TNsoki" (same rule as the member form); suffix 2, 3, … if taken.
async function uniqueMemberId(admin: SupabaseClient, wanted: string | null, first: string, last: string, email: string): Promise<string> {
  const clean = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '')
  let base = clean(wanted || '')
  if (!base) {
    const f = clean(first), l = clean(last)
    base = f && l ? f.charAt(0).toUpperCase() + l.charAt(0).toUpperCase() + l.slice(1).toLowerCase()
      : clean(email.split('@')[0]) || 'Member'
  }
  for (let n = 1; n < 100; n++) {
    const candidate = n === 1 ? base : `${base}${n}`
    const [{ data: m }, { data: u }] = await Promise.all([
      admin.from('members').select('id').eq('member_id', candidate).maybeSingle(),
      admin.from('users').select('id').ilike('member_id', escapeLike(candidate)).maybeSingle(),
    ])
    if (!m && !u) return candidate
  }
  throw new Error('Could not find a free member ID')
}

async function findLoginByEmail(admin: SupabaseClient, email: string): Promise<{ id: string } | null> {
  // public.users mirrors every login created by this app (id = auth id).
  const { data: u } = await admin.from('users').select('id').eq('email', email).maybeSingle()
  if (u) return u
  // Fallback: page through Auth (logins without a users row).
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data?.users?.length) return null
    const hit = data.users.find((x) => (x.email || '').toLowerCase() === email)
    if (hit) return { id: hit.id }
    if (data.users.length < 1000) return null
  }
  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401)
    const { data: { user }, error: userError } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user?.email) return json({ error: 'Unauthorized' }, 401)

    const caller = await resolveCaller(admin, user.id, user.email)
    if (!caller.memberId || (!caller.isSuper && caller.role !== 'admin')) {
      return json({ error: 'Only admins can create members' }, 403)
    }

    const body = await req.json()
    const email = normEmail(body.email)
    const role = (body.role || 'member') as string
    const churchId = (body.church_id || null) as string | null
    const name = (typeof body.name === 'string' ? body.name : '').trim()
    const firstName = (typeof body.first_name === 'string' ? body.first_name : name.split(' ')[0] || '').trim()
    const lastName = (typeof body.last_name === 'string' ? body.last_name : name.split(' ').slice(1).join(' ')).trim()
    const voicePart = VOICE_PARTS.includes(body.voice_part) ? body.voice_part : null
    const status = body.status === 'inactive' ? 'inactive' : 'active'

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'A valid email is required' }, 400)
    if (!ALLOWED_ROLES.includes(role)) {
      return json({ error: `Role "${role}" can't be used for an account. Choose Member, Admin or Guest.` }, 400)
    }
    // Only a super admin creates admins or promotes anyone to admin (DB trigger
    // members_guard_privileged enforces the same for direct writes).
    if (!caller.isSuper && role === 'admin') {
      return json({ error: 'Only a super admin can make someone an admin', reason: 'grant_admin' }, 403)
    }
    if (!churchId) return json({ error: 'church_id is required' }, 400)
    if (!caller.isSuper && churchId !== caller.churchId) {
      return json({ error: 'Admins can only add members to their own church' }, 403)
    }
    const { data: church } = await admin.from('churches').select('id').eq('id', churchId).maybeSingle()
    if (!church) return json({ error: 'Church not found' }, 400)

    console.log('create-member:', { mode: body.complete ? 'complete' : 'legacy', role, church_id: churchId, by: caller.memberId })

    // ── Existing login? ──
    const existing = await findLoginByEmail(admin, email)
    if (existing) {
      if (!(body.complete && body.if_exists === 'link')) {
        return json({ error: 'An account with this email already exists', code: 'account_exists' }, 409)
      }
      // Link / promote. The password is never touched here.
      // Never a super admin (same full definition as reset-password: member role
      // OR users.is_super_admin on the login) — only a super admin may change one,
      // and nobody re-roles a super admin through this path.
      const { data: targetUser } = await admin.from('users').select('is_super_admin').eq('id', existing.id).maybeSingle()
      if (targetUser?.is_super_admin === true) {
        return json({ error: 'This account is a super admin', reason: 'target_is_super_admin' }, 403)
      }
      const { data: member } = await admin.from('members').select('id, church_id, role').eq('email', email).maybeSingle()
      if (member && member.church_id !== churchId) {
        return json({ error: 'This person already belongs to another church', code: 'other_church' }, 409)
      }
      if (member?.role === 'super_admin') return json({ error: 'This account is a super admin', reason: 'target_is_super_admin' }, 403)
      // Linking re-roles and re-activates the member: never another admin unless super admin.
      if (!caller.isSuper && member?.role === 'admin' && member.id !== caller.memberId) {
        return json({ error: 'Only a super admin can change another admin', reason: 'target_is_admin' }, 403)
      }
      if (member) {
        const { error } = await admin.from('members').update({ role, status: 'active' }).eq('id', member.id)
        if (error) throw error
      } else {
        const memberId = await uniqueMemberId(admin, body.member_id || null, firstName, lastName, email)
        const { error } = await admin.from('members').insert({
          id: existing.id, member_id: memberId, first_name: firstName, last_name: lastName, email,
          role, status: 'active', church_id: churchId, voice_part: voicePart, phone: body.phone || null,
        })
        if (error) throw error
      }
      const { error: upErr } = await admin.from('users').upsert(
        { id: existing.id, email, name: name || `${firstName} ${lastName}`.trim() || email, role, church_id: churchId, status: 'active' },
        { onConflict: 'id' })
      if (upErr) throw upErr
      const { error: metaErr } = await admin.auth.admin.updateUserById(existing.id, { app_metadata: { role } })
      if (metaErr) throw metaErr
      return json({ success: true, existing: true, user_id: existing.id, password: null }, 200)
    }

    // ── New account ──
    const finalPassword = (typeof body.password === 'string' && body.password) || DEFAULT_PASSWORD
    const useDefaultPassword = !body.password
    const undo: Array<() => Promise<unknown>> = []
    try {
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        password: finalPassword,
        email_confirm: true,
        user_metadata: { name: name || `${firstName} ${lastName}`.trim(), voice_part: voicePart },
        app_metadata: { role },
      })
      if (authError || !authData?.user) throw authError || new Error('Failed to create login')
      const authId = authData.user.id
      undo.push(() => admin.auth.admin.deleteUser(authId))

      const { error: usersError } = await admin.from('users').insert({
        id: authId,
        email,
        name: name || `${firstName} ${lastName}`.trim() || email,
        member_id: null,
        role,
        voice_part: voicePart,
        status,
        church_id: churchId,
        must_change_password: useDefaultPassword,
        last_password_change: useDefaultPassword ? null : new Date().toISOString(),
      })
      if (usersError) throw usersError
      undo.push(() => admin.from('users').delete().eq('id', authId))

      let memberRow = null
      if (body.complete) {
        const memberId = await uniqueMemberId(admin, body.member_id || null, firstName, lastName, email)
        const { data, error: memberError } = await admin.from('members').insert({
          id: authId, // member row id = login id for new accounts
          member_id: memberId,
          first_name: firstName,
          last_name: lastName,
          email,
          phone: body.phone || null,
          voice_part: voicePart,
          role,
          status,
          church_id: churchId,
          must_change_password: useDefaultPassword,
        }).select().single()
        if (memberError) throw memberError
        memberRow = data
      }

      console.log('create-member: created', { user_id: authId, member: memberRow?.member_id ?? null })
      return json({
        success: true,
        existing: false,
        user_id: authId,
        data: { id: authId, email, role, church_id: churchId },
        member: memberRow,
        password: useDefaultPassword ? DEFAULT_PASSWORD : finalPassword,
        mustChangePassword: useDefaultPassword,
      }, 200)
    } catch (err) {
      console.error('create-member: failed, undoing', err)
      for (const step of undo.reverse()) {
        try { await step() } catch (e) { console.error('create-member: undo step failed', e) }
      }
      throw err
    }
  } catch (error) {
    console.error('Error creating member:', error)
    const msg = (error as any)?.message || 'Failed to create member'
    const code = (error as any)?.code
    return json({ error: code === '23505' ? 'That email or member ID is already in use' : msg }, code === '23505' ? 409 : 500)
  }
})
