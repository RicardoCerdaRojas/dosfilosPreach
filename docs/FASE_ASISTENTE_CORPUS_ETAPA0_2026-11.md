# Fase «Asistente del corpus y batería de controles» — Etapa 0: medir y revisar (0a, 0b, 0c)

> Estado: BORRADOR (2026-11-20). Base del diseño visual de la fase.
> Rótulos: **[L] leído** en el código · **[M] medido** en datos o en el navegador · **[S] supuesto**.
> Código revisado en `feat/fase-asistente-corpus` @ b3bf16e9 (incluye #834). Rutas relativas a `packages/`.
> Lectura previa: decisión byblos 01M7VFRHTB… (orden y dos puertas), convención 01M7VFTZ97… (procedimiento v4),
> `docs/EVALUACION_PROCESO_ACADEMICO_2026-11.md` §9, `docs/PROCEDIMIENTO_TRABAJO_ACADEMICO_2026-11.md` §4b–§4d.

## 1. Mapa del código

### 1.1 Ciclo de vida del estudio

Todo el trabajo vive en **un solo documento** `exegeticalPapers/{paperId}` con `steps[]` y `sources[]` adentro
(`FirestoreExegeticalPaperRepository.ts:57-85`) [L]; tope de 1 MB (repo `:745-750`) [L]. Los casos de uso corren
en el navegador y llaman al modelo por `runLlmPrompt` con reserva de cobro [L].

| Paso | Usuario | Generador | Se guarda en | Decide |
|---|---|---|---|---|
| Crear | pasaje, perfil, proyecto, tipo, encuadre | `CreateExegeticalPaperUseCase` (sin modelo) | raíz, `phase:'configuring'` | usuario |
| Configurar (rúbrica, manifiesto, corpus, plan de corpus, plan estructural) | sube o elige | extractores; `ProposeStepCorpusAllocationsUseCase` propone hojas | `rubric`, `styleGuideSnapshot`, `sources[]`, `stepPlan.perStep` | modelo propone, usuario ajusta |
| «Mi lectura» (opcional) | escribe | — | `stepPlan.perStep[id].studentReading` | usuario |
| Sembrar | botón | `SeedStepsForPassageUseCase` | `steps[]`, `phase:'in-progress'` | sistema |
| Análisis por versículo | generar / regenerar / verificar / aceptar | `AnalyzeVerseCanonicallyUseCase` + `analyzerPrompts.ts` | `steps[i].versions[]` | **modelo**; usuario acepta la versión entera |
| Prosa del versículo | componer | `ComposeVerseAcademicProseUseCase` | **sobrescribe** `markdown` de la misma versión (+ `previousProse`) e injerta en `assembledMarkdown` | modelo |
| Conclusión | componer, aceptar | `ComposeConclusionFromAnalysesUseCase` | versión del paso | modelo / acepta |
| Tesis | escribe o pide propuestas | `ProposeThesisUseCase` → `SetPaperThesisUseCase` | `paper.thesis{text, origin, approvedAt}` | **usuario** |
| Introducción | componer, aceptar | `ComposeIntroductionFromAnalysesUseCase` (exige conclusión) | versión | modelo / acepta |
| Ensamble | generar, aceptar | mecánico (`GenerateStepUseCase.ts:514-543`) | al aceptar: `assembledMarkdown`, `phase:'assembled'` | usuario |
| Ensamble académico (vía paralela) | diálogo, guardar | `ComposeAcademicPaperUseCase` → `SaveAssembledPaperUseCase` | **sobrescribe** `assembledMarkdown`, no toca `phase` | usuario |
| Coherencia | botón | `RunCoherencePassUseCase` | **no se guarda** | — |
| Exportar | .md / .docx (no hay PDF) | `exportPaperToMarkdown/Docx` | lee `assembledMarkdown` | — |

Hallazgos [L]:

- **Las decisiones debatibles las toma el modelo.** `TranslationCrux…commitment.chosen/rationale` y
  `QuestionAnswer.decision` son campos obligatorios del esquema de salida (`responseSchema.ts:426-437`,
  `CanonicalVerseAnalysis.ts:808-816`); ninguna pantalla los escribe. El usuario solo influye antes («Mi lectura»,
  que el prompt usa sin forzar la decisión, `analyzerPrompts.ts:799-813`), regenerando o editando el markdown (una
  versión `edited` no actualiza `canonicalAnalysis`, `ExegeticalStep.ts:190-194`).
- **«Tipo de trabajo» es etiqueta libre** (`ProjectWorkType`, `AIProject.ts:136-154`). No hay enum TP / investigación /
  síntesis+sermón; el tipo cambia el flujo solo vía `exegeticalMethod`, preguntas del encuadre y rúbrica.
  `paperLength.ts` no define tipos (la evaluación lo citaba así; corregir).
- **Versiones:** pasos con `versions[]` recortado a 5 (`trimStepVersions.ts:21`) — el comentario dice «append-only»
  y no lo es. `assembledMarkdown` (`ExegeticalPaper.ts:237-244`, no 236-243) es un string sin versiones con **tres
  escritores** (aceptar ensamble, guardar composición académica, injerto de prosa). El documento entregado no se puede
  reconstruir.
- **Nada invalida aguas abajo.** Cambiar un versículo no marca desactualizadas conclusión, introducción ni ensamble;
  `assembled` no se revierte. Solo existen `isStepPlanStale` y la tesis que vuelve a borrador.

### 1.2 Redacción y armado

- **Dos caminos** que escriben el mismo campo: por secciones (`verseProsePrompt.ts`, compositores de introducción y
  conclusión) y el trabajo entero de una vez (`composerPrompts.ts:41-163`, corpus recortado a 80 000 caracteres,
  `:470-511`) [L].
- **Sin perfil por tipo de trabajo:** los compositores no leen `workType` ni `exegeticalMethod` [L].
- **Extensión** (`paperLength.ts:73-285`): renglones × 11 palabras, solo Times 12 con márgenes de 1″; se hace cumplir
  solo en versículos (re-pasada si > presupuesto + 8 %); introducción, conclusión y el compositor entero no se
  re-miden [L].
- **Citas en la prosa:** el rótulo de página («p. N» / «hoja N») se copia del análisis; el juez de citas compara contra
  fragmentos con `pageHint` (`ICitationVerifier.ts:19-43`). Los veredictos de la prosa **no bloquean**; las ediciones a
  mano del ensamble no se verifican [L].
- **Exportación:** solo Word y Markdown; revisión previa bloquea si no hay ensamble o si lo guardado difiere de pantalla
  (`useExportReview.ts:63-65`) [L].

### 1.3 Controles existentes frente a las 5 capas (§4c)

| Control | Se guarda | Bloquea | Sabe de versión | Capa |
|---|---|---|---|---|
| Verificación de citas por paso (`VerifyStepCitationsUseCase`) | sí, en la versión del paso | sí (análisis), no (prosa) | **sí** (huella de fuente; se borra al recomponer) | 1 |
| Revisión humana de cita (`ReviewCitationUseCase`) | sí | desbloquea | sí | 1 |
| Testigos sin cita, quitar citas literales falsas, cobertura del análisis | en resumen / no | no | parcial | 1 (preventivo) |
| Coherencia (`RunCoherencePassUseCase`) | **no** (`:25-30`) | no | no; lee pasos aceptados, **no el ensamble**; no recibe la tesis | 2 (+3, 4 parcial) |
| Revisión de la tesis (6 criterios) | no | no | parcial | 4 (parcial) |
| Revisión antes de exportar (forma) | no | no | no deja registro | 5 (forma) |
| Extensión | no | no | no | 5 (tope) |
| Fidelidad (`fidelity_pass`) | en el **sermón** | — | sí | ninguna del paper (dormido) |
| Revisión de prosa con modelo | dada de baja 2026-11-02 | — | — | — |

Coherencia: tiene 7 categorías y 3 severidades (`reviewerPrompts.ts:7-24`) pero **ningún criterio para pasar**
(«no tiene rúbrica» es verdad a medias) [L].

Vacíos por capa [L]:

1. **Unitaria:** solo citas. Faltan glosa contra argumento, forma verbal completa, rival respondida, criterio que
   discrimina, reglas de voz (`vocabularyRules`, `academicVoice` se usan al generar, no al revisar).
2. **Integración:** solo coherencia, sin registro ni criterio ni apéndices ni matriz de requisitos.
3. **Conclusión:** no existe el mapa oración → sección de origen.
4. **Introducción y tesis:** no se comprueba tesis = última oración de la conclusión.
5. **Regresión:** no hay registro, ni control vencido, ni lectura del texto entregado.
- Transversal: no hay prueba de las pruebas; el documento no tiene versión ni hash propio.

### 1.4 Corpus: conseguir y usar

| Mitad | Existe [L] | Falta |
|---|---|---|
| Conseguir | subida, extracción por visión, cola por rangos, lote, ficha de corrida (`extraction_runs`), índice (`document_chunks`), numeración de páginas, catálogo estático (~10 libros), coincidencia con biblioteca | catálogo más amplio y camino para títulos fuera; `__system__` poblado ([S] vacío en prod, según memoria) y **alcanzable por búsqueda vectorial** (hoy `userId == uid`, `recuperarFragmentos.ts:94,183`; `retrieveCuratedCorpus.ts:284`) |
| Usar | receta por fuente (`ExcerptRecipe`), plan por paso (`pinnedSheets`), recuperación dentro de hojas admitidas, verificador de citas, búsqueda literal, PDF en la página | **ficha con respaldo**: `CommentatorPosition` no guarda `chunkId`/extracto/versión de extracción (salvo `verbatimQuote`); ids de fragmento posicionales que el reindexado borra → cita huérfana en silencio; chat con alcance del estudio; enlace afirmación → ficha |

Chats existentes: Facultad en el estudio (`PaperFacultyDrawer`, RAG sobre libros enteros [S]) y «Consultar biblioteca»
(`consultarBiblioteca`, responde solo con fragmentos `[Fn]`, guarda en `library_consultations`). Este último es la
mejor base para el chat del corpus; le falta el alcance «corpus del estudio» (`Alcance` = `todo|libros`).

### 1.5 Scripts de administración → puerta MCP

106 scripts ocultos en `scripts/rag-eval/` (repo principal, sin commit) [L]:

| Grupo | N | Escribe en producción |
|---|---|---|
| Diagnóstico / medición de recuperación e índice | 39 | no |
| Leer / buscar texto y metadatos de biblioteca | 25 | no |
| Leer datos de estudios (papers, guías, devoluciones) | 32 | no |
| Congelar / exportar a archivos locales | 4 | no |
| Editar datos de estudios | 6 | **sí** (`cargar-reglas`, `regla-22`, `fichas-actualizar`, `corregir-analisis-236`, `editar-tp9`, `renombrar-patrones`; todos con `--aplicar`) |

Más `scripts/billing/.devolver-lecturas-silabo.ts` (devuelve créditos, escribe). Tres gastan en APIs pagas.
~94 % solo lee → insumo para la decisión abierta «MCP de solo lectura o con escritura confirmada».

## 2. Recorrido en el navegador (producción, sesión del fundador, solo lectura)

Recorrido de TP #10 (Santiago 5:1-6, `40pjrOE2gOAl0symSHm5`) el 2026-11-20. No se generó, aceptó ni editó nada [M].

1. **Lista de trabajos** (`/dashboard/exegesis`): 33 trabajos; filtros por fase; la tarjeta muestra pasos, % y fuentes.
   No muestra qué controles pasó cada trabajo ni si el entregado está verificado [M].
2. **Página del trabajo:** pasos con versión («v2 de 2»), contador de citas («11/12 · 1!»), cobertura del corpus por
   fuente («Planificada y citada en 5 pasos»), extensión estimada, datos para citar 7/7, palabras vetadas, rúbrica y
   guía. Es un **panel de estado rico pero disperso**: cada tarjeta es un control parcial sin un veredicto común [M].
3. **Vista de estudio del versículo 5:1:** «Decisiones de traducción» dice «Sin decisiones registradas». La decisión
   real (medio / manera / circunstancia concomitante de ὀλολύζοντες) vive en «Respuestas a las preguntas», con criterio
   decisivo y decisión **redactados por el modelo**; las tres lecturas dicen «Ninguna fuente del corpus la defiende» [M].
   El diálogo con comentaristas sí muestra cita textual + página + «Ver en el documento original» — el respaldo existe
   para las posiciones, no para las lecturas [M].
4. **Revisión de citas de 5:1** (`…/pasos/:id/revision`): 11 verificadas, 1 revisada a mano; aviso «La prosa cambió
   después de la última verificación … sus citas no tienen veredicto» [M].
5. **Configuración → Plan de uso:** propuesta del modelo por paso (ancla / contraste / técnica) con justificación;
   «¿Qué responde cada pregunta?» recorre el índice de páginas (sin modelo, [L] `useCorpusQuestionReview` →
   `passagePagesQuery`). La configuración tarda >10 s en cargar («Cargando configuración…»); las pestañas se cortan a la
   derecha en el ancho del panel [M].
6. **Copy con «el modelo»:** «…el modelo puede usar las demás cuando sea pertinente» (Plan de uso) — viola la regla de
   no exponer el motor en la interfaz [M].
7. **Ensamble final:** «Editaste el ensamblado a mano … Volver a ensamblar … reemplaza estas ediciones». El texto que
   entra al documento difiere de la prosa del paso (p. ej. 5:1 cambia el cierre: «…es de medio, aunque manera sigue
   siendo posible» → «…es la de medio. La de manera sigue siendo posible.») [M].

## 3. Datos de TP #7–#10 (Firestore, solo lectura)

Scripts: `scripts/rag-eval/.medir-0c.ts`, `.medir-0c-diff.ts` (repo principal, sin commit; solo leen). TP #9 tiene dos
trabajos (uno en configuración); se mide el ensamblado.

| TP | id | pasos en el documento | versiones del paso aceptado | origen | prosa con veredicto propio | entregado = prosa de los pasos | lecturas sin fuente que las defienda |
|---|---|---|---|---|---|---|---|
| #7 3:13-18 | qTwu… | 3 | 2–3 | generado | 1 de 3 | **no** (≈1220 de ~1300 palabras distintas) | — (sin preguntas; 4 cruces) |
| #8 4:1-10 | FKtK… | 4 | 3–**8** | **editado a mano** (4/4) | 0 de 4 | sí | — (sin preguntas; 4 cruces) |
| #9 4:11-17 | 9aac… | 4 | 2–6 | **editado a mano** (4/4) | 4 de 4 | sí | 3 de 11 |
| #10 5:1-6 | 40pj… | 4 | 1–2 | generado | 0 de 4 | **no** (≈217 de ~1200 palabras distintas) | 5 de 11 |

Todo [M]. Lectura de los datos:

- **Ningún TP tiene tesis, conclusión ni introducción aceptadas.** Coincide con el perfil TP (§4d: capas 1, 2, 5). La
  batería debe activarse por perfil, no siempre las 5 capas.
- **El entregado se verificó a nivel de ensamble** en #7 y #10 (veredictos en la versión aceptada del ensamble, creados
  después de la edición: #10 18:43 → 18:44, #7 18:38 → 18:49). En #9 el ensamble aceptado **no** tiene verificación.
  → La cobertura real depende de qué botón se apretó al final; nada la exige.
- **Dos maneras de corregir conviven:** editar el paso (#8, #9: todo `edited`) o editar el ensamble (#7, #10). En la
  primera, el análisis canónico queda viejo frente a la prosa (una versión `edited` no actualiza `canonicalAnalysis`);
  en la segunda, los pasos quedan viejos frente al entregado. **En ningún caso hay una sola fuente de verdad.**
- **Las decisiones se mudaron:** #7 y #8 registran cruces de traducción (1–2 por versículo); #9 y #10 casi no, porque la
  decisión vive en «Respuestas a las preguntas». El diseño de la ficha de decisión debe cubrir ambos lugares.
- **Lecturas sin respaldo:** 8 de 22 lecturas en #9–#10 no tienen ninguna fuente del corpus que las defienda. Es el
  hueco que la mitad «usar» del corpus debe cerrar (o el análisis debe declarar que la lectura es propia).
- **Discrepancia con el código:** TP #8 guarda 8 versiones en un paso, aunque `MAX_STEP_VERSIONS = 5` [L]. El recorte
  solo actúa en escrituras nuevas [S]; el historial real no es confiable como registro.

## 4. Qué le exige esto al diseño (insumo para las etapas 1–4)

1. **Una sola fuente de verdad del texto con versiones** antes que cualquier control. Sin un «documento versión N»
   inmutable (hash + fecha + quién lo cambió), la batería no tiene a qué atarse. Hoy: string suelto con tres escritores
   y dos maneras de corregir que se desincronizan (§1.1, §3). → Prerrequisito de la etapa 4.
2. **Registro de controles fuera del documento del trabajo** (subcolección o colección propia): el tope de 1 MB ya
   obligó a recortar historial (#824/#825) [L].
3. **Batería por perfil** (§4d): TP → capas 1, 2, 5; investigación → 1–5 con apéndices; síntesis + sermón → 1–5 por
   parte. El tipo de trabajo debe pasar de etiqueta libre a perfil tipado (§1.1).
4. **La decisión debatible pasa al usuario** (etapa 2, ficha): opciones con su respaldo (cita + página + versión de
   extracción), criterio, y la elección la confirma el usuario; el modelo propone. Cubrir cruces de traducción y
   respuestas a preguntas (§3).
5. **Respaldo por afirmación** (etapa 1, mitad «usar»): guardar extracto + `resourceId` + versión de extracción; ids de
   fragmento estables frente al reindexado (§1.4).
6. **Invalidación aguas abajo:** cambiar un versículo marca vencidos los controles y secciones que dependen de él
   (capa 5).
7. **Redacción por tipo** (etapa 3): los compositores no conocen el perfil; la extensión se mide solo en versículos.
8. **Puerta MCP:** ~94 % de los scripts solo leen; los 6 que escriben siguen el patrón «ensayo → `--aplicar`». Esto
   favorece **lectura libre + escritura confirmada** (cada escritura con ensayo, confirmación y huella en el registro),
   antes que solo lectura, que dejaría vivos los 6 scripts de escritura. **DECIDIDO (2026-11-20):** lectura libre +
   escritura confirmada (byblos, decisión «MCP del sistema: lectura libre y escritura confirmada»).
9. **Chat del corpus:** partir de «Consultar biblioteca» (respuestas solo con fragmentos `[Fn]`), agregarle el alcance
   «corpus del estudio» (hojas admitidas) y el enlace respuesta → ficha.

Arreglo menor detectado: copy «el modelo» en Plan de uso (§2.6).

## 5. Correcciones a la evaluación (§9)

- `ExegeticalPaper.ts:236–243` → las líneas son 237–244; la afirmación se confirma [L].
- `paperLength.ts:8–20` no define tipos de trabajo; el tipo es `ProjectWorkType` (etiqueta libre) [L].
- «Coherencia sin rúbrica»: tiene categorías y severidades; lo que falta es criterio para pasar y registro [L].

## 6. Etapa 0b — Catálogo de Santiago frente a las obras usadas

Leído: `recommendations/nt/james.ts` (17 obras), `groups/catalog.ts` (epístolas generales), `invariant.ts`; bibliografías
de los Word de TP #7–#12 y del TI de Santiago 3, las cuatro bitácoras y el sílabo de NT785. [L] salvo donde se indica.

**Cruce (26 obras usadas):**

- **Usadas y en el catálogo (13):** NA28, Wallace GGBB, Metzger\*, Robertson\*, Ropes, McCartney, BDAG†, Mayor\*,
  Allison‡, McKnight‡, Moo PNTC‡§, Davids NIGTC‡§, Vlachos‡§; parcial: Kittel (el catálogo trae TDNT en inglés; se usó
  el Compendio en español).
- **Usadas y fuera del catálogo (12):** en la biblioteca — Tuggy (5 trabajos), Varner 2010 (4), Adamson NICNT 1976 (3),
  Motyer BST (3), Porter *Idioms* (2), Runge (1), Wallace y Steffen en español (1), SBLGNT (1); **conseguidas fuera** —
  Louw-Nida (3)†, Martin WBC 48 (2)‡, Varner *MSJ* 2011 (1), Brandell 2022 (1).
- **En el catálogo y nunca usadas:** 10 de 17 de `james.ts` (Dibelius, Johnson AB, Laws, Davids en español, Blomberg y
  Kamell, artículos de Laws y Johnson, Bauckham, Hartin) más casi todas las generales.

\* edición distinta · † en Drive, fuera de la plataforma · ‡ subido el 17-nov para el TI porque no estaba ·
§ copia sin paginación impresa (EPUB/MOBI).

**Ediciones y paginación:** Metzger (catálogo 1994, usado 1975), Mayor (1910 vs reimpresión 1978 de 1897), Robertson
(1934 vs 1919), Kittel (TDNT vs Compendio), Davids en español (Kregel 2019 vs Fundación Hurtado 2015 del sílabo), BDAG
(única copia legible no oficial). Que la paginación cambie entre esas ediciones es [S]. Desfases hoja − página impresa
medidos en las bitácoras: Allison −51, Martin −111, McKnight −31, Wallace −36, Robertson −78/−80, Runge −7,
Louw-Nida −30. `libraryMatch` no compara año ni edición [L].

**Errores de identificación:** un archivo subido como el ZECNT de Santiago era Gardner, *1 Corintios*. En el sistema, dos
fichas del sílabo apuntan a otro libro del mismo autor (Burt → Jonás; Kistemaker → Pedro y Judas).

**Sílabo frente al catálogo:**

- Lista en español: 0 de 21 coinciden exactamente.
- Lista en inglés: 10 de 59 están en el catálogo.
- Los dos textos obligatorios (Davids y Moo en español) no están como los pide el curso.
- `docs/BuscarRecursos.md` solo cubre dominio público.

**Qué exige a la mitad «conseguir» (etapa 1a):**
1. **El sílabo como fuente**, además de la curaduría, y una vía para obras fuera del catálogo que pasen la misma
   verificación.
2. **La edición y la paginación fijadas en la ficha**: año, editorial, ISBN. Si la copia es de otra edición, se avisa
   antes de citar, y `libraryMatch` compara el año.
3. **Comprobar al conseguir**: que sea la obra correcta, que tenga paginación impresa, su desfase y que no sea una
   copia no oficial.
4. **Herramientas semanales separadas de los comentarios.** Léxicos y gramáticas en español en el catálogo de NT;
   comentarios suficientes para rotar con la regla de no repetir.
5. **Obras pedidas y no tenidas** marcadas como pendientes de conseguir, con su edición exacta. Corregir los vínculos
   del sílabo que apuntan a otro libro.

## 7. Etapa 0a — «Del corpus al texto» frente a las hojas citadas de verdad

Reproducción fuera de línea de las rutas deterministas desplegadas, con las funciones puras del repo:

- **A — selector** (`proposeSheetRanges`): encabezado corrido o esquema del libro; en gramáticas y léxicos, hojas que
  nombran el versículo.
- **B — tarjeta por pregunta** (`reviewCorpusByQuestion`): hasta 4 hojas por fuente y pregunta.
- **S — secciones de gramática por categoría.**
- **L — entradas de los lemas del pasaje.**

Datos: `document_chunks` y `pageNumbering`, en solo lectura. No hubo llamadas a modelo ni a embeddings, porque las
28 fuentes tomaron ruta determinista. Verdad de referencia: las citas del TP #11 (`TP11_v5.md`), `00_INDICE.md` del
TP #12 y los respaldos del TI de Stg 3:1–5a. Acierto = hoja exacta. Scripts `scripts/rag-eval/.medir-0a-*.ts`
(solo leen). Todo [M] salvo donde se indica.

| Trabajo | En la biblioteca: recall A∪B | La tarjeta acierta en la misma pregunta | Hojas propuestas | Citas fuera de la biblioteca |
|---|---|---|---|---|
| TP #11 (5:7–11) | 14/18 (78 %) | 8/23 | 68 | 10 |
| TP #12 (5:12–20) | 10/19 (53 %) | 3/21 | 68 (190 con S+L) | 22 |
| TI (3:1–5a) | 53/86 (62 %) | — (sin preguntas) | 150 (329 con S+L) | 76 |
| **Total** | **77/123 (63 %)**; 86/123 (70 %) con S+L | 11/44 | 286 (~27 % útiles) | **108/231 (47 %)** |

**Recall por tipo de fuente:**

| Tipo | Recall |
|---|---|
| Comentarios, NA28 y Metzger | **51/58 (88 %)** |
| Gramáticas | **22/57 (39 %)**; 29/57 con S |
| Léxicos y diccionarios | 4/8; 6/8 con L |

**Causas:**

1. **La gramática se cita por categoría, no por versículo.** Wallace: 10/37 aciertos. S rescata 7 hojas, pero propone
   35–55 hojas por gramática.
2. **No se ubica la entrada de lemas con artículo largo.** Kittel no tiene entrada detectada para σῴζω, κάμνω, τέλος,
   καλύπτω ni κρίμα. En Tuggy, la ruta por versículo pierde los lemas.
3. **La tarjeta por pregunta es estrecha:** 4 hojas por fuente. No ve NA28 ni Metzger, porque no escriben «Stg 5:x», y
   se apaga cuando el trabajo no tiene preguntas.
4. **En comentarios se pierde el contorno.** El esquema trae la sección, pero no la introducción ni las hojas vecinas.
   A la vez, propone secciones enteras: McCartney, 23 hojas para 7 citadas.
5. **El 47 % de lo citado no está en la biblioteca** (BDAG, Louw-Nida, Allison, Martin, McKnight, Davids, Moo,
   Vlachos, artículos). Coincide con la etapa 0b.

**Advertencias:**

- Es una reproducción, no la callable desplegada. Que el código sea idéntico está [L]; que producción se comporte igual
  es [S].
- La `pageNumbering` de Kittel declara desfase 0, pero sus páginas impresas llegan a 1.143 en 1.119 hojas. Hoy la
  plataforma no puede comprobar citas de Kittel por página impresa [L].
- El respaldo `KittelFriedrich_p1143.txt` contiene una traza de error, no el texto.
- La verdad del TI incluye páginas de apoyo.
- Se supone que el estudiante adjunta cada libro que cita.

**Qué exige a la mitad «usar» (etapa 1b):**
- Ruta por **categoría gramatical** con la pregunta como consulta, no por versículo.
- **Entradas de lema** robustas en léxicos y diccionarios con artículo largo.
- Contorno de la sección en comentarios.
- La tarjeta por pregunta tiene que ver el aparato crítico y funcionar sin preguntas.
- Precisión: proponer menos y mejor. Hoy el 73 % de las hojas propuestas sobra.

## 8. Resumen de la etapa 0

| Medida | Resultado |
|---|---|
| 0c — controles con registro por versión | Solo las citas. El texto entregado no tiene versiones y tiene tres escritores |
| 0c — dueño de las decisiones debatibles | El modelo. En #9–#10, 8 de 22 lecturas no tienen fuente que las defienda |
| 0b — obras usadas que están en el catálogo | 13 de 26. El sílabo en español coincide 0 de 21 |
| 0a — hojas citadas que la fase propone, sobre lo que hay en la biblioteca | 63 % (comentarios 88 %, gramáticas 39 %) |
| 0a + 0b — lo citado que no estaba en el sistema | 47 % |
| MCP | Lectura libre y escritura confirmada (decidido el 2026-11-20) |
