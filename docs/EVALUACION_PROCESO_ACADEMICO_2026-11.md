# Evaluación del proceso académico: ¿está documentado y alcanza la evidencia para mejorar el sistema?

> 2026-11-19, después de entregar el TP #12. Solo lectura de código y documentos.
> Rótulos: **medido** (contado), **leído** (en el código o en un documento), **supuesto** (sin comprobar).

## 1. Respuesta corta

- **Documentación:** el método está bien registrado en contenido, pero **no está en un lugar durable ni ordenado por tipo de trabajo**:
  - el procedimiento vigente (v3) y cuatro bitácoras no están en git;
  - la adaptación para los TP vive dentro de dos bitácoras, no en el procedimiento;
  - los informes de prueba de NT785, TP11 y TP12 vivían en una carpeta temporal, y los del TP11 se perdieron.
- **Evidencia:** **alcanza para decidir el núcleo común** de lo que el sistema debe hacer en los tres tipos de trabajo. Ese núcleo es el control del texto final, la revisión con criterio, la verificación de citas y el ciclo con el autor: los mismos fallos aparecen medidos en 4 trabajos distintos.
- **Lo que la evidencia no alcanza:** **no alcanza todavía para afirmar que el proceso por capas mejora la nota**, porque no ha vuelto ninguna devolución de los trabajos hechos con él. Tampoco alcanza para saber si los revisores del sistema, con su propio modelo, encuentran lo que encontraron los revisores de este proceso. Las dos preguntas tienen una prueba barata, descrita en §6.

## 2. Inventario de la documentación

| Pieza | Dónde está | Estado |
|---|---|---|
| Procedimiento v3 (`docs/PROCEDIMIENTO_TRABAJO_ACADEMICO_2026-11.md`) | Local | **Fuera de git.** El PR #834 tiene la v1 |
| Bitácoras: TI #3, NT785, TP #10, TP #11, TP #12 | Local, `docs/` | Solo la del TI #3 está en el PR #834; **las otras cuatro, fuera de git** |
| Método del TI #3 | PR #834 | Bien |
| Adaptación del procedimiento a un TP | Bitácora TP #11 §5 y bitácora TP #12 §4 | **No está en el procedimiento** |
| Herramientas: `armar_trabajo.py`, `indice_respaldo_tp.py`, `verificar_citas_tp.py` y los cambios de `md2docx_tms.py` | `research_notes/ti3_salmo23_2026-11/herramientas/` | **Fuera de git.** La carpeta lleva el nombre del primer caso, no del uso |
| Informes de prueba (criterio y resultados de cada ronda) | TI #3: Drive. NT785 y TP #12: copiados a Drive el 19-nov (`06_Pruebas_e_informes/`) | **TP #11: perdidos**; quedan solo los resúmenes de su bitácora |
| Trabajos en el sistema (TP #7–#10), con hallazgos B70–B103, Familia A y la fase «Del corpus al texto» | `docs/` | **Fuera de git** (`FAMILIA_A…`, `FASE_DEL_CORPUS…`, bitácora del TP #10) |
| Lecciones y reglas | byblos: 5 lecciones o reglas del 18 y el 19 de noviembre, más las del TI #3 y NT785 | Bien |
| Criterios del profesor (22 patrones) | Memoria `project_criterios_profesor_tp` | Bien. **Falta la gramática del curso con sus categorías «IGNORA»**, que está en byblos |

**Lo que falta para que el material sirva de ejemplo a quien implemente:**
1. Procedimiento v4 con **perfiles por tipo de trabajo** (§5 de este documento) y con las lecciones del TP #12.
2. Todo lo anterior en git, en un solo PR de documentación.
3. La carpeta `06_Pruebas_e_informes/` como parte fija de la estructura de cada trabajo (procedimiento §3).

## 3. La evidencia disponible

| Trabajo | Tipo | Dónde se hizo | Controles | Lo que encontraron (medido) | Devolución del profesor |
|---|---|---|---|---|---|
| TP #7–#10 | TP semanal | **En el sistema** | Los del sistema | TP #10: 3 correcciones de fondo en 4 preguntas, todas de argumentación (memoria de criterios). Familia A: de 73 hojas citadas en TP #8–#10, el sistema halla 66 por algún camino y su propuesta guardada, 46 | **Sí** (base de los 22 criterios) |
| TI #2 | Investigación (hebreo) | En el sistema y a mano | — | 131 anotaciones del profesor, 33 con código | **Sí** |
| TI #3 | Síntesis + sermón (hebreo) | **Con el procedimiento** | 4 revisiones por parte | Parte 1: 27 de argumento, 13 ajustes en 71 citas, 20 de coherencia y 20 de voz. Parte 2: 20, 15 y 20. Forma: 21 | Pendiente |
| NT785 Santiago 3 | Investigación (griego) | Con el procedimiento | 4 focos + coherencia final | 13 de 190 citas con atribución que la fuente no sostiene; **3 contradicciones altas en el texto final, halladas por el autor**; 8 omisiones del proceso | Pendiente |
| TP #11 | TP semanal | Con el procedimiento v3 | Capas 1, 2 y 5 + prueba de las pruebas | Capa 1: las 4 respuestas fallaron en la v1, y el error sembrado se detectó. La capa 2 vio un error introducido por una corrección. **El autor encontró 5 citas en inglés** | Pendiente |
| TP #12 | TP semanal | Con el procedimiento v3 | Capa 1 (2 rondas), capa 2 (2 veces), capa 5 (3 veces), prueba de las pruebas | Capa 1, ronda 1: **10 hallazgos altos** en 4 respuestas, y **2 de 2 errores sembrados detectados**. Desde la ronda 2: 0 altos. **De 12 hallazgos medios posteriores, la mayoría nació de correcciones o recortes.** 7 pasos omitidos (el autor encontró 1). El autor dejó 1 comentario | Pendiente |

## 4. Lo que la evidencia ya demuestra (suficiente para decidir)

1. **El error grave nace al final, en lo que cambia después de revisar.**
   - NT785: 3 contradicciones altas en el texto final, sin ninguna revisión después de la consolidación (medido).
   - TP #12: después de la primera ronda, casi todos los hallazgos medios nacieron de correcciones, recortes o propuestas aplicadas sin verificar (medido; bitácora del TP #12, pasos 8a, 14a y 15).
   - En el sistema, el texto ensamblado no tiene versiones, y lo que se edita ahí no se vuelve a validar (leído: `ExegeticalPaper.ts:236–243`).
   - **Decisión que sostiene:** el control del texto final es la prioridad uno.
2. **Una revisión sin criterio explícito deja pasar las reglas conocidas.**
   - TP #11: las citas en inglés llegaron al autor porque el criterio de la prueba no incluía la regla (medido).
   - TP #12: 6 reglas de voz faltaban en el criterio (leído).
   - En el sistema, los criterios de la rúbrica llegan al redactor (`composerPrompts.ts:428`), pero **ningún revisor** los recibe, y la coherencia no se guarda (leído: `RunCoherencePassUseCase.ts:22–30`).
3. **La revisión por pregunta o sección encuentra temprano lo que la revisión final encontraba tarde.** TP #11 y TP #12: argumentos que no discriminan, categorías equivocadas, atribuciones infieles, todo en la v1 (medido). En NT785, las mismas clases de error aparecieron recién al final (medido).
4. **Verificar que el extracto exista no basta; la paráfrasis también se verifica.**
   - NT785: 13 de 190 citas.
   - TP #12: 5 atribuciones infieles con el extracto ya verificado (medido).
   - El sistema ya tiene la mitad difícil (`takenFromSource` / `notFromSource`, leído). Le falta guardar la imagen de la página y un índice que falle si falta un respaldo.
5. **El ciclo con el autor en Word es donde se cierran los errores que nadie más ve.**
   - TI #3: 25 ediciones del autor.
   - NT785: 3 omisiones graves halladas por el autor.
   - TP #11: la portada; TP #12: la regla de glosar (medido).
   - El sistema no lee los comentarios ni el control de cambios (leído).
6. **Las páginas estimadas fallan.**
   - TI #3: el presupuesto en palabras subestimó la Parte 1 en 4 páginas.
   - TP #12: las correcciones llevaron el texto de 3 a 4 páginas (medido).
   - El sistema estima por palabras y lo advierte (leído: `paperLength.ts:8–20`).
7. **El modelo del sistema, versículo → conclusión → introducción, no calza con dos de los tres tipos** (leído):
   - el TP reparte las preguntas por versículo;
   - la investigación no tiene secciones temáticas ni apéndices;
   - la síntesis + sermón no existe como tipo.
8. **Las omisiones cambiaron de naturaleza: primero de diseño, después de ejecución.**
   - En NT785, las 8 omisiones eran sobre todo huecos del procedimiento, y cada una dejó una regla nueva (procedimiento §12, medido).
   - En el TP #12, las 7 omisiones eran pasos que el procedimiento ya pedía y que se saltaron al seguirlo de memoria (medido).
   - El diseño ya está bastante completo, y lo que falla es cumplirlo. En el sistema eso pide **compuertas**, no instrucciones: un paso que no se puede saltar.

## 5. Plataforma frente al procedimiento, por paso

Resumen de un mapa del código del 19-nov. Las afirmaciones de mayor peso se comprobaron en el código.

| Paso | En el sistema | Brecha principal |
|---|---|---|
| 0. Entradas y requisitos | Parcial: enunciado, preguntas, rúbrica, plazo, devolución, fuentes excluidas | Nada es obligatorio; no hay matriz de requisitos ni clases como entrada; las prohibiciones que no son una fuente quedan en texto libre |
| Fuentes, extractos y página | **Sí, lo más maduro** | No hay una ficha de lectura aprobada por el autor |
| Aprobaciones del autor | Parcial: pasos, tesis, títulos | **Las decisiones discutibles las elige el modelo** (`TranslationCrux.options`) |
| Tope y páginas | Estimación | No hay medición real del Word exportado |
| Pruebas por capas | Parcial: citas por paso, coherencia, tesis, revisión antes de exportar | Sin criterio para pasar; la coherencia no se guarda ni ve la rúbrica; falta la capa 3; no hay regresión sobre el ensamble |
| Citas | **Fuerte** | No hay imagen guardada; no hay índice que falle; no se verifica el ensamble |
| Citas bíblicas y griego | **No** (solo insumos: MorphGNT, OSHB y `verifyAnchorVerse`) | Comparar la prosa con el texto base y la RV1960 |
| Voz y criterios | Parcial: reglas al redactar | No son una lista de control al revisar; no hay vetos de la gramática del curso; «todo en español» no está |
| Controles por versión | Parcial: versiones por paso | No hay hash ni regla de vencimiento; el ensamble no tiene versiones |
| Comentarios en Word | **No** | Leer los comentarios y el control de cambios, comparar y aplicar como regla |
| Entrega | Word sí, PDF no | El CONTENIDO queda como campo de Word; no hay apéndices; no hay forma revisada sobre el PDF |
| Lecciones | Sí, como reglas de la guía | No vuelven como criterio de prueba |

## 6. Lo que todavía no sabemos, y cómo averiguarlo barato

| Pregunta | Por qué importa | Prueba propuesta | Costo |
|---|---|---|---|
| **¿El proceso por capas reduce las marcas del profesor?** | Es la razón para llevarlo al sistema | **Registrar ahora la predicción**, antes de que vuelvan las devoluciones del TP #11 y del TP #12: marcas de fondo por pregunta, contra la base del TP #10 (3 en 4, todas de argumentación). Contarlas con el mismo código del profesor. Las variables que confunden: otro pasaje, ediciones del autor | Nulo |
| **¿Los revisores del sistema encuentran lo mismo?** | Decide si basta con darles criterio o si hace falta otro diseño | **Banco de pruebas con lo guardado:** TP #12 v1 (4 informes con unos 30 hallazgos verificados), NT785 v4 (3 contradicciones altas conocidas) y TI #3 (informes en Drive). Correr ahí el revisor de coherencia y el verificador de citas del sistema y medir cuántos hallazgos conocidos recuperan, contando los errores sembrados | Llamadas al modelo de producción (prepago; **requiere OK**) |
| ¿Cuántos hallazgos de los revisores eran falsos? | Sin esto no se sabe cuánto ruido agrega cada capa | Reconstruir desde los informes guardados cuántos hallazgos se descartaron al verificarlos (se registró en parte, por ejemplo el B2 del TP #12) | Lectura |
| ¿Sirve para otro estudiante y otro profesor? | Todo viene de un autor, un seminario y un profesor | No se puede medir hoy; marcarlo como **supuesto** en todo diseño | — |
| ¿Cuánto cuesta cada capa? | Para decidir qué corre siempre y qué a pedido | Registrar tiempos y llamadas por capa en el próximo trabajo | Nulo |

## 7. Propuesta para el sistema, por orden y por tipo de trabajo

**El núcleo común** es igual para los tres tipos y tiene la evidencia más fuerte:

1. **El texto final, controlado.**
   - El ensamble con versiones y hash.
   - Registro de controles con vencimiento: cambiar el texto vence la coherencia y las citas.
   - Una compuerta antes de exportar que diga qué control está vencido.
   - Medición real de páginas del documento exportado.
   - Evidencia: §4.1 y §4.6.
2. **Revisión con criterio.**
   - Cada revisor recibe la rúbrica, los criterios del profesor, las reglas de voz, las lecciones de la guía y los vetos de la gramática del curso, y devuelve si pasa o no con su tabla.
   - La coherencia se guarda.
   - Evidencia: §4.2.
3. **Citas auditables.**
   - Imagen de la página guardada junto a cada cita.
   - Índice que falle si falta un respaldo.
   - Verificación del griego, el hebreo y las referencias bíblicas de la prosa. Las herramientas manuales existen y se probaron con mutación. **Ojo:** en el TP #12 no encontraron ningún error real, así que su valor medido es de cobertura, no de errores evitados.
   - Evidencia: §4.4.
4. **Ciclo con el autor.**
   - Leer los comentarios y el control de cambios del Word, compararlo con el original y aplicar cada comentario como regla a todo el texto.
   - Las decisiones discutibles, al autor como opciones.
   - Evidencia: §4.5 y la omisión ✋ del TP #12.
5. **Etapa 0 como compuerta.**
   - Plazo, rúbrica, Guía, devolución anterior y fuentes prohibidas, con la matriz de requisitos que se revisa en la puerta final.
   - Evidencia: −10 % por atraso en el TI #2; el plazo de NT785 se descubrió el día anterior; el plazo del TP #12 no se leyó.

**Lo propio de cada tipo de trabajo:**

| Tipo | Estructura que hace falta | Capas | Lo específico |
|---|---|---|---|
| **TP semanal** | **Una sección por pregunta**, no por versículo | 1 (por pregunta), 2 y 5 | Rotación de fuentes por semana; tope de 2–3 páginas; cita «(Autor, N)»; un cierre con una afirmación y la traducción |
| **Investigación** | Secciones temáticas libres; inventarios (formas, aparato) como **apéndices** que no cuentan para el tope | 1 a 5 | La tesis sale del cuerpo (conclusión → tesis → introducción); los requisitos se cumplen en el cuerpo, no en un apéndice |
| **Síntesis + sermón** | Un tipo nuevo que lea los trabajos aprobados y su devolución | 1 a 5 por parte | El sermón hereda las glosas y los tiempos de la Parte 1; el género del pasaje limita la aplicación; se conservan los argumentos elogiados |

**Lo que no conviene construir todavía:**
- **La prueba de las pruebas como función para el usuario:** sirvió, pero es control de calidad del sistema, no del estudiante. Va en el banco de §6.
- **La «puerta» de comentario del autor con IA:** primero hay que medir cuánto del ciclo es mecánico (leer y comparar) y cuánto es juicio.

## 8. Próximos pasos propuestos (versión inicial, corregida en §9)

1. **Documentación (sin riesgo):** procedimiento v4 con perfiles por tipo y las lecciones del TP #12; actualizar el PR #834 con el procedimiento, las 5 bitácoras, los documentos del sistema (`FAMILIA_A`, `FASE_DEL_CORPUS`) y las herramientas; `06_Pruebas_e_informes/` en la estructura de carpetas.
2. **Registrar la predicción** de marcas del profesor para el TP #11 y el TP #12 antes de que vuelvan las devoluciones (§6).
3. **El banco de pruebas de los revisores** con los textos y hallazgos guardados (requiere el OK del costo).
4. Con 2 y 3 resueltos, un documento de fase para el núcleo común (§7, puntos 1–2), con un PR por fase, según la regla vigente.

## 9. Corrección acordada con el fundador (2026-11-19/20)

El fundador objetó dos cosas, y las dos eran ciertas.

1. **Esta evaluación no revisó a fondo el flujo actual.** Se basó en un mapa del código contra los 12 pasos y en 4 comprobaciones. No se recorrió el flujo como lo usa un estudiante, ni se leyeron los datos reales de los TP #7–#10, ni el ciclo de vida de un paso. Esa revisión es la etapa 0 de la fase siguiente.
2. **Proponer «el control del texto final» se queda corto: el método es la batería completa.** En el TP #12, los 10 hallazgos altos los encontró la capa 1 en la v1, no la regresión. El registro de controles por versión no es un paso del final: es el eje del que cuelgan las cinco capas. El sistema ya tiene partes de las capas 1, 2 y 4; faltan la capa 3, la regresión, el criterio para pasar y el registro.

**El orden acordado** sigue el flujo del trabajo, como propuso el fundador, con dos ajustes del asistente:

| # | Etapa | Contenido |
|---|---|---|
| 0 | **Medir y revisar** | (a) La fase «Del corpus al texto» (#826–#829) está desplegada, pero **nunca se probó en un TP real**. Se mide contra las hojas citadas de verdad en el TP #11, el TP #12 y NT785 (los índices de respaldo son la verdad de referencia). (b) El catálogo curado de Santiago y la guía de búsqueda frente a las obras que se usaron y se consiguieron fuera del sistema; no tiene costo, porque el catálogo es estático. (c) Revisión profunda del flujo actual: código, recorrido en el navegador y datos de los TP #7–#10 |
| 1 | **El corpus del trabajo, en dos mitades** | (a) **Qué conseguir:** lo que pide el trabajo (propósito y cantidad, según el enunciado, la rúbrica y las reglas del curso) frente a lo que el estudiante tiene; títulos verificados para conseguir; revisión de lo que trae (edición, paginación, desfase, para qué sirve). (b) **Qué usar de lo que tiene:** hojas por pregunta |
| 2 | **Ficha de lectura con respaldo** | Extracto, página, imagen y la pregunta a la que sirve; la aprueba el autor; la usa el redactor y la verifica la capa 1. **Nace con versión.** |
| 3 | **Redacción por tipo de trabajo** | Por pregunta (TP), por tema con apéndices (investigación), y síntesis + sermón |
| 4 | **Batería completa** | Las 5 capas, cada una con su criterio para pasar, sobre el registro de controles por versión. El registro se diseña desde la etapa 2, aunque sus compuertas se construyan aquí |

**El asistente del corpus: una capa de herramientas con dos puertas.** El fundador observó que lo que mejor funcionó fue poder conversar en cualquier momento, sobre todo para armar el corpus: pedir títulos, revisar libros descargados antes de subirlos, decidir qué se cita sin página. Funcionó porque el asistente tenía el contexto del trabajo, podía leer los libros antes de subirlos, tenía herramientas, y **cada conversación dejaba registro**. Hoy esa lectura del sistema se hace con 107 scripts sueltos con acceso de administrador (`scripts/rag-eval/.*.ts`), fuera de git.

- **Las herramientas del corpus se definen una vez**, sobre los casos de uso que ya existen:
  - buscar en la biblioteca;
  - leer una página con su número impreso;
  - consultar el catálogo y verificar un título contra catálogos públicos;
  - leer los requisitos del trabajo;
  - revisar un PDF antes de subirlo;
  - marcar «por conseguir», descartar con su razón y fijar una hoja a una pregunta.
- **Puerta 1, el MCP del sistema:** para el fundador, el desarrollo y los usuarios avanzados, sobre Claude Desktop o Code. Reemplaza los scripts de administrador por un acceso limitado a la cuenta, permite correr el banco de pruebas sobre el sistema real y muestra qué herramientas se usan antes de diseñar pantallas.
- **Puerta 2, el chat del corpus dentro del trabajo:** para todos. Usa el modelo de la plataforma y una bandeja de revisión de PDF. Cada conversación termina en un cambio de estado visible en el corpus.

**Decisiones abiertas para el diseño:**
1. El MCP, ¿solo lectura al comienzo, o también escritura con confirmación?
2. ¿Puede el asistente proponer títulos fuera del catálogo curado, si cada uno pasa la verificación contra catálogos públicos? Esto revierte la decisión de la v1.7.
3. Mandar texto de libros a un modelo externo en la puerta 1: son archivos del usuario, pero se declara y se autoriza.
4. La bandeja de revisión lee solo la página de derechos, el índice y algunas páginas de muestra, no el libro entero, por el costo de la extracción premium.

**Supuesto:** pocos estudiantes instalarían un MCP; por eso la puerta 2 es la de todos.

**Siguiente fase:** una rama nueva, que empieza por la etapa 0 y entrega **un diseño completo, con lo visual, para que el fundador lo evalúe antes de aprobar que se construya**.
