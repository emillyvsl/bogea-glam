import 'dotenv/config';
import {prisma} from '../src/db.js';
import {replaceSalonCatalog} from './salon-catalog.js';
try{const result=await prisma.$transaction(replaceSalonCatalog,{maxWait:10000,timeout:60000});console.log(`Catálogo atualizado: ${result.active} serviços ativos em ${result.categories} categorias; ${result.deleted} antigos removidos; ${result.archived} preservados inativos por vínculo com agendamentos.`);console.log('Profissionais com serviços específicos precisam ter os novos serviços associados no gerenciador.');}catch(error){console.error(error.message);process.exitCode=1;}finally{await prisma.$disconnect();}
