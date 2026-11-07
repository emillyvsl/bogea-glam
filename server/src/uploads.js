import express from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir,writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { requireAdmin } from './auth.js';
export const imageDirectory = fileURLToPath(new URL('../uploads/images/',import.meta.url));
export function imageExtension(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'jpg';
  if (buffer.toString('ascii',0,4) === 'RIFF' && buffer.toString('ascii',8,12) === 'WEBP') return 'webp';
  return null;
}
export function registerUploads(app) {
  app.use('/api/images',express.static(imageDirectory,{ dotfiles:'deny',index:false,setHeaders:res=>{res.set('X-Content-Type-Options','nosniff');} }));
  app.post('/api/admin/images',requireAdmin,express.raw({type:['image/jpeg','image/png','image/webp'],limit:'5mb'}),async(req,res)=>{
    const extension=imageExtension(req.body);
    const types={jpg:'image/jpeg',png:'image/png',webp:'image/webp'};
    if (!extension || req.get('Content-Type')?.split(';')[0] !== types[extension]) return res.status(400).json({error:'Envie uma imagem JPG, PNG ou WebP válida (até 5 MB).'});
    const filename=`${randomUUID()}.${extension}`;
    await mkdir(imageDirectory,{recursive:true});
    await writeFile(path.join(imageDirectory,filename),req.body,{flag:'wx'});
    res.status(201).json({url:`/api/images/${filename}`});
  });
}
