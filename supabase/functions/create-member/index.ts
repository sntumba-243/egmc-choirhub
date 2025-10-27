import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - admin access required' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { email, password, name, phone, role, voice_part, status } = await req.json();

    if (!email || !name || !voice_part) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const generatedPassword = password || Math.random().toString(36).slice(-8) + 'A1!';

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;

      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: generatedPassword,
        email_confirm: true,
        user_metadata: {
          name,
          role: role || 'member',
          voice_part,
        },
        app_metadata: {
          role: role || 'member',
        },
      });
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: generatedPassword,
        email_confirm: true,
        user_metadata: {
          name,
          role: role || 'member',
          voice_part,
        },
        app_metadata: {
          role: role || 'member',
        },
      });

      if (createError) {
        return new Response(
          JSON.stringify({ error: createError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (!newUser.user) {
        return new Response(
          JSON.stringify({ error: 'Failed to create user' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      userId = newUser.user.id;
    }

    const { data: existingMember } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    let memberData;
    if (existingMember) {
      const { data: updatedData, error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          name,
          email,
          phone: phone || null,
          role: role || 'member',
          voice_part,
          status: status || 'active',
        })
        .eq('id', userId)
        .select()
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      memberData = updatedData;
    } else {
      const { data: insertedData, error: insertError } = await supabaseAdmin
        .from('users')
        .insert([{
          id: userId,
          name,
          email,
          phone: phone || null,
          role: role || 'member',
          voice_part,
          status: status || 'active',
        }])
        .select()
        .single();

      if (insertError) {
        if (!existingUser) {
          await supabaseAdmin.auth.admin.deleteUser(userId);
        }
        return new Response(
          JSON.stringify({ error: insertError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      memberData = insertedData;
    }

    return new Response(
      JSON.stringify({
        data: memberData,
        password: generatedPassword
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});