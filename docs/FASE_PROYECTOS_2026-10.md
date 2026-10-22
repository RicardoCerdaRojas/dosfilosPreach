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
- **Tipos nuevos:** Curso, Investigación y Exegético, cada uno con su recorrido (ver la tabla del ADR-046). Se revisan los tipos actuales (ver decisiones abiertas).
- **`ExegeticalPaper.projectId`** (opcional):
  - «Nuevo estudio» desde el proyecto, que hereda lo que el proyecto define;
  - al crear un trabajo suelto, la pregunta «¿en qué proyecto?», con el último usado como sugerencia y «ninguno» siempre disponible.
- **La página del proyecto** muestra sus estudios con su fase. La lista de **Exégesis** se puede filtrar y agrupar por proyecto.
- **Conversaciones:**
  - las de Tutores, griego y hebreo siguen agrupándose por proyecto;
  - una conversación se puede ligar además a un estudio del proyecto (el contexto de la conversación ya trae `paperId`).
- **El encargo del curso vive en el proyecto:** sílabo, rúbrica, guía de estilo, criterios del profesor y portada. Es lo que hoy guarda el perfil de trabajo, que queda como plantilla para crear proyectos (ver decisiones abiertas).
- **Medida:** pasar «Teología II – Cristología» a Curso y crear desde él un estudio que herede la guía y la rúbrica.

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

## Decisiones que siguen abiertas

1. **Los tipos actuales.** «Sermón» y «Serie» se superponen con el planificador; «Estudio» se parece a Investigación. **Propuesta:**
   - Curso, Investigación, Exegético, Consejería y General;
   - «Estudio» pasa a Investigación;
   - «Serie» y «Sermón» dejan de ofrecerse al crear, porque esos casos van al planificador; los proyectos que ya los tengan los conservan.
2. **El perfil de trabajo.** **Propuesta:** sigue como plantilla para crear proyectos de tipo Curso, y la configuración vive en el proyecto.
3. **El cobro.** ¿Por estudio, por proyecto o por producto? Es una decisión de negocio aparte. Hoy se cobra por operación.
4. **Los «Material previo».** ¿Se dejan, se archivan o se reparten? **Propuesta:** dejarlos y no crear más.

## Cómo se entrega

- Una etapa = un PR, con un commit por unidad.
- Antes de cada PR:
  - pruebas;
  - una mutación por prueba nueva;
  - revisión adversarial (`docs/REVISION_ADVERSARIAL.md`).
- **Terminado** significa desplegado y probado con un caso real: un curso del fundador (TP #9 en adelante) y el proyecto «Jonás».
