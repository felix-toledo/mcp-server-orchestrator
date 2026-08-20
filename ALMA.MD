# Contexto Global del Proyecto: ALMA (Sistema Operativo Cognitivo)

## 1. Visión y Filosofía (Local-First)

Estás asistiendo en el desarrollo de **ALMA**, un Sistema Operativo Cognitivo. No estamos construyendo un chatbot web tradicional ni un wrapper de OpenAI. ALMA es una extensión soberana y persistente de la memoria del usuario que reside en su propia infraestructura (Self-Hosted).

**Filosofía Core:**

- **Soberanía de Datos:** Los datos sensibles jamás deben quedar atrapados en un SaaS cerrado. Todo corre localmente en contenedores.
- **Memoria Transparente:** La memoria no es una caja negra vectorial. ALMA guarda sus recuerdos, resúmenes e interacciones valiosas en archivos Markdown nativamente compatibles con Obsidian. Si el humano edita el Markdown, la IA lo asimila.
- **Proactividad:** ALMA tiene percepción del tiempo (CHRONOS) y ciclos de sueño (ONIROS), lo que le permite actuar de forma asíncrona sin que el usuario se lo pida explícitamente.

## 2. Punto de Partida: Repositorio Actual

Actualmente operamos sobre un monorepo que implementa el **Orquestador MCP**.

- `services/orchestrator` (Puerto 3001): Expone el endpoint `/api/inquire`, valida tokens (KAA), y gestiona el loop de conversación entre el LLM (Gemini/OpenAI) y las herramientas MCP.
- `services/mcp-server` (Puerto 3000): Servidor que expone herramientas custom hacia el orquestador. Conectado a Postgres vía Prisma.

Este repositorio actual es la base perfecta para nuestro primer módulo: **LOGOS**.

## 3. Arquitectura "The Cortex" (Hacia dónde vamos)

Debemos escalar este monorepo para implementar los 4 agentes biológicos de ALMA:

1. **LOGOS (Orquestador - Ya iniciado):** El centro de razonamiento que interpreta la intención y delega tareas vía MCP. Utiliza "Model Cascading" (Gemini Flash para velocidad/routing, modelos mayores para razonamiento complejo).
2. **MNEMOS (Memoria Híbrida - Siguiente prioridad):** Almacenamiento dual. PostgreSQL con la extensión `pgvector` para recuperación semántica (RAG). A su vez, sincroniza y persiste los datos en archivos Markdown estructurados (con Frontmatter YAML) legibles por humanos en Obsidian.
3. **CHRONOS (Gestión Temporal):** Uso de colas transaccionales persistentes en Postgres (mediante `pg-boss` en Node.js) para agendar recordatorios y procesos en el futuro.
4. **ONIROS (Deep Sleep):** Un Cron Job nocturno (3:00 AM) orquestado por `pg-boss`. Lee la "memoria a corto plazo" (logs crudos del día), usa el LLM para resumir tareas/datos duros, consolida la información en Markdown/pgvector, y limpia la base de datos (Garbage Collection).

## 4. Reglas Estrictas de Ingeniería y Stack

Como asistente de IA, DEBES acatar estas reglas para todo código generado:

- **Lenguaje:** Node.js + TypeScript con tipado estricto. Prohibido usar `any`.
- **Base de Datos:** PostgreSQL es la única fuente de verdad. Usaremos Prisma ORM (ya configurado), al cual le añadiremos soporte para `pgvector` y `pg-boss`.
- **Persistencia Asíncrona (Fire and Forget):** El guardado de memoria (logs) no debe bloquear la respuesta al usuario. Usa middleware invisible para insertar el log crudo en Postgres y delegar el análisis semántico a un worker en background.
- **Obsidian-First Design:** Al generar schemas o plantillas para guardar información, piensa en formato Markdown nativo. Usa Frontmatter para metadatos (fechas, tags) y `[[WikiLinks]]` para relaciones semánticas.
- **Frontend Próximo:** Se añadirá una Web App en Next.js (App Router) + Tailwind CSS + Shadcn/ui. Debe ser Mobile First (PWA).
- **Infraestructura:** Todo debe ser contenerizado con Docker y orquestado en `docker-compose.yml`.

## 5. Misión Inmediata (Fase 1 y Fase 2)

Nuestros próximos pasos en el Spec-Driven Development son:

1. **Extender Prisma:** Modificar `schema.prisma` del `mcp-server` (o crear un paquete de DB compartido) para soportar tablas de `short_term_memory`, embeddings vectoriales y la tabla de jobs de `pg-boss`.
2. **Middleware de Persistencia:** Interceptar el flujo actual en `services/orchestrator/src/mcp/Orchestrator.ts` para guardar asíncronamente cada par de Pregunta/Respuesta en la tabla temporal.
3. **Crear el módulo ONIROS:** Implementar un worker ligero que ejecute el pipeline de 3 pasos (Extracción, Consolidación en Markdown y Limpieza) simulando el "sueño" del sistema.
