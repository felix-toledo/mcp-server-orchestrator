Esta skill valida el pilar de MNEMOS y la "Memoria Visual". ALMA debe poder materializar sus pensamientos en un formato legible por humanos.

Descripción: Permite a ALMA crear o actualizar archivos Markdown directamente en tu bóveda local de Obsidian.

Parámetros:

filename (string): Nombre del archivo (ej. ideas_tfg.md).

content (string): El cuerpo del documento en Markdown.

frontmatter (object): Metadatos YAML (ej. {"tags": ["#idea", "#tfg"], "status": "draft"}).

append (boolean): Si es true, agrega contenido a una nota existente en lugar de sobrescribirla.

Filosofía ALMA: Esto garantiza la soberanía. No guardamos en una nube oscura; el LLM escribe un archivo .md en tu disco duro. Al usar esta tool, el LLM debe estar instruido para generar enlaces bidireccionales ([[WikiLinks]]) para ir armando el grafo de conocimiento.
