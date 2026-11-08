import {salonCatalog as seedServices} from './salon-catalog.js';
import 'dotenv/config';
import { prisma } from '../src/db.js';
import { hashPassword } from '../src/password.js';
import { salonHours } from '../src/scheduling.js';
async function seed() {
  const email = 'emillyvslim@gmail.com';
  const password = 'Emilly1821.';
  await prisma.$transaction(async tx => {
    await tx.salon.upsert({ where: { id: 1 }, update: {}, create: { id: 1, hours: salonHours } });
    for (const name of new Set(seedServices.map(s=>s.category))) await tx.category.upsert({where:{name},update:{},create:{name}});
    for (const service of seedServices) {
      const images = { 'Mechas loiras': '/images/mechas.jpg', 'Escova': '/images/escova.jpg', 'Tratamento capilar': '/images/tratamento.jpg', 'Maquiagem express': '/images/maquiagem.jpg' };
      if (!await tx.service.findFirst({ where: { name: service.name,category:service.category } })) await tx.service.create({ data: { ...service, image: images[service.name] } });
    }
    await tx.user.upsert({ where: { email }, update: {role:'ROOT'}, create: { email, name: 'Emilly', passwordHash: await hashPassword(password), role: 'ROOT' } });
  });
  console.log('Seed concluído. Dados existentes e senhas anteriores preservados.');
}
seed().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());




