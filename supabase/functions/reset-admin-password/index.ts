// reset-admin-password — RETIRED (2026-11-25).
//
// The previous version had no authorization at all: anyone who could reach it
// could set ANY account's password, including the super admin's. It is not
// deployed and nothing in the app calls it. Use `reset-password`, which checks
// the caller (admin of the same church, or super admin) and refuses super
// admin targets (`target_is_super_admin`).
//
// This stub fails closed so an accidental deploy can't reopen the hole.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve((req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  return new Response(
    JSON.stringify({ error: 'This endpoint is retired. Use reset-password.', reason: 'retired' }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
