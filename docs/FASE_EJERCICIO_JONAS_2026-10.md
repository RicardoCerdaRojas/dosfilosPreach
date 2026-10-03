# Fase — Lo que destapó el estudio de Jonás 4:5-11 · octubre 2026

**Qué es.** Arreglos surgidos de un ejercicio real en producción, entre el
2026-10-01 y el 2026-10-03: el estudio y el sermón 6 de la serie de Jonás
(4:5-11). Se recorrió todo el camino: heredar el corpus de la serie, elegir
páginas, analizar versículo por versículo, componer y pasar al generador de
sermón hasta los enfoques homiléticos. Mientras tanto se anotaron 31 hallazgos
en la bitácora del ejercicio.

Tres se resolvieron en el momento porque bloqueaban el estudio:

- **#729:** las fuentes heredadas de la serie hacían que el análisis leyera el comienzo de cada libro.
- **#730 y #731:** el presupuesto del corpus.
- **#732:** el medidor por versículo.

Esta fase cierra el resto. También incluye tres pendientes de la fase anterior, por decisión del fundador.

**Cómo se entrega.** **Un solo PR**, con **un commit por unidad**, en el orden
de abajo. Cada commit queda completo y se puede probar en la interfaz.

**Antes de cada commit:**
1. Se corren las pruebas en local.
2. Se pasa la revisión adversarial (`docs/REVISION_ADVERSARIAL.md`), incluidas
   las preguntas 8 y 9: un estimador se escribe leyendo a su consumidor, y nada
   se predice sin medir.
3. Toda prueba nueva se rompe a propósito una vez, para ver que falla.

**Terminado** significa desplegado y probado en producción con el sermón 7 de
Jonás.

**Decisiones del fundador (2026-10-03):**

- **#11, preguntas sugeridas:** son candidatas que el pastor marca, edita o descarta. Nunca llenan el encuadre solas.
- **#28, clic en la palabra:** abre un modal en el mismo lugar con la explicación completa del paper para adaptarla. Solo lo adaptado pasa a «Tu descubrimiento».
- **#2, re-publicar:** solo se crea una versión nueva si cambió algo, y se avisa antes de crearla.
- **#5, estilo del manuscrito:** editable.
- **Pendientes grandes de la fase anterior** (anclas internas, texto completo desde los fragmentos, portada en la guía): entran en esta fase.

Para cada hallazgo se indica su número de la bitácora
(`project_ejercicio_jonas_6`) y lo que se verificó en el código el 2026-10-03.

---

## A · Integridad del corpus

### A1 · Extraer no mezcla páginas y fragmentos; el diálogo respeta la fuente (#22b, #14)

**#22b · Páginas y fragmentos viejos a la vez.**

- **Causa:** `ExtractExcerptsForPaperUseCase` (rama `existing`, l.187-204) no toca la receta (`excerptRecipe`). Una fuente que ya tenía páginas y pasa por «Extraer de mi biblioteca» queda con las dos cosas. Así terminaron Burt (50 fragmentos) y Sassom (60).
- **Arreglo:** el diálogo no autoselecciona las fuentes con páginas y las muestra con «Tiene páginas elegidas · Ajustar». Si igual se extrae, la última acción gana: la receta queda en `null`. Al guardar páginas se limpian los fragmentos, y eso ya pasaba.

**#14 · El diálogo pisa los datos de la fuente.**

- **Causa:** el diálogo precarga el tipo desde la biblioteca, no desde la fuente del corpus. Al extraer, pisa `sourceType` y `displayLabel`. Además empareja solo por `sourceLibraryResourceId`, así que una fuente legacy (solo `corpusId`) se duplica.
- **Arreglo:** subir a domain el emparejamiento fuente↔recurso, que es el mismo criterio de `findExistingSource` y `recursoDe`. Precargar tipo, rol, etiqueta y clave desde la fuente existente, y no pisar la etiqueta.

### A2 · Ninguna fuente lee el comienzo del libro sin aviso (#12b, #15)

- **Domain:** `isSourceWithoutScope(s)` (citable, sin páginas y sin fragmentos) e `isPickedByPages(s)` (léxico, diccionario o gramática).
- **Panel de pasos:** muestra un aviso fijo con un enlace «Elegir páginas de X» por cada fuente sin alcance.
- **Por qué no es un modal antes de analizar** (cambio respecto del plan, al implementarlo): después de A4 esas fuentes ya no leen el comienzo del libro, sino que buscan por versículo. Un modal en cada análisis frenaría sin necesidad, y su texto dejaría de ser cierto.
- **Preselección del diálogo de extracción** (`autoSelection`, función pura con pruebas): primero todas las fuentes sin alcance, después el top-N. Las gramáticas y los léxicos no se preseleccionan, y tampoco los libros que ya tienen páginas elegidas.

### A3 · Heredar trae páginas, y la oferta se ve en la página del trabajo (#12a, #1)

**#12a · Heredar trae páginas.**

- Después de heredar, por cada comentario: índice de hojas → `proposeSheetRanges` contra el pasaje nuevo → `SelectSourcePages`, con concurrencia limitada.
- Del trabajo hermano se copian solo las páginas fijadas, por ejemplo la introducción del libro. Las páginas de su perícopa no sirven para el pasaje nuevo.
- Las gramáticas y los léxicos quedan para el selector, como en A2.

**#1 · La oferta se ve.** La tarjeta lateral «Corpus del trabajo» dice «Hay N fuentes en la serie · Traerlas».

### A4 · Fuentes completas y fragmentos se consultan por versículo (#12c, #16)

**Domain:** `retrievalScopeOf(source)`. Es la misma función que usan el analizador, el paso y el medidor.

- **Con receta:** devuelve la receta.
- **Documento completo citable:** todas las hojas (`WHOLE_DOCUMENT_RANGE`).
- **Fragmentos:** las hojas de los fragmentos. Los editados y los que no tienen hoja van siempre (`alwaysExcerpts`).

**Respaldos:**

- **Si la búsqueda no trae nada:**
  - un documento completo sigue el camino de siempre, el texto entero;
  - los fragmentos viajan todos, como antes.
- **Por qué el documento completo no se retira** (cambio respecto del plan): una prueba existente protege el extracto corto subido a mano, donde el documento ES la curaduría. Retirarlo ahí sería peor.

**Tandas:** el recuperador parte el pedido en tandas de 25 fuentes (`MAX_SOURCES_PER_CALL`, igual al `MAX_SOURCES` de la callable). Una tanda caída solo apaga sus fuentes.

**Medidor:** cuenta con los mismos alcances.

**Compositores:** una fuente asignada con fragmentos trae sus fragmentos, no el libro entero.

**Límite conocido:** un documento completo asignado a la introducción o la conclusión sigue llegando entero, recortado a 80.000. Consultarlo pediría una búsqueda con consulta dentro del compositor.

---

## B · Selector de páginas

### B1 · Botón y rótulos que dicen lo que pasa (#23, #21b)

- **El botón dice lo que hace:** «Volver a guardar» cuando solo hay que limpiar, y «Guardar cambios» o «Agregar N hojas» según el caso. «Guardado» se pluraliza bien.
- **Tramo:** se muestra como «hojas 79–91 (13)».
- **Numeración:** la columna, el visor y los paneles usan la misma, `printedLabelIn` con desfase de respaldo. Los chips dicen «h. 440 · p. 436», y una línea fija explica: «h. = hoja del PDF; p. = página impresa».

### B2 · Lemas del pasaje entero, también en griego (#20)

**Error nuevo:** «Páginas por lema» no funciona con léxicos griegos.

- La clave del lema solo reconoce consonantes hebreas (`lemmaPages.ts:75`).
- El servidor también (`functions/.../documentTextSearch.ts:135`).
- El panel fija `dir="rtl" lang="he"`.

**Arreglo:**

- **Lemas desde la morfología del pasaje entero**, no desde los versículos ya analizados:
  - en griego, el lema de MorphGNT;
  - en hebreo, el número de Strong de morphhb traducido con una tabla nueva de Strong a lema, generada por script desde openscriptures/HebrewLexicon.
- **Clave de búsqueda griega** en domain y en functions.
- **Panel:** dirección según la lengua.
- **Carrito:** botón «Vaciar».

### B3 · «Quedarse con las páginas por lema» y «Selección sugerida» (#19, #21)

- **«Quedarse solo con estas N hojas»** en el panel de lemas, con un aviso cuando un léxico admite mucho más que sus lemas.
- **«Selección sugerida»,** determinista en la v1:
  - toma la hoja de entrada de cada lema;
  - ordena por rareza en la Biblia: la frecuencia del NT ya existe y la del AT se genera de morphhb;
  - luego por cuántas veces se repite en el libro, y deja los verbos comunes al final;
  - recorta al presupuesto y muestra el porqué de cada hoja;
  - en las gramáticas, las categorías marcadas de la morfología (wayyiqtol, infinitivo constructo, participio…) se cruzan con las secciones.

---

## C · Rúbrica, encuadre y portada de un estudio para predicar

### C1 · La rúbrica sabe qué es, y los trabajos de una serie nacen con la de predicación (#7, #4)

- **`PaperRubric.preset`** persistido (`academic` | `preaching` | `strategy-only`). Los documentos viejos caen a la heurística del ancla.
- **Rótulo:** «Estudio para predicación».
- **Error extra de #7:** con la rúbrica de predicación se muestran las justificaciones de la académica. Se corrige.
- **#4, nacer con la de predicación:**
  - Los dos caminos que crean trabajos desde una serie (manual en `SeriesDetail` y automático en `autoCreatePapersForPericopes`) nacen con la rúbrica de predicación.
  - `SeriesDetail` ahora respeta los valores por defecto de exégesis de la serie (`exegesisDefaults`). Hoy los ignora.

### C2 · Un estudio que no se entrega no pide portada ni páginas (#8, #27)

**#8 · Portada.**

- **Domain:** `paperIsDelivered(paper)`.
- Si el trabajo no se entrega, el botón de portada queda neutro (sin «falta») y no aparece el aviso al exportar.

**#27 · Panel «Extensión».**

- **Causa:** sin ensamble, el panel mide `exportPaperToMarkdown` con la cabecera, y la cabecera incluye el encuadre completo. Además los versículos con solo análisis no tienen prosa: cuentan 0.
- **Arreglo:**
  - el panel y el glosario dejan de contar la cabecera;
  - la fila de cada versículo dice «objetivo ~200 palabras», que es lo que es;
  - si el trabajo no se entrega, el panel orienta en vez de decir «faltan N páginas».

### C3 · Botón «Rúbrica» en el encabezado, con modal (#6)

Igual que Encuadre y Portada. El elegidor (`RubricSetupChooser`) sale a su propio archivo y el botón plegable desaparece.

### C4 · Encuadres por género y preguntas candidatas (#10, #11)

**#10 · Encuadres por género.** El bloque «PREGUNTAS DEL TEXTO» de la plantilla de predicación cambia según el género del libro (`inferGenreFromBook`), con un selector para cambiarlo.

**#11 · Preguntas candidatas.**

- «Sugerir preguntas» propone 5-8 candidatas.
- El pastor las marca, edita o descarta. Nunca se llena el encuadre sin su intervención.
- Cada forma hebrea o griega citada se coteja contra la morfología real del pasaje, y la pregunta se descarta si la forma no está.
- **Contexto que recibe:** el pasaje, la morfología, el género y la proposición del plan si existe.
- **Requisitos técnicos:**
  - Feature nueva en el proxy.
  - Ruteo en `config/llmRouting`. **Escribirlo en producción requiere el OK del fundador.**
- **Banco de prueba:** Jonás 4:5-11 y Santiago 2:14-26.

### C5 · La portada vive en la guía de estilo (pendiente 21 de la fase anterior)

- **Manifiesto:** `StyleGuideManifest.cover`, con los renglones, las mayúsculas y la línea «POR». El valor por defecto es el de TMS.
- **Extractor y editor:** se amplían para leerla y editarla.
- **Exportador:** `exportPaperToDocx` recibe el manifiesto, y si no lo hay usa `TMS_COVER_LAYOUT`.

---

## D · Pasos del trabajo

### D1 · Secciones vacías que dicen por qué (#13)

- **Número:** el contador solo aparece si es mayor que 0.
- **Crítica textual:** dice «revisado · sin variantes».
- **Decisiones de traducción vacías:** dicen la regla — solo se registra una decisión cuando los textos traen testigos para opciones distintas.

### D2 · Regenerar con indicación por los compositores; acciones en el encabezado (#25, #26)

**#25 · Regenerar con indicación.**

- **Hallazgo:** los compositores ya aceptan la indicación (`regenerationHint`). Solo falta que `StepCard` la mande.
- **Arreglo:** que la mande. Y el reintento por fuentes asignadas faltantes suma su instrucción a la del usuario, en vez de reemplazarla.

**#26 · Acciones en el encabezado.**

- Las acciones se describen una sola vez y las usan el pie y el encabezado, este último como íconos con tooltip y `stopPropagation`.
- Se ven también con el paso colapsado.
- En móvil: 3-4 íconos y un menú.

---

## E · Bibliografía y citas

### E1 · Leer en lote las portadas que faltan (#9)

- **Botón:** «Leer las portadas de los N que faltan», en «Datos para citar».
- **Proceso:** concurrencia de 2 y una sola pantalla de revisión, con una casilla por libro.
- **Diálogo:** dice que la ficha queda guardada en el LIBRO para todos los trabajos.

### E2 · El texto completo sale de los fragmentos indexados (pendiente 15 de la fase anterior)

- **Problema:** `library_resources.textContent` es una copia con huecos, por el tope de 1 MB.
- **Callable nueva:** devuelve el texto ordenado por `chunkIndex`, sin embeddings.
- **Adaptador:** el de `IResourceContentReader.getTextContent` la usa para las fuentes del corpus. Las guías y las rúbricas, que son cortas, siguen como hoy.

### E3 · Anclas internas para libros sin páginas impresas (pendiente 8 de la fase anterior)

- **Tipo nuevo de cita:** un tercer `CitationPageKind`, `'section'`, con un localizador de texto que puede ser una sección o un lema.
- **`citationAnchorFor`:** emite «§ …» cuando el libro no tiene numeración resuelta.
- **Se ajustan también:** los prompts, el cotejo del verificador y los renderizadores.

---

## F · Generador de sermón

### F1 · El estudio de palabras sabe el idioma; el clic precarga (#29, #28)

**#29 · Idioma.**

- **Domain:** `languageForPassage(passage)`, por testamento.
- El estudio de palabras arranca en hebreo en el AT, con placeholders del idioma correcto.

**#28 · El clic abre un modal para adaptar.**

- El clic en la palabra de una tarjeta del paper abre un modal en el mismo lugar.
- **Qué trae el modal:** la explicación del paper **completa, sin recortar**, en una caja editable, junto con la palabra, la referencia y el idioma.
- **Qué pasa a «Tu descubrimiento»:** solo lo que el pastor adapta en ese modal. La idea es reutilizar partes del estudio, no copiarlo entero (decisión del fundador, 2026-10-03).
- **Comentarios que cambian:** los de «Es consulta, no relleno» (`PaperStudyReferencePanel`, `paperStudyReference.ts`) se reescriben con esta regla.

### F2 · Observaciones con cajas visibles; el paso Insight pasa a i18n (#30)

- **Cajas:** se ven 3 cajas virtuales desde el inicio, sin guardar strings vacíos. «+ Agregar otra observación» va debajo.
- **Contador y tarjeta:** contador «N de 3», tarjeta con borde y papelera solo en las observaciones por encima del mínimo.
- **Textos:** todo el paso pasa a `generator.json`.

### F3 · Rediseño de «Elige el enfoque» (#31)

- **Grilla:** las tarjetas van en una grilla de 2×2 a todo el ancho, con tokens del sistema de diseño y radio-group.
- **Barra fija** con el enfoque elegido y «Desarrollar».
- **Ayuda** plegada en «¿Cómo elegir?».
- **Recorrido** como pasos numerados, y «Por qué funciona» plegable.
- **La tesis del pastor**, arriba y una sola vez. No se genera una tesis por enfoque: la IA no origina la tesis (P2).
- **Código muerto:** se borra `ApproachSelector.tsx`, que nadie importa.

### F4 · Estilo del manuscrito editable (#5)

- **Qué hay hoy:** `SERMON_MANUSCRIPT_STYLE` es una regla interna del taller de redacción.
- **Qué se agrega:** el usuario guarda su propia versión. El prompt usa la suya o la del sistema, y hay un botón para volver a la del sistema.
- **Lo que no se puede quitar:** el registro del español (`SPANISH_REGISTER`) sigue siendo fijo.

---

## G · Series y publicación

### G1 · Vincular un sermón existente a su perícopa (#3)

- **Dónde:** en la tarjeta del sermón planificado, «Vincular sermón existente…».
- **Cómo:** un buscador ordenado por coincidencia de pasaje, que excluye los ya vinculados.
- **Si se elige una copia publicada,** se vincula su borrador.

### G2 · Re-publicar solo crea una versión si cambió algo (#2)

Decisión del fundador, 2026-10-03. Al publicar, el borrador se compara con la última copia publicada (`wizardProgress.publishedCopyId`):

- **Si hay cambios:** se avisa «Vas a crear una versión nueva (la N)», se confirma y se crea. El historial de versiones se mantiene.
- **Si no hay cambios:** no se crea nada, y se avisa «Sin cambios desde la última publicación».

**Qué se compara:** el contenido, el título y la bibliografía. No se comparan las fechas ni los contadores.

## H · Voseo

**Functions:**

- `emails/templates/quotaWarning.ts`, que es un correo al usuario.
- Los prompts de `study-companion/orientStudy.ts` y `buildStructuralPuzzle.ts`.

**Web:** `es/library.json` y `es/guidedSermon.json`.

---

## Orden

A1 → A2 → A3 → A4 → B1 → B2 → B3 → C1 → C2 → C3 → C4 → C5 → D1 → D2 → E1 →
E2 → E3 → F1 → F2 → F3 → F4 → G1 → G2 → H.

**Toca `packages/functions`:**

- B2: búsqueda de lemas griegos.
- C4: feature del proxy.
- E2: callable de texto completo.
- H: voseo.

El deploy de producción despliega functions al mergear.
