# Fase «Proyectos»: contenedor de estudios, estado del arte y metodología

> **Estado:** PROPUESTA (2026-10-22). Decisión de arquitectura: ADR-046. Etapa 0 en el PR #800.

## Qué es

El proyecto pasa a ser el **contenedor de muchos estudios**: un curso, una investigación o un estudio exegético de un pasaje largo. Tiene un encargo, un **estado del arte** (la bibliografía preparada una vez para todas las tareas) y sus estudios. Agrupa también las conversaciones con Tutores, las sesiones de griego y hebreo, las extracciones y el material producido.

- **El estudio** sigue siendo la raíz de sus productos derivados.
- **El planificador** sigue siendo el módulo de predicación y se **vincula** a un proyecto.
- **Un estudio suelto** sigue siendo posible.

Lo motivó una tarea que en los TP de Santiago se hizo fuera del sistema: investigar qué fuentes usar según los criterios del profesor y la bibliografía del curso.

## Lo que hay (leído el 2026-10-22)

- **`AIProject`:**
  - tipos con recorrido, definidos en la web (`projectRoadmaps.ts`);
  - fuentes (`sourceIds`) que acotan solo las conversaciones con Tutores;
  - agrupa conversaciones, sesiones de griego y hebreo, extracciones y sermones (`projectId` de un solo sentido).
- **Producción:**
  - hay 18 proyectos, ninguno con tipo; 7 son «Material previo»;
  - ningún trabajo exegético está en un proyecto; 19 de 47 cuelgan de una serie;
  - los temas se repiten entre proyecto y serie (Jonás, 2 Pedro).
- **Tres modelos de fuentes separados:**
  - las del proyecto (`sourceIds`);
  - las de la serie (`resourceIds` y `exegesisDefaults.sourceRefs`);
  - el corpus de cada trabajo (`ProjectSource[]`).
- **Piezas que ya sirven a la fase de fuentes:**
  - la bibliografía del curso (`courseBibliography`), que se arregla en #800;
  - el catálogo curado de recomendaciones;
  - el ranking de la biblioteca por pasaje;
  - las fuentes excluidas y la memoria de entregas;
  - la tarjeta «¿Qué responde cada pregunta?» (8a).
- **Lo que falta:**
  - ligar el trabajo con el proyecto;
  - el estado del arte como fase;
  - el estado «por conseguir»;
  - los estudios temáticos (sin pasaje);
  - la división en perícopas fuera del planificador;
  - buscar fuera de la biblioteca.

## Principios

1. **El vínculo es opcional y no se fusionan entidades.** El trabajo exegético se liga con `projectId`; no se convierte en proyecto.
2. **Una sola herramienta de investigación de fuentes, en dos escalas:** completa en el proyecto, liviana en un estudio suelto.
3. **El estudio parte de lo que el proyecto ya resolvió.** Hereda el encargo y la bibliografía aprobada, y solo decide qué hojas responden a su pregunta.
4. **El planificador no pierde nada.** El calendario, las series y el camino del sermón siguen ahí; solo se vincula.
5. **Los nombres de las fases son los que un profesor reconoce:** encargo, estado de la cuestión, estudios, redacción y revisión.

## Etapas

### Etapa 0 · Arreglos (PR #800)
- El tipo del proyecto se guarda al crearlo, y editar uno no lo cambia sin avisar.
- El extractor conserva la bibliografía del curso y la maquetación.
- El trabajo de una serie nace con las fuentes por defecto de la serie.
- La herencia completa las fuentes sin curar, en vez de duplicarlas.

### Etapa 1 · El proyecto contiene estudios
- **Tipos al crear:** Curso, Investigación, Exegético, Consejería y General, cada uno con su recorrido (ver la tabla del ADR-046). «Sermón» y «Serie» ya no se ofrecen; «Estudio» pasa a Investigación.
- **`ExegeticalPaper.projectId`** (el proyecto de origen, opcional) y **`linkedProjectIds[]`** (los proyectos vinculados):
  - «Nuevo estudio» desde el proyecto, que hereda lo que el proyecto define;
  - al crear un trabajo suelto, la pregunta «¿en qué proyecto?», con el último usado como sugerencia y «ninguno» siempre disponible.
- **Asociar después:** «Agregar a un proyecto», como origen o como vínculo, desde el estudio y desde la lista. Si se elige origen, se ofrecen las fuentes de la bibliografía del proyecto que faltan, sin pisar las que hay.
- **La página del proyecto** muestra sus estudios (los de origen y los vinculados, rotulados) con su fase. La lista de **Exégesis** se puede filtrar y agrupar por proyecto.
- **Conversaciones:**
  - las de Tutores, griego y hebreo siguen agrupándose por proyecto;
  - una conversación se puede ligar además a un estudio del proyecto (el contexto de la conversación ya trae `paperId`).
- **El encargo del curso vive en el proyecto:** sílabo, rúbrica, guía de estilo, criterios del profesor y portada. Es lo que hoy guarda el perfil de trabajo, que queda como plantilla. La etapa 1b lo separa en datos del curso y tipos de trabajo.
- **Medida:** pasar «Teología II – Cristología» a Curso y crear desde él un estudio que herede la guía y la rúbrica.

**Revisión adversarial de la etapa 1 (2026-10-22, dos revisores, 19 hallazgos):**
- **Corregidos los graves:**
  - Crear un estudio fallaba con una portada heredada sin fecha. La portada pasó a la creación sin la limpieza de `normalizeCover`.
  - La conversación de un estudio con proyecto buscaba solo en las fuentes del proyecto y no en las del estudio. Ahora usa la unión de las dos (`conversationSourceScope`).
- **Corregidos los medios y bajos:**
  - En la creación del estudio:
    - el perfil elegido a mano reemplaza también la guía del proyecto;
    - dejar el proyecto deshace su encargo;
    - «La rúbrica del sistema» del encargo se respeta;
    - la estrategia admite «Sin preferencia»;
    - un proyecto archivado o ajeno de la URL no se usa como origen.
  - En «Agregar a un proyecto»:
    - un origen archivado se ve como origen;
    - no se ofrecen libros borrados de la biblioteca;
    - el aviso dice cuántas fuentes se agregaron si fallan algunas;
    - un proyecto con el que colabora puede pasar a ser el origen.
  - Asociar un estudio no cambia su fecha de edición, y quitar un vínculo es una sola escritura.
  - El primer paso de los recorridos se completa también con la nota que escribe su botón.
  - La vista de lista muestra el proyecto y el filtro tiene su propio nombre.
  - Las tarjetas del estado vacío salen de `PROJECT_TYPES`.
  - Una clave del prototipo no pasa por un tipo de proyecto.
- **Queda para después, a propósito:**
  - «Agregar a un proyecto» desde la tarjeta de la lista: la tarjeta entera es un botón y hay que reestructurarla.
  - Agrupar la lista por proyecto.
  - Pasar a i18n los textos de los recorridos de proyecto, que ya estaban fijos en español antes de esta etapa.
  - Que asociar un origen a un estudio ya creado aplique el encargo del proyecto; hoy solo lo hereda quien nace desde el proyecto.

### Etapa 1b · Datos del curso y tipos de trabajo

**Por qué.** Al probar la etapa 1, el fundador creó el curso «NT785 - Exégesis de Santiago» y copió el perfil «TP Semanal» en el encargo. Ahí vio el problema: un encargo por proyecto obliga a un solo perfil. Un curso pide TP semanales, un ensayo y un paper final, cada uno con su rúbrica, y todos comparten la misma bibliografía. En lenguaje académico, el encargo es lo que se pide en *una* tarea, no en el curso entero.

**Qué cambia:**
- **El proyecto tiene dos niveles:**
  - **Datos del curso** (`courseInfo`): el nombre del curso y una guía de estilo opcional. En un proyecto que no es curso, solo la guía.
  - **Tipos de trabajo** (`workTypes[]`): por ejemplo «TP Semanal» o «Paper final». Cada uno tiene su nombre, rúbrica (con sus tres estados), encuadre, guía, estrategia y portada. Se copia de un perfil de trabajo o se arma a mano.
- **El perfil de trabajo** es la plantilla de un tipo de trabajo, no de un curso.
- **La guía de estilo** se puede poner en los dos niveles; la del tipo gana sobre la del curso (decisión del fundador, 2026-10-22).
- **«Nuevo estudio» desde el proyecto** pregunta qué tipo de trabajo es:
  - con un solo tipo, se elige solo;
  - sin elegir, el estudio hereda solo los datos del curso;
  - pasar de un tipo a otro reemplaza todos sus campos, también los vacíos.
- **El estudio guarda su tipo** (`ExegeticalPaper.projectWorkTypeId`):
  - la página del proyecto lo rotula;
  - «Agregar a un proyecto» deja elegirlo para un estudio ya creado. Solo lo rotula: no le cambia la rúbrica;
  - cambiar o quitar el proyecto de origen borra el tipo, porque el id solo vale dentro de ese proyecto.
- **El recorrido del Curso** da por cumplido el encargo cuando hay al menos un tipo de trabajo. El nombre del curso solo no basta.
- **Compatibilidad:** el `charge` de la etapa 1 ya no se escribe. Se lee como datos del curso y un tipo («encargo»). Medido el 2026-10-22: ningún proyecto de producción lo tenía guardado.

**Revisión adversarial de la etapa 1b (2026-10-22, 10 hallazgos):**
- **Corregidos:**
  - Pasar de un tipo con encuadre a uno sin encuadre dejaba la consigna del primero.
  - Un curso con solo el nombre, o sin tipo elegido, desplazaba al perfil por defecto sin heredar nada. Ahora el nombre solo no cuenta como herencia.
  - Un tipo vacío elegido después de uno lleno traía el perfil por defecto. Ahora un tipo elegido siempre hereda, aunque esté vacío.
  - La estrategia «Sin preferencia» pasa a llamarse «Por defecto (dialéctica)», que es lo que hace.
  - El rótulo del tipo en la lista no llegaba a contraste AA.
  - Un estudio cuyo tipo se quitó del proyecto se ve como tal y se puede dejar sin tipo.
  - En un tipo, la guía vacía dice «La del curso» solo si el curso tiene guía.
  - El selector de proyecto y tipo pasó a su propio componente, para no seguir engordando la página de creación.
- **Queda para después:**
  - Copiar un perfil a un tipo no llena el nombre del curso, si está vacío.
  - El nombre «Encargo» del tipo que sale de un encargo viejo está fijo en español. En producción no hay ninguno.

### Etapa 2 · El estado del arte
- **Bibliografía del proyecto.** Cada fuente tiene:
  - si es obligatoria, recomendada o candidata;
  - su estado: en la biblioteca, por conseguir o descartada;
  - la razón, y para qué pregunta o estudio sirve.
- **Sus pasos:**
  1. **Requisitos:** del sílabo o a mano si no hay bibliografía. Incluyen tipos y mínimos, obras obligatorias, prohibiciones y criterios del profesor.
  2. **Candidatas:** la bibliografía del curso, el catálogo curado, la biblioteca (con ranking por los pasajes del proyecto) y los libros compartidos de la plataforma.
  3. **Evaluación:** si cubre el libro bíblico, si es una edición con páginas impresas, el idioma y el nivel de rigor.
  4. **Conseguir:** el estado «por conseguir», que hoy no existe porque una fuente sin recurso no tiene dónde vivir.
  5. **Aprobada:** la lista con la que nace cada estudio.
- **Herencia:** cada estudio nuevo arranca con la bibliografía aprobada y las hojas que nombran su pasaje (8a).
- **La regla de no repetir y la memoria de entregas** se cuentan por proyecto, no por todo el historial.
- **Versión liviana para el estudio suelto:** los mismos pasos, solo sobre ese trabajo.
- **Medida:** con el sílabo y la bibliografía del curso de Santiago, la bibliografía aprobada contiene lo que en los TP #5 a #8 se eligió a mano.

### Etapa 3 · Proyecto exegético y planificador
- **La división en perícopas se comparte:**
  - un proyecto exegético divide su pasaje y crea un estudio por perícopa, sin sermones ni fechas;
  - el resultado se guarda en el proyecto, no solo en la serie.
- **Vínculo entre plan y proyecto:**
  - un plan del planificador puede apoyarse en un proyecto y usar su bibliografía y sus estudios;
  - un proyecto exegético puede derivar un plan de predicación;
  - los dos siguen existiendo solos.
- **Se unifican las fuentes:** con el vínculo, las fuentes de la serie son las del proyecto; sin él, siguen siendo las de la serie.
- **Medida:** el proyecto «Jonás» y la «Serie expositiva — Jonás» quedan ligados, y la serie usa la bibliografía del proyecto.

### Etapa 4 · Estudios temáticos
- Un estudio sin pasaje, sobre un tema o un término, dentro de un curso o una investigación. Requiere que el trabajo exegético acepte un alcance que no sea un pasaje. Es el cambio de datos más grande.

### Etapa 5 · Productos del proyecto y metodología visible (por desarrollar)
- Entregables que combinan varios estudios: el ensayo final de una investigación, la carpeta del curso, la serie predicada a partir del proyecto.
- **Nota metodológica exportable:** qué se consultó, con qué criterio y qué se descartó.
- **Búsqueda fuera de la biblioteca:** Open Library, Google Books, Crossref (DOI), siempre verificada contra el catálogo y nunca solo por el modelo (decisión de la v1.7).

## Decisiones del fundador (2026-10-22)

1. **Tipos al crear:** Curso, Investigación, Exegético, Consejería y General. «Sermón» y «Serie» dejan de ofrecerse, porque esos casos van al planificador; los proyectos que ya los tienen los conservan. «Estudio» pasa a Investigación.
2. **El perfil de trabajo** queda como plantilla para crear cursos. La configuración vive en el proyecto.
3. **El cobro sigue siendo por estudio:** es la unidad donde más se usa el asistente.
4. **Los «Material previo»** se dejan y no se crean más.
5. **Un estudio suelto se puede asociar después** a un proyecto.
6. **Un estudio puede colaborar con más de un proyecto:** tiene un proyecto de origen, que define su encargo, y varios vínculos.
7. **Un curso tiene varios tipos de trabajo** (TP semanal, ensayo, paper final), cada uno con su perfil, sobre una bibliografía común. Los nombres son «Datos del curso» y «Tipos de trabajo». La guía de estilo puede ser del curso o del tipo de trabajo, y la del tipo gana (etapa 1b).

## Cómo se entrega

- Una etapa = un PR, con un commit por unidad.
- Antes de cada PR:
  - pruebas;
  - una mutación por prueba nueva;
  - revisión adversarial (`docs/REVISION_ADVERSARIAL.md`).
- **Terminado** significa desplegado y probado con un caso real: un curso del fundador (TP #9 en adelante) y el proyecto «Jonás».
