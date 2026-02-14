import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_lJBAh2Uv0oIe@ep-soft-union-ainruaiw-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function fixConstraints() {
  try {
    console.log('🔧 Fixing Neon constraints to match Supabase...\n');
    
    // Drop and recreate voice_part constraint (allow case-insensitive + nulls)
    console.log('1️⃣ Fixing voice_part constraint...');
    await pool.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_voice_part_check;');
    await pool.query(`
      ALTER TABLE users 
      ADD CONSTRAINT users_voice_part_check 
      CHECK (
        voice_part IS NULL OR 
        LOWER(voice_part) IN ('soprano', 'alto', 'tenor', 'bass')
      );
    `);
    console.log('   ✅ voice_part constraint updated (allows NULL and any case)');
    
    // Drop and recreate role constraint (allow more role types)
    console.log('\n2️⃣ Fixing role constraint...');
    await pool.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;');
    await pool.query(`
      ALTER TABLE users 
      ADD CONSTRAINT users_role_check 
      CHECK (role IN ('admin', 'member', 'inactive', 'guest'));
    `);
    console.log('   ✅ role constraint updated (allows admin, member, inactive, guest)');
    
    // Also make voice_part column case-insensitive by adding a trigger
    console.log('\n3️⃣ Adding lowercase trigger for voice_part...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION lowercase_voice_part()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.voice_part IS NOT NULL THEN
          NEW.voice_part = LOWER(NEW.voice_part);
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await pool.query(`
      DROP TRIGGER IF EXISTS lowercase_voice_part_trigger ON users;
      CREATE TRIGGER lowercase_voice_part_trigger
      BEFORE INSERT OR UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION lowercase_voice_part();
    `);
    console.log('   ✅ Auto-lowercase trigger added');
    
    console.log('\n🎉 Constraints fixed! Ready to export again.\n');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
  }
}

fixConstraints();
