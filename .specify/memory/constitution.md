# Constitución — MCP Server SMA / Sistema Provincial de Obras Públicas

Principios inamovibles del proyecto. Ningún agente, humano o modelo puede saltearlos
para "ir más rápido". Si un plan o una tarea entra en tensión con una cláusula, la
tensión se resuelve acá, por escrito, no en el código.

Este archivo pesa más que `CLAUDE.md`, que cualquier `AGENTS.md` de agente, y que
cualquier instrucción suelta en el chat. Si algo entra en conflicto, gana la
constitución y se dice explícitamente por qué.

---

## I. Spec as Source of Truth

Ninguna regla de negocio se adivina.

- Si el `planificador` (o cualquier agente) no encuentra una regla de negocio escrita
  explícitamente en la spec, **no la infiere ni la copia de un caso parecido**: la
  escribe en la sección "Open Questions" de la spec y la deja pendiente de respuesta
  humana.
- Una spec con Open Questions sin responder **no avanza** a Plan, y esas preguntas
  **no se contestan en código** (i.e., prohibido "resolver" una ambigüedad escribiendo
  el `if` que a uno le parece razonable y seguir).
- El código nunca es la fuente de verdad de una regla de negocio. La spec sí. Si el
  código y la spec discrepan, gana la spec (o se corrige la spec, explícitamente, con
  el humano en el loop).

**Por qué**: en un sistema que filtra acceso a datos de obra pública por rol y
teléfono, una regla de negocio adivinada es un bug de seguridad o de confianza
institucional disfrazado de feature.

## II. Encode every correction

Si un error se cuela a través de un gate (lint, test, typecheck, review humana), el
fix no es solo arreglar el síntoma: incluye mejorar el gate que lo dejó pasar.

- Un bug que rompe una regla ya documentada → agregar o reforzar el test que lo hace
  imposible la próxima vez.
- Un patrón que el lint no captura → agregar o ajustar la regla de lint.
- Un tipo demasiado laxo que permitió el error → estrechar el tipo.
- Nombrar el gate agregado/reforzado es parte de reportar la corrección — no es
  opcional ni un "nice to have" posterior.
- Nunca se apaga un gate para lograr un build verde. Si un gate estorba
  legítimamente, se discute y se ajusta con el humano, no se bypassea con
  `--no-verify`, `eslint-disable` sin justificación, o `skip`.

**Por qué**: sin esto, el equipo (humano + agentes) reaprende el mismo error cada
pocas semanas. Cada corrección debe dejar el sistema estructuralmente más difícil de
romper de la misma forma otra vez.

## III. Strict TDD con Vitest

Ninguna feature entra sin su test en Vitest que **falle primero, y falle por el
motivo correcto**.

- Orden obligatorio: escribir el test → correrlo y verificar que falla por la razón
  esperada (no por un typo, un import roto, o un error de setup) → escribir el código
  mínimo que lo hace pasar → refactorizar con el test en verde.
- Un test que nunca se vio fallar no prueba nada — puede estar mal escrito y pasar
  siempre.
- El `ejecutor` no puede marcar una tarea como terminada sin el test correspondiente
  corriendo en verde.
- El `tester` escribe tests para romper el sistema (estado vacío, rol incorrecto,
  teléfono no autorizado, error de red, límites), no para confirmar el happy path que
  ya escribió el `ejecutor`.

**Por qué**: en un sistema con control de acceso por rol/teléfono, "funciona en mi
prueba manual" no es evidencia suficiente. El test es el contrato ejecutable.

## IV. Separación de Capas

Se respeta a rajatabla lo documentado en `docs/designPateerns.md`: Module Pattern,
Service Layer, Dependency Injection, Strategy Pattern.

- Las **tools del MCP** (`src/infraestructure/tools/`) son finas: reciben el input,
  lo validan (zod), llaman a un servicio, y formatean la respuesta para el protocolo
  MCP. No contienen lógica de negocio pesada, no arman queries complejas de Prisma
  inline, no calculan reglas de negocio.
- La **lógica de negocio** vive en la capa de servicios (`src/services/` o
  equivalente), como clases o funciones que reciben sus dependencias inyectadas.
- **`PrismaClient` se inyecta**, nunca se instancia con `new PrismaClient()` dentro de
  un servicio o de una tool. Se crea una vez (en el core / bootstrap) y se pasa hacia
  abajo. Esto es lo que hace testeable la capa de servicios sin base de datos real.
- Cuando el comportamiento varía según plataforma o tipo de entidad (Instagram vs.
  TikTok, o en este dominio: tipo de obra, tipo de rol), se usa Strategy Pattern en
  vez de un árbol de `if/else` creciente dentro del servicio.

**Por qué**: sin esta separación, cada tool termina con su propia copia de lógica de
negocio y de acceso a datos, imposible de testear unitariamente y fácil de romper la
regla de aislamiento de tenant/rol de forma inconsistente entre tools.

## V. Aislamiento de Tenant/Roles

Toda query a Prisma que toque datos de obras debe filtrar estrictamente por el
rol y el número de teléfono del usuario que hace la solicitud.

- No existe una query "de administrador implícito" ni un acceso de lectura sin
  contexto de usuario en el camino de `/api/inquire`.
- El contexto de rol/teléfono se resuelve una única vez, cerca del borde de entrada
  (middleware/controller), y se pasa explícitamente a los servicios — nunca se
  re-deriva a mitad de una tool o de un servicio a partir de datos parciales.
- Cualquier tool o servicio nuevo que consulte datos de obra pública declara, en su
  propio código y en la spec que lo originó, qué filtro de rol/teléfono aplica. Si la
  regla de qué puede ver cada rol no está definida todavía, es una Open Question
  (Cláusula I) — no se implementa "amplio por ahora, se restringe después".

**Por qué**: es el dominio del proyecto. Un query sin este filtro no es un bug
cualquiera, es una fuga de datos de un sistema provincial con datos sensibles de
proyectos y obras públicas.

---

## Precedencia

`Constitución` > `AGENTS.md` / `CLAUDE.md` > spec activa > skill relevante > preferencia
de estilo del momento.

Si un agente detecta que no puede cumplir una tarea sin violar una cláusula, se
detiene y lo reporta — no elige la cláusula que le resulta más cómoda de romper.
