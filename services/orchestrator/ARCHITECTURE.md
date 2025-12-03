# Arquitectura del Orchestrator

## Diagrama de Flujo

```
┌─────────────┐
│   Cliente   │
│  (Postman,  │
│   cURL,     │
│   Frontend) │
└──────┬──────┘
       │ POST /api/inquire
       │ Header: KAA
       │ Body: {messages: [...]}
       ↓
┌──────────────────────────────────┐
│    Orchestrator Service          │
│         (Puerto 3001)            │
│                                  │
│  ┌────────────────────────────┐ │
│  │ validateAgentMiddleware    │ │
│  │ ✓ Valida header KAA        │ │
│  └────────────┬───────────────┘ │
│               ↓                  │
│  ┌────────────────────────────┐ │
│  │   inquireController        │ │
│  │ • Valida mensajes (Zod)    │ │
│  │ • Convierte a formato OpenAI│ │
│  └────────────┬───────────────┘ │
│               ↓                  │
│  ┌────────────────────────────┐ │
│  │     Orchestrator           │ │
│  │ • Coordina LLM + MCP       │ │
│  │ • Loop de conversación     │ │
│  └──────┬──────────┬──────────┘ │
│         │          │             │
└─────────┼──────────┼─────────────┘
          │          │
    ┌─────┘          └─────┐
    ↓                      ↓
┌──────────────┐    ┌──────────────┐
│ LLM Provider │    │  McpClient   │
│  (Strategy)  │    │              │
└──────┬───────┘    └──────┬───────┘
       │                   │
       ↓                   ↓
┌──────────────┐    ┌──────────────┐
│   OpenAI     │    │ MCP Server   │
│     API      │    │ (Puerto 3000)│
│  gpt-4.1-nano │    │              │
└──────────────┘    │  • hello     │
                    │  • (más...)  │
                    └──────────────┘
```

## Flujo de una Petición

### 1. Validación (Middleware)

```typescript
validateAgentMiddleware
├── Verifica header KAA existe
├── Compara con KEY_ALLOWED_AGENTS (.env)
└── ✓ Continúa | ✗ 401/403
```

### 2. Controller (inquireController)

```typescript
inquireController
├── Valida body con Zod
├── Convierte mensajes a formato OpenAI
├── Crea instancia de Orchestrator
└── Procesa conversación
```

### 3. Orchestrator (Orquestador Principal)

```typescript
Orchestrator.processConversation
├── Conecta al MCP Server
├── Obtiene herramientas disponibles
└── Loop (máx 10 iteraciones):
    ├── Envía mensajes al LLM
    ├── ¿Hay tool calls?
    │   ├── SÍ:
    │   │   ├── Ejecuta cada tool en MCP
    │   │   ├── Agrega resultados al historial
    │   │   └── Continúa loop
    │   └── NO:
    │       └── Devuelve respuesta final
```

### 4. Patrón Strategy (LLM)

```typescript
ILlmProvider (Interface)
├── OpenAIProvider ✓
├── ClaudeProvider (futuro)
├── GeminiProvider (futuro)
└── ...

LlmProviderFactory
└── createDefault() → Lee LLM_PROVIDER del .env
```

### 5. MCP Client

```typescript
McpClient
├── connect() → StreamableHTTPClientTransport
├── listTools() → Descubre herramientas
├── getToolsForOpenAI() → Convierte a formato OpenAI
└── callTool(name, args) → Ejecuta herramienta
```

## Estructura de Directorios

```
services/orchestrator/
├── src/
│   ├── api/
│   │   ├── inquireController.ts      # Endpoint principal
│   │   └── validateAgentMiddleware.ts # Validación de seguridad
│   │
│   ├── llm/                           # Patrón Strategy
│   │   ├── ILlmProvider.ts           # Interface
│   │   ├── OpenAIProvider.ts         # Implementación OpenAI
│   │   └── LlmProviderFactory.ts     # Factory
│   │
│   ├── mcp/                           # Cliente MCP
│   │   ├── McpClient.ts              # Cliente para el mcp-server
│   │   └── Orchestrator.ts           # Orquestador principal
│   │
│   └── index.ts                       # Entry point
│
├── .env                                # Variables de entorno
├── package.json
└── tsconfig.json
```

## Variables de Entorno

```env
# Servidor
PORT=3001

# Seguridad
KEY_ALLOWED_AGENTS=clave-secreta

# LLM
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-nano

# MCP
MCP_SERVER_URL=http://localhost:3000/mcp
```

## Comunicación entre Servicios

```
Cliente → Orchestrator: REST (HTTP)
  • POST /api/inquire
  • Header: KAA
  • Body: JSON con mensajes

Orchestrator → OpenAI: REST (HTTPS)
  • API de OpenAI
  • Envía mensajes + herramientas disponibles
  • Recibe respuesta + posibles tool calls

Orchestrator → MCP Server: MCP Protocol (HTTP)
  • StreamableHTTP transport
  • Protocolo JSON-RPC 2.0
  • Descubrimiento y ejecución de herramientas
```

## Seguridad

1. **Middleware de Validación**: Todas las peticiones deben incluir header `KAA`
2. **Variables de Entorno**: Las API keys se guardan en `.env` (nunca en código)
3. **Validación de Esquemas**: Zod valida todos los inputs
4. **Manejo de Errores**: Try-catch en cada capa con logs apropiados

## Escalabilidad Futura

### Agregar nuevo proveedor de LLM:

1. Implementar `ILlmProvider`:

```typescript
export class ClaudeProvider implements ILlmProvider {
  getName() { return 'claude'; }
  async generateResponse(...) { ... }
}
```

2. Agregar al Factory:

```typescript
case 'claude':
  return new ClaudeProvider(process.env.CLAUDE_API_KEY!);
```

3. Actualizar `.env`:

```env
LLM_PROVIDER=claude
CLAUDE_API_KEY=sk-ant-...
```

### Agregar nuevas herramientas MCP:

Solo se hace en `mcp-server`:

1. Crear archivo en `services/mcp-server/src/infraestructure/tools/`
2. Registrar en `services/mcp-server/src/core/server.ts`
3. El orchestrator las descubre automáticamente ✨

## Testing

Ver `TEST_API.md` para ejemplos de pruebas completas.

---

## 📊 **Flujo Completo del Orquestador**

### 🔄 **1. Punto de Entrada (`index.ts`)**

```
POST /api/inquire → validateAgentMiddleware → inquireController
```

### 🔐 **2. Middleware de Validación (`validateAgentMiddleware.ts`)**

- Verifica header `KAA` (Key Allowed Agents)
- Compara con variable de entorno `KEY_ALLOWED_AGENTS`
- Si falla: retorna 401/403
- Si pasa: continúa al controller

### 📨 **3. Controller Principal (`inquireController.ts`)**

```typescript
// Líneas 29-107
1. Valida el body con Zod schema
2. Convierte mensajes al formato OpenAI
3. Crea/reutiliza instancia de Orchestrator
4. Llama a orchestrator.processConversation()
5. Retorna respuesta JSON
```

### 🎯 **4. Procesamiento Principal (`Orchestrator.ts`)**

```typescript
// Líneas 29-99
1. Conecta al servidor MCP
2. Obtiene herramientas disponibles
3. Loop de iteraciones (máximo 10):
   - Genera respuesta con LLM
   - Si hay tool calls → ejecuta herramientas
   - Agrega resultados al historial
   - Continúa hasta que no hay más tool calls
4. Retorna respuesta final
```

### 🤖 **5. Generación LLM (`OpenAIProvider.ts`)**

```typescript
// Líneas 21-89
1. Agrega prompt del sistema
2. Llama a OpenAI API
3. Procesa respuesta y tool calls
4. Retorna LlmResponse
```

### 🔧 **6. Ejecución de Herramientas (`McpClient.ts`)**

```typescript
// Para cada tool call:
1. Parsea argumentos JSON
2. Llama al servidor MCP
3. Retorna resultado
4. Agrega al historial de conversación
```

## 📍 **Dónde Visualizar el Flujo:**

### **1. En la Consola (Logs en Tiempo Real)**

Los logs que viste en el terminal muestran el flujo:

```
📨 Nueva petición recibida con 2 mensajes
🔧 Creando nueva instancia de orchestrator...
🔌 Intentando conectar al servidor MCP...
✅ Conectado al servidor MCP
🔧 Herramientas disponibles: hello, getAccountAnalytics
🔄 Iteración 1
🛠️ El LLM solicita 1 tool call(s)
  → Ejecutando: getAccountAnalytics
  ✓ Resultado: {...}
```

### **2. Archivos de Código (Orden de Ejecución)**

1. `index.ts` (línea 31) → Ruta principal
2. `validateAgentMiddleware.ts` → Validación
3. `inquireController.ts` → Controller
4. `Orchestrator.ts` → Lógica principal
5. `OpenAIProvider.ts` → LLM
6. `McpClient.ts` → Herramientas

### **3. Diagrama de Flujo Visual**

```
Request → Middleware → Controller → Orchestrator → LLM → Tools → Response
   ↓         ↓           ↓            ↓         ↓      ↓        ↓
index.ts  validateAgent inquireController Orchestrator OpenAIProvider McpClient JSON
```
