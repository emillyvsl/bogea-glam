import {localNow} from './scheduling.js';
export async function ensureProtocol(db,booking){
  if(booking.protocol)return booking.protocol;
  const year=localNow(booking.createdAt?new Date(booking.createdAt):new Date()).date.slice(2,4);
  const protocol=`BG-${year}${String(booking.id).padStart(2,'0')}`;
  await db.booking.updateMany({where:{id:booking.id,protocol:null},data:{protocol}});
  return (await db.booking.findUnique({where:{id:booking.id},select:{protocol:true}})).protocol;
}
