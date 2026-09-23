import 'dotenv/config';
import PgBoss from 'pg-boss';
import { createApp } from './core/server.js';
import { PrismaClient } from './infrastructure/prismaClient.js';
import { TelegramBotClient } from './infrastructure/telegramBotClient.js';
import { ReminderService } from './services/reminderService.js';

const prisma = new PrismaClient();
const pgBoss = new PgBoss(process.env.DATABASE_URL ?? '');
const telegramBotClient = new TelegramBotClient(process.env.TELEGRAM_BOT_URL || 'http://localhost:30023');
const reminderService = new ReminderService(prisma, pgBoss, telegramBotClient);

pgBoss.on('error', (error) => console.error('❌ pg-boss error:', error));

const app = createApp({ reminderService });
const PORT = process.env.PORT || 30026;

reminderService
  .initialize()
  .then(() => console.log('⏰ pg-boss listo, workers activos registrados'))
  .catch((error) => console.error('❌ No se pudo inicializar pg-boss:', error));

app.listen(PORT, () => {
  console.log(`scheduler listening on http://localhost:${PORT}`);
});
