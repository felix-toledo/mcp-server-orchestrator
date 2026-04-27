Descripción: Permite a LOGOS buscar información en la memoria a corto plazo o en los vectores de Obsidian ya procesados.

Parámetros:

query (string): La pregunta o concepto a buscar.

limit (number): Cantidad de fragmentos a recuperar (recomiendo limitarlo a 3 o 5 para no saturar el contexto).

Filosofía ALMA: Cuando pidas "Hagamos hamburguesas", el orquestador primero dispara esta skill buscando "preferencias comida hamburguesa". La BD vectorial (pgvector) devuelve tu odio por el pepino, y recién ahí ALMA genera la respuesta final.
