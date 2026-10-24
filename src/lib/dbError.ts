// Turn a Supabase/Postgres error into a toast-ready reason, so failures say
// WHY instead of a bare "Failed to …". RLS denials (42501) get plain words;
// everything else passes its real message through.

interface DbErrorLike {
  code?: string;
  message?: string;
}

export function dbErrorReason(error: unknown): string {
  const e = (error || {}) as DbErrorLike;
  if (e.code === '42501' || e.message?.includes('row-level security')) {
    return "you don't have permission to change this";
  }
  if (e.code === '23505' || e.message?.includes('duplicate')) {
    return 'it is already there';
  }
  return e.message || 'unknown error';
}

/** e.g. dbErrorMessage('Failed to add song', err) → "Failed to add song: you don't have permission to change this" */
export const dbErrorMessage = (prefix: string, error: unknown): string =>
  `${prefix}: ${dbErrorReason(error)}`;
