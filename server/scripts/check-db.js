// Integration check uses an isolated database and never migrates the application DB.
import 'dotenv/config';
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
const url = new URL(process.env.DATABASE_URL || 'postgres://bogea:bogea_dev@localhost:5432/bogea_glam');
const name = `bogea_test_${randomBytes(8).toString('hex')}`;
const admin = new pg.Pool({ connectionString: url.toString(), connectionTimeoutMillis: 3000 });
url.pathname = `/${name}`;
const database = new pg.Pool({ connectionString: url.toString() });
const env = { ...process.env, DATABASE_URL: url.toString(), ADMIN_EMAIL: 'emillyvslim@gmail.com', ADMIN_PASSWORD: 'Emilly1821.', BOGEA_SKIP_GENERATE: 'true' };
function run(file, ...args) {
  const result = spawnSync(process.execPath, [file, ...args], { env, stdio: 'inherit' });
  assert.equal(result.status, 0, `${file} falhou`);
}
let created = false;
try {
  await admin.query(`CREATE DATABASE "${name}"`); created = true;
  run('scripts/setup-db.js');
  run('prisma/seed.js');
  run('prisma/seed.js');
  const counts = await database.query('SELECT (SELECT count(*)::int FROM services) AS services, (SELECT count(*)::int FROM professionals) AS professionals, (SELECT count(*)::int FROM users) AS users');
  assert.deepEqual(counts.rows[0], { services: 30, professionals: 0, users: 1 });
  const { rows: [user] } = await database.query('SELECT password_hash FROM users');
  assert.notEqual(user.password_hash, env.ADMIN_PASSWORD);
  // Reproduce the pre-Prisma schema inside this isolated test database.
  assert.equal((await database.query('SELECT current_database() AS name')).rows[0].name, name);
  await database.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  await database.query(await readFile('prisma/migrations/202611030001_initial/migration.sql','utf8'));
  await database.query("INSERT INTO services (name,category,description,duration,price) VALUES ('Mechas loiras','Coloração','preservar registro',300,500)");
  await database.query("UPDATE services SET description = 'preservar registro' WHERE id = 1");
  run('scripts/setup-db.js');
  run('prisma/seed.js');
  const preserved = await database.query('SELECT description FROM services WHERE id = 1');
  assert.equal(preserved.rows[0].description, 'preservar registro');
  const migrations = await database.query('SELECT count(*)::int AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL');
  assert.equal(migrations.rows[0].count, 12);
  run('node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code');
  process.env.DATABASE_URL = url.toString();
  const {prisma}=await import('../src/db.js');
  const {replaceSalonCatalog}=await import('../prisma/salon-catalog.js');
  const firstCatalog=await prisma.$transaction(replaceSalonCatalog,{timeout:60000});
  const secondCatalog=await prisma.$transaction(replaceSalonCatalog,{timeout:60000});
  assert.equal(firstCatalog.active,30);assert.equal(secondCatalog.active,30);
  assert.equal(await prisma.service.count({where:{active:true}}),30);
  const makeup=await prisma.service.findFirst({where:{category:'MAQUIAGEM',name:'Maquiagem express'}});assert.equal(makeup.duration,40);assert.equal(Number(makeup.price),170);
  await prisma.service.create({data:{name:'Escova',category:'ESCOVA',description:'Fixture de teste',duration:60,price:120,active:true}});
  const { checkWorkflow } = await import('./check-workflow.js');
  await database.query("INSERT INTO professionals (name,email) VALUES ('Profissional de teste','principal@example.test'),('Outra profissional de teste','outra@example.test')");
  const previousGoogle=process.env.GOOGLE_CALENDAR_ENABLED;
  process.env.GOOGLE_CALENDAR_ENABLED='true';
  process.env.EMAIL_ENABLED='false';
  await checkWorkflow(env);
  const confirmedBookings=await prisma.booking.findMany({where:{status:'Confirmado'},include:{googleSync:true}});
  assert.ok(confirmedBookings.length>0);
  assert.ok(confirmedBookings.every(b=>b.googleSync), 'Confirmação manual e pagamento devem persistir tarefas Google.');
  if(previousGoogle===undefined)delete process.env.GOOGLE_CALENDAR_ENABLED;else process.env.GOOGLE_CALENDAR_ENABLED=previousGoogle;
  const {checkGoogleCalendar}=await import('./check-google-calendar.js');
  await checkGoogleCalendar(prisma);
  const {checkBookingEmail}=await import('./check-booking-email.js');
  await checkBookingEmail(prisma);
  await prisma.$disconnect();
  console.log('OK: banco novo, seed repetido e adoção do banco legado preservando dados.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  await database.end();
  if (created) await admin.query(`DROP DATABASE "${name}"`);
  await admin.end();
}







