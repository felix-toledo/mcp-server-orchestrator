# CONTEXT.md

Glosario vivo de términos y decisiones de dominio resueltas vía `grill-with-docs`.
Consultar antes de volver a preguntar algo ya definido acá.

## Tools de consulta MCP sobre Proyectos/Obras (2026-08-23)

Contexto: se agregaron tools MCP nuevas (`services/mcp-server/src/infraestructure/tools/`)
para responder preguntas en lenguaje natural sobre obras públicas vía el orchestrator.
Decisiones de alcance tomadas:

- **Escritura de avance ("registrar mi último avance que cargué") — FUERA DE ALCANCE.**
  Las tools de este bloque son 100% de solo lectura (findMany/findFirst/groupBy).
  Razón: no existe autenticación real de usuario en el pipeline (el orchestrator solo
  valida un header `KAA` compartido por agente, no identifica personas). Escribir en
  `Avance` sin poder verificar quién carga el dato es un riesgo de integridad de datos.
  Retomar cuando exista sesión/autenticación de usuario real.

- **Notificaciones push ("avisame cuando cambie el estado de una obra que sigo") — FUERA DE ALCANCE.**
  Requiere suscripción + mecanismo de push (websocket/email/cron); no es un patrón de
  tool MCP síncrona. El usuario puede lograr el mismo resultado hoy re-preguntando
  manualmente con `getProyectoDetalle`/`listarProyectos`.

- **Identidad de usuario y permisos por rol (2026-09-08) — RESUELTO.**
  El orchestrator ahora identifica a la persona que pregunta (no solo el agente, que
  ya validaba `KAA`). Cadena de middlewares en `services/orchestrator/src/index.ts`:
  `validateAgentMiddleware` (KAA, sin cambios) → `resolveUserMiddleware` (nuevo) →
  `inquireController`.
  - Canal telegram manda header `X-Canal: telegram` + `X-Telefono` (el bot lo pide
    una vez por chat vía botón nativo "compartir contacto" de Telegram, ver
    `services/telegram-bot/src/index.ts`).
  - Canal web manda `X-Canal: web` + `X-Email` (server-to-server: lo agrega el
    backend de la web que ya autenticó al usuario, el `KAA` no llega al browser).
  - `resolveUserMiddleware` busca el `Usuario` activo por celular (comparando los
    últimos 10 dígitos, formato libre) o por email, trae sus `roles` (relación
    `Usuario.roles: Rol[]`) y arma `req.user: AuthenticatedUser` (ver
    `services/orchestrator/src/auth/types.ts`). Sin match → 403. No hay rol anónimo.
  - Permisos por rol: `services/orchestrator/src/auth/rolePermissions.ts` mapea
    `Rol.nombre` (ADMIN, GOBERNADOR, INSPECTOR, etc. — valores reales en la tabla
    `Rol`, no un enum) a la lista de tools MCP que ese rol puede ver. `McpClient`
    filtra el catálogo antes de mandarlo al LLM: un rol no ve (ni puede alucinar
    una llamada a) una tool que no tiene permitida — el control de acceso no vive
    en el prompt. `Orchestrator.processConversation` además valida de nuevo cada
    `toolCall.name` contra el set permitido antes de ejecutarla (defensa en
    profundidad).
  - Scope de datos: `services/orchestrator/src/auth/scopeArgs.ts` fuerza
    `tipoProyecto` (`Rol.tipoProyectoScope`, ya existe en el schema) en los args de
    `listarProyectos` cuando el usuario tiene un único scope — el LLM no puede
    pisarlo. Scope por `areaId` (para SUPERVISOR_AREA) queda pendiente: las tools
    de `proyectosQueryTools.ts` todavía no aceptan un parámetro de área para
    filtrar por.
  **Cómo aplicar:** "mis obras"/"mi área" ya funcionan — el system prompt
  (`services/orchestrator/src/auth/rolePrompts.ts`) le pasa la identidad al LLM
  para que la use como filtro sin volver a pedirla. Si se agrega una tool nueva al
  mcp-server, sumarla explícitamente en `rolePermissions.ts` para cada rol que deba
  verla (fail-closed: no listada = no visible).
  **Dato verificado:** en la base real (`obras-local`, revisado 2026-09-08) 162 de
  574 `Usuario` tienen `celular` cargado, en formato libre (`3794594248`,
  `+54 9 379 491-3416`, `3794 682077`). `normalizarTelefono` (últimos 10 dígitos)
  matchea los tres formatos vistos en la muestra. El login por Telegram va a
  rechazar (403) a un usuario real que no tenga celular cargado en su ficha — eso
  sigue siendo trabajo de carga de datos, no de código.

- **"Atraso" (para Top 10 obras con mayor atraso) = gap avance financiero vs físico.**
  Definición operativa: `avanceFinanciero - avanceFisico` grande y positivo → señal de
  "obra pagada pero no ejecutada" (la alerta de gestión que la propia lista de
  preguntas del usuario menciona explícitamente). No se usa comparación de cronograma
  de `Etapa` (fechaFinPlaneada vs hoy) para esta definición.
  **Cómo aplicar:** el ranking ordena por ese gap descendente; separado de "mayor
  monto" que es su propio ranking por `monto` desc.

- **"Categoría" no es un único campo del schema.** Un `Proyecto` se puede categorizar
  por 4 dimensiones distintas y no relacionadas entre sí: `grupo`/`subgrupo`
  (categorización jerárquica principal), `etiqueta` (tags libres, muchos-a-muchos),
  `organismo` (Área/ministerio/municipio responsable) y `ejeGobierno` (enum fijo:
  DESARROLLO/GENERO/INCLUSION/MODERNIZACION). Se resolvió con dos tools genéricas
  parametrizadas por `tipo` (`listarCategorias`, `obrasPorCategoria`) en vez de una
  tool por dimensión, para permitir la conversación "qué categorías hay" → "dame las
  obras de la categoría X" sobre cualquiera de las 4.
  **Cómo aplicar:** si aparece una quinta dimensión de categorización a futuro
  (`lineamiento`, `masterPlan`, `objetivoDesarrolloSostenible`), sumarla como un nuevo
  caso de `tipo` en `categoriasTools.ts`, no crear un archivo nuevo por dimensión.

- **Tools/scope nuevos para cubrir preguntas por rol (2026-09-08) — RESUELTO.**
  Sobre la identidad/permisos ya resueltos arriba, se completó el catálogo para
  cubrir las preguntas relevadas por rol (admin, gobernador, inspector, referentes)
  sin duplicar tools existentes:
  - `listarProyectos` y `listarTareasPendientes` ganaron `organismoId` — necesario
    para que `scopeArgs.ts` pueda restringir a SUPERVISOR_AREA a su propia área.
  - `getProyectoDetalle` ahora también trae `proveedorAdjudicado` y `requisitos`
    pendientes (contratista adjudicado, monto, plazo, fechas de licitación/
    adjudicación/inauguración e impacto ya eran campos escalares de `Proyecto`,
    solo faltaba incluir las dos relaciones).
  - `obrasAsignadasInspector` ahora trae `coordenadas` (mapa de visitas del
    inspector) y `scopeArgs.ts` fuerza `usuarioId` al propio inspector que
    pregunta — no puede consultar las obras de otro usuarioId.
  - `proyectosPendientesDocumentacion` se extendió para detectar también
    proyectos sin responsable asignado o sin coordenadas ("qué datos faltan por
    cargar").
  - Tools nuevas: `resumenUsuarios` (usuariosTools.ts — activos/inactivos/
    accedidos recientes, agrupable por ministerio; exclusiva de ADMIN) e
    `impactoProyectos` (impactoTools.ts — población beneficiada y empleo,
    puntual o agregado; GOBERNADOR).
  - **Deliberadamente NO se crearon tools nuevas para "obras finalizadas para
    inaugurar", "listas para licitación", "en idea/factibilidad"**: son
    `listarProyectos(estadoNombre: ...)` con el nombre exacto de
    `EstadoProyecto` (ver los valores reales listados en la descripción del
    parámetro `estadoNombre`). Tampoco para "alineación a Ejes/ODS" (ya cubierto
    por `listarCategorias`/`obrasPorCategoria` con `tipo: ejeGobierno`).
  **Cómo aplicar:** si se agrega una tool nueva al mcp-server, hay que sumarla
  explícitamente en `services/orchestrator/src/auth/rolePermissions.ts` para cada
  rol que deba verla (fail-closed). El scope por `organismoId` hoy solo se aplica
  a `listarProyectos`/`listarTareasPendientes` (`scopeArgs.ts` → `TOOLS_CON_ORGANISMO`);
  si una tool nueva necesita scope de área, sumarla a ese set.

- **Puertos de los servicios (2026-09-08) — RESUELTO.** mcp-server pasó de 3000 a
  **3011**, orchestrator de 3001 a **3012** (telegram-bot no tiene puerto propio,
  solo hace polling saliente hacia Telegram). Configurado vía `.env` raíz
  (`MCP_SERVER_PORT`, `ORCHESTRATOR_PORT`, `MCP_SERVER_URL`,
  `ORCHESTRATOR_INQUIRE_URL`) — el código de `index.ts` de cada servicio ya leía
  esas env vars con nombre correcto, solo faltaba setear el valor. También
  actualizado en `docker-compose.yml`, `env.template`, `.env.example`.

- **Auditoría de consultas al asistente (2026-09-08) — RESUELTO.** Cada llamada a
  `Orchestrator.processConversation` (éxito, límite de iteraciones o excepción)
  queda registrada en la tabla `ConsultaLog` (schema.prisma): usuario, roles,
  canal, pregunta, respuesta, tools MCP usadas (con args y si cada una salió bien)
  y duración. Escrito por `services/orchestrator/src/auth/consultaLog.ts`, best
  effort (si falla el registro no rompe la respuesta al usuario, solo loguea el
  error en consola). `ConsultaLog` no tiene `@relation` hacia `Usuario` a
  propósito: el log sobrevive aunque se borre/inactive el usuario.
  Se agregó también la tool `revisarConsultasAsistente` (consultaLogTools.ts,
  exclusiva de ADMIN vía `'*'` en rolePermissions.ts) para poder preguntarle al
  propio asistente "qué salió mal" en lenguaje natural — filtra por canal,
  usuario, ventana de días, y por `soloErrores` (cubre tanto
  `ConsultaLog.exitoso=false` como el caso más sutil de una tool individual que
  falló pero el LLM se recuperó y respondió igual).
  **Cómo aplicar:** la tabla se creó con `prisma db push` (no hay carpeta
  `prisma/migrations/` en el repo — fue borrada en algún momento, ver git history).
  Si se agrega una migración de verdad más adelante, conviene regenerar el
  historial de migraciones desde cero en vez de asumir que existe uno.

  **Agrupar por conversación — decidido NO hacerlo por ahora (2026-09-08).**
  `ConsultaLog` guarda una fila por pregunta, sin ningún id que agrupe el ida y
  vuelta de una misma charla. Hoy ningún canal manda un identificador de
  conversación al orchestrator (el telegram-bot tiene su propia sesión en memoria
  por `ctx.chat.id`, pero nunca se la pasa al orchestrator; el canal web tampoco
  manda nada de eso). Para reconstruir aproximadamente una conversación con lo que
  ya existe: filtrar `ConsultaLog` por `usuarioId`, ordenar por `createdAt`, y
  agrupar las filas separadas por menos de ~10 min (mismo criterio de corte de
  sesión que ya usa el bot en `SESSION_TTL_MS`).
  **Cómo aplicar si hace falta agrupar de verdad más adelante:** agregar
  `conversacionId String?` a `ConsultaLog` + un header `X-Conversacion-Id`
  opcional. El telegram-bot lo arma solo (`chatId` + timestamp de inicio de
  sesión); el canal web tendría que empezar a mandar el suyo (el id de sesión de
  su propio chat) — sin eso, la fila queda sin agrupar pero no rompe nada.
