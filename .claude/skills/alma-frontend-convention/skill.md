---
name: alma-frontend-conventions
description: Convenciones de diseño y frontend de ALMA (tokens, tipografía, componentes, voz). Usar SIEMPRE que se toque código de frontend del proyecto — componentes, estilos, copy de interfaz, nuevas pantallas — para mantener consistencia con el design system.
---

# ALMA — convenciones de frontend

ALMA es un asistente de IA personal, self-hosted, "segundo cerebro" del usuario (memoria editable en Markdown, chat, sistema multiagente configurable). La propuesta de valor central es **soberanía de datos**: el usuario controla todo, nada vive en una caja negra. El diseño tiene que transmitir calidez y confianza, nunca frialdad corporativa de SaaS genérico.

Este archivo formaliza el design system extraído del mockup de chat ("Alma Chat 2") y ya construido como sistema de tokens + componentes base. Fuente completa, con previews en vivo de cada componente: el artifact "Alma" (Design System) en Claude. Este .md es la versión portátil para que cualquier sesión de Claude Code que toque el frontend la consulte sin depender de ese artifact.

Estado: cubre tokens (color, tipografía, espaciado, radios, sombras) y componentes base (botón, input, chip, card, nav lateral, modal, tooltip). Todavía NO cubre: burbujas de chat / streaming / trazas de agente, explorador de archivos, onboarding, configuración de agentes — si tocás esas pantallas, extendé este sistema, no inventes tokens nuevos sueltos.

## Cuándo consultar esto

Antes de escribir o tocar cualquier componente, estilo, color, tipografía o copy de interfaz del frontend. Si estás por usar un valor de color, tamaño, espaciado o radio que no aparece en la lista de tokens de abajo, es señal de que hay que agregarlo al sistema (y a este archivo), no de que hay que improvisarlo inline.

## Dirección de marca

Cálida, editorial, artesanal — lo opuesto a un SaaS frío. Fondo papel, tinta casi negra pero cálida (nunca gris puro), acento terracota como color de marca. El detalle que sostiene todo: una serif itálica (Newsreader) usada *solo* para la palabra "Alma" y titulares de bienvenida — como una firma manuscrita en medio de una interfaz sans-serif. Una monoespaciada (JetBrains Mono) aparece *solo* en metadata técnica (tiempos, costos, tokens, paths, tool calls) — el guiño de "podés ver el motor" que refuerza soberanía de datos sin volverse un dashboard de devs.

## Fundamentos de contenido

Segunda persona, tono directo y cercano, sin signos de exclamación ni emojis decorativos. Frases cortas y en minúscula salvo nombres propios ("buen día, ¿cómo viene el día?", "consultando agendas…"). La metadata técnica siempre en `mono-xs`/`mono-sm`, nunca en `body` — es un dato, no una frase; separarla tipográficamente es lo que comunica transparencia. Nunca la escondas: es la prueba de que "nada vive en una caja negra".

## Fundamentos visuales

**Color.** El fondo es papel cálido (`bg`), nunca blanco puro ni gris frío. `accent` es el único color con peso de marca — botón primario, links, ítem activo de nav, avatar. No lo repitas en decoraciones sin función. Los estados (`success`/`danger`/`warning`) siempre van con ícono o palabra, nunca solo el color. `on-accent` es el único texto permitido sobre un fondo `accent`.

**Tipografía**, tres familias con roles fijos y no intercambiables:
- `sans` (Instrument Sans): la voz por defecto, toda la interfaz.
- `serif` (Newsreader, itálica): la firma de marca. Solo la palabra "Alma" y titulares de bienvenida (`display`, `display-sm`). Nunca en botones, UI o contenido del usuario.
- `mono` (JetBrains Mono): la voz del motor. Solo números y rutas técnicas. Nunca prosa.

**Espaciado y forma.** Usá la escala (`space-2`…`space-32`), nunca un valor suelto intermedio. Los radios crecen con el tamaño del elemento (`radius-xs` en chips → `radius-xl` en el input pill). Avatares e íconos circulares usan `50%` directo, no `radius-full`.

**Bordes antes que sombras.** Alma se resuelve con `border` sobre `surface`, no con elevación. `shadow-sm`/`shadow-md` son EXCLUSIVOS de tooltip y modal — ningún otro componente flota con sombra.

**Estados.** Todo control interactivo usa `focus-ring` en foco de teclado — nunca lo saques sin reemplazo. El hover de superficies planas pasa de `surface`/`bg` a `surface-subtle`, nunca a un color inventado.

**Modo oscuro.** No es un tema "apagado" del claro: es una superficie cálida invertida (marrón casi negro, nunca gris azulado). Cada token tiene su par `dark` — usalos siempre en pareja, nunca hardcodees un hex.

**Iconografía.** Sin librería propia todavía: el mockup usa glifos de texto y formas dibujadas a mano. Si se adopta una librería (Lucide, Phosphor…), trazo/outline, no relleno, para no competir con los bloques de `accent`.

## Tokens

### Color (light / dark)

| token | light | dark | uso |
|---|---|---|---|
| `bg` | `#FBF7F0` | `#1C1815` | fondo de página |
| `surface` | `#FFFDF9` | `#262019` | cards, inputs, modales, popovers |
| `surface-subtle` | `#F2EADD` | `#322A22` | burbuja asistente, hover de filas, item de sidebar seleccionado |
| `fill-muted` | `#EFE7D9` | `#3A3126` | chips, tags, badges |
| `border` | `#E4DACA` | `#453A2D` | borde de reposo (suave, a propósito) |
| `border-strong` | `#9C8360` | `#847152` | borde funcional (3:1): botón secundario, indicador activo de nav |
| `ink` | `#2A2521` | `#F3ECE0` | texto e íconos primarios |
| `text-muted` | `#6B6058` | `#B7A996` | texto secundario (cumple 4.5:1 en toda superficie) |
| `accent` | `#B4552D` | `#E2825A` | marca: botón primario, links, item activo, avatar |
| `accent-hover` | `#8E3F1F` | `#EF9873` | hover/pressed de accent |
| `on-accent` | `#FBF7F0` | `#1C1815` | texto sobre superficie `accent` |
| `success` | `#4E7B54` | `#7FB086` | éxito — siempre con ícono/palabra |
| `danger` | `#A6392B` | `#D97A6C` | error — siempre con ícono/palabra |
| `warning` | `#8A6D1E` | `#D9B15B` | alerta — siempre con ícono/palabra |
| `focus-ring` | `{accent}` | `{accent}` | outline 2px de todo control enfocable |

Todos los pares texto/fondo de esta tabla están verificados en WCAG 2 (≥4.5:1 para texto normal, ≥3:1 para `border-strong`/`focus-ring`) en ambos temas.

### Tipografía

Familias: `--font-sans: "Instrument Sans", system-ui, sans-serif` · `--font-serif: "Newsreader", Georgia, serif` · `--font-mono: "JetBrains Mono", ui-monospace, "SFMono-Regular", monospace`. Cargar desde Google Fonts (no hay archivos propios en el sistema).

| estilo | familia | tamaño/línea | peso | uso |
|---|---|---|---|---|
| `micro` | sans | 11px/16px | 500 | eyebrows, divisores de fecha (uppercase, letter-spacing .08em) |
| `caption` | sans | 12px/17px | 400 | metadata secundaria, helper text |
| `caption-strong` | sans | 12.5px/17px | 600 | títulos chicos en negrita (pasos de traza) |
| `body-sm` | sans | 13px/19px | 400 | UI densa: sidebar, tooltip, líneas secundarias de card |
| `body` | sans | 15px/22px | 400 | texto por defecto: mensajes, labels, copy |
| `body-strong` | sans | 15px/22px | 600 | nombres de archivo, títulos de card, labels de botón |
| `heading` | sans | 17px/22px | 600 | títulos de panel/sección |
| `display-sm` | serif italic | 21px/1.1 | 400 | wordmark "Alma" |
| `display` | serif italic | 34px/1.05 | 400 | hero de onboarding, empty states |
| `mono-xs` | mono | 10.5px/14px | 400 | tags técnicos dentro de pills |
| `mono-sm` | mono | 11px/15px | 400 | latencia, costo, tokens, paths, trazas MCP |

### Espaciado

`space-2`(2px) · `space-4`(4px) · `space-6`(6px) · `space-8`(8px) · `space-10`(10px) · `space-12`(12px) · `space-14`(14px) · `space-16`(16px) · `space-20`(20px) · `space-24`(24px) · `space-32`(32px)

### Radios

`radius-xs`(6px, chips/tags/badges chicos) · `radius-sm`(10px, botones/inputs compactos) · `radius-md`(14px, cards) · `radius-lg`(18px, burbujas de chat/cards grandes) · `radius-xl`(22px, input pill del composer) · `radius-full`(999px, pills — círculos usan `50%`, no esto)

### Sombras

`shadow-sm`: `0 2px 8px rgba(42,37,33,0.08)` light / `0 2px 10px rgba(0,0,0,0.32)` dark — tooltips y popovers chicos, exclusivamente.
`shadow-md`: `0 12px 32px rgba(42,37,33,0.14)` light / `0 12px 32px rgba(0,0,0,0.44)` dark — modales, exclusivamente.

### CSS custom properties (listas para pegar)

```css
:root,
[data-theme="light"] {
  --bg: #FBF7F0;
  --surface: #FFFDF9;
  --surface-subtle: #F2EADD;
  --fill-muted: #EFE7D9;
  --border: #E4DACA;
  --border-strong: #9C8360;
  --ink: #2A2521;
  --text-muted: #6B6058;
  --accent: #B4552D;
  --accent-hover: #8E3F1F;
  --on-accent: #FBF7F0;
  --success: #4E7B54;
  --danger: #A6392B;
  --warning: #8A6D1E;
  --focus-ring: var(--accent);
  --shadow-sm: 0 2px 8px rgba(42,37,33,0.08);
  --shadow-md: 0 12px 32px rgba(42,37,33,0.14);

  --font-sans: "Instrument Sans", system-ui, sans-serif;
  --font-serif: "Newsreader", Georgia, serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SFMono-Regular", monospace;

  --space-2: 2px;  --space-4: 4px;   --space-6: 6px;   --space-8: 8px;
  --space-10: 10px; --space-12: 12px; --space-14: 14px; --space-16: 16px;
  --space-20: 20px; --space-24: 24px; --space-32: 32px;

  --radius-xs: 6px; --radius-sm: 10px; --radius-md: 14px;
  --radius-lg: 18px; --radius-xl: 22px; --radius-full: 999px;
}

[data-theme="dark"] {
  --bg: #1C1815;
  --surface: #262019;
  --surface-subtle: #322A22;
  --fill-muted: #3A3126;
  --border: #453A2D;
  --border-strong: #847152;
  --ink: #F3ECE0;
  --text-muted: #B7A996;
  --accent: #E2825A;
  --accent-hover: #EF9873;
  --on-accent: #1C1815;
  --success: #7FB086;
  --danger: #D97A6C;
  --warning: #D9B15B;
  --shadow-sm: 0 2px 10px rgba(0,0,0,0.32);
  --shadow-md: 0 12px 32px rgba(0,0,0,0.44);
}
```

## Componentes base

Guía de cada uno — reglas de uso, do/don't. El detalle visual completo (HTML/CSS de referencia) vive en el artifact del design system; esto resume las decisiones para no romperlas al escribir código nuevo.

**Button** — tres variantes, un solo peso de marca por bloque de acciones: `primary` (fondo `accent`, texto `on-accent`, uno solo por pantalla/bloque), `secondary` (fondo `surface`, borde `border-strong`, texto `ink`), `ghost` (sin fondo/borde, texto `accent`, para acciones de bajo compromiso). `radius-sm`. Nunca dos primarios juntos; nunca ghost como única acción de una pantalla.

**Input / Textarea** — fondo `surface`, borde `border` en reposo (se fortalece a `border-strong` en hover), borde `accent` + `focus-ring` de 3px en foco, borde `danger` + hint en `danger` en error (nunca el borde rojo sin texto explicando qué corregir). Textarea sin resize manual. Label siempre visible, nunca solo placeholder.

**Chip** — pastilla sin acción por defecto (`fill-muted`/`text-muted`) para tags de contexto; variante mono (`mono-xs`) para nombres técnicos; variante acción (`surface`+`border`, clickeable, como ghost en pill) para quick-replies; variante removible (botón de cierre en `text-muted`, nunca `danger`); variantes de estado con punto/ícono, nunca solo color de fondo. `accent` nunca es fondo de chip — ese peso es exclusivo del botón primario y nav activo.

**Card** — contenedor `surface` + `border` + `radius-md`. Variante archivo adjunto (ícono de tipo en `fill-muted`, acción en `accent`). Variante vacía (borde punteado, texto `text-muted` centrado, sin ilustración ni mascota). Nunca sombra sobre una card que ya está sobre otra `surface`.

**Navegación lateral** — fondo `surface` sobre `bg`, borde `border` a la derecha. Ítem activo: fondo `surface-subtle` + indicador de borde izquierdo `border-strong` (nunca fondo `accent`); el ícono del activo sí toma `accent`. Hover a `surface-subtle` sin indicador.

**Modal** — centrado sobre scrim `ink` al 35%, `shadow-md` (una de las dos únicas superficies con sombra). Máximo dos acciones, la de mayor compromiso al final. Confirmación destructiva: botón principal en `danger`, no `accent`.

**Tooltip** — fondo `ink`, texto `on-accent` (la única superficie oscura invertida del sistema, a propósito), `shadow-sm`. Una línea, sin acciones clickeables adentro, aparece solo en hover/focus del ancla.

## Reglas duras (no negociables sin pedirlo explícitamente)

1. Ningún color hardcodeado fuera de esta tabla de tokens — si falta un valor, se agrega al sistema, no se improvisa inline.
2. `serif` (Newsreader itálica) nunca en UI funcional — solo firma de marca y titulares.
3. `mono` nunca en texto que el usuario escribió o lee como prosa — solo metadata técnica.
4. Todo componente interactivo tiene estado de foco visible con `focus-ring`.
5. Sombra solo en modal y tooltip — todo lo demás se resuelve con `border`.
6. Los tres estados semánticos (`success`/`danger`/`warning`) siempre van acompañados de ícono o palabra, nunca dependen solo del color.
7. Cada superficie/texto nuevo que se agregue debe verificarse en ambos temas (light y dark) antes de darse por terminado.
