import {reconcilePaymentEvents} from './payment-events.js';
import 'dotenv/config';
import { app } from './app.js';
import { prisma } from './db.js';
import { processNotifications,notificationsConfigured } from './notifications.js';
import { reconcileInterruptedCheckouts } from './payments.js';
const port = process.env.PORT || 4000;
prisma.$connect().then(async () => {
  await reconcileInterruptedCheckouts();
  reconcilePaymentEvents().catch(()=>console.error('Falha na conciliação inicial.'));
  app.listen(port, () => console.log(`Bogéa Glam API em http://localhost:${port}`));
}).catch(error => { console.error('Banco indisponível:',error.message); process.exit(1); });
if (notificationsConfigured() || process.env.REMINDERS_ENABLED === 'true') {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try { await processNotifications({includeReminders:process.env.REMINDERS_ENABLED==='true'}); } catch (error) { console.error('Falha no processador de notificações:',error.message); } finally { running = false; }
  }, 60000);
  timer.unref();
}

const paymentTimer=setInterval(()=>reconcilePaymentEvents().catch(()=>console.error('Falha na conciliação de pagamentos.')),60000);paymentTimer.unref();

