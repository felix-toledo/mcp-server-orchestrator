---
name: grill-with-docs
description: Entrevista implacable al humano sobre un plan, idea o término de dominio ambiguo hasta llegar a un entendimiento compartido, mapeado como árbol de decisiones. Uso obligatorio del `planificador` durante la fase Clarify del pipeline SDD, especialmente para resolver términos de dominio del Sistema Provincial de Obras Públicas (roles, permisos, estados de obra, etc.).
---

# grill-with-docs

Entrevistá al usuario implacablemente sobre un plan o idea hasta llegar a un
entendimiento compartido. Mapeá esto como un árbol de decisiones: cada pregunta
depende de que sus prerrequisitos ya estén resueltos.

## Cómo trabajar

1. **Construí el árbol antes de preguntar.** Identificá qué decisiones dependen de
   cuáles. No preguntes por un detalle de implementación de un rol si todavía no
   está decidido qué roles existen.
2. **Trabajá en rondas.** En cada ronda, hacé únicamente las preguntas de la
   **frontera**: aquellas cuyos prerrequisitos ya están resueltos (contestados en
   esta sesión o ya presentes en `CONTEXT.md`/la spec). No amontones preguntas de
   distintas profundidades del árbol en la misma ronda.
3. **Formato de cada pregunta**, sin excepción:

   ```
   ❓ **Q1** - **<título corto>**: <cuerpo de la pregunta, con el contexto mínimo
   necesario para que se pueda responder sin ir a buscar nada más> ➡️ <tu
   recomendación concreta, con el motivo en una frase>
   ```

4. **Esperá las respuestas** antes de generar la siguiente ronda. No asumas una
   respuesta "razonable" y sigas — eso es exactamente lo que esta skill existe para
   evitar (Cláusula I de la constitución: ninguna regla de negocio se adivina).
5. Cuando una ronda cierra un término de dominio (ej. "qué roles existen en el
   sistema de obras públicas y qué puede ver cada uno", "qué significa 'obra
   paralizada'"), **escribilo inmediatamente en `CONTEXT.md`** en la raíz del repo —
   no esperes a que termine toda la entrevista. `CONTEXT.md` es el glosario vivo de
   términos de dominio ya resueltos; cualquier agente lo puede consultar antes de
   volver a preguntar lo mismo.
6. Si una respuesta implica una decisión difícil de revertir y con trade-offs reales
   (por ejemplo: cómo se identifica al usuario de WhatsApp de forma única, qué
   modelo de aislamiento de datos por rol se usa, qué proveedor de LLM se fija como
   default), generá un **ADR** en `docs/adr/` con el formato estándar (contexto,
   decisión, alternativas consideradas, consecuencias). Un término de glosario va a
   `CONTEXT.md`; una decisión arquitectónica va a un ADR. Si dudás cuál es, preguntá:
   "¿esto se podría revertir sin reescribir media feature?" — si la respuesta es no,
   es ADR.

## Cuándo se usa

Es la herramienta obligatoria del agente `planificador` durante la fase **Clarify**
del pipeline SDD (`Constitution → Specify → Clarify → Plan → Tasks → Implement`).
Se dispara cada vez que:

- Aparece un término de dominio sin definición escrita (roles, estados, permisos,
  reglas de visibilidad de datos de obra pública).
- Una spec tiene una sección de Open Questions con preguntas sin responder.
- Un plan requiere una decisión de arquitectura con trade-offs que nadie confirmó
  todavía.

## Qué NO hacer

- No hagas más de una ronda de preguntas "por las dudas" sin esperar respuesta.
- No contestes vos mismo una pregunta de dominio porque "es obvio" — si fuera obvio
  ya estaría en `CONTEXT.md` o en la spec.
- No mezcles la recomendación con la pregunta de forma que sea difícil distinguir
  cuál es tu sugerencia y cuál es la decisión del humano — el separador ➡️ existe
  para eso.
