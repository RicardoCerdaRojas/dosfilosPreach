# ADR-046 — El proyecto es un contenedor de estudios; el estudio sigue siendo la raíz de sus productos

## Estado

`proposed`

Reemplaza la **definición de proyecto** del ADR-003. El principio central del ADR-003 sigue vigente: un estudio alimenta muchos productos derivados.

## Fecha

2026-10-22

## Contexto

En los trabajos prácticos de Santiago (TP #5 al #8), la primera tarea fue investigar qué libros, artículos y comentarios convenía usar. Esa investigación partía de los criterios del profesor y de la bibliografía del curso, cuando el curso la daba. Se hizo con ayuda externa y el sistema no tiene un lugar para ella:

- el armado del trabajo salta de la rúbrica (cuántas fuentes de cada tipo) a «elige de tu biblioteca o sube un archivo»;
- `METODOLOGIA.md` dice que el estudiante «sube las fuentes que el profesor exige», como si esa investigación ya estuviera hecha.

Esa investigación no es de un trabajo. Es **de un curso, de una investigación o de un estudio largo**: se hace una vez y sirve para varias tareas.

**Lo que hay hoy** (leído en el código y en producción, 2026-10-22):

- **ADR-003** (aceptado 2026-05-22):
  - define el proyecto como la unidad de **un pasaje** (`passage`), con un estudio y sus productos derivados;
  - hace obligatorio el `projectId` y pone las series como hijas del proyecto.
  - Nunca se construyó: la fase 5 sigue en borrador.
- **`AIProject`** («Proyectos» en el menú):
  - tiene tipos (Sermón, Serie, Consejería, Estudio, General), cada uno con su recorrido;
  - agrupa las conversaciones con Tutores, las sesiones de griego y hebreo, las extracciones y los sermones;
  - sus fuentes (`sourceIds`) acotan las conversaciones con Tutores.
  - El tipo nunca se guardaba: se arregla en el PR #800.
- **Uso real:**
  - Hay 18 proyectos. Ninguno tiene tipo y siete son «Material previo», creados por una migración.
  - Los creados a mano son de tres clases: un curso («Teología II – Cristología»), series («Serie 2 Pedro», «Jonás») y una investigación («La inspiración y la suficiencia de las Escrituras»).
  - Ninguno de los 47 trabajos exegéticos está ligado a un proyecto; 19 cuelgan de una serie del planificador.
- **El mismo tema se repite en dos lugares:** el proyecto «Jonás» y la serie «Serie expositiva — Jonás»; «Serie 2 Pedro» y «Serie expositiva — 2 Pedro».
- **Las fuentes viven en tres modelos que no se hablan:** las del proyecto (`sourceIds`), las de la serie (`resourceIds` y `exegesisDefaults`) y el corpus de cada trabajo (`ProjectSource[]`).
- **La división en perícopas (`DetectPericopesUseCase`) es independiente:** recibe un libro y devuelve perícopas. Solo **guarda** el resultado dentro de la serie de sermones.

## Decisión

**Hay tres niveles, y cada uno tiene una tarea.**

1. **El estudio** es la unidad de trabajo sobre un pasaje (y, más adelante, sobre un tema). Es la **raíz de sus productos derivados**: sermón, estudio bíblico, lección, devocional. Es el principio del ADR-003, sin cambios. Hoy el estudio es el trabajo exegético (`ExegeticalPaper`), y la derivación ya existe en parte (#211, #214).
2. **El proyecto** es un **contenedor de muchos estudios**. Tiene un encargo, un estado del arte y estudios. Es el camino por defecto, pero un estudio suelto sigue siendo posible.
3. **El planificador** sigue siendo el **módulo de predicación**: series, calendario y el camino de cada sermón. No es una fase del proyecto. Se **vincula** a un proyecto, que no lo contiene.

### Qué es un proyecto

| Tipo | Encargo | De dónde salen los estudios |
|---|---|---|
| **Curso** | Sílabo, rúbrica, guía de estilo, criterios del profesor | Del calendario de tareas: TP, ensayos, la investigación final |
| **Investigación** | Pregunta y alcance | De las preguntas: pasajes, temas, términos |
| **Exegético** | Pasaje largo y propósito | De la división del pasaje en perícopas |

**Los tipos que se ofrecen al crear** son Curso, Investigación, Exegético, Consejería y General (decisión del fundador, 2026-10-22):
- «Sermón» y «Serie» dejan de ofrecerse, porque esos casos van al planificador; los proyectos que ya los tienen los conservan;
- «Estudio» pasa a llamarse Investigación.

### Un estudio: un proyecto de origen y varios vínculos

- **El proyecto de origen** (uno, opcional) define el encargo del estudio: rúbrica, guía, criterios del profesor y la bibliografía que hereda.
- **Los proyectos vinculados** (varios) muestran el estudio en su lista, lo pueden usar en sus productos y sus conversaciones lo pueden consultar. No le cambian las reglas.

Ejemplo: el estudio de Santiago 4:1-10 nace en el curso como TP, y se vincula a la serie sobre Santiago y a una investigación sobre la oración.

Ya hay un antecedente en el código: una extracción de «Mis Recursos» ya pertenece a varios proyectos (`Extraction.projectIds[]`).

**Un estudio suelto se puede asociar después** a un proyecto, como origen o como vínculo. Al asociarlo se le **ofrecen** las fuentes de la bibliografía del proyecto que todavía no tiene; nunca se pisa lo que ya tiene.

### El perfil de trabajo

Queda como **plantilla para crear proyectos de tipo Curso**. La configuración del curso vive en el proyecto, no en el perfil (decisión del fundador, 2026-10-22).

### Qué agrupa un proyecto

- **sus estudios**, que se crean desde el proyecto y heredan su encargo y su bibliografía;
- **las conversaciones con Tutores** y las sesiones de griego y hebreo, como hoy. Una conversación puede ligarse además a un estudio del proyecto;
- **las extracciones** de «Mis Recursos» y el material producido;
- **el estado del arte**: la bibliografía del proyecto, con el estado y la razón de cada fuente;
- **sus fuentes**, que siguen acotando las conversaciones, como hoy.

### Qué aporta un proyecto: la metodología

- **El encargo:** qué se pide y con qué criterios.
- **El estado del arte:** requisitos, candidatas, evaluación, «por conseguir» y una bibliografía aprobada. Se prepara una vez para todas las tareas.
- **Los estudios:** cada uno parte de la bibliografía aprobada y solo decide qué hojas responden a su pregunta.
- **Las fases** llevan nombres que un profesor reconoce: encargo, revisión bibliográfica o estado de la cuestión, estudios, redacción y revisión.

**La investigación de fuentes es una sola herramienta con dos escalas:**
- **en el proyecto**, completa;
- **en un estudio suelto**, liviana, sobre ese trabajo y su pasaje.

### Los productos derivados, en dos niveles (por desarrollar)

- **El estudio** deriva sus productos. Ya existe en parte.
- **El proyecto** deriva entregables que combinan varios estudios: el ensayo final de una investigación, la serie que se predica a partir de un proyecto exegético, la carpeta de entregas de un curso. Más adelante, también una **nota metodológica**: qué se consultó, con qué criterio y qué se descartó.

Este ADR fija el principio y la dirección. El diseño de cada producto queda para fases propias.

### El vínculo con el planificador

- Un plan de sermones puede **apoyarse** en un proyecto, y entonces usa su bibliografía y sus estudios.
- Un proyecto exegético puede **derivar** un plan de predicación.
- Los dos pueden existir solos.
- La **división en perícopas** es una herramienta compartida: el planificador la usa para predicar y el proyecto exegético para estudiar, sin fechas ni sermones.

## Alternativas consideradas

| Alternativa | Por qué descartada |
|---|---|
| **Mantener el ADR-003:** proyecto = un pasaje | No deja lugar para lo que agrupa el trabajo (un curso, una investigación) ni para el estado del arte. La unidad por pasaje con productos derivados ya la cumple el estudio. |
| **Una entidad «Curso»**, o convertir el perfil de trabajo en curso | «Curso» encierra el producto en el seminarista y deja fuera la investigación y el proyecto exegético. Además, el perfil de trabajo es una plantilla (se aplica una vez y no recuerda nada), no un contenedor de trabajos. |
| **El planificador como fase «Plan» del proyecto** | Recorta el módulo de predicación (calendario, series, camino del sermón) a un paso de otro módulo. La relación correcta es un vínculo. |
| **Proyecto obligatorio para todo estudio** | El propio ADR-003 lo anotaba como riesgo de «ceremonia» para quien solo quiere predicar. Un cajón automático («Material previo») muestra que lo forzado no se usa. |
| **Copiar el estudio a cada proyecto que lo usa** | Las copias terminan distintas: una se corrige y la otra no. El vínculo comparte un solo estudio. |
| **Un estudio en varios proyectos con el mismo peso** | ¿Qué rúbrica y qué bibliografía mandan? Dos encargos pueden contradecirse. Por eso hay un solo proyecto de origen y varios vínculos. |
| **Fusionar `ExegeticalPaper` con `AIProject`** | El trabajo es documental, con historial de versiones y disciplina de citas (`ExegeticalPaper.ts`, «confirmado con el usuario»). Se liga con un `projectId`; no se fusiona. |

## Consecuencias

### Positivas

- La investigación de fuentes tiene dónde vivir y se hace una vez por proyecto, no en cada tarea.
- El menú «Proyectos» tiene una razón de ser: agrupar y dar método.
- Desaparece la duplicación de temas: «el estudio de Jonás» y «la serie que se predica a partir de él» quedan ligados.
- El principio del ADR-003 (un estudio alimenta muchos productos) se conserva y gana un segundo nivel: los entregables del proyecto.
- La migración es liviana y reversible: el vínculo es opcional y no hay datos que convertir.

### Negativas

- Hay un nivel más (proyecto → estudio → productos). Para quien solo predica, tiene que ser opcional de verdad y no estar en su camino.
- «Proyectos» hoy es también la carpeta de las conversaciones con Tutores. Hay que cuidar que los dos usos no se confundan en la interfaz.
- Los estudios temáticos (sin pasaje) requieren cambiar el trabajo exegético, que hoy exige `passage`. Es el cambio de datos más grande del plan.

### Neutrales

- **El cobro sigue siendo por estudio** (decisión del fundador, 2026-10-22): es la unidad donde más se usa el asistente. El proyecto no se cobra aparte. Esto deja de lado la propuesta del ADR-003 de cobrar por proyecto.
- **Los siete «Material previo»** se dejan como están y no se crean más.

## Impacto

- **Código afectado:**
  - `AIProject` (tipos y recorridos) y su página;
  - `ExegeticalPaper` (`projectId` de origen, `linkedProjectIds[]`; más adelante, estudios sin pasaje);
  - la lista de Exégesis (por proyecto);
  - la fase de fuentes (bibliografía del proyecto, herencia hacia cada estudio);
  - `SermonSeries` (vínculo con el proyecto);
  - la división en perícopas (compartida).
- **Fases impactadas:**
  - la fase 5 («proyecto como contenedor») se redefine con este ADR;
  - la fase 6 («planner runway») cambia: las series se vinculan a un proyecto y no son su colección.
- **Migraciones requeridas:** ninguna obligatoria. Los proyectos existentes se tipan editándolos (#800).
- **Reversibilidad:** alta, porque todos los vínculos son opcionales.

## Referencias

- Plan: `docs/FASE_PROYECTOS_2026-10.md`
- Reemplaza en parte: ADR-003 (definición de proyecto). Relacionado: ADR-004 (el trabajo exegético es un recurso consultable del proyecto).
- Especificación de asistentes v1.3: `docs/spec-asistentes-preparacion-estudio-v1.3.md` (niveles proyecto / proceso; tipos Curso y Conferencia que faltaban).
- PRs base: #211, #214 (productos derivados), #800 (etapa 0: tipo de proyecto, bibliografía del curso, fuentes de la serie).
