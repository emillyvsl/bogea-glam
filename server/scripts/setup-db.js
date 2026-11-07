import 'dotenv/config';
import pg from 'pg';
import { spawnSync } from 'node:child_process';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
function run(...args) {
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', ...args], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Prisma ${args[0]} falhou.`);
}
try {
  const { rows } = await pool.query("SELECT to_regclass('public.services') AS legacy, to_regclass('public._prisma_migrations') AS migrations");
  if (rows[0].legacy && !rows[0].migrations) {
    // Verify the previous application's columns before adopting its migration.
    await pool.query('SELECT id,name,category,description,duration,price,active FROM services LIMIT 0');
    await pool.query('SELECT id,name,email,active FROM professionals LIMIT 0');
    await pool.query('SELECT id,client_name,whatsapp,professional_id,service_ids,booking_date,start_minute,end_minute,total_minutes,total_price,deposit,status,expires_at,created_at,segments,whatsapp_consent,paid FROM bookings LIMIT 0');
    console.log('Adotando o banco da versão anterior sem apagar registros.');
    run('migrate', 'resolve', '--applied', '202611030001_initial');
  }
  run('migrate', 'deploy');
  if (process.env.BOGEA_SKIP_GENERATE !== 'true') run('generate');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await pool.end(); }
