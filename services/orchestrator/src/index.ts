import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Cargar .env desde la raíz del monorepo
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import express, { Request, Response } from 'express';
import cors from 'cors';
import { inquireController, initializeOrchestrator } from './api/inquireController.js';
import { validateAgentMiddleware } from './api/validateAgentMiddleware.js';

const app = express();
const PORT = process.env.PORT || 3011;

// Middleware global
app.use(cors() as any);
app.use(express.json());

// Rutas básicas
app.get('/', (req, res) => {
  res.json({
    message: 'Orchestrator service is running',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'orchestrator',
    timestamp: new Date().toISOString(),
  });
});

// Ruta principal del API con middleware de validación
app.post('/api/inquire', validateAgentMiddleware, inquireController);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Orchestrator service started on port ${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
  console.log(`🔐 API endpoint: POST http://localhost:${PORT}/api/inquire`);

  // Pre-conectar servidores MCP en background para que el primer request no espere
  console.log('⏳ Pre-inicializando servidores MCP en background...');
  initializeOrchestrator()
    .then(() => console.log('✅ Servidores MCP listos'))
    .catch((err) => console.error('❌ Error en pre-init de MCP:', err));
});

export default app;
