# Ficha de palabra — tabla de destino

> Generado desde los registros de bloques (`bloquesHebreo.tsx`, `bloquesGriego.tsx`). No editar a mano:
> `ACTUALIZAR_TABLA=1 npx vitest run tablaDestino` (en `packages/web`).

Cada fila es un bloque de la ficha: el dato, dónde estaba antes del rediseño, en qué sección queda, si entra en el resumen (tooltip y tarjeta) y de dónde sale.

## Hebreo (21 bloques)

| # | Bloque | Dato | Antes | Sección | Resumen | De dónde sale |
|---|---|---|---|---|---|---|
| 1 | `he.palabra` | La palabra (con morfemas en color) y su transliteración | tarjeta, tooltip, panel | Encabezado | sí | datos (OSHB, MorphGNT, MACULA o conteo propio) |
| 2 | `he.categoria` | Categoría | tarjeta, tooltip | Encabezado | sí | asistente |
| 3 | `he.verboDebil` | «Verbo débil» | tarjeta | Encabezado | — | asistente |
| 4 | `he.apertura` | «Apertura» narrativa (וַיְהִי) | tarjeta | Encabezado | — | regla |
| 5 | `he.oshb` | Sello de validación con OSHB | tarjeta | Encabezado | — | datos (OSHB, MorphGNT, MACULA o conteo propio) |
| 6 | `he.traduccion` | Traducción en contexto | tarjeta, tooltip, panel | Encabezado | sí | asistente |
| 7 | `he.raiz` | Raíz, su transliteración y su significado | tarjeta, tooltip | La palabra | — | asistente |
| 8 | `he.lexico` | Léxico (glosa) | tarjeta, tooltip | La palabra | — | asistente |
| 9 | `he.celdas` | Binyan, forma, tipo de raíz, persona, género, número, estado y valor temporal | tarjeta, tooltip | La forma | sí | asistente |
| 10 | `he.correccionesOshb` | Correcciones de OSHB (cada diferencia) | tooltip | La forma | — | datos (OSHB, MorphGNT, MACULA o conteo propio) |
| 11 | `he.pistas` | Cómo se reconoce: la forma (pistas) | tarjeta, tooltip, panel | La forma | — | asistente |
| 12 | `he.morfemas` | Morfemas, uno por uno, y la guía de colores | tarjeta, tooltip, panel | La forma | — | asistente |
| 13 | `he.reglasVerboDebil` | Reglas de verbo débil (detective) y su clasificación | panel | La forma | — | asistente |
| 14 | `he.funcionInfinitivo` | Función del infinitivo | tarjeta, tooltip | Su función | sí | regla + asistente |
| 15 | `he.funcionParticipio` | Función del participio | tarjeta, tooltip | Su función | sí | regla + asistente |
| 16 | `he.funcionKi` | Función de כִּי | tarjeta, tooltip | Su función | sí | regla + asistente |
| 17 | `he.funcionSintactica` | Función sintáctica (texto del asistente) | tarjeta, tooltip, panel | Su función | sí | asistente |
| 18 | `he.quienHabla` | Quién habla y a quién | tarjeta, tooltip | En el contexto | — | regla |
| 19 | `he.antepuesta` | Antepuesta al verbo | tarjeta, tooltip | En el contexto | — | datos (OSHB, MorphGNT, MACULA o conteo propio) |
| 20 | `he.explicacion` | Explicación pedagógica (texto largo) | tarjeta, panel | Para estudiar | — | asistente |
| 21 | `he.investigar` | Investigar la palabra paso a paso (detective) | tarjeta | Acciones | — | — |

## Griego (23 bloques)

| # | Bloque | Dato | Antes | Sección | Resumen | De dónde sale |
|---|---|---|---|---|---|---|
| 1 | `gr.palabra` | La palabra, su transliteración y su lema | tarjeta, tooltip | Encabezado | sí | datos (OSHB, MorphGNT, MACULA o conteo propio) |
| 2 | `gr.categoria` | Categoría | tarjeta, tooltip | Encabezado | sí | datos (OSHB, MorphGNT, MACULA o conteo propio) |
| 3 | `gr.palabraClave` | Insignia «Palabra clave» | tarjeta, tooltip | Encabezado | sí | asistente |
| 4 | `gr.traduccion` | Traducción en contexto | tarjeta, tooltip | Encabezado | sí | asistente |
| 5 | `gr.rango` | Rango semántico | tarjeta, tooltip | La palabra | — | asistente |
| 6 | `gr.frecuencia` | Frecuencia (NT, libro, palabra rara) | tarjeta, tooltip | La palabra | — | datos (OSHB, MorphGNT, MACULA o conteo propio) |
| 7 | `gr.composicion` | Composición de la palabra | tarjeta, tooltip | La palabra | — | asistente |
| 8 | `gr.nombre` | Nota sobre el nombre | tarjeta, tooltip | La palabra | — | asistente |
| 9 | `gr.celdas` | Tiempo, voz, modo, persona, caso, número, género, grado | tarjeta, tooltip | La forma | sí | datos (OSHB, MorphGNT, MACULA o conteo propio) |
| 10 | `gr.pistas` | Cómo se reconoce: la forma (pistas y su fuente) | tarjeta, tooltip | La forma | — | regla |
| 11 | `gr.funcionVerbo` | Función del verbo | tarjeta, tooltip | Su función | sí | regla + asistente |
| 12 | `gr.usoTiempo` | Uso del tiempo (indicativo) | tarjeta, tooltip | Su función | — | asistente |
| 13 | `gr.caso` | Función del caso, su puente de traducción y la función sintáctica | tarjeta, tooltip | Su función | sí | asistente |
| 14 | `gr.funcionSintactica` | Función sintáctica (texto del asistente) y puente de traducción | tarjeta, tooltip | Su función | sí | asistente |
| 15 | `gr.preposicion` | Régimen de la preposición | tarjeta, tooltip | Su función | — | regla |
| 16 | `gr.articulo` | Uso del artículo, su antecedente y la regla de anáfora | tarjeta, tooltip | Su función | — | regla + asistente |
| 17 | `gr.particulas` | Partículas y pronombre explícito | tarjeta, tooltip | Su función | — | regla + asistente |
| 18 | `gr.agencia` | Agencia (agente de la pasiva) | tarjeta, tooltip | Su función | — | regla + asistente |
| 19 | `gr.autos` | Uso de αὐτός | tarjeta, tooltip | Su función | — | regla + asistente |
| 20 | `gr.antepuesta` | Antepuesta al verbo | tarjeta, tooltip | En el contexto | — | datos (OSHB, MorphGNT, MACULA o conteo propio) |
| 21 | `gr.relaciones` | Relaciones con otras palabras | tarjeta, tooltip | En el contexto | — | asistente |
| 22 | `gr.significancia` | Significancia (palabra clave) | tarjeta, tooltip | Para estudiar | — | asistente |
| 23 | `gr.guardar` | Guardar hallazgo para el sermón | tarjeta | Acciones | — | — |
