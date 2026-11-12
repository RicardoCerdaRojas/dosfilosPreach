# Ficha de palabra — tabla de destino

> Generado desde los registros de bloques (`bloquesHebreo.tsx`, `bloquesGriego.tsx`). No editar a mano:
> `ACTUALIZAR_TABLA=1 npx vitest run tablaDestino` (en `packages/web`).

Cada fila es un bloque de la ficha: el dato, dónde estaba antes del rediseño, en qué sección queda, si entra en el resumen (tooltip y tarjeta) y de dónde sale.

## Hebreo (26 bloques)

| # | Bloque | Dato | Antes | Sección | Resumen | De dónde sale |
|---|---|---|---|---|---|---|
| 1 | `he.palabra` | La palabra (con morfemas en color) y su transliteración | tarjeta, tooltip, panel | Encabezado | sí | datos (OSHB, MorphGNT, MACULA o conteo propio) |
| 2 | `he.categoria` | Categoría (con su color; sin categoría, «partícula») | tarjeta, tooltip | Encabezado | sí | asistente |
| 3 | `he.verboDebil` | «Verbo débil» | tarjeta | Encabezado | — | asistente |
| 4 | `he.apertura` | «Apertura» narrativa (וַיְהִי) | tarjeta | Encabezado | — | regla |
| 5 | `he.oshb` | Sello de validación con OSHB (al tocarlo, código y correcciones) | tarjeta | Encabezado | — | datos (OSHB, MorphGNT, MACULA o conteo propio) |
| 6 | `he.traduccion` | Traducción en contexto (con respaldo: glosa, raíz…) | tarjeta, tooltip, panel | Encabezado | sí | asistente |
| 7 | `he.raiz` | Raíz, su transliteración y su significado | tarjeta, tooltip | La palabra | sí | asistente |
| 8 | `he.lexico` | Léxico (glosa) | tarjeta, tooltip | La palabra | — | asistente |
| 9 | `he.ketivQere` | Ketiv y qere: lo escrito y lo que se lee |  | La palabra | sí | datos (OSHB, MorphGNT, MACULA o conteo propio) |
| 10 | `he.celdas` | Binyan, forma, tipo de raíz, persona, género, número, estado y valor temporal | tarjeta, tooltip | La forma | sí | asistente |
| 11 | `he.correccionesOshb` | Correcciones de OSHB (cada diferencia) | tooltip | La forma | — | datos (OSHB, MorphGNT, MACULA o conteo propio) |
| 12 | `he.pistas` | Cómo se reconoce: la forma (pistas) | tarjeta, tooltip, panel | La forma | — | asistente |
| 13 | `he.morfemas` | Morfemas, uno por uno (dagesh forte ◌ּ), y la guía de colores | tarjeta, tooltip, panel | La forma | — | asistente |
| 14 | `he.detectiveVerbo` | Detective del verbo (fuerte o débil) y su clasificación en Farfán | panel | La forma | — | asistente |
| 15 | `he.funcionInfinitivo` | Función del infinitivo | tarjeta, tooltip | Su función | sí | regla + asistente |
| 16 | `he.funcionParticipio` | Función del participio | tarjeta, tooltip | Su función | sí | regla + asistente |
| 17 | `he.funcionKi` | Función de כִּי | tarjeta, tooltip | Su función | sí | regla + asistente |
| 18 | `he.funcionVerbo` | Función del verbo finito (Arnold y Choi cap. 3), con el cohortativo por función |  | Su función | sí | regla + asistente |
| 19 | `he.funcionPreposicion` | Función de la preposición (Arnold y Choi §4.1) |  | Su función | sí | asistente |
| 20 | `he.wawDisyuntiva` | Waw disyuntiva (waw + no verbo) y su valor |  | Su función | sí | regla + asistente |
| 21 | `he.funcionSintactica` | Función sintáctica (texto del asistente) | tarjeta, tooltip, panel | Su función | sí | asistente |
| 22 | `he.quienHabla` | Quién habla y a quién | tarjeta, tooltip | En el contexto | — | regla |
| 23 | `he.articulo` | El sustantivo con artículo ya se nombró antes (posible artículo anafórico) |  | En el contexto | — | datos (OSHB, MorphGNT, MACULA o conteo propio) |
| 24 | `he.antepuesta` | Antepuesta al verbo | tarjeta, tooltip | En el contexto | — | datos (OSHB, MorphGNT, MACULA o conteo propio) |
| 25 | `he.explicacion` | Explicación pedagógica (con su formato) | tarjeta, panel | Para estudiar | — | asistente |
| 26 | `he.investigar` | Investigar la palabra paso a paso (detective) | tarjeta | Acciones | — | — |

## Griego (26 bloques)

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
| 16 | `gr.apertura` | Vocativo al comienzo con imperativo o pregunta: señal de apertura de sección |  | En el contexto | — | datos (OSHB, MorphGNT, MACULA o conteo propio) |
| 17 | `gr.sentidoLouwNida` | Sentido de la preposición en el versículo (Louw-Nida, dato de MACULA) |  | Su función | — | datos (OSHB, MorphGNT, MACULA o conteo propio) |
| 18 | `gr.articulo` | Uso del artículo, su antecedente y la regla de anáfora | tarjeta, tooltip | Su función | — | regla + asistente |
| 19 | `gr.condicional` | Clase de la condicional y su valor (Wallace) |  | Su función | sí | regla |
| 20 | `gr.particulas` | Partículas y pronombre explícito | tarjeta, tooltip | Su función | — | regla + asistente |
| 21 | `gr.agencia` | Agencia (agente de la pasiva) | tarjeta, tooltip | Su función | — | regla + asistente |
| 22 | `gr.autos` | Uso de αὐτός | tarjeta, tooltip | Su función | — | regla + asistente |
| 23 | `gr.antepuesta` | Antepuesta al verbo | tarjeta, tooltip | En el contexto | — | datos (OSHB, MorphGNT, MACULA o conteo propio) |
| 24 | `gr.relaciones` | Relaciones con otras palabras | tarjeta, tooltip | En el contexto | — | asistente |
| 25 | `gr.significancia` | Significancia (palabra clave) | tarjeta, tooltip | Para estudiar | — | asistente |
| 26 | `gr.guardar` | Guardar hallazgo para el sermón | tarjeta | Acciones | — | — |
