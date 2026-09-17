# ALMA — Documento Maestro del PFG

2026-09-17 · @Someone

## 1. Objetivos y condiciones del PFG

El Proyecto Integrador Final (PIF) —llamado en la carrera Proyecto Final de Grado— es la instancia curricular final de Ingeniería en Sistemas de Información en la Universidad de la Cuenca del Plata, regulada por la Resolución Rectoral N° 97/23. Esto es lo que aplica directamente a ALMA:

- **Objetivo del PIF (Art. 1):** que el estudiante integre, profundice y aplique los saberes de la carrera mediante un estudio técnico completo, aplicando creatividad y habilidades personales.
- **Origen válido del proyecto (Art. 4):** debe partir de una problemática, necesidad u oportunidad real — requisito que ALMA cumple con los tres problemas identificados (privacidad nula, alucinación técnica, pasividad/amnesia de los asistentes actuales).
- **Modalidad (Art. 23.2):** ALMA se encuadra en "Diseño y Desarrollo de un Sistema de Información" — releva necesidades, diseña la solución y desarrolla los componentes del sistema.
- **Aprobación y defensa (Art. 11-18):** el cursado y la evaluación de la cátedra habilitan a la defensa oral ante un tribunal de tres evaluadores. Nota mínima para aprobar: 6/10. Duración máxima de la exposición: 45 minutos, seguida de preguntas del tribunal.
- **Criterios de evaluación del tribunal (Art. 18.1):** pertinencia y claridad del tema, objetivos acordes al perfil del egresado, grado de aplicación de los conocimientos, manejo de conceptos teóricos, coherencia entre componentes y conclusiones, fuentes consultadas, calidad de la presentación escrita y oral.
- **Formato del informe escrito (Art. 20-21):** hoja A4, Times New Roman 12, interlineado doble, márgenes normales (2,5 cm sup/inf, 3 cm izq/der), redacción impersonal en presente, bibliografía en normas APA.
- **Estructura obligatoria del informe (Art. 22 y 24):** Carátula, Resumen (máx. 600 palabras), Índice, y 13 capítulos obligatorios — I. Definición del Proyecto, II. Relevamiento e Investigación de Mercado, III. Entorno y Dominio del SI, IV. Modelo de Negocios, V. Planificación, VI. Metodologías de Gestión, VII. Marketing, VIII. Propiedad Intelectual, IX. Diseño de Solución, X. Recursos, XI. Oportunidades del Proyecto, XII. Lecciones Aprendidas, XIII. Entregables—, más Conclusiones, Bibliografía y Anexos.
- **Entrega final (Art. 19):** una copia digital completa (informe + código fuente + tablero de gestión del proyecto) para la Biblioteca, con el formulario de autorización de publicación correspondiente.

## 2. Qué es lo que buscamos

**El problema, en tres dimensiones:**

- **Privacidad:** las IAs comerciales son cajas negras. El usuario no sabe qué se hace con sus datos, no puede auditar el sistema, y expone información sensible (historias clínicas, balances, notas personales) a terceros sin control real.
- **Confiabilidad:** los modelos —cloud y locales— alucinan cuando se los conecta a documentos propios. Sin un mecanismo como RAFT o un reranker que filtre distractores, el RAG casero devuelve respuestas incorrectas con confianza.
- **Pasividad:** los asistentes actuales solo responden cuando se les habla. No conectan información entre sesiones, no generan síntesis por sí mismos, y el usuario tiene que pedir explícitamente "guardá esto" — no hay memoria orgánica ni proactividad real.

**Misión:** desarrollar un ecosistema de software inteligente, open source y self-hosted, que amplíe la capacidad cognitiva humana garantizando la soberanía digital de sus datos.

**Visión:** ser el ecosistema de gestión de conocimiento personal (PKM) de referencia para quienes exigen privacidad total — tanto profesionales individuales como equipos u organizaciones enteras.

**Objetivo general:** desarrollar un sistema self-hosted multiagente que actúe como extensión persistente y segura de la memoria humana, asistiendo proactivamente al usuario con privacidad absoluta.

**Objetivos específicos:**

- Soberanía digital: 100% de los datos procesados y almacenados localmente, en contenedores aislados.
- Rendimiento: respuesta multimodal (texto/voz) en menos de 30 segundos.
- Integración tecnológica: comunicación estable vía protocolo MCP y LangGraph entre módulos.
- Precisión sin alucinación: RAG con reranker como base, y RAFT aplicado de forma acotada donde el análisis costo-beneficio lo justifique.
- Memoria transparente y editable: el conocimiento vive como archivos Markdown legibles y editables desde la propia interfaz, nunca como una base opaca.
- Proactividad: el sistema conecta información y genera insights nuevos por sí mismo, no solo responde cuando se le pregunta.

**Golden Circle de ALMA**

- **Why:** creemos que la tecnología debería ampliar la capacidad cognitiva de una persona sin pedirle a cambio que renuncie al control sobre su propia información. La privacidad no debería ser un lujo técnico reservado a quien sabe programar.
- **How:** con una arquitectura self-hosted y open source, donde el usuario controla la infraestructura (local, VPS o cloud propio); los agentes se coordinan vía MCP, la memoria vive en archivos Markdown editables, y el sistema razona con precisión sobre documentos propios sin alucinar, además de generar conexiones nuevas de forma proactiva.
- **What:** un sistema operativo cognitivo personal (PKM multiagente) que se instala con un solo comando, se accede vía chat/voz desde web o WhatsApp, y se integra con calendario, archivos y las herramientas que el usuario elija.

## 3. Nuestro proyecto

**ALMA (Autonomous Learning & Memory Architecture)** es el Proyecto Integrador Final de Felix Toledo y Facundo Peloso, con la Ing. Sergio Lapertosa como profesor de cátedra en la UCP. Es un sistema de software open source y self-hosted que implementa una arquitectura multiagente basada en LLMs, pensado como ecosistema de gestión del conocimiento personal (PKM): un "segundo cerebro digital" que acompaña la rutina diaria del usuario garantizando soberanía digital absoluta. Entrega de MVP planificada para diciembre de 2026.

**Base científica:** el proyecto se apoya en una Revisión Sistemática de la Literatura (RSL) propia de Toledo y Peloso (PPS I, 2026), siguiendo la metodología de Kitchenham y Charters (2007), que partió de \~461 resultados (Google Scholar, arXiv, Aalto, DiVA, MDPI, TechRxiv, ResearchGate) y llegó a 20 estudios primarios (85% de 2025-2026). Hallazgos clave: MCP se consolida como estándar de facto para conectar agentes con herramientas; la brecha self-hosted vs. cloud se cierra en costo (modelos locales alcanzan 85-90% de la calidad de APIs propietarias a 40-200 veces menos costo) pero no en usabilidad; el patrón orquestador-trabajador domina (38% de casos, vía LangGraph); y ningún estudio de los 20 relevaó integra reconocimiento de voz con memoria en Markdown ni un ciclo proactivo de generación de insights — ese gap es lo que valida el diferencial de ALMA.

**Modelo de negocio (resumen):** proyecto open source académico-profesional con potencial de evolucionar a producto (licencia MIT o Apache 2.0), orientado inicialmente al mercado hispanohablante latinoamericano. El usuario puede traer su propia API key sin costo adicional, o pagarle a ALMA para no tener que configurar nada —ver sección 9—, lo que deja una vía de monetización futura además del valor académico del proyecto.

**Planificación de alto nivel:** metodología SCRUM adaptada a un equipo de 2 personas (\~24 hs/semana en total), sprints de 2 semanas, fases desde infraestructura base (abr-may 2026) hasta estabilización y cierre (nov-dic 2026). El camino crítico (PERT/CPM) no tiene holgura: cualquier atraso en la integración de MCP desplaza linealmente el resto del cronograma, algo a tener muy presente frente a la cantidad de decisiones nuevas que se siguen sumando al alcance (ver sección 11).

## 4. Arquitectura de módulos y motor de razonamiento

**Módulos centrales** (los nombres se mantienen tal cual):

- **LOGOS** — orquestador multimodal (voz/chat), enruta intenciones y tareas usando el protocolo MCP.
- **MNEMOS** — persistencia híbrida: base vectorial (PostgreSQL + pgvector) sincronizada con archivos Markdown. Memoria episódica (vectores) + semántica (conocimiento). Ver detalle completo en la sección 5.
- **CHRONOS** — gestión temporal: motor de colas persistentes para calendarios, recordatorios y procesos asíncronos.
- **ONIROS** — procesamiento de fin de jornada sobre la memoria de corto plazo. Su comportamiento definitivo se detalla en la sección 5, porque toca directamente el modelo de datos.

**Motor de razonamiento** (el flujo interno de cada consulta): el prompt del usuario llega a un **SkillRouter** —un modelo chico y rápido— que decide qué skills usar y si la tarea es compleja, en paralelo a una búsqueda **RAG top 20** filtrada por un **reranker** (top 5, tipo cross-encoder). Si la tarea es compleja, el LLM principal arma un plan antes de ejecutar; si no, responde directo. Si el sistema no encuentra información relevante, lo dice explícitamente en vez de inventar una respuesta. Cuando hace falta una herramienta externa, el flujo entra al ciclo de **MCP** con un límite de iteraciones (10 si va avanzando, 5 si viene fallando) para evitar loops costosos. Al cerrar una tarea compleja, un **compresor de contexto** resume lo hecho hasta ese punto y lo guarda en la memoria de corto plazo, para no perder continuidad sin tener que reprocesar todo el historial en cada llamada.

Este diseño busca optimizar tanto latencia como costo: el modelo chico filtra y decide antes de involucrar al modelo grande, y el reranker limpia el ruido del RAG antes de que llegue al LLM — alineado con el pedido de que "todo esto sea lo más optimizado posible".

## 5. Memoria: comportamiento de ONIROS y modelo de datos

**Los dos niveles de memoria:**

- **Corto plazo:** todo lo hablado en el día, logueado siempre e íntegramente, sin excepción. Retención indefinida hasta que el propio usuario decida borrar algo — la UI muestra por defecto los últimos \~30 registros y permite filtrar por fecha, contenido o similitud vectorial.
- **Largo plazo (base de conocimiento):** lo que realmente queda como conocimiento permanente del usuario, en archivos Markdown.

**Reglas de comportamiento de ONIROS (definitivas):**

1. **ONIROS nunca borra nada de la base de conocimiento de largo plazo.** Solo opera sobre lo que se habló durante el día (corto plazo / logs), nunca sobre el conocimiento ya consolidado.
2. **Pedido explícito del usuario → va directo a la base de conocimiento.** Si el usuario le dice "acordate de esto" en una conversación normal, eso se guarda de inmediato como conocimiento, sin pasar por ONIROS.
3. **Curación implícita al final del día.** Sobre lo que no fue pedido explícitamente, ONIROS revisa la conversación del día y decide qué vale la pena promover a conocimiento permanente por su propio criterio — ejemplo dado: si el usuario comentó que le gustó mucho una banana, eso no se guarda automáticamente en el momento, pero ONIROS puede decidir esa noche que es un dato útil sobre sus preferencias y agregarlo al conocimiento.
4. **Insights al día siguiente.** Además de curar, ONIROS puede generar y presentar al usuario resúmenes o conexiones sobre lo hablado el día anterior al arrancar una nueva sesión —esta función de "buenos días" se mantiene, no se descarta.
5. **Criterio de importancia: pendiente de diseño.** Qué hace que algo sea "importante" para pasar a largo plazo queda como línea de investigación a futuro (evaluar consulta con un psicólogo o psiquiatra), buscando que el comportamiento se acerque al de una memoria humana multifacética — varias facetas de una misma persona conviviendo en el mismo sistema.

**Modelo de datos (4 tablas principales):**

| Tabla                      | Contenido                                                                                                                                                                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Usuario**                | Nombre, apellido, email, password (hash), fecha de nacimiento, y otros campos a definir (rol/plan, fecha de alta, preferencias).                                                                                                                                                                                         |
| **Conocimientos**          | Ruta del archivo .md, título, resumen y vector. El contenido completo del conocimiento vive en el .md, nunca en la tabla — así se evita mandarle al agente el archivo entero y consumir tokens de más; solo el resumen + vector viajan para la recuperación (RAG), y se va al archivo completo únicamente si hace falta. |
| **Logs de conversaciones** | Sesión, mensajes, respuestas, título, vector del resumen de la conversación. Retención indefinida.                                                                                                                                                                                                                       |
| **Conocimientos diarios**  | Lo que se genera o se descarta durante el día, antes de que ONIROS decida al final de la jornada qué asciende a la tabla de Conocimientos.                                                                                                                                                                               |

La base de datos es única y vive junto al código del proyecto (arranca vacía en cada instalación); a partir de ahí, todo conocimiento y todos los .md que el usuario genera desde la interfaz tienen que quedar replicados/indexados en esa misma base.

## 6. Interfaz de usuario

La gestión de conocimiento se hace desde una interfaz propia —ya no Obsidian— que tiene que parecerse lo más posible a Obsidian en su comportamiento, sin ir mucho más allá de eso para el MVP:

- Manejo de carpetas y archivos.
- Editor de Markdown inline.
- Excalidraw embebido para diagramas.

El resto de la UI, según el wireframe que ya tenían dibujado, se organiza en: Conversación rápida (chat básico), Agendas, Proyectos, "Ver base" (el explorador de archivos anterior) y Configuraciones (WhatsApp, Cloudflare, skills, agentes), con una versión mobile del mismo panel.

**Nota de alcance:** ya que se decidió construir esta capa propia en lugar de integrar Obsidian directamente, conviene apoyarse en componentes existentes en vez de reconstruir todo desde cero — un editor de Markdown embebible (tipo Monaco, TipTap o CodeMirror) y el motor de Excalidraw, que es open source y pensado justamente para embeberse en otras aplicaciones.

## 7. Sistema multiagente

El usuario puede crear un agente de dos formas: conversando con su propio agente en lenguaje natural ("creá un agente que haga tal cosa"), o desde una UI dedicada, donde también puede elegir entre plantillas prearmadas en vez de armar todo desde cero.

Límite práctico: hasta 10 agentes activos por usuario — un techo más que una necesidad esperada en el uso real.

Los casos de uso configurables van desde lo personal (recordatorios, seguimiento de proyectos del día a día, domótica del hogar) hasta lo empresarial (una empresa configurando agentes por área: marketing, RR.HH., ventas, tech), sobre el mismo motor multiagente base (LangGraph, patrón orquestador-trabajador).

## 8. Infraestructura: almacenamiento, portabilidad, acceso remoto e instalador

**Ubicación de los datos:** se recomienda una carpeta simple y visible en el home del usuario (por ejemplo `~/ALMA/`), completamente separada del repositorio de código, con subcarpetas para la base de conocimiento (.md), configuración y backups. Una carpeta visible en el home es más fácil de encontrar para un usuario no técnico que las rutas estándar del sistema operativo (AppData, XDG, Library), aunque esas serían técnicamente "más correctas" — conviene priorizar la accesibilidad dado el público objetivo.

**Portabilidad:** todavía no definida en detalle. Las dos opciones sobre la mesa son copiar/pegar esa carpeta de datos a otra máquina, o generar un archivo empaquetado (export/import) que lleve todo. Queda pendiente de diseño (ver sección 11).

**Acceso remoto:** Cloudflare Tunnel como opción por defecto —gratis, sin infraestructura propia que mantener— dejando VPS con reverse proxy propio como alternativa avanzada para quien quiera una URL fija. La fricción de tener que escanear un QR nuevo en cada sesión con Cloudflare se documenta como limitación conocida y aceptada del modelo self-hosted, no como algo a esconder. El servidor corre en la máquina del propio usuario: su "nube personal" es su PC de casa.

**Instalador:** todo lo anterior empaquetado en un instalador único (Docker Compose u homólogo), de forma que cualquier usuario —técnico o no— pueda levantar su instancia con fricción mínima. La base de datos se crea desde cero en el momento de la instalación.

## 9. Canales y proveedores de IA

**WhatsApp:** Evolution API como opción por defecto, porque permite onboarding por QR — alineado con el objetivo de que la configuración sea simple para usuarios no técnicos. Se documenta como limitación conocida el riesgo de bloqueo del número, por tratarse de una integración no oficial sobre WhatsApp Web. Twilio queda como alternativa oficial de pago para quien prefiera evitar ese riesgo, aunque no ofrece el flujo por QR.

**Proveedores de IA:** conexión a Claude, ChatGPT/Codex, Gemini y DeepSeek. El modelo de acceso combina dos caminos:

- El usuario trae su propia API key, sin costo adicional de ALMA.
- El usuario le paga a ALMA para no tener que configurar nada — ALMA absorbe el costo de las llamadas a los modelos, y esto se convierte en una vía de monetización futura del proyecto, con el costo operativo que eso implica.

**Línea de investigación abierta:** sigue en evaluación si conviene ofrecer además autenticación vía las suscripciones que el usuario ya tiene (Claude, ChatGPT, Gemini) en lugar de exigir siempre una key nueva, incluyendo la posibilidad de apoyarse en clientes oficiales de línea de comandos (por ejemplo Claude Code) como atajo técnico. Es una decisión que requiere comparar alternativas concretas —incluyendo casos de otras aplicaciones que ya intentaron algo similar— antes de comprometerse a construir sobre ella. Mientras tanto, el flujo por defecto sigue siendo guiar al usuario paso a paso para generar su propia API key, u ofrecerle pagarle a ALMA directamente.

## 10. Vectorización, embeddings y RAFT

Todo el conocimiento —resúmenes de archivos y de conversaciones— se vectoriza en la base de datos para búsqueda semántica (RAG).

**Embeddings — recomendación:** para las primeras pruebas usar un modelo de embeddings vía API externa tiene sentido: es más rápido de integrar y da buena calidad desde el primer día. Pero conviene encapsularlo desde ya detrás de una interfaz/adaptador propio, para poder reemplazarlo más adelante por un modelo de embeddings local (por ejemplo BGE-M3 o nomic-embed-text) sin tocar el resto del sistema. Vale la pena decirlo con todas las letras en el informe: mandar el contenido a una API externa para vectorizarlo contradice, aunque sea parcialmente, la promesa central de soberanía de datos — conviene presentarlo como una decisión consciente de la etapa de prototipo, con un plan de migración a un modelo local documentado como trabajo futuro (o, si el tiempo lo permite, resuelto antes de la defensa).

**RAFT — recomendación:** no aplicarlo de forma generalizada a cualquier usuario en el MVP. Generar datasets sintéticos y entrenar (o re-entrenar) un modelo por dominio tiene un costo de cómputo alto que no cierra con el presupuesto de I+D ya ajustado del proyecto. En cambio, conviene acotarlo a **un único caso piloto** —por ejemplo el propio caso de uso personal del equipo— y usarlo como demostración académica: entrenar un adaptador liviano (LoRA, vía Unsloth, que ya habían identificado) sobre ese dominio puntual, y mostrar en el informe una comparación medible entre RAG simple y RAG+RAFT (precisión, tasa de alucinación) sobre ese piloto. Para el resto de los casos de uso alcanza con RAG + reranker, que ya cubre gran parte del objetivo de "precisión sin alucinación" a mucho menor costo. Un piloto bien medido es, además, más convincente frente al tribunal que aplicar RAFT a todos sin poder mostrar métricas comparativas.

## 11. Cosas a definir

- Criterio final de "qué es importante" para que ONIROS decida qué asciende de corto a largo plazo (evaluar consulta con un especialista en psicología/psiquiatría, como plantearon, inspirándose en cómo prioriza la memoria humana).
- Mecanismo concreto de portabilidad de los datos: copiar la carpeta de datos a mano vs. un archivo empaquetado de exportación/importación.
- Cierre de la investigación sobre acceso a proveedores de IA vía suscripción vs. API key vs. pago directo a ALMA, documentando la decisión final y su justificación.
- Nombre y estructura exacta de la carpeta de datos del usuario y del set completo de subcarpetas (conocimiento, configuración, backups, logs).
- Librería definitiva de edición Markdown y de diagramación (Excalidraw embebido) para la UI.
- Dataset y métricas exactas del piloto de RAFT: qué dominio, qué preguntas, qué se compara contra qué.
- Plan de migración de embeddings de API externa a modelo local, y en qué etapa del proyecto se hace.
- Campos completos de la tabla de Usuario, más allá de nombre, apellido, mail, password y fecha de nacimiento.
- Reglas y límites de uso de agentes más allá del techo de 10: qué pasa si dos agentes entran en conflicto, cómo se les asignan skills y herramientas.

## 12. Tareas priorizadas

**Académico / PFG**

1. Hablar con la profesora sobre la evolución de alcance del proyecto antes de reescribir capítulos ya entregados.
2. Actualizar el Capítulo I (Definición del Proyecto) con la memoria v2 (ONIROS redefinido) y la ampliación de público.
3. Revisar el Capítulo II (Relevamiento de Mercado) para reflejar el público ampliado, o encuadrarlo explícitamente como visión futura.

**Arquitectura / research** 4. Prototipar el motor de razonamiento (SkillRouter + RAG + reranker + MCP). 5. Cerrar el esquema definitivo de las 4 tablas de la base de datos (Usuario, Conocimientos, Logs, Conocimientos diarios). 6. Investigar y decidir el mecanismo de acceso a proveedores de IA (suscripción vs. API key vs. pago a ALMA). 7. Diseñar el piloto de RAFT: elegir dominio, generar dataset sintético, definir métricas de comparación contra RAG simple.

**Producto / UX** 8. Elegir las librerías base para el editor Markdown tipo Obsidian y para Excalidraw embebido. 9. Diseñar el flujo de creación de agentes (conversacional + plantillas) y la gestión de agentes activos. 10. Diseñar el paso a paso de onboarding para usuarios no técnicos (API key, WhatsApp por QR, acceso remoto).

**Infraestructura** 11. Definir el estándar de carpeta de datos del usuario, separada del repositorio de código. 12. Armar el instalador (Docker Compose u homólogo) con creación de base de datos desde cero. 13. Configurar Cloudflare Tunnel como acceso remoto por defecto y documentar el trade-off como limitación conocida. 14. Integrar Evolution API para WhatsApp y documentar el riesgo de bloqueo de número.
