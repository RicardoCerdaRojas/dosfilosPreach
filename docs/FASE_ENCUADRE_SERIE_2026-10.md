# Fase «Encuadre de la serie» + Esdras: que la fase 1 del proyecto Exegético sirva de algo

> Documento de fase, versión 2. Leído en el código el 2026-10-24 sobre `origin/main` eac75562 (#814, «Proyecto → Serie»). Nace de la primera prueba del fundador: creó el proyecto «Esdras — serie expositiva» y no entendió qué pedía «Pasaje y propósito». Tenía razón: la fase no hacía nada.
>
> La versión 2 incorpora dos revisiones adversariales del borrador, una de método (homilética y exégesis) y una técnica contra el código. Lo que cambió y por qué está en la sección 8.

## 1. Qué y por qué

**Lo que hay hoy (leído y medido):**
- **La fase 1 no hace nada.** «Pasaje y propósito» abre el diálogo genérico «Nuevo material», con el ejemplo «Exégesis de Rom 12:1-2». Cualquier nota completa la fase (`projectRoadmaps.ts:300-309`), y nadie la lee después: ni el planificador, ni los estudios, ni el sermón.
- **El libro está escondido.** Se elige en Estado del arte → «Requisitos» (`bibliographyCriteria.bibleBooks`), que es vocabulario de curso.
- **El planificador no recibe el encuadre.** Recibe libro, alcance, «≈N sermones», título, fecha de inicio y frecuencia. No recibe propósito, audiencia ni hipótesis. La descripción de la serie es un texto fijo (`ExpositoryAssistantPage.tsx:952`). La frecuencia se usa para las fechas y no se guarda.
- **Nada de la serie llega a los estudios ni al sermón** (`SeriesService.ts:641-653`, `augmentGenerationRules.ts:210-216`).
- **Esdras no tiene catálogo (medido).** «Buscar candidatas» da 19 obras para Esdras y **cero comentarios**; para Nehemías da 34, con 12 comentarios. 12 de las 15 obras curadas bajo Nehemías comentan Esdras-Nehemías, que en el canon hebreo es un solo libro.
- **Ruido en el catálogo (leído).** Esdras y Nehemías reciben obras que no les corresponden:
  - Noth, *The Deuteronomistic History*: cubre Deuteronomio–Reyes.
  - Sanders, *Judaism 63 BCE–66 CE*: su ficha dice «útil para AT tardío», pero el periodo es posterior a todo el AT.
  - Filón.
- **El arameo de Esdras sale con nombres hebreos (medido sobre morphhb).** Esdras 4:8–7:26 tiene 220 verbos arameos. `describeOshbCode` y `countOshbVerbTypes` quitan el prefijo `A` y aplican la tabla hebrea: el peal sale «qal», el haphel «hifil», el pael «piel», el hophal «hofal», el hishtaphel «hitpael». Son unos 155 de los 220, y esa tabla va al analizador como «DATO… no negociable» (`verseMorphologyBriefing.ts:158-180`). Además, la voz del analizador para todo el AT es «hebreo bíblico», con gramáticas solo hebreas (`testamentVoice.ts:52-77`).
- **Cuatro defectos chicos (leídos):**
  - «Cambios sin guardar» queda pegado: compara con `JSON.stringify` y trata como distintos null, `''` y ausente.
  - «Refinar» del Pase 5 no manda la observación: `regenerationHint` se pierde en el hook y en el caso de uso.
  - La nota de contexto del proyecto no se puede borrar: el diálogo manda `|| undefined`, el caso de uso convierte `''` en `undefined` y el repositorio lo descarta.
  - La frecuencia de la serie no se guarda.

### Principios fijos
1. **El texto manda sobre el predicador, y también sobre el asistente.** La hipótesis y el propósito pastoral **no entran** al planificador ni a la exégesis: harían eiségesis por diseño. Por simetría, la lectura del asistente tampoco reemplaza la del pastor:
   - el pastor escribe su estructura y su idea central **antes** de ver el panorama;
   - la tarjeta de contraste rotula lo de la máquina como **«lo que propone el panorama»**, nunca «lo que dice el texto».

   Es la espiral hermenéutica (Osborne, *The Hermeneutical Spiral*; Greidanus, *The Modern Preacher and the Ancient Text*, cap. 5).
2. **La hipótesis se revisa durante el trabajo, no al final.** Hay un registro: después del panorama y después de cada estudio, el pastor anota si confirma, matiza o contradice. La síntesis consolida ese registro, no lo inicia.
3. **Al sermón llega solo lo que el pastor escribió y revisó.** No llega la hipótesis provisoria: un generador armoniza la perícopa con lo que recibe. Llega la idea **revisada**, si existe, y solo para conectar el sermón con el arco de la serie. Tampoco llegan el «objetivo pastoral» ni la «proposición homilética» que el asistente escribió en cada fila del plan: la gran idea es del predicador (Robinson, *Biblical Preaching*), y además chocaría con la proposición que sale del análisis.
4. **El propósito pastoral entra donde corresponde: en la aplicación del sermón** (Chapell, *Christ-Centered Preaching*). Lleva una pregunta de control: «¿con qué texto del libro muestras que atiende esa necesidad?» (Stott, *Between Two Worlds*: primero el mundo bíblico). Esa pregunta frena el uso de Esdras-Nehemías como manual de liderazgo.
5. **El texto fija la unidad de predicación; el calendario la ajusta.** El ritmo (domingos, inicio, frecuencia) no se manda como meta al planificador. Da las fechas, y después del Pase 4 una nota compara «el texto dio N unidades; planeaste M domingos». El campo opcional «≈N sermones» sigue siendo del pastor.
6. **Escribe el pastor.** No hay botón «generar hipótesis», ni mínimos, ni puntaje. El encuadre muestra qué falta, sin bloquear: un aprendizaje es una trayectoria, no un piso (lección registrada).
7. **Una sola fuente para el libro:** `bibliographyCriteria.bibleBooks`. El encuadre lo escribe por ruta con punto, en el mismo `updateDoc` que el encuadre. Estado del arte lee los libros de lo guardado, no de su borrador.
8. **El encuadre vive en el proyecto.** La serie lo lee por `series.projectId`. Una serie sin proyecto no tiene encuadre; su sermón solo gana el título de la serie y «sermón k de N» (decidido en la revisión: es contexto literario, útil e inofensivo).
9. **Retrocompatible, y solo hosting.** Un Exegético viejo que completó la fase 1 con una nota sigue completo. No hay functions, reglas ni índices nuevos: `/series` (firestore.rules:572-580) y `/ai_projects` (862-869) validan solo el dueño.

## 2. El recorrido del pastor (Esdras)

1. **Fase 1.** «Pasaje y propósito», con el botón **«Definir el encuadre»**, abre un diálogo con secciones.
   - **El pasaje.**
     - Libros del canon. Con Esdras o Nehemías aparece la nota: «En la Biblia hebrea son un solo libro. Puedes marcar los dos».
     - Alcance: libro completo, o desde–hasta. Solo con un libro marcado; se guarda en la numeración del original y se muestra en la del lector.
   - **Para qué.** Predicar una serie, enseñar una clase o estudio personal.
   - **La lectura del libro.** Primero, la indicación: «léelo entero de una sentada antes de dividirlo» (Stott; Greidanus). Después:
     - **un título de una línea por capítulo** (Jensen; el «survey» de Traina): diez campos para Esdras, y el pastor completa los que quiera;
     - **las repeticiones que observaste**. La herramienta pide buscarlas y no las da.
   - **Tu lectura del libro**, provisoria. Cinco campos breves; cada uno con su campo «versículos que lo sostienen» (Kaiser, *Toward an Exegetical Theology*):
     1. **Género y cómo se lee.** Una lista: narrativa histórica, ley, poesía, sabiduría, profecía, evangelio, epístola, apocalíptico. Al elegir, aparecen preguntas propias del género; para narrativa: conflicto, giro, resolución y evaluación del narrador (Mathewson, *The Art of Preaching OT Narrative*).
     2. **Ocasión y primeros destinatarios.**
     3. **Estructura:** los movimientos del libro, cada uno con desde–hasta y un título. Por ejemplo, 1–6 «el regreso y el templo» y 7–10 «Esdras y la Ley».
     4. **Idea central del libro.**
     5. **Trayectoria hacia Cristo** (Greidanus, *Preaching Christ from the OT*). Se pide también en «estudio personal», porque es teológica, no pastoral.
   - **El propósito pastoral** (en predicar y enseñar): a quiénes, qué necesidad, «¿con qué texto del libro muestras que la atiende?» y qué cambio esperas.
   - **El ritmo** (en predicar y enseñar): domingos aproximados, fecha de inicio (`YYYY-MM-DD` local) y frecuencia.
   - **«Para predicar Esdras»**, en la columna lateral del diálogo y en la tarjeta. Son notas curadas del libro con sus fuentes:
     - la unidad de Esdras-Nehemías, y la pregunta de si la serie termina en Esd 10 o sigue hasta Neh 13;
     - Esd 4:6-23 agrupa la oposición por tema, no por cronología: se respeta el orden del narrador, y el orden Esdras/Nehemías es un debate abierto;
     - el arameo de la correspondencia imperial como dato teológico: Dios gobierna a los reyes (1:1; 6:22; 7:27);
     - las listas (cap. 2; 8:1-14; 10:18-44) van con la narración vecina;
     - **Esd 9–10, pasaje pastoralmente delicado:** el eje es el pacto y la idolatría, no la etnia (Dt 7:3-4; Mal 2:10-16); 1 Co 7:12-16 impide aplicarlo como mandato de divorcio; el libro termina sin resolver, y Neh 13 muestra la recaída.
2. **La tarjeta «Encuadre».** Muestra el resumen, los campos que faltan (sin bloquear) y el botón «Editar». La fase 1 queda completa con libro e idea central, o con la nota vieja.
3. **Tarjetas de curso.** «Datos del proyecto» y «Tipos de trabajo» no aparecen en un Exegético que no las usa. Si ya tienen datos, siguen; el enlace «Opciones de curso» las muestra.
4. **Requisitos.** En Estado del arte → Requisitos, con encuadre, los libros se ven en solo lectura con el enlace «Cambiar en el encuadre».
5. **«Buscar candidatas» con Esdras:**
   - comentarios de Esdras-Nehemías y propios de Esdras, entre ellos Burt, *Esdras* (Andamio), en castellano;
   - fondo persa: Kuhrt, Briant, Yamauchi, los papiros de Elefantina;
   - arameo bíblico: Rosenthal, Vogt y Ribera Florit en castellano.

   Sin Noth, Sanders ni Filón.
6. **«Planificar la serie».** El planificador abre con el libro, el alcance, la fecha de inicio y la frecuencia. Se precargan **una sola vez** y solo si no se restauró un borrador. La descripción de la serie la escribe el pastor; se precarga con su idea central.
7. **Después del Pase 1.** La tarjeta **«Tu lectura y lo que propone el panorama»** pone lado a lado:
   - idea con idea;
   - sus movimientos con la macroestructura del panorama.

   Con alcance acotado dice «del pasaje», no «del libro». Debajo pregunta «¿Qué cambia en tu lectura?», con confirma, matiza o contradice y una nota. Queda en el registro de la hipótesis; se invita a responder, pero no es obligatorio.
8. **Después del Pase 4.** Si el número de unidades no coincide con los domingos del ritmo, una nota lo dice, con dos salidas: agrupar en el editor de fronteras, o ajustar el calendario.
9. **Cada estudio por perícopa** nace con su **lugar en el libro** en el encargo: «Perícopa 3 de 12. Antes: …; después: …». También los creados a mano desde SeriesDetail. Es contexto literario, no agenda pastoral.
10. **En la tarjeta «Encuadre», «Anotar lo que dice un estudio».** El pastor elige el estudio y escribe confirma, matiza o contradice, con una nota. Con al menos una anotación aparece **«Consolidar la idea»**: muestra la original y el registro, y pide la idea revisada, un veredicto (confirmada, matizada o corregida) y el porqué. Si después se edita la idea original, la revisión queda marcada como desactualizada y deja de llegar al sermón hasta consolidarla de nuevo.
11. **El sermón recibe:**
    - el título de la serie y «sermón k de N»;
    - el propósito pastoral (audiencia, necesidad, su texto de apoyo y el cambio esperado);
    - la idea **revisada y vigente**, si existe, rotulada «idea del libro según el predicador, revisada tras sus estudios». Regla: el análisis de esta perícopa gana si chocan.

    No recibe la hipótesis provisoria ni la proposición del plan. Los vecinos ya llegan por el encargo del estudio.
12. **Esdras 4:8 (arameo).** El estudio y el analizador dicen «hebreo y arameo bíblicos», los tallos salen como peal, haphel, pael, hithpeel…, y se ofrecen las gramáticas de arameo.

## 3. Modelo de datos

| Dónde | Cambio | Nota |
|---|---|---|
| `AIProject` | `framing?: ProjectFraming` | Se escribe **por campo** con rutas con punto (`framing.centralIdea`…). El formulario no pisa el registro ni la revisión. `null` borra con `deleteField()`. |
| `ProjectFraming` | `purpose: 'preach' \| 'teach' \| 'personal'`; `scope?: {bookId, passage: PassageReference} \| null` (numeración del original; se descarta si cambia el libro o hay más de uno); `reading?: {chapterTitles?: Record<number, string>, repetitions?: string}`; `genre?: FramingGenre`; `occasion?`, `occasionEvidence?`; `structure?: Array<{passage: PassageReference, title}>`; `centralIdea?`, `centralIdeaEvidence?`; `christTrajectory?`, `christTrajectoryEvidence?`; `audience?`, `need?`, `needEvidence?`, `desiredChange?`; `rhythm?: {sundays?, startDate?: 'YYYY-MM-DD', frequency?}`; `hypothesisLog?: Array<{id, at, source: 'panorama' \| 'study', studyId?, verdict: 'confirms' \| 'nuances' \| 'contradicts', note}>`; `revision?: {centralIdea, verdict: 'confirmed' \| 'nuanced' \| 'corrected', why, ofIdea, revisedAt}`; `updatedAt` | **No guarda libros.** `cleanProjectFraming` quita lo vacío **a todo nivel** (Firestore se inicia sin `ignoreUndefinedProperties`, `config/firebase.ts:44`) y **trunca** con topes por campo: 2 000 caracteres por texto, 300 por título, 20 movimientos y 200 entradas de registro. `revision.ofIdea` guarda la idea consolidada para detectar cuándo queda desactualizada. |
| `bibliographyCriteria.bibleBooks` | el encuadre lo escribe con la ruta `'bibliographyCriteria.bibleBooks'` | Va en el **mismo** `updateDoc` que el encuadre. Si al guardar los requisitos el proyecto guardado tiene encuadre, el caso de uso vuelve a leer y **conserva** los `bibleBooks` guardados. `useProjectBibliography` lee los libros de `project.bibliographyCriteria` cuando hay encuadre. |
| Listas blancas | `framingPatch` en `UpdateProjectDTO`, `IAIProjectRepository`, `FirestoreAIProjectRepository` y la mutación web | El repositorio aplica las rutas con punto. Además se arregla el borrado de `contextNote` (`deleteField()`), también en `ProjectEditDialog`. |
| `SeriesMetadata` | `frequency?: 'weekly' \| 'biweekly' \| 'monthly' \| 'flexible'` | `createSeriesFromPlan` la guarda. El spread de metadata la conserva al escribir y al leer (`FirebaseSeriesRepository.ts:89, 182`). `SeriesForm` la lee al recalcular fechas en lugar de arrancar en `'weekly'`. |
| `ExegeticalPaper` | `seriesPlacement?: {position, total, previous?, next?}` (datos) | Lo escriben el lote y «Crear estudio» de SeriesDetail (`seriesPlacementFor`, cuenta unidades). Se dibuja en el prompt del estudio como «Lugar en el libro (contexto literario, no tesis)», en el idioma del estudio. **No** va en el `assignmentBrief`: la revisión mostró que el encargo alimenta la búsqueda de fuentes (`briefForQuery`) y el prompt lo trata como guía autoritativa. |
| `GenerationRules` | `seriesContext?: {title, position, total, pastoral?: {audience?, need?, needEvidence?, desiredChange?}, revisedIdea?: string}` | Lo arma `augmentGenerationRules` leyendo el sermón y los proyectos una vez y sumando `getSeries`. La fila se busca por `draftId === sermon.id`, si no por `sourceSermonId`, y si no por `paperId === sourcePaperId`. El proyecto sale de `series.projectId`. |
| `SourceRecommendation` | `covers` se respeta también en el invariante | Hoy solo en el grupo (`index.ts:91`). Con eso: Noth cubre Josué–2 Reyes; Filón, el Pentateuco y el NT; las herramientas de arameo, `['EZR','DAN']`. Sanders pasa a `testament: 'NT'`. |
| `preachingNotes` (domain, recomendaciones) | notas curadas por libro, con fuentes | Por ahora EZR y NEH comparten las de Esdras-Nehemías. Cada nota lleva su `passage?` para resaltarla cuando el alcance la toca, por ejemplo 9–10. |

## 4. Unidades

| Unidad | Qué | Archivos (dueño único) | Depende |
|---|---|---|---|
| **U1 · Catálogo y notas de Esdras** | `ot/ezraNehemiah.ts`: las 12 obras compartidas, que se esparcen en NEH y en un EZR nuevo; las solo de Nehemías quedan en NEH. EZR entra en `VERIFIED_BOOKS`. Obras nuevas, de la lista ya comprobada: las propias de Esdras (Fried, Fyall, Burt, Reynolds, Pakkala), las de Esdras-Nehemías que faltan (Steinmann, Davies, Levering, Hamilton, Boda y Redditt, Pagán, Alonso Schökel), el fondo persa (Kuhrt, Briant, Yamauchi, Porten, COS 3) y el arameo (Rosenthal, Vogt, Greenspahn, Van Pelt, Ribera Florit). Cada ISBN se confirma de nuevo con `verificar-catalogo.ts`. `covers` en el invariante, Noth, Filón, Sanders. Guía de búsqueda: «Ezra-Nehemiah» como consulta adicional para EZR y NEH. `preachingNotes.ts` con las cinco notas de Esdras-Nehemías. | `recommendations/**` (incluido su `index.ts`), `searchGuide.ts`, pruebas | — |
| **U2 · Arameo** | `oshbMorphology`: la tabla aramea oficial de OSHB (26 tallos, leída en hb.openscriptures.org) cuando el código entero empieza con `A`, reutilizando la detección de `oshb-contrast.ts:58`. El recuento rotula «(arameo)». `bible/aramaicSpans.ts`: Gn 31:47, Jer 10:11, Esd 4:8–6:18 y 7:12–26, Dn 2:4–7:28 (versículos enteros), más `passageHasAramaic(passage)`. `voiceFor(bookId, passage?)`: con arameo, «hebreo y arameo bíblicos» y las gramáticas de arameo; se actualizan sus llamadores. El prompt expositivo menciona el arameo en Esdras y Daniel. Medir si `lemmaKey` mezcla lemas arameos y hebreos; arreglarlo solo si se confirma. | `oshbMorphology.ts`, `bible/aramaicSpans.ts`, `domain/src/index.ts` (solo esa línea), `testamentVoice.ts`, `exegesis/prompts.ts`, `canonicalAnalyzer/analyzerPrompts.ts`, `GeminiCanonicalVerseAnalyzer.ts`, `expository-prompts/shared.ts`; la prueba contra morphhb va en infrastructure, y las pruebas de códigos usan el formato del XML (`HAampa`, `AVqp3ms`) | — |
| **U3 · Modelo del encuadre** | `ProjectFraming`, `FramingGenre`, `cleanProjectFraming` (limpieza profunda y topes), `framingStatus(project)` → `{status, missing[]}`, `currentRevisedIdea(framing)` (null si está desactualizada). (`placeInBook` se retiró en la revisión: lo reemplaza `seriesPlacementFor`, ver §3.) `framingPatch` con rutas con punto en las cuatro listas; protección de `bibleBooks`; `deleteField()` para null; arreglo de `contextNote` en el caso de uso y en `ProjectEditDialog`. | `AIProject.ts`, `exegesis/services/projectFraming.ts`, `exegesis/index.ts` (solo esa línea), `UpdateProjectUseCase.ts`, `IAIProjectRepository.ts`, `FirestoreAIProjectRepository.ts`, `useFacultyProjects.ts`, `ProjectEditDialog.tsx`, pruebas (con un doble que rechace `undefined` anidado) | — |
| **U4 · Formulario y panel** | `ProjectFramingDialog`, `ProjectFramingCard`, `HypothesisLogDialog` y `ConsolidateIdeaDialog`. Kind `'frame'` en el recorrido; fase 1 por `framingStatus` o por la nota vieja. Tarjetas de curso ocultas en Exegético sin datos. Libros en solo lectura en Requisitos con encuadre; `useProjectBibliography` lee los libros guardados. `utils/canonico.ts`, compartido: ordena claves y trata null, `''` y ausente como iguales; lo usan las dos tarjetas de curso y Estado del arte. Notas «Para predicar…». i18n es/en con las preguntas por género. | `ProjectDashboard.tsx`, `projectRoadmaps.ts`, `recorridos.test.ts`, `components/project/ProjectFraming*.tsx`, `ProjectCourseCard.tsx`, `ProjectWorkTypesCard.tsx`, `BibliographyCriteriaPanel.tsx`, `RequirementsTab.tsx`, `useProjectBibliography.ts`, `utils/canonico.ts`, `projects.json` | U1, U3 |
| **U5 · Planificador** | Precarga desde el encuadre, solo en la rama sin borrador y una sola vez (con una ref): alcance, fecha, frecuencia y descripción. La tarjeta «Tu lectura y lo que propone el panorama» escribe en el registro. La nota de unidades contra domingos después del Pase 4. `metadata.frequency` en `SermonSeries`, en `createSeriesFromPlan` y en `SeriesForm`. `seriesPlacement` en el estudio, desde el lote y desde «Crear estudio» (no en el encargo; ver §3). Arreglo de «Refinar». | `ExpositoryAssistantPage.tsx`, `SetupCard.tsx`, `serieDesdeProyecto.ts`, componente nuevo de contraste, `SeriesService.ts`, `SermonSeries.ts`, `SeriesForm.tsx`, `SeriesDetail.tsx` (si «Crear estudio» arma el encargo ahí), `useExpositoryAssistant.ts`, `RunExpositoryPassesUseCase.ts`, `series.json` | U3 |
| **U7 · La lectura en el estudio** | Panel plegado **al final** del estudio de una perícopa que pertenece a un proyecto con encuadre: «Tu lectura del libro» (idea central, estructura con el movimiento al que pertenece esta perícopa resaltado, registro) y «Anotar lo que dice este estudio de tu lectura» (confirma / matiza / contradice + nota → `framing.hypothesisLog` con `studyId`). Al final y plegado a propósito: primero se observa el texto sin la hipótesis (lectura inductiva, Traina; Osborne), después se compara. Nada de esto va a un prompt. | componente nuevo en `pages/exegesis/**` + el punto de montaje en la página del estudio, i18n `exegesis.json` (solo claves nuevas) | U3 |
| **U6 · Sermón** | `seriesContext` en `GenerationRules`. `augmentGenerationRules` lo arma reutilizando las lecturas. `prompts-generator` lo dibuja con estas reglas: la idea revisada está rotulada y gana el análisis; el propósito pastoral orienta la aplicación y no cambia la proposición exegética. Si no hay serie, nada cambia. | `SermonGenerator.ts`, `augmentGenerationRules.ts`, `prompts-generator.ts`, pruebas | U3 |

**Olas:**
- **Ola 1**, en paralelo: U1, U2 y U3.
- **Ola 2**, en paralelo: U4, U5, U6 y U7.
- **Después:**
  1. revisión adversarial con tres lentes: correctitud y datos, método, y textos y accesibilidad;
  2. arreglos;
  3. suites completas, tipos y mutaciones;
  4. un commit por unidad y un PR.

## 5. Pruebas que cuentan

- **Catálogo:**
  - EZR tiene al menos 9 obras verificadas y al menos 6 comentarios, con historical-critical y además historical-grammatical o canonical-theological.
  - Las obras de Esdras-Nehemías salen en los dos libros; las de solo Nehemías no salen en Esdras.
  - Noth sale en Josué y no en EZR ni en NEH. Sanders no sale en ningún libro del AT. Filón sale en GEN y en el NT, y no en EZR.
  - El arameo sale en EZR y DAN, no en GEN.
  - La lista de pendientes sigue cerrada, y cada ISBN es válido y pertenece al título completo.
- **Arameo:**
  - `AVqp3ms` da «peal perfecto», `AVhp3ms` «haphel perfecto», `AVpp3ms` «pael perfecto»; `HVqp3ms` sigue diciendo «qal perfecto»; `HAampa` sigue siendo un adjetivo hebreo.
  - En infrastructure: los versículos con código `A[A-Z]` de morphhb son exactamente los de `ARAMAIC_SPANS`.
  - La voz de Esd 4:8-24 y la de 4:6-24 mencionan el arameo; la de 1:1-4, no.
- **Encuadre:**
  - `cleanProjectFraming` quita `undefined` anidados (prueba con un doble que los rechaza), trunca, y quita los bloques pastorales en «personal» pero conserva la trayectoria.
  - `framingStatus` cubre los tres estados y la lista de lo que falta.
  - `currentRevisedIdea` devuelve null cuando la idea cambió después de revisarla.
  - Guardar el encuadre no pisa los requisitos, ni los guardados ni los de una caché vieja; guardar los requisitos no pisa los libros del encuadre; el formulario no borra el registro ni la revisión.
  - La nota de contexto se puede borrar.
- **Planificador:**
  - Con encuadre, la precarga ocurre una vez y no pisa un borrador restaurado. Sin proyecto, nada cambia.
  - «Refinar» manda la observación (pruebas del hook y del caso de uso).
  - `metadata.frequency` se guarda y `SeriesForm` la lee.
  - El encargo trae el lugar en el libro, también desde «Crear estudio».
  - La tarjeta de contraste dice «del pasaje» con alcance acotado.
- **Sermón:**
  - La fila se encuentra por las tres vías.
  - Sin revisión no hay `revisedIdea`; con revisión desactualizada, tampoco.
  - El prompt no contiene la proposición del plan ni la hipótesis provisoria.
  - Sin serie, el prompt queda igual (comparar byte a byte).
- **Mutaciones:** romper cada regla nueva una vez.

## 6. Fuera de esta fase (anotado)

- **Una unidad predicada en varios domingos** (pedido del fundador, 2026-10-25): un estudio por unidad y varios sermones, cada uno con su tramo y su idea («parte 1 de 2»). Va en **la fase siguiente, en su propio PR**, porque toca medio sistema que hoy supone «una fila = un estudio» (leído): `StartStudyFromPaperUseCase` (parcha la fila por `paper.pericopeId` y reabre el último borrador del estudio: la parte 2 abriría el borrador de la parte 1), la lista blanca de filas en `FirebaseSeriesRepository.ts:128-142, 221-235`, `SeriesDetail` («Crear estudio» escribe `paperId` en una fila), `EditSermonDialog` (`syncSyntacticUnit` sobre la unidad compartida), borrar una fila, los conteos de `seriesPericopeRows`/`seriesProgress` y `SermonWizard` (`targetSermonId` pisa el pasaje de la parte). Diseño de partida: `PlannedSermon.unitSplit?: {unitId, part, of, range}`; la parte 1 conserva el id de la fila (el `pericopeId` del estudio sigue valiendo); `week` consecutivas y las siguientes corridas; partir y unir en el servidor (`SeriesService.splitPlannedSermon`), no reescribiendo el arreglo desde el cliente; `StartStudyFromPaper` recibe `plannedSermonId`. Esta fase deja lista la `frequency` guardada que esa necesita para correr las fechas.
- Pasar el encuadre a los tutores de la Facultad (hoy reciben solo `contextNote`).
- Llevar las notas «Para predicar…» al prompt del panorama. Hoy el panorama tiene caché por libro: requiere cambiar su versión.
- Que el pastor proponga la división completa en unidades de predicación antes del Pase 4. Esta fase pide sus **movimientos**, que es lo que da el «survey». La unidad de predicación la decide la gramática del texto, y para eso está el editor de fronteras.
- El selector de pasaje del planificador ya muestra la numeración del original sin convertir: es un defecto previo, anotado aparte.
- Reutilizar estudios existentes al crear la serie.
- Catálogos para Daniel y otros libros con arameo.

## 7. Decisiones que tomé y por qué (para el fundador)

1. **La hipótesis no orienta la división, ni el estudio, ni el sermón mientras sea provisoria.** Se contrasta y se revisa a la vista; al sermón llega solo la idea revisada.
2. **El encuadre vive en el proyecto.** Una segunda serie del mismo proyecto (Nehemías después de Esdras) lo comparte sin copias que se desincronicen.
3. **Esdras y Nehemías comparten las obras de Esdras-Nehemías**, porque son un libro en el canon hebreo.
4. **No hay mínimos ni puntajes.** La tarjeta muestra qué falta e invita.
5. **Lo que escribe el asistente en el plan no llega al sermón.** La gran idea del sermón es del predicador.

**Respuestas del fundador (2026-10-25):** (1) el formulario está bien; (2) la hipótesis no llega al sermón hasta consolidarla, y **debe quedar a la vista del pastor durante el proceso** → panel, planificador y, nuevo, el estudio (U7, al final y plegado, para no leer la perícopa desde la hipótesis); (3) los domingos solo dan fechas y un aviso, y **una sección puede predicarse en varios domingos** → fase siguiente (§6); el aviso de unidades contra domingos lo menciona como salida.

## 8. Qué cambió desde la versión 1

**Revisión de método:**
- La «hipótesis» única pasó a ser cinco campos con versículos: género, ocasión, estructura, idea central y trayectoria hacia Cristo.
- El conteo de lecturas, que nadie verifica, se reemplazó por títulos por capítulo y repeticiones.
- El pastor escribe su estructura antes del panorama, y la tarjeta dice «lo que propone el panorama».
- El registro de la hipótesis acompaña todo el trabajo; el veredicto suma «matizada».
- La hipótesis provisoria y la proposición del plan ya no llegan al sermón.
- La descripción de la serie la escribe el pastor, y el propósito pastoral lleva su texto de control.
- El ritmo ya no es meta del planificador.
- Se agregaron las notas propias de Esdras, entre ellas Esd 9–10.

**Revisión técnica:**
- Limpieza profunda de `undefined` y escritura por rutas con punto, en un solo `updateDoc`.
- Estado del arte lee los libros guardados.
- Doble causa del borrado de `contextNote`.
- Los llamadores de `voiceFor` entran en U2.
- `frequency` va en el tipo y en `SeriesForm`.
- Alcance como `PassageReference` en la numeración del original.
- Precarga una sola vez y sin pisar el borrador.
- La revisión queda desactualizada si se edita la idea.
- El panorama de un pasaje se rotula como tal.
- Comparación canónica para «Cambios sin guardar».
- Pruebas del arameo con el formato del XML.
- Filón por `covers`.
- Fecha local.
- Dueños únicos para los barriles y los archivos que habían quedado sin unidad.

## 9. Revisión adversarial de la implementación (2026-10-25)

Tres revisores (datos, método y experiencia). Lo principal que se corrigió en la ronda de arreglos:
- **Datos:**
  - Los títulos por capítulo pasan a guardarse por libro, porque al agregar un libro quedaban en el libro equivocado.
  - Un capítulo entero se expande antes de convertir la numeración, y el pasaje original se valida contra la versificación original. Antes, el alcance en Joel se borraba sin aviso y «Malaquías 4» se guardaba como un capítulo que no existe.
  - No se puede revisar la idea si no hay idea central, y `ofIdea` sale de lo guardado.
  - El registro se escribe con `arrayUnion`.
  - El lugar en el libro sale del encargo y pasa a un campo propio.
  - La tarjeta de contraste se reinicia con cada panorama.
- **Método:**
  - La nota de Esd 9–10 se reescribió: «linaje santo» en 9:2, Malaquías también condena el divorcio, 1 Co 7:39 y 7:12-16, Esd 6:21.
  - La nota del arameo también se reescribió, porque los versículos que citaba están en hebreo.
  - La nota de 4:6-23 se separa del debate sobre el orden de Esdras y Nehemías.
  - Hay dos notas nuevas: «no es un manual de liderazgo» y «una restauración incompleta».
  - El aviso de unidades dice «el Pase 4 propone».
  - El panorama no «confirma» la lectura del pastor.
  - Los ejemplos de los campos muestran solo el formato.
  - El género tiene dónde responderse.
  - La descripción de la serie se precarga solo con la idea revisada.
  - El bloque de la serie va después del análisis en el prompt del sermón.
- **Experiencia:**
  - El diálogo pide confirmar antes de perder cambios.
  - Contraste AA en errores y rótulos.
  - En el teléfono, las notas van arriba y plegadas.
  - El aviso de unidades tiene dos salidas reales.
  - Glosario único («tu lectura», «Revisar tu idea central», «¿Qué hace con tu lectura?»).
  - Objetivos táctiles de 44 px.
  - Archivos de página partidos.

**Deuda anotada tras la verificación final (bajo):**
- El lugar en la serie llega solo al prompt de pasos. Antes, dentro del encargo, llegaba también a los compositores de la introducción y la conclusión. Hay que decidir si esos lo reciben: es donde más pesa el flujo del libro.
- Cancelar el encuadre abierto desde Requisitos no ofrece la vuelta. El botón Atrás del navegador cae en Candidatas.
- `originalChapterCount` acepta MAL 4 como número del original. No hace daño, porque la única entrada pasa por la conversión desde el lector.
- El registro de la hipótesis crece sin tope en el documento: `arrayUnion` no recorta y el tope de 200 se aplica al leer. No hay tarea de compactación.
- «Páginas por lema» junta lemas arameos y hebreos de las mismas consonantes (medido en Esd 4:6-24).
