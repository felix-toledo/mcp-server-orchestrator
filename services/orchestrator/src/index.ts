import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { inquireController } from './api/inquireController.js';
import { validateAgentMiddleware } from './api/validateAgentMiddleware.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware global
app.use(cors());
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
});

export default app;
