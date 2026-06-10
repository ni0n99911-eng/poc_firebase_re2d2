import 'dotenv/config';
import postgres from 'postgres';
import fs from 'fs';

async function run() {
  const sqlContent = fs.readFileSync('supabase/migrations/033_llm_cache.sql', 'utf8');
  console.log('Connecting to', process.env.DATABASE_URL);
  const sql = postgres(process.env.DATABASE_URL);
  try {
    await sql.unsafe(sqlContent);
    console.log('Migration successful');
  } catch (e) {
    console.error('Error running SQL:', e);
  } finally {
    await sql.end();
  }
}
run();
