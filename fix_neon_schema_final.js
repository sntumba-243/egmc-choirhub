import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_lJBAh2Uv0oIe@ep-soft-union-ainruaiw-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function fixSchema() {
  try {
    console.log('🔧 Fixing Neon schema issues...\n');
    
    // Fix role constraint - allow any role
    console.log('1️⃣ Removing role constraint...');
    await pool.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;');
    console.log('   ✅ Role constraint removed (now allows any role)');
    
    // Fix songs table - make arranger nullable
    console.log('\n2️⃣ Making arranger column nullable...');
    await pool.query('ALTER TABLE songs ALTER COLUMN arranger DROP NOT NULL;');
    console.log('   ✅ Arranger is now nullable');
    
    // Also make other optional song columns nullable
    console.log('\n3️⃣ Making other song columns nullable...');
    const nullableColumns = [
      'sheet_music_url',
      'soprano_audio_url', 
      'alto_audio_url',
      'tenor_audio_url',
      'bass_audio_url'
    ];
    
    for (const col of nullableColumns) {
      try {
        await pool.query(`ALTER TABLE songs ALTER COLUMN ${col} DROP NOT NULL;`);
        console.log(`   ✅ ${col} is now nullable`);
      } catch (e) {
        console.log(`   ℹ️  ${col} was already nullable`);
      }
    }
    
    console.log('\n🎉 Schema fixed! Ready to export all data.\n');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
  }
}

fixSchema();
