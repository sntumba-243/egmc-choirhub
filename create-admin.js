import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lpcepycxqfqzwwszmpks.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwY2VweWN4cWZxend3c3ptcGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0MzE5MzcsImV4cCI6MjA3NzAwNzkzN30.AY5xmu5CYZN6kV-pSyyoCb3LHzPKJQ6WIExX5N8nm64';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdminUser() {
  try {
    console.log('Creating admin user for: sntumba@outlook.com');

    const { data, error } = await supabase.auth.signUp({
      email: 'sntumba@outlook.com',
      password: 'egmc@Choirbook',
      options: {
        data: {
          name: 'Admin User',
          role: 'admin',
          voice_part: null,
        },
        emailRedirectTo: undefined,
      },
    });

    if (error) {
      console.error('Error creating admin user:', error.message);

      if (error.message.includes('already registered')) {
        console.log('\nUser already exists! Testing login...');

        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email: 'sntumba@outlook.com',
          password: 'egmc@Choirbook',
        });

        if (loginError) {
          console.error('Cannot login:', loginError.message);
          console.log('\nThe user exists but password may be different.');
        } else {
          console.log('✓ Login successful! User can access the app.');
          console.log('User ID:', loginData.user?.id);
        }
      }
      return;
    }

    console.log('✓ Admin user created successfully!');
    console.log('User ID:', data.user?.id);
    console.log('Email confirmed:', data.user?.email_confirmed_at ? 'Yes' : 'No');

    if (data.user) {
      const { error: dbError } = await supabase.from('users').insert({
        id: data.user.id,
        email: 'sntumba@outlook.com',
        name: 'Admin User',
        role: 'admin',
        voice_part: null,
      });

      if (dbError) {
        if (dbError.message.includes('duplicate')) {
          console.log('✓ User profile already exists in database');
        } else {
          console.error('Error inserting user into database:', dbError.message);
        }
      } else {
        console.log('✓ User profile created in database!');
      }
    }

    console.log('\n========================================');
    console.log('Login credentials:');
    console.log('Email: sntumba@outlook.com');
    console.log('Password: egmc@Choirbook');
    console.log('========================================');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

createAdminUser();
