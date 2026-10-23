# Etapa 2 · El estado del arte: la bibliografía del proyecto

> **Estado:** PROPUESTA (2026-10-23). Es la etapa 2 de `docs/FASE_PROYECTOS_2026-10.md` (ADR-046). Requiere el OK del fundador antes de escribir código.

## Qué es

La bibliografía del curso se prepara **una vez** y le sirve a todas sus tareas. En los TP de Santiago se armó fuera del sistema: se investigó qué libros convenía usar según los criterios del profesor. Esta etapa la trae dentro del proyecto, con un método que un profesor reconoce.

**Cinco pasos:**
1. requisitos;
2. candidatas;
3. evaluación;
4. conseguir;
5. aprobada.

Cada estudio nuevo del proyecto parte de la bibliografía aprobada.

## La metodología que lo respalda

Cada paso sigue a un manual reconocido. Rótulos: **V** = verificado en el texto o en un índice o reseña confiable; **M** = de memoria. No se citan números de página que no se hayan visto.

| Paso | Qué hace | Respaldo |
|---|---|---|
| **1. Requisitos** | Qué exige el curso: mínimos por tipo de fuente, obras obligatorias, prohibiciones y criterios del profesor. Salen del sílabo o se escriben a mano si no hay bibliografía. | Turabian, *A Manual for Writers*, 9.ª ed. (2018), cap. 2 **V** · Kibbe, *From Topic to Thesis* (2016), cap. 1 **V** · Vyhmeister, *Manual de investigación teológica* (Vida, 2009), caps. 11–12 **V** |
| **2. Candidatas** | Se reúnen de varias bibliografías y se cruzan. Lo que aparece en varias sube de rango. | Booth et al., *The Craft of Research*, 4.ª ed., cap. 5 **V** · Turabian 3.2 **V** · Fee, *New Testament Exegesis*, 3.ª ed. (2002), cap. IV, paso 13 **V** · Eco, *Cómo se hace una tesis*, III.2.2: copiar las bibliografías de varias obras de consulta y cruzarlas; las que «citan todos» dan una «primera jerarquía» **V** |
| **3. Evaluación** | Una lista fija de preguntas por obra: autor, editorial y su orientación, fecha de la edición (no de la impresión), nivel académico o popular, si trae notas y bibliografía, si es fuente primaria o secundaria. A eso se agregan dos preguntas propias: si cubre el libro bíblico y si la edición tiene páginas impresas. | Vyhmeister, cap. 15, sus 14 preguntas **V** · Turabian 3.3 **V** · CRAAP (Blakeslee, 2004) **V** |
| **3b. Tradición y nivel** | Cada comentario se rotula por nivel (técnico, semitécnico, expositivo) y por tradición. La tradición sirve para **equilibrar**, no para filtrar: escuchar al menos tres interpretaciones distintas. | Glynn, *Commentary and Reference Survey* (2007) **V** · Carson, *NT Commentary Survey*, 7.ª ed. (2013) **V** · Longman, *OT Commentary Survey*, 5.ª ed. (2013) **V** · Fee 4.1 **V** · Vyhmeister, cap. 1 **V** |
| **4. Conseguir** | Una ficha sin ubicación es una dificultad que hay que resolver. Para cada libro bíblico, tener en la biblioteca propia los dos o tres mejores comentarios. | Eco III.2.2 **V** · Fee 4.1 **V** |
| **5. Aprobada** | La lista con la que se trabaja, junto con **los criterios usados para incluir u omitir**. Se puede ampliar o recortar después: no se congela. | Vyhmeister, cap. 7, «Ensayo bibliográfico» **V** |
| **Anotación** | Cada obra dice para qué sirve: qué pregunta o tarea, qué páginas y qué posición sostiene. | Booth, cap. 6 **V** · Eco IV.2.3 y III.2.2 **V** · Vyhmeister, cap. 13 **V** · Hart, *Doing a Literature Review*, 2.ª ed. (2018), caps. 3 y 8 **V** |
| **Fichada** | La ficha bibliográfica (lo que hay que buscar) es distinta de la ficha de lectura (lo que ya se leyó). | Eco III.2.2 y IV.2.3 **V** |
| **Herencia a cada estudio** | El fichero de un trabajo sirve para los siguientes. | Eco **V**. Cómo heredar es una decisión de producto. |

**Tres advertencias de la metodología que el diseño respeta:**
- **Tu propia exégesis va antes que los comentarios** (Fee 13.1; Stuart, paso 11; Vyhmeister, cap. 1; Kibbe, cap. 1 **V**). La bibliografía se *arma* temprano, pero los comentarios del pasaje se *leen* después. El estudio hereda las herramientas desde el principio. Cuándo entran los comentarios es la decisión 1.
- **En un trabajo exegético no va una sección aparte de «lo que dice la literatura»**. Lo que dicen las fuentes se integra a lo largo del texto (Fee **V**). El «ensayo bibliográfico» como capítulo es propio de una tesis o de una investigación (Vyhmeister, cap. 7). Por eso, lo que produce el estado del arte depende del tipo de proyecto.
- **Ningún manual fija un número mínimo de fuentes.** Vyhmeister dice «tantos como sean necesarios» **V**. El mínimo lo pone cada curso, en la rúbrica de cada tipo de trabajo.

## Lo que hay (leído en el código y en producción, 2026-10-23)

- **`AIProject.sourceIds`:** ids de la biblioteca, sin peso, estado ni razón. Solo acotan las conversaciones con Tutores. La tarjeta del proyecto **no muestra los libros compartidos de la plataforma**: filtra por dueño.
- **La bibliografía del curso** (`CourseBibliographyEntry`):
  - tiene título, autor, serie, obligatoria o recomendada, una nota y un `resourceId` que ninguna pantalla escribe;
  - vive dentro de la **rúbrica**, así que llega al proyecto solo a través de la rúbrica de cada tipo de trabajo;
  - ya existen la coincidencia con la biblioteca (`matchCourseBibliography`) y la cobertura (`courseBibliographyCoverage`).
- **El catálogo curado:**
  - recomendaciones con nivel de importancia, idiomas y razón;
  - solo Hebreos, Romanos y Génesis tienen lista propia; Santiago y Jonás tienen solo la del grupo y la general.
- **El ranking de la biblioteca:** es **por trabajo** (necesita un pasaje) y por vectores. Para el proyecto basta la cobertura del libro (`coversBibleBooks`, `exegeticalType`).
- **Los mínimos por tipo de fuente:** viven en la rúbrica (`SourceRequirement`), con su verificación (`computeRubricCompliance`) y su nivel de rigor (`assessRubricRigor`).
- **Lo que hoy no existe:**
  - una fuente que no esté en la biblioteca («por conseguir»);
  - el estado «descartada»;
  - un campo de idioma en los recursos;
  - un ranking a nivel de proyecto.
- **La memoria de entregas y «no repetir fuentes»** se cuentan sobre **todos** los trabajos del autor, no por proyecto.
- **Medido en producción:** en los TP de Santiago (1:19 a 4:10) se usaron unas 14 obras distintas, con un núcleo que se repite en 3 a 5 TP:
  - los títulos, tal como figuran en la base: NA28; *A Textual Commentary on the Greek NT* (UBS4); *The Epistle of James — the Greek text with introduction*; el NICNT de Santiago; el Baker Exegetical (BECNT); *A Critical and Exegetical Commentary on the Epistle of St. James* (ICC); *The Book of James — A New Perspective*;
  - las herramientas: el *Léxico Griego-Español*, la *Gramática Griega*, el *Diccionario Teológico del NT*, *Greek Grammar Beyond the Basics*, *Idioms of the Greek NT* y *Grammar of the Greek NT in the Light of Historical Research*.
  - **El mismo libro quedó clasificado distinto según el TP:** el NICNT figura como comentario crítico en unos y como expositivo en otros, y el UBS4 como comentario textual, aparato crítico o comentario crítico. Evaluarlo una sola vez en el proyecto corrige eso.

## Diseño

### Datos

Una lista nueva en el proyecto: **`AIProject.bibliography: ProjectBibliographyEntry[]`**.
- Va dentro del documento del proyecto, con un tope de 200 entradas y notas cortas: unos 250 KB en el peor caso. No hacen falta reglas nuevas de Firestore.
- Se guarda limpia de `undefined`, igual que los tipos de trabajo.

**Cada entrada (una ficha):**

| Campo | Para qué |
|---|---|
| `id`, `title`, `author`, `year`, `publisher`, `series`, `edition` | La ficha bibliográfica. Vale también para un libro que todavía no está en la biblioteca. |
| `resourceId` | El libro en la biblioteca, propia o compartida. Sin él, la obra está **por conseguir**. |
| `sourceType` | La misma taxonomía de siempre (14 tipos, incluido `journal-article`). Se clasifica **una vez** y todos los estudios heredan esa clasificación. |
| `weight` | **Obligatoria**, **recomendada** o **complementaria**. |
| `decision` | **Candidata**, **aprobada** o **descartada**. |
| `reason` | Por qué se aprobó o se descartó. Es obligatoria para descartar. |
| `origin` | De dónde salió: sílabo, catálogo, biblioteca, estudios anteriores del curso o a mano. |
| `evaluation` | Las preguntas de la lista: cubre el libro bíblico, páginas impresas, fecha de la edición, nivel (técnico, semitécnico, expositivo o popular), tradición (rótulos de Glynn), idioma, si trae notas y bibliografía, y si es fuente primaria o secundaria. Lo que el sistema ya sabe se completa solo y se puede corregir. |
| `annotation` | Para qué tipos de trabajo o preguntas sirve, qué páginas y qué posición sostiene. |
| `read` | Si ya se leyó: la ficha de lectura de Eco. |

**Los criterios del proyecto** van en `AIProject.bibliographyCriteria`:
- los requisitos del profesor, en texto;
- las prohibiciones;
- los **criterios de inclusión y exclusión**, que es lo que exige Vyhmeister, cap. 7.

Los mínimos por tipo de fuente **no se duplican**: se leen de las rúbricas de los tipos de trabajo del proyecto.

**Compatibilidad con lo que ya existe:**
- **Los `sourceIds` actuales se leen como entradas aprobadas**, igual que se hizo con el encargo viejo.
- **Las entradas aprobadas que están en la biblioteca se copian a `sourceIds`**, así las conversaciones con Tutores siguen acotadas como hoy.
- No se migra nada en producción.

### Pantalla: «Estado del arte»

Es una página propia del proyecto. El tablero ya está grande, así que el paso «Estado del arte» del recorrido lleva a ella.

- **Requisitos:** los criterios en texto y, solo para leer, los mínimos que piden las rúbricas de los tipos de trabajo.
- **Candidatas,** con cinco orígenes:
  1. **El sílabo:** la bibliografía del curso que trae la rúbrica de cada tipo de trabajo.
  2. **El catálogo curado** para los libros bíblicos del proyecto.
  3. **Tu biblioteca, con los libros compartidos:** solo los que cubren esos libros bíblicos o son obras de referencia (léxicos, gramáticas, el texto crítico).
  4. **Los estudios del curso:** lo que ya usaron los TP del proyecto. Es la versión liviana del «cruce de bibliografías» de Eco. Lo que aparece en varios estudios sube de rango.
  5. **A mano:** una obra por conseguir o un artículo de revista. Fee los pide y hoy no tienen lugar.

  Lo que se repite entre orígenes se junta en una sola ficha, que muestra todos sus orígenes.
- **Evaluación:** se abre cada ficha, se responden las preguntas (las que ya se saben vienen respondidas) y se decide si se aprueba o se descarta, con la razón.
- **Avisos que informan y no bloquean:**
  - un tipo de fuente que piden las rúbricas y no tiene ninguna obra aprobada;
  - toda la bibliografía cae en una sola tradición;
  - una obra obligatoria está por conseguir;
  - un comentario no cubre el libro bíblico.
- **Por conseguir:** la lista de lo que falta, con el botón «Ya lo tengo», que la liga a un libro de la biblioteca al subirlo.
- **Aprobada:** la lista final con sus criterios. Más adelante se podrá exportar como bibliografía anotada (etapa 5).

### Herencia: el estudio parte de lo aprobado

- Al crear un estudio en el proyecto, se le **ofrecen** las obras aprobadas que están en la biblioteca, como hoy se ofrece la herencia de una serie:
  - vienen marcadas por defecto;
  - traen la clasificación del proyecto;
  - un comentario que no cubre el libro del estudio no se ofrece.
- Se reusa lo que ya existe: `initialSources` en la creación y el patrón de `corpusHeredado`. Las hojas de cada libro se eligen después, en el corpus, como siempre (8a).
- **La memoria de entregas y «no repetir fuentes» se cuentan dentro del proyecto.** El TP #9 se compara con los TP del curso, no con todo tu historial.

## Cómo se entrega

**Un PR**, que incluye también el arreglo de las tarjetas ya hecho (commit b15f5008). Un commit por unidad:
1. La entidad y sus reglas en domain: ficha, decisión, evaluación, compatibilidad con `sourceIds` y fusión de candidatas.
2. Guardar en el proyecto, con su caso de uso y la sincronización con `sourceIds`.
3. Las candidatas de los cinco orígenes.
4. La página «Estado del arte»: requisitos, candidatas, evaluación, por conseguir y aprobada.
5. La herencia en la creación del estudio, y «no repetir» y la memoria de entregas por proyecto.
6. Lo que encuentre la revisión adversarial.

Antes del PR: pruebas, una mutación por cada prueba nueva y la revisión adversarial.

**Medida de terminado:** desplegado y probado en NT785.
- La bibliografía aprobada contiene las 14 obras que se eligieron a mano en los TP #5 a #8.
- Cada una queda con **una sola** clasificación.
- El TP #10 nace con ellas ofrecidas.

## Decisiones para el fundador

1. **¿Cuándo entran los comentarios del pasaje?** Fee pide hacer la propia exégesis antes de leer comentarios.
   - **(a)** Se ofrecen al crear, junto con las herramientas, como hoy. El sistema los necesita para redactar.
   - **(b)** Al crear solo entran las herramientas (texto crítico, aparato, léxicos, gramáticas), y los comentarios se ofrecen en el paso del corpus.
   - **Recomendado: (a)**, con una nota de método en el corpus. Hoy los pasos del trabajo usan los comentarios desde el principio, y (b) cambia ese flujo.
2. **«No repetir fuentes» por proyecto.** Ningún manual lo pide: es una regla de tu profesor.
   - Propuesta: se cuenta dentro del proyecto y se mantiene como hoy, con el aviso y la confirmación del estudiante.
   - ¿Es así, o el profesor lo pide entre todos tus cursos?
3. **La tradición teológica:** propongo solo **avisar** cuando toda la bibliografía cae en una sola tradición, sin filtrar nada. ¿De acuerdo?
4. **Lo que queda para después:**
   - el rastreo de citas dentro de los libros: qué obras citan tus fuentes;
   - la búsqueda fuera de la biblioteca (Open Library, Crossref);
   - el «mapa de posiciones por pregunta» de una investigación.

   Las tres van a la etapa 5.
