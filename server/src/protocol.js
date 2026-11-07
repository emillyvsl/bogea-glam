import {randomBytes} from 'node:crypto';
export async function ensureProtocol(db,booking){
  if(booking.protocol)return booking.protocol;
  const protocol=`BG-${randomBytes(12).toString('hex').toUpperCase()}`;
  await db.booking.updateMany({where:{id:booking.id,protocol:null},data:{protocol}});
  return (await db.booking.findUnique({where:{id:booking.id},select:{protocol:true}})).protocol;
}
