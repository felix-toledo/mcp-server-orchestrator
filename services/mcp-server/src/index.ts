import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from './core/server.js';
import 'dotenv/config';
import cors from 'cors'; // Asegúrate de tener cors instalado: npm i cors @types/cors

// --- Configuración del Servidor Express ---
const app = express();
app.use(express.json());

// Habilitamos CORS para permitir peticiones desde cualquier origen.
// Es crucial exponer 'Mcp-Session-Id' para que los clientes puedan manejar sesiones.
app.use(
  cors({
    origin: '*',
    //exposedHeaders: ['Mcp-Session-Id'],
  }),
);

// Almacenamiento en memoria para las sesiones activas.
// La clave es el session ID y el valor es la instancia del transporte.
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};
const PORT = process.env.PORT || 3010;

// --- Health Check Endpoint ---
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'MCP Server is healthy' });
});

// --- Endpoint Principal del MCP ---
app.all('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  try {
    if (sessionId && transports[sessionId]) {
      // Si la petición incluye un ID de sesión válido, reutilizamos el transporte existente.
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // Si es una nueva conexión (sin ID de sesión y con un cuerpo de inicialización),
      // creamos un nuevo servidor y transporte para ella.
      const mcpServer = await createMcpServer();

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(), // Generamos un ID de sesión único.
        onsessioninitialized: (newSessionId: string) => {
          console.log(`🚀 Nueva sesión iniciada: ${newSessionId}`);
          transports[newSessionId] = transport;
        },
      });

      // Cuando la conexión se cierre (ej. el cliente se desconecta), limpiamos el transporte.
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          console.log(`🔌 Sesión cerrada: ${sid}`);
          delete transports[sid];
        }
      };

      // Conectamos la lógica del servidor MCP con la capa de transporte.
      await mcpServer.connect(transport);
    } else {
      // Si la petición no es de inicialización y no tiene un ID de sesión, es inválida.
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message:
            'Bad Request: Se requiere un Mcp-Session-Id válido o una petición de inicialización.',
        },
        id: null,
      });
    }

    // Pasamos la petición al transporte para que la procese según el protocolo MCP.
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error al manejar la petición MCP:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

// --- Iniciar el Servidor ---
app.listen(PORT, () => {
  console.log(`✅ Servidor MCP escuchando en http://localhost:${PORT}/mcp`);
});
