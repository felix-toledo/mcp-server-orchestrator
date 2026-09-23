import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import { inquireController, inquireStatusController, initializeOrchestrator } from './api/inquireController.js';
import { validateAgentMiddleware } from './api/validateAgentMiddleware.js';

const app = express();
const PORT = process.env.PORT || 30021;

app.use(cors() as any);
app.use(express.json());

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

app.post('/api/inquire', validateAgentMiddleware, inquireController);
// Live-status amendment — polled by the frontend while a request is in flight.
app.get('/api/inquire/status/:requestId', validateAgentMiddleware, inquireStatusController);

app.listen(PORT, () => {
  console.log(`Orchestrator service started on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
  console.log(`API endpoint: POST http://localhost:${PORT}/api/inquire`);

  // Pre-connect to MCP servers in the background so the first request doesn't pay that cost.
  console.log('Pre-initializing MCP servers in the background...');
  initializeOrchestrator()
    .then(() => console.log('MCP servers ready'))
    .catch((err) => console.error('Error pre-initializing MCP:', err));
});

export default app;
