# Fase: lo que destapó el TP #8 (Santiago 4:1-10) · octubre 2026

> **Estado: APROBADA 2026-10-21, en tres fases (8a → 8b → 8c).** Las decisiones del fundador y las que siguen abiertas están al final.

## Qué es

Es la fase de arreglos que salió de un ejercicio real hecho en producción el 21 de octubre de 2026: el trabajo práctico #8 de griego del NT del fundador, sobre Santiago 4:1-10. Tenía cuatro preguntas (μέλεσιν, φονεύετε, αἰτεῖτε καὶ οὐ λαμβάνετε, la cita de 4:5) y la entrega era el mismo día a las 19:59. El ejercicio servía también para probar la fase del TP #7 (`docs/FASE_EJERCICIO_TP7_2026-10.md`, #765-#769).

El ejercicio tenía **un objetivo nuevo: medir la autonomía**, es decir, cuánto avanza el estudiante con la plataforma sola, sin consultar a Claude. La bitácora completa, con 45 hallazgos, está en la memoria `project_ejercicio_tp8_santiago4_1`.

**El objetivo de esta fase** lo fijó el fundador: que el estudiante **no dependa de ayuda externa**. La plataforma tiene que **prever** los errores antes de generar y, cuando igual ocurran, **guiar** la solución con un diagnóstico y un arreglo de un clic. La **precisión de las citas** es lo prioritario.

---

## Lo que midió el ejercicio

| Medida | Resultado |
|---|---|
| Configuración (encuadre, rúbrica, portada, plan estructural) | Sin ayuda |
| Corpus, plan de uso y diagnóstico de citas | Con ayuda de Claude: leyó producción y cruzó datos |
| Análisis regenerado con una indicación **genérica** de método | La plataforma halló **6 de 10** datos esperados (4:1 1/1, 4:3 2/3, 4:5 3/6) |
| Prosa recompuesta con la lista genérica del profesor | La plataforma resolvió **cerca de la mitad** de los puntos |
| Alarmas de citas | Unas 30 en el día (contadas a mano en la bitácora). Casi todas de cuatro tipos (ver D); muy pocas eran errores de contenido |
| Errores de Claude | 4, todos por escribir sin leer la página: Tuggy 585 en vez de 584, Gn 6:3–7 «según Adamson», Adamson como crítico-técnico, Wallace 533 |

**La lección central.** Los aciertos de Claude no salieron de conocer los libros, sino de **datos que la plataforma ya tiene y no usa**:

- el índice de pasajes `refs` de `document_chunks` (#779);
- la morfología SBLGNT;
- la búsqueda en todo el libro (`searchDocumentText`);
- los campos que el verificador ya calcula.

Casi todo lo que falta es **unir piezas que ya existen**, y casi todo sin modelo.

---

## Lo que ya funciona (no tocar)

Comprobado en producción el 2026-10-21. Son arreglos del TP #7:

- **Rúbrica:** la que se elige al crear el trabajo se conserva, y el encabezado dice su nombre (#1 y #4 del TP #7).
- **Fuentes excluidas:**
  - la propuesta nombra la entrega anterior («Santiago 3:13-18»);
  - cada marca se guarda al marcarla;
  - cada ficha dice «citada en…» (#2, #9 y #10).
- **Plan de uso:**
  - planifica solo los versículos con pregunta, y la introducción y la conclusión quedan «fuera por el encuadre»;
  - las fichas muestran la clave del autor;
  - sin bucle y sin rechazo del proveedor.
- **Plan estructural:** el ancla ya no queda en 0 (#18).
- **Visor (fase F):** «Ir a p.», «Buscar en todo el libro» y «Citar». El fundador los usó.
- **Verificador:** separa bien lo que dice la fuente del análisis propio. Sus alarmas en 4:1 (Tuggy) y 4:3 (Kittel) eran correctas.
- **Ensamble determinista:** respeta las ediciones a mano.
- **`applyPageLabelStyle`:** quita «p.» al mostrar y exportar.

---

## Principios de diseño (valen para todas las unidades)

1. **Primero lo determinista; el modelo trabaja solo sobre candidatos ya hallados.** Las hojas se encuentran por índice: `refs`, lema y encabezado. El modelo solo ordena, rotula o redacta, así que no puede inventar una página.
2. **Cada afirmación lleva su procedencia.** El esquema separa «lo que dice la fuente» (con cita, idealmente textual) de «lo que concluye el análisis» (sin cita). Ese único cambio previene la mayoría de las alarmas del día.
3. **El verificador ve lo mismo que vio el analizador y, antes de alarmar, busca en el libro.** Una cita no se declara «no encontrada» sin haber leído la página citada, sus vecinas y el libro completo.
4. **Toda alarma trae causa, evidencia y un remedio.** Nunca «revisa manualmente» a secas.
5. **Nada se pierde entre etapas.** Lo que el análisis resolvió (el criterio decisivo, la gramática del curso, las citas corregidas) tiene que llegar a la prosa. Un auditor lo comprueba.
6. **Cada unidad se mide con el TP #8 como banco de prueba** (ver «Banco de prueba»). Ninguna se da por terminada sin la medición del antes y el después.

---

## A. El material correcto en el corpus: por pasaje, por palabra, por nota (prever)

**Problema.** El corpus elige páginas por **parecido de texto** con el pasaje. En gramáticas, léxicos, diccionarios y comentarios clásicos, esa señal no sirve.

- **#18 · Wallace:** propuso 14 tramos y ninguno contenía las 3 hojas que nombran Stg 4.
- **#19 · Tuggy:** trajo ἀλαζονεία, κατήφεια y las abreviaturas, y ningún lema de las preguntas.
- **#32 · Mayor:** perdió la hoja 411, la nota sobre 4:3 que defiende la lectura rival, y las hojas 415–417 sobre 4:5.
- **Kittel:** acertó a medias.

Claude encontró todo eso consultando `refs` y buscando los lemas en el texto.

### A1. Índice de pasajes en el corpus (#18)
- **Hoy:**
  - `refs` lo escribe `indexStructuredDocument.ts:244/453`, y su único lector es el chat de la biblioteca (`recuperarFragmentos.ts:177-196`).
  - «Páginas que nombran el pasaje» (`usePassagePages.ts`) usa una regex literal (`documentTextSearch.ts:268`, libro + c:v) que pierde «v. 14», «4:2» suelto e «IV 2, 3».
  - `SheetRangeProposer.ts:79-89` solo prueba lo estructural y lo semántico.
- **Arreglo:**
  1. Agregar a `searchDocumentText` un modo `'refs'`. Consulta `document_chunks` por `resourceId + userId + refs array-contains-any` (ya hay índice en `firestore.indexes.json:847-863`) y devuelve las hojas (`metadata.page`) con los versículos que nombra cada una. Hay que contemplar la biblioteca compartida del sistema, cuyos fragmentos son de otro dueño.
  2. Agregar un tercer proponente en `proposeSheetRanges`: las hojas cuyo `refs` contiene un **versículo con pregunta** (`parseBriefQuestions`). Va primero en gramáticas, léxicos, diccionarios y aparatos. Le llega a la vez al selector, a adjuntar desde la biblioteca, a heredar de la serie y a «Falta para la rúbrica».
  3. Reemplazar la regex de `usePassagePages` por el modo `'refs'`.
  4. En la selección por versículo, darle **bono de pasaje** a la hoja cuyo `refs` contiene el versículo del paso (`rankCuratedChunks`, `retrieveCuratedCorpus.ts:343-366`), antes del coseno.
- **Medida:** con las páginas que se eligieron a mano en el TP #8 como respuesta esperada, la propuesta de Wallace contiene las hojas 569, 633 y 698. Hoy no contiene ninguna.

### A2. Entradas de léxico y diccionario por lema, completas (#19, #29)
- **Hoy:**
  - Los lemas salen del análisis o de la morfología de **todo** el versículo (`ExegesisSourcePagesPage.tsx:88-101`), no de la pregunta.
  - `lemmaSheetsIn` (`documentTextSearch.ts:230-255`) cuenta apariciones por hoja.
  - `rankLemmaSheets` asume que «la hoja con más apariciones es la entrada».
  - Siempre devuelve una hoja suelta, nunca un tramo.
  - La negrita del lema **sí** está en el texto indexado.
- **Arreglo:**
  1. Tomar los **lemas de la consigna**: las palabras griegas o hebreas citadas en cada pregunta, lematizadas con la morfología SBLGNT u OSHB del versículo (μέλεσιν → μέλος, φονεύετε → φονεύω, αἰτεῖτε → αἰτέω). Esos lemas van primero, y después los del resto del versículo.
  2. Agregar un detector de entrada: la línea que empieza con `**lema` (con tolerancia a acentos y a la ficha «, ους, τό.»). La entrada termina en el siguiente lema en negrita. El resultado es un **tramo** («584–585»), no una hoja.
  3. En la «selección sugerida» del léxico, proponer la entrada de cada lema de la consigna, ya fijada.
- **Por qué:** la hoja 585 de Tuggy contenía la cita de Stg 4:1, pero la definición estaba en la 584. Ese fue el error de Claude (#29), y la plataforma lo habría evitado tomando la entrada entera.

### A3. Comentarios clásicos con notas por versículo (#32)
- **Hoy:** `parseHeadingReference` (`documentOutline.ts:166-218`) solo reconoce referencias completas en encabezados markdown. `refsDeFragmento` exige «c:v» o el nombre del libro. Mayor no tiene ni «sección exacta» ni `refs` útiles, aunque el índice del visor muestra «IV 2, 3] NOTES» en cada página.
- **Arreglo:**
  1. Agregar un patrón de **encabezado de página** con capítulo romano y versículos: «IV 2, 3] NOTES».
  2. Agregar un patrón de **nota con lema** al comienzo de una línea: «3. αἰτεῖτε καὶ οὐ λαμβάνετε,]» y «πρὸς φθόνον ἐπιποθεῖ.]». El versículo se toma del número, y el capítulo se hereda del encabezado de página en curso.
  3. Aplicar los dos patrones en `refsDeFragmento` y en el esquema del documento, para que Mayor y Ropes (ICC) den «sección exacta» por versículo.
  4. Rellenar `refs` con `scripts/rellenar-refs.ts`. **No toca los vectores, así que no cuesta embeddings.** Pide OK antes de `--escribir`.
- **Medida:** la nota de Mayor sobre 4:3 (h. 411) y las de 4:5 (h. 413–417) entran al corpus sin que nadie las elija a mano.

### A4. Revisión del corpus por pregunta, antes de generar (la pieza que previene)
Es una tarjeta nueva en el Corpus y en el Plan de uso: **«¿Qué responde cada pregunta?»**. Para cada pregunta muestra, por fuente, las hojas que la tocan (de A1, A2 y A3), y avisos con su arreglo:
- *«Runge no nombra ningún versículo con pregunta.»* → [Quitarlo]
- *«Jamieson-Fausset-Brown no tiene páginas impresas: sus citas no se podrán comprobar.»* → [Quitarlo] o [Resolver numeración]
- *«La nota de Mayor sobre 4:3 (h. 411) no está en el corpus.»* → [Agregarla y fijarla]
- *«Gramática del curso (Wallace): nombra 4:2 en las pp. 597 y 662 y 4:5 en la p. 533.»* → [Fijar]
- *«Comentario crítico-técnico: 1 de 2. Ninguna fuente de tu biblioteca permitida esta semana cubre este tipo; las de ese tipo están excluidas: Ropes y McCartney.»* → [Aceptar 1 de 2] o [Subir un libro] (#10, #13)

Todo es determinista y usa los datos de A1, A2 y A3. Así el estudiante se entera de lo que falta **antes** de gastar en el análisis.

**Medido (2026-10-21, solo lectura, corpus real del TP #8, `scripts/rag-eval/.medir-revision.ts`):**
- **Corpus como se entregó:** un solo aviso, la entrada de λαμβάνω en Tuggy (550–551) fuera del corpus. Es material que la pregunta 3 nombra («οὐ λαμβάνετε»).
- **Contrafáctico, sin Mayor 411 ni Tuggy 584 (el corpus antes de los arreglos a mano):** avisa los dos.
  - «Mayor trata las preguntas 2 y 3 (4:2, 4:3) en p. 133, fuera del corpus».
  - «La entrada de μέλεσιν en Tuggy está incompleta (sin p. 584)».
- **Mayor 411 se detecta solo con las refs de A3.** Hace falta `rellenar-refs.ts --escribir` después del deploy. Con las refs de hoy, Mayor no nombra ningún versículo con pregunta.
- **Tres reglas que salieron de la medición:**
  1. **Un comentario del libro nunca recibe «no nombra ningún versículo».** Con las refs de hoy, Mayor salía como inútil, con la acción [Quitar del corpus].
  2. **Un hueco dentro de la sección elegida avisa** (≤ 4 hojas a cada lado), aunque otra hoja del corpus nombre el versículo. Sin esta regla, la 413 («IV 3–5]») tapaba la falta de la 411.
  3. **En un léxico manda la entrada del lema.** Tuggy 209 (δαπανάω) cita 4:3, pero la entrada de αἰτέω ya estaba en el corpus.
- **Lo que no hace:** «Comentario crítico-técnico: 1 de 2… excluidas: Ropes y McCartney» queda para A7, que es donde se decide la regla por tipo.
- **Modo de selección `passage`:** las propuestas por pasaje ya no se guardan como «Coincidencia aproximada». La selección hecha a mano tampoco: tiene su propio rótulo.

### A5. Fijar por hoja (#33)
- **Hoy:** `normalizeSheetRanges` (`documentPageIndex.ts:117-135`) funde las hojas contiguas, y «Fijar» compara el tramo exacto (`SourcePagesWorkspace.tsx:292-299`). Por eso no se puede fijar la 411 dentro de 407–418.
- **Arreglo:** guardar `pinnedSheets` como un **conjunto de hojas**, independiente de los tramos. La interfaz permite fijar y desfijar cada hoja. El medidor y `readPinned` leen el conjunto. Los datos antiguos se migran tramo por tramo.

**Hecho (2026-10-21):**
- **Sin campo nuevo y sin migración.** `pinnedRanges` ya vivía aparte de los tramos y se recortaba a ellos (`clipRangesTo`), y el recuperador lee cualquier sub-tramo. Lo que fallaba era la interfaz, que comparaba el tramo exacto.
- **Lo fijado se trata como un conjunto de hojas:** `togglePinnedSheet`, `togglePinnedRange`, `pinStateOfRange` y `subtractSheetRanges`.
- **Se fija cada hoja desde el riel y desde el visor** («Fijar esta hoja»).
- **El carrito muestra «1 de 12 hojas fijadas»** y su botón queda a medias (`aria-pressed="mixed"`).
- **Arreglo de paso:** cuando el carrito fundía 407–418 con la 419, el botón decía «sin fijar» aunque las doce hojas siguieran fijadas.

### A6. El diálogo «Extraer de mi biblioteca» (#7, #8, #11, #14, #17)
- **#7 · Lengua del pasaje:** filtrar u ordenar con `LibraryResource.scriptCensus` (la cantidad de caracteres griegos y hebreos) contra el testamento del pasaje, en `faltaParaLaRubrica.ts:72-80` y en `recomendablePorPasaje`.
- **#14 · Clave de cita:** sale del autor, nunca de un paréntesis del título (Metzger salió como «UBS4»).
- **#17 · Ediciones duplicadas:** si la misma obra está dos veces y una no tiene páginas impresas (el Wallace en español es una exportación de Logos), recomendar la que sí las tiene. Al subir un PDF, marcar las exportaciones de Logos.
- **#8 · Rol:** el rol mostrado en la lista es el mismo que queda al marcar.
- **#11:** «Te faltan 1 fuentes» → plural correcto.

### A7. La regla de no repetir fuentes, por tipo (#1, #15)
- **Hoy:** `proposeExclusions` (`excludedSources.ts:31-41`) propone **todo** lo citado en la entrega anterior: léxicos, gramáticas y NA28.
- **Arreglo:**
  - Agregar `sourceRepetitionPolicy` al perfil de trabajo (`WorkProfile`), con un valor por tipo de fuente:
    - `exclude` para los comentarios;
    - `alternate` para las gramáticas: es una preferencia, mira las **dos** entregas anteriores y sugiere la otra;
    - `free` para los léxicos y el texto base.
  - Aplicarlo en `proposeExclusions`. El tipo sale de `previous.sources`, que ya viene en el resumen.
  - **#15:** si una fuente se desmarcó a propósito en la propuesta, su tarjeta no vuelve a avisar «no debería entrar».

**Hecho y medido (2026-10-21, solo lectura, entregas reales, `scripts/rag-eval/.medir-exclusiones.ts`):**
- **Antes de A7**, la propuesta para el TP #8 era McCartney, Motyer, NA28, Robertson, Ropes, Tuggy y Varner.
- **Ahora propone** McCartney, Motyer, Ropes y Varner (excluir) y Robertson (alternar, «con Porter o Wallace»). Es exactamente la lista que el fundador escribió a mano en el encuadre.
- **NA28 y Tuggy ya no se proponen.** La tarjeta dice por qué.
- **Regla por tipo** (`DEFAULT_SOURCE_REPETITION_POLICY`):
  - comentarios: `exclude`;
  - gramáticas: `alternate`;
  - el resto: `free`.

  Una cita sin tipo conocido se excluye, como antes. El tipo sale de las fuentes de esa entrega (`PreviousDelivery.citedSourceTypes`).
- **El bloque de fuentes del encuadre** ya no nombra léxicos ni texto base repetidos.
- **#15:** con las exclusiones confirmadas, la fila de una fuente que se dejó fuera a propósito no vuelve a avisar (`warnsRepeatedSource`).
- **De A4:** cuando lo que falta de un tipo solo se cubriría con libros excluidos, la tarjeta de la rúbrica lo dice: «1 de 2: … excluidas (McCartney, Ropes). Puedes entregar con 1 de 2 o subir otro libro». No hace falta un botón [Aceptar], porque la rúbrica no bloquea.
- **Desvío del plan: la regla no va en el perfil de trabajo.** El perfil se copia por valor al crear, y el trabajo no guarda a cuál pertenece. La regla queda configurable en el dominio (`policy`), y la propuesta sigue siendo editable. Si otro curso pide otra regla, se agrega al perfil y se copia al crear, como la portada.

### A8. Cuando falla un proveedor, decirlo (#9)
- **Hoy:**
  - Un 402 de Gemini (sin saldo prepago) en `retrieveChunks` se convierte en `internal` (`retrieveChunks.ts:285-296`).
  - El diálogo muestra «No se pudo extraer los fragmentos» (`ExtractFromLibraryDialog.tsx:328-337`).
  - No hay aviso al super admin.
- **Arreglo:**
  - Un error tipado (`provider-quota-exhausted`) con un mensaje claro para el usuario: «La búsqueda no está disponible en este momento. Ya avisamos al equipo».
  - Un correo a los `super_admin`, como el de `checkLlmBudget.ts:57-69`, la primera vez por hora.
  - Una alerta de saldo bajo en AI Studio, pendiente desde el 15 de octubre.

---

## B. El plan de uso reparte hojas, no fuentes (#22, #23, #24)

**Problema.** El planificador recibe solo `id · tipo · título · clave` de cada fuente (`ProposeStepCorpusAllocationsUseCase.ts:99-104`). Nunca ve una hoja ni un lema. Además, sus reglas, pensadas para un trabajo largo, empujan a dejar a Tuggy y a Kittel en un solo paso:

- «UNA ancla, UN contraste, UNA técnica»;
- «Máximo 4 fuentes por paso»;
- «van en ese paso y no en otro» (`GeminiStepCorpusPlanner.ts:154-158, 167, 283, 286`).

### B1. Reparto previo, sin modelo
Para cada paso con pregunta, toda fuente que tenga una hoja con `refs` del versículo, o una **entrada** de un lema de la pregunta (de A1 y A2), entra a ese paso con **su rol del corpus** (`chosenRole`). Es lo que hizo Claude a mano con la tabla del día.

### B2. El modelo decide sobre material real
- `ProposeStepCorpusSourceInput` suma, por fuente, `pinnedRanges` y un **resumen de evidencia por paso**: la hoja y una línea de contenido de unos 300 caracteres (encabezado y glosa).
- **Modo preguntas.** Se deriva de `parseBriefQuestions(...).some(q => q.verses.length > 0)`. En ese modo:
  - no hay tope de 4 fuentes por paso;
  - una fuente puede ir en varios pasos;
  - se quita «no en otro»;
  - se quita la regla de cobertura (`PLN:284`), que choca con la anterior.
- El modelo decide los roles y **qué voces se oponen**.

**Hecho (B1 y B2 van juntos: B2 sin B1 no se puede medir):**
- **Una sola evidencia.** El plan usa la de la tarjeta de A4 (`evidenceFromReview`), y solo las hojas que ya están en el corpus. Viaja desde la interfaz, que ya la tiene cargada; buscarla de nuevo sería leer cada libro dos veces.
- **«Proponer plan» espera a la revisión.** Si la revisión todavía está cargando, el botón no se puede pulsar.
- **Lo que ve el modelo, por paso:** la hoja, la palabra de la consigna y un renglón de hasta 300 caracteres, más el rol del corpus.
- **Modo preguntas.** Se activa cuando algún paso trae preguntas con versículo. En ese modo se quitan:
  - el tope de 4 fuentes por paso;
  - «van en ese paso y no en otro»;
  - la cobertura obligatoria del corpus.
- **B1 en código.** Después del modelo, toda fuente con evidencia entra a su paso con el rol del corpus. La nota del paso lo dice: «También entra por sus páginas sobre la pregunta del paso: Tuggy».

**Medido (determinista, antes del modelo; solo lectura con el corpus real y las refs de A3 simuladas):**
- **4:1:** Mayor, Tuggy, Adamson y Kittel. ✓
- **4:2:** Tuggy ✓, más Kittel y Wallace. Las dos tienen hojas fijadas que nombran 4:2. NA28 queda a cargo del modelo: la conjetura φθονεῖτε no nombra el versículo.
- **4:3:** Kittel y Tuggy ✓, más Mayor y Adamson.
- **4:5:** Wallace y Tuggy ✓, más Mayor, Adamson y Kittel.
- **Mayor entra solo con las refs de A3**, después del relleno.

El resultado contiene todo el plan que se armó a mano, menos NA28 en 4:2.

### B3. Editar el plan
- **#23:** al agregar una fuente con «Editar», se precarga su `chosenRole` (`PinnedSourcesPicker.tsx:93-99`, `UpdateStepCorpusAllocationUseCase.ts:95-104`).
- **#24:** si el estudiante cambia la asignación, la justificación del planificador se marca «editada por ti», en vez de quedar desactualizada.

**Medida:** «Proponer plan» reproduce solo, en el TP #8, el plan que se armó a mano:
- 4:1: Adamson, Mayor, Tuggy y Kittel;
- 4:2: más Tuggy y NA28;
- 4:3: más Kittel y Tuggy;
- 4:5: Wallace y Tuggy, además de lo propuesto.

---

## C. El análisis responde la pregunta y separa la fuente de la inferencia (#35, #31, #34, criterios del profesor)

**Problema:**

- **El analizador no recibe las preguntas como tarea.** Solo ve el encuadre entero (`AnalyzeVerseInput`, `analyzerPrompts.ts:290-294`).
- **No hay un campo para la respuesta ni para el criterio decisivo.**
- **`SourceCitation` admite una sola página** (`CanonicalVerseAnalysis.ts:693-707`).
- **No hay regla para las atribuciones de segunda mano.**
- **La «gramática del curso» está fija en Wallace** dentro del prompt.

Con una indicación genérica de método, el motor ya encontró 6 de 10 datos esperados. Lo que falta es que ese método venga **de serie**.

### C1. Las preguntas como tarea, con su tipo
- Agregar `sectionQuestions` a `AnalyzeVerseInput`, poblado con `questionsOfStep` (`AnalyzeVerseCanonicallyUseCase.ts:161-179`).
- Agregar un clasificador de tipo en `briefQuestions.ts`, junto a `isSyntaxQuestion`, con cuatro tipos: **identificar** (qué pasaje, quién, cuál), **léxica** (qué significa, qué denota), **sintaxis** (qué relación, qué función) y **crítica textual**.
- Agregar un campo nuevo al esquema, `questionAnswers[]`:
  - `directAnswer`: la respuesta en una oración;
  - `options[]`: cada lectura con sus `defenders` (clave y página);
  - `decisiveCriterion`: el texto, **por qué favorece una lectura y no la otra** y sus fuentes;
  - `decision`.
- En una pregunta de tipo **identificar**, el catálogo de opciones es obligatorio, y la respuesta abre con el estado de la cuestión (#35).

### C2. El método, de serie
Es la indicación que hoy hubo que escribir, puesta en el prompt del analizador para todo verso con pregunta:

1. Buscar un criterio que **distinga** entre las lecturas, de preferencia de la misma carta.
2. Dar la razón que cada autor da contra la lectura rival.
3. Presentar las **concesiones** que un autor hace contra su propia tesis.
4. No usar la clasificación de un elemento para decidir otro sin mostrar la relación (patrón 7 del profesor).

Va en el bloque «Disciplina de citación» (`analyzerPrompts.ts:143-149`).

### C3. La procedencia en el esquema (la pieza central de la precisión)
- En cada entrada con fuentes (`commentatorEngagement.position`, `lexicalAnalyses.verseSpecificLoading`, `footnoteExtensions`, `oldTestamentLinks.interpretiveBearing`, `confidenceFlags`), separar dos campos:
  - `sourceSays`: lo que la fuente dice, con `verbatimQuote` cuando se puede;
  - `ownInference`: lo que concluye el análisis, **sin fuentes**.
- La prosa redacta las dos partes en oraciones distintas, y la cita va solo en la primera.
- `SourceCitation.pageEnd?`, para los rangos (170–171).
- `SourceCitation.via?`, para la segunda mano: «Adamson (170) atribuye a Mayor, Knowling y Ropes…». El prompt exige `via` cuando la fuente cita a otro autor.
- **Por qué:** más de la mitad de las ~30 alarmas del día (conteo a mano, no medido) eran **afirmaciones mixtas**, es decir, la fuente más una conclusión propia bajo la misma cita, o citas puestas en el lugar equivocado.

### C4. La gramática del curso, como dato
- La gramática del curso queda **configurada en el perfil**, en `WorkProfile.courseGrammar`. En TMS es Wallace.
- El prompt y el esquema (`analyzerPrompts.ts:248`, `responseSchema.ts:156`) se parametrizan con esa gramática.
- Regla: si la gramática del curso está en el corpus y clasifica la construcción, la respuesta **responde a esa clasificación** (patrón 8 del profesor).

### C5. Una cita textual no verificada no desaparece en silencio
Hoy `verifyAttributedQuotes` vacía `verbatimQuote` y deja solo un `console.warn` (`AnalyzeVerseCanonicallyUseCase.ts:231-245`). Debe guardar `quoteUnverified: true` y mostrarlo en la Revisión de citas.

**Medida:** con el TP #8 como banco, el análisis encuentra los 10 datos esperados **sin indicación** (hoy encuentra 6 de 10 *con* indicación). Las alarmas por afirmación mixta bajan al menos a la mitad.

---

## D. Precisión de citas: el verificador ve lo mismo, busca antes de alarmar y guía (#30, #31, #37, #38, #42; #33 del TP #7)

**Lo que hace hoy** (leído en el código; un solo motor, `VerbatimFirstCitationVerifier` → `GeminiLlmCitationVerifier`):

- **Material que coteja:** las hojas de la receta, o los fragmentos guardados, más **los 5 fragmentos más parecidos** a la oración. Recorta cada fragmento a **4.000 caracteres** (`GeminiLlmCitationVerifier.ts:90, 389`), así que «el libro entero» queda en la portada. Las páginas vecinas se priorizan, pero **nunca se piden aparte**.
- **Dos caminos distintos para el análisis y para la prosa:**
  - la prosa no pasa por el paso textual;
  - no traduce la unidad de página;
  - no lleva `otherSources`;
  - su evidencia es otra oración.

  Por eso Wallace 662 pasó en el análisis y falló en el documento, y por eso hubo falsas alarmas en una cita con dos fuentes «(Mayor, 129; Adamson, 166)» y en una con rango «170–171».
- **El separador de oraciones** (`citationParser.ts:105-116`) corta en cualquier punto, así que «4:9ss. (Adamson, 171)» deja la evidencia vacía (#42).
- **Lo que el juez halla en la fuente** (`takenFromSource`) se descarta (`parseLlmResponse`, `:465-512`).
- **La página de revisión descarta los veredictos de la prosa** (`citationReview.ts:24`). El del ensamble vive en estado local y se pierde al recargar. `FILTERS` no incluye `page-unverifiable`, aunque ese estado bloquea.

### D1. Un solo material, completo, para los dos caminos
1. **La página citada y sus vecinas se leen siempre**, con la ventana ±2, usando `getDocumentChunks`. No pasan por los embeddings ni por el tope de 4.000. Si la cita trae rango, se leen todas sus páginas.
2. **Antes de dar «no encontrada», se busca en el libro completo:**
   - la frase textual, con `findVerbatim` sobre los fragmentos del recurso;
   - después, las palabras clave, con `searchDocumentText` en los modos texto y lema.

   Si aparece, el veredicto es «página no coincide → N», con la evidencia, y no «no encontrada». Es lo que habría resuelto McCartney 203/204 (TP #7) y Adamson 170 (TP #8).
3. **La prosa hereda de su análisis.** Una cita de la prosa con la misma clave y página que una afirmación del análisis hereda su `verbatimQuote`, su `otherSources` y su unidad de página.
4. **Varias fuentes en un paréntesis:** la oración se juzga por fuente, con «Juzga SÓLO la parte que corresponde a X».
5. **Rango:** se coteja contra la unión de sus páginas.

### D2. El parser de citas (#42)
- `findSentenceStart` no corta en las abreviaturas «ss., s., cf., p., pp., v., vv., n., nn., ed., trad., etc., i.e., e.g.», ni en un punto que va justo antes de la cita.
- `extractEvidence` mira también **hacia adelante**, cuando la oración empieza con la cita: «Mayor (p. 314) lo discute…».
- Corregir los desfases de posición entre puntos de código y UTF-16 (`maskRanges`, `:51-57`).

### D3. Guardar lo que el verificador encontró
- Guardar `takenFromSource` (lo que la oración le atribuye a la fuente) y el **tramo de la fuente que la respalda** (`supportingSpan`, con su página).
- Con eso:
  - el visor **resalta** el pasaje citado, incluso en una paráfrasis (#37);
  - la Revisión de citas muestra, lado a lado, lo que la fuente dice y lo que la oración le atribuye.

### D4. «Diagnosticar esta cita» (#30, #34)
Es un botón en cada alarma. **Clasifica la causa** con reglas fijas sobre los campos del verificador y la búsqueda de D1, y ofrece **un** remedio con la nota de revisión ya escrita:

| Causa | Cómo se detecta | Remedio de un clic |
|---|---|---|
| 1 · **Está en otra página** del libro | La búsqueda de D1 la encuentra en N | [Corregir a p. N] (`CorrectCitationUseCase`); si la hoja no está en el corpus, [Agregar la hoja y regenerar] |
| 2 · **Afirmación mixta** | `takenFromSource` cubre solo una parte de la oración | Muestra «la fuente dice A; la oración agrega B». [Dividir la oración], con la propuesta de dos oraciones, o [Aceptar con nota] |
| 3 · **Otra fuente lo dice** | La frase aparece en otra fuente del corpus | [Cambiar la atribución a X, p. N] |
| 4 · **Varias páginas o varias fuentes** | Rango o paréntesis compuesto | Se resuelve solo (D1.4 y D1.5); no llega a ser alarma |
| 5 · **Segunda mano** | La fuente atribuye la idea a un tercero | [Reescribir como «según X (p. N)»] |
| 6 · **Nadie lo dice** | No aparece en el libro ni en el corpus | [Quitar la cita] o [Regenerar con esta indicación], ya escrita |

La clasificación es determinista. El modelo solo redacta la oración propuesta en las causas 2 y 5, y el estudiante la acepta o la descarta.

**Medida:** las alarmas del TP #8 y las del TP #7 #33, con su causa ya anotada en la bitácora, son el banco. El diagnóstico tiene que clasificar bien todas, y el remedio propuesto tiene que coincidir con el que se aplicó a mano.

### D5. Un solo lugar para revisar las citas
- La Revisión de citas muestra los veredictos del **análisis**, de la **prosa** y del **ensamble**, guardados y no solo en estado local.
- `FILTERS` suma `page-unverifiable`.
- El ensamble deja de usar el `CitationVerificationDialog` viejo.

### D6. El visor
- **#38:** la selección exige que tanto `anchorNode` como `focusNode` estén dentro de la hoja (`PdfPageViewer.tsx:387-417`).
- **Rangos:** se abre la primera página y se resalta en todas.
- **Resaltado:** usa `supportingSpan` (D3). Si la frase cruza el corte de página, se busca también en la hoja siguiente.

---

## E. La prosa conserva lo que el análisis resolvió, y un revisor lo comprueba (#36, #39, #40)

**Problema:**

- **La prosa deshizo una decisión ya resuelta.** En 4:3, el análisis decidía con la concesión de Mayor 133, y la prosa volvió a decidir por κακῶς, que vale para las dos lecturas.
- **La prosa omitió un dato que estaba en el análisis.** Wallace 533 faltaba en 4:5.
- **La prosa citó «(Nestle y Aland, 692)» en vez de «NA28»** (#39). Las instrucciones se contradicen:
  - `citationStyle.ts:49` pide «(Apellido, p. N)»;
  - `verseProsePrompt.ts:22, 125` pide «sólo sourceKey».
- **El compositor no sabe qué citas fallaron.**
- **Las reglas propias de la guía de estilo no llegan** (`additionalRules`): solo las usa el compositor del paper completo.

### E1. Lo que la prosa tiene que conservar
- El compositor recibe `questionAnswers` (C1), con el criterio decisivo, como algo **que debe conservar**.
- Recibe la lista de citas **no verificadas** o corregidas, para no repetirlas.
- Recibe un `citeAs` explícito por fuente: la clave del corpus.
- Se elimina la contradicción de `citationStyle.ts:49` (#39).

### E2. Las reglas del profesor dentro de la plataforma
- `StyleGuideManifest.additionalRules` se renderiza en el analizador (`analyzerPrompts.ts:152-153`) y en el compositor del versículo (`verseProsePrompt.ts:110-116`).
- La lista de criterios del profesor (memoria `project_criterios_profesor_tp`) va precargada en la plantilla «TP Semanal Griego NT».

### E3. El revisor de prosa, antes del Word
Una tarjeta «**Revisión antes de entregar**», por versículo. Hace dos clases de controles.

**Controles fijos:**
- ¿está el criterio decisivo del análisis?;
- ¿está la clasificación de la gramática del curso, si el análisis la trae?;
- ¿quedó alguna cita no verificada?;
- ¿alguna oración de cierre afirma dos cosas?;
- rangos con «–», acentos griegos frecuentes (διὰ τό) y comas dobles.

**Control con modelo:** la lista de nueve criterios del profesor. Devuelve los hallazgos con su lugar y una propuesta de arreglo.

Debajo, un botón: [Recomponer con estas observaciones]. **No bloquea el Word**; avisa.

### E4. El flujo
- **#36:** al aceptar el análisis, el botón principal pasa a ser «Componer prosa». Hoy es un ícono gris de 28 px (`StepCard.tsx:657-666`).
- Junto al ensamble va un contador «3 de 4 con prosa».
- «Componer paper académico» advierte que **reescribe todo y borra las ediciones a mano**. En el modo preguntas se oculta.

**Medida:** con los análisis del TP #8, la prosa conserva los 3 criterios decisivos y Wallace 533, y el revisor detecta los 7 puntos que hubo que corregir a mano.

---

## F. La entrega: bibliografía, título y avisos (#43, #44, #45)

- **#43 · BUG:** `IncompleteBibliographyGate.tsx:66-109` pide 6 claves `detail.bibliography.gate.*` que no existen en esa ruta. Están en `detail.bibliography.*` y en `detail.steps.gate.notInCorpus`, y por eso se ven las claves crudas. **Arreglo:** corregir las rutas y agregar una prueba que falle si un texto del aviso empieza con «detail.».
- **#44 · Raya en el título:** `formatPassageReference` (`passage-reference.ts:296-316`) siempre usa guion. **Arreglo:** una opción de presentación con «–» para el título del ensamble (`assemblyContents.ts:269`), la cabecera del .md (`exportPaperToMarkdown.ts:56`) y el título del docx (`exportPaperToDocx.ts:321`). El valor por defecto no se cambia, porque `verseSectionKey` y `replaceVerseSection` buscan el rótulo exacto.
- **#45 · Bibliografía:**
  - **Subtítulo duplicado:** `withFullTitle` (`bibliography.ts:267-276`) reemplaza el título por el título largo del recurso sin mirar si la ficha ya trae `subtitle`, y después `titleWithSubtitle` vuelve a agregarlo. La nota corta hereda el título largo.
  - **Segundo autor:** se normaliza al formato Turabian («Kittel, Gerhard, y Gerhard Friedrich»), venga del lector de portada o de lo que escribió el estudiante.
  - **Mayúsculas en títulos en inglés:** estilo Chicago, con preposiciones y conjunciones en minúscula. Solo en títulos en inglés; los títulos en español van en minúscula salvo la primera palabra.

---

## G. Interfaz y cuenta (#25, #26, #27, #28, #41 y menores)

- **#25 · «Ir al trabajo»:** pasa a las `acciones` de la barra única `BarraDePagina` (`layout/barra-de-pagina.tsx:13`) o al encabezado, junto a «Guardar perfil». Un solo botón principal por vista.
- **#26 y #27 · Colores. Es una falla del control de arquitectura (decisión 5).**
  - **Causa:** la regla 3 de `scripts/check-compliance.sh` (líneas 169-190) **ya detecta** los colores fijos en `className`, pero solo **advierte** (`SOFT_WARN`): el pre-commit (`.husky/pre-commit`) no falla. Por eso entraron 55 usos en 33 archivos; en `StepCard.tsx` hay 10 `bg-emerald-500`.
  - **Arreglo del control (va primero):**
    - **trinquete con línea base**, igual que `scripts/check-web-types.sh`: un archivo versionado con el conteo actual de colores fijos por archivo;
    - el pre-commit y la CI **fallan** si un archivo sube su conteo o si un archivo nuevo trae colores fijos;
    - el conteo solo puede bajar, y al bajar se actualiza la línea base;
    - la lista de excepciones (`COLOR_ALLOWLIST`) queda para paletas editoriales documentadas, como la landing.
  - **Token de acción:** los botones primarios usan `primary-solid`. Se agrega la regla `[data-theme="blue"]`, en claro y en oscuro, con un azul real que pase AA con texto blanco (~221 83% 53%, 5,2:1).
  - **Barrido:** se migran los colores fijos a tokens semánticos, empezando por la exégesis (`StepCard.tsx` y `ExegesisPaperPage.tsx`). Cada archivo migrado baja la línea base.
  - **Para la memoria de arquitectura:** la regla 3 pasa de advertencia a falla con trinquete. Se anota en `.agent/rules/compliance_gate.md`.
- **#28 · Pasos fuera del documento:** se agrupan plegados al final («Fuera del documento · 6») y atenuados. Hoy se ven idénticos a los de adentro (`ExegesisPaperPage.tsx:797-812`).
- **#41 · Cuota de estudios:**
  - El aviso del 80 % hoy solo aparece en `ExegesisPage.tsx:175`. Pasa a mostrarse también en la página del trabajo.
  - Antes de cada operación, si el saldo no alcanza para la siguiente, se avisa antes de empezar y no a mitad de camino.
  - El super admin puede dar US$ de exégesis desde el panel: hay que extender `grantUserCredits.ts:59-83` a `packExegesisUsd`, reusando `addExegesisPackAdmin`.
- **Menores de la plantilla de rúbrica (#2-#6):**
  - la errata «eloos»;
  - la justificación vacía del expositivo;
  - el texto pegado de otra rúbrica (`sourcePastedText`);
  - «Cubre 3 de 4 áreas» sin decir cuál;
  - las recomendaciones estructurales que nombran la introducción y la conclusión aunque el encuadre las excluye.

---

## Banco de prueba (el TP #8 como respuesta esperada)

Es un archivo de datos versionado, `packages/domain/src/exegesis/__tests__/banco/tp8-santiago4.json` o el lugar equivalente donde ya vivan los bancos de recuperación, con cuatro partes.

1. **Hojas esperadas por pregunta y fuente** (A y B):
   - Wallace: 569, 633 y 698;
   - Tuggy: 37, 367, 508, 584–585, 931 y 938;
   - Kittel: 31–33, 108, 238–240, 372, 523 y 699;
   - Mayor: 407–410 (4:1–2), 411 (4:3) y 413–417 (4:5);
   - Adamson: 170–171 (4:5).
2. **Los 10 datos del análisis** (C):
   - 3:6 en Adamson 166;
   - la concesión de Mayor 133;
   - 1 Jn 5:15;
   - el catálogo de Adamson 170–171;
   - «totally unknown»;
   - Mayor 136;
   - Wallace 533;
   - las objeciones de Mayor 139;
   - el paso de Metzger al sujeto;
   - Kittel 372.
3. **Las alarmas con su causa** (D): Tuggy 585 (1), Mayor 132 → 130 (4), Kittel 32 «suplicar para sí» (3), Mayor 134 (2), Adamson 171 → 170 (1), Gn 6:3–7 (sin falta: era de primera mano), Wallace 662 (6), «Nestle y Aland» (clave), «4:9ss.» (parser), y las del TP #7 #33.
4. **Los 7 puntos de la prosa** que hubo que corregir a mano (E).

La medición del antes y el después se escribe en este documento al cerrar cada unidad. Está rotulada como **medido**, nunca como estimado.

---

## Cómo se entrega

Según la regla vigente, **una fase = un PR, un commit por unidad**. Antes de cada commit:
1. Correr las pruebas en local.
2. Pasar la revisión adversarial (`docs/REVISION_ADVERSARIAL.md`).
3. Romper a propósito, una vez, cada prueba nueva.

**Terminado** significa desplegado y probado en producción con el TP #9.

**Por su tamaño, se propone partirla en tres fases** (decisión 1):

| Fase | Unidades | Por qué en este orden |
|---|---|---|
| **8a · Material correcto** | A1, A2, A3, A4, A5, B1, B2, B3, A7 | Todo lo demás depende de que el material llegue. Sin esto, el verificador y la prosa trabajan sobre el corpus equivocado |
| **8b · Citas precisas** | C1-C5, D1-D6, E1-E4 | Es la prioridad del fundador. C3 (la procedencia) y D1 (buscar antes de alarmar) son las dos piezas de mayor efecto |
| **8c · Entrega e interfaz** | F, G (con el trinquete de colores), A6, A8 | De bajo riesgo |

**Arreglos rápidos que conviene adelantar ya** (un PR chico): F #43 (las claves del aviso), D2 (el parser con «ss.»), F #45 (el subtítulo duplicado), G #41 (dar USD de exégesis desde el panel) y A6 #14 (la clave desde el autor).

---

## Decisiones del fundador (2026-10-21)

1. **Tres fases:** 8a (material correcto), 8b (citas precisas) y 8c (entrega e interfaz). Cada fase va en un PR, con un commit por unidad.
2. **Orden 8a → 8b → 8c.** La precisión de citas necesita primero el material correcto.
3. **El revisor de prosa (E3) solo avisa.** No bloquea el Word.
4. **El verde de los botones que generan no es intencional.** Es una falla del control de arquitectura: la regla de colores solo advertía. Se arregla con el trinquete de G #26 y #27, y el barrido sigue a los tokens semánticos.

## Decisiones que siguen abiertas

Tienen una propuesta por defecto. Si el fundador no dice otra cosa, se aplica la propuesta.

1. **El PR de arreglos rápidos** (F #43, D2, F #45, G #41 y A6 #14): ¿va antes de 8a? **Propuesta:** sí, porque es chico y quita bloqueos reales de la entrega.
2. **La regla de repetición:** ¿en el perfil de trabajo o en la rúbrica? ¿«Alternar la gramática» se sugiere sola? **Propuesta:** en el perfil; la alternancia se sugiere marcada, y el estudiante la confirma.
3. **La gramática del curso:** **Propuesta:** Wallace por defecto en la plantilla TMS.
4. **Relleno de `refs` (A3):** se corre `scripts/rellenar-refs.ts --escribir` sobre la biblioteca, sin costo de embeddings. Pide OK al momento de correrlo.
5. **Alerta de proveedor (A8):** **Propuesta:** correo a los super admin, como `checkLlmBudget`, más un aviso en el panel.
