import 'dotenv/config';
import { createApp } from './core/server.js';
import { TelegramRuntime } from './core/telegramRuntime.js';
import { KnowledgeStoreClient } from './infrastructure/knowledgeStoreClient.js';
import { OrchestratorClient } from './infrastructure/orchestratorClient.js';

const knowledgeStoreClient = new KnowledgeStoreClient(process.env.KNOWLEDGE_STORE_URL || 'http://localhost:30025');
const orchestratorClient = new OrchestratorClient(
  process.env.ORCHESTRATOR_URL || 'http://localhost:30021',
  process.env.KEY_ALLOWED_AGENTS || '',
);
const telegramRuntime = new TelegramRuntime(knowledgeStoreClient, orchestratorClient);

const app = createApp({ knowledgeStoreClient, telegramRuntime });
const PORT = process.env.PORT || 30023;

// AC1 — a token already saved from a previous run starts polling right
// away; no token yet is not an error, the HTTP server still comes up.
knowledgeStoreClient
  .getTelegramLink()
  .then((link) => {
    if (link?.botToken) {
      return telegramRuntime.start(link.botToken);
    }
    console.log('ℹ️ telegram-bot: sin token configurado todavía, esperando PUT /config.');
    return undefined;
  })
  .catch((error) => console.error('❌ No se pudo leer la config de Telegram al iniciar:', error));

app.listen(PORT, () => {
  console.log(`telegram-bot listening on http://localhost:${PORT}`);
});
