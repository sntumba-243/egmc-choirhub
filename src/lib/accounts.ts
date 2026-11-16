// Account creation and password resets, shared by the member form, church form
// and church page.
//
// • createAccount → edge function create-member (`complete: true`): login +
//   users row + members row (with a member_id) in one call, everything undone if
//   a step fails. The password comes back only when the whole account exists.
//   `linkExisting` (super admin "Add Admin"): an existing login is linked /
//   promoted instead, and its password is left unchanged (`existing: true`).
// • loginIdForMember → DB function login_id_for_member: the LOGIN id for a
//   member row (never by exact email — case used to differ).
// • resetPasswordFor → edge function reset-password (authorizes the caller).

import { supabase } from './supabase';
import { generateMemorablePassword } from './passwordUtils';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function callFunction(name: string, body: unknown): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}

export interface CreateAccountInput {
  email: string;
  churchId: string;
  role: 'member' | 'admin' | 'guest' | string;
  firstName?: string;
  lastName?: string;
  name?: string;
  memberId?: string;
  phone?: string | null;
  voicePart?: string | null;
  status?: string;
  linkExisting?: boolean;
}

export interface CreateAccountResult {
  existing: boolean;          // true: an existing login was linked; password unchanged
  userId: string;             // login (auth) id
  email: string;              // normalized
  password: string | null;    // only for a NEW account, only after everything succeeded
}

export async function createAccount(input: CreateAccountInput): Promise<CreateAccountResult> {
  const email = normalizeEmail(input.email);
  const password = generateMemorablePassword();
  const result = await callFunction('create-member', {
    complete: true,
    if_exists: input.linkExisting ? 'link' : undefined,
    email,
    password,
    name: input.name,
    first_name: input.firstName,
    last_name: input.lastName,
    member_id: input.memberId,
    phone: input.phone ?? null,
    voice_part: input.voicePart ?? null,
    role: input.role,
    status: input.status || 'active',
    church_id: input.churchId,
  });
  return {
    existing: result.existing === true,
    userId: result.user_id,
    email,
    password: result.existing ? null : (result.password || password),
  };
}

export async function loginIdForMember(memberRowId: string): Promise<string> {
  // (the Neon failover client has no rpc — there is no failover for this admin action)
  const { data, error } = await (supabase as any).rpc('login_id_for_member', { p_member: memberRowId });
  if (error || !data) throw new Error('No login found for this member');
  return data as string;
}

/** Sets a new generated password on a login and returns it (show it once). */
export async function resetPasswordFor(loginId: string): Promise<string> {
  const newPassword = generateMemorablePassword();
  await callFunction('reset-password', { user_id: loginId, new_password: newPassword });
  return newPassword;
}
