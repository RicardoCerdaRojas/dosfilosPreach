# ADR-043 — Un estudio para predicar no es un trabajo académico más corto

## Estado

`accepted`

## Fecha

2026-09-27

## Contexto

El módulo de exégesis tenía una sola rúbrica: la académica, doce páginas, con la
edición crítica del texto bíblico como ancla del versículo y el aparato como
requisito de corpus. Está bien para lo que es —un trabajo de seminario— y se
usaba también para preparar sermones, porque era lo único que había.

Medido sobre la serie de Jonás: **los seis sermones tenían el encuadre vacío**
sobre la rúbrica académica de doce páginas. Ninguno la había llenado. Un
formulario que nadie completa no es un formulario difícil: es el formulario
equivocado.

Las diferencias no son de tamaño. Son de naturaleza:

| | Trabajo académico | Estudio para predicar |
|---|---|---|
| Ancla del versículo | `biblical-text-edition` — la edición crítica | `commentary-expository` — el comentario que explica |
| Lo que el lector necesita | que las decisiones textuales estén justificadas | que el sentido del pasaje esté claro y aplicable |
| Citas | nota al pie, con aparato | paréntesis, en el cuerpo |
| Extensión | doce páginas | tres a cinco, y de contenido |
| Preguntas del encuadre | las da el profesor | **no existen a priori** |

Esa última fila es la que rompía el modelo. El encuadre nació para transcribir
la consigna de una tarea. Un predicador no tiene consigna: tiene un pasaje, una
congregación y una fecha. Pedirle que «pegue las preguntas del trabajo» ante un
campo vacío es pedirle que invente el género antes de usarlo.

Y hay un segundo obstáculo, reportado en vivo: *«me es difícil completar el
encuadre, sobre todo la parte de fuentes y formatos»*. Esa parte del encuadre no
es criterio del autor —es un inventario de lo que ya está en el corpus y de lo
que la rúbrica ya decidió— y sin embargo se le pedía escribirlo a mano.

## Decisión

**Una segunda rúbrica de primera clase, `PREACHING_STUDY_RUBRIC`**, no un
descuento de la académica:

- `expectedLength: { unit: 'pages', min: 3, max: 5 }`
- `formatting: { lineSpacing: 'single', citationForm: 'parenthetical',
  blankLineBetweenParagraphs: true }`
- ancla del versículo: `commentary-expository`
- corpus mínimo: un comentario expositivo y una voz crítica

**Una plantilla de encuadre que se carga con las preguntas ya redactadas**
(`PREACHING_BRIEF_TEMPLATE`, cinco bloques). El autor edita en vez de inventar.
`briefGaps` distingue tres estados que antes se veían iguales: vacío, plantilla
sin llenar (`CORCHETE_DE_PLANTILLA`), y sin claves de búsqueda.

**El bloque de «fuentes y formato» lo escribe el sistema**
(`buildSourcesAndFormatBlock`), porque su contenido ya vive en el corpus y en la
rúbrica. Lista deliberadamente sólo las fuentes que transliteran, no las que
perdieron la lengua original: un libro que escribe `wayyēra rāʻâ gedôlâ` en vez
de hebreo apuntado no está roto, y nombrarlo junto a los que sí perdieron el
texto reintroduce el falso positivo que el PR #704 había cerrado (dos de ocho
fuentes acusadas de extracción rota cuando sólo transliteraban).

## Alternativas consideradas

**Parametrizar la rúbrica académica con un «modo corto».** Es lo que parecía
barato y es lo que produce el formulario vacío: la extensión no es la
diferencia, el ancla sí. Una rúbrica que pide edición crítica como lectura base
no se arregla recortándole páginas.

**Dejar el encuadre libre y confiar en el autor.** Es lo que había. Seis de seis
vacíos.

**Generar el encuadre entero con el modelo.** Se descartó: las preguntas del
encuadre son el aporte del predicador, y son lo que hace que el estudio conteste
algo suyo en vez de recitar el pasaje. La plantilla ofrece la FORMA; el
contenido lo pone él.

## Consecuencias

- Hay dos rúbricas y habrá más. `preachingStudyRubric.ts` queda como el ejemplo
  de cómo se declara una: entidad propia, no un flag sobre la existente.
- El autor que venía trabajando con la rúbrica académica no se ve afectado; la
  elección es explícita.
- La plantilla puede envejecer respecto de lo que el planificador sabe hacer.
  `briefGaps` avisa cuando quedó sin llenar, que es el modo de falla que
  importa.

## Impacto

`preachingStudyRubric.ts`, `preachingBriefTemplate.ts`, `sourcesAndFormatBlock.ts`
en dominio, más la selección de rúbrica en la interfaz de configuración.

## Referencias

- PR #705 — rúbrica y plantilla.
- PR #706 — la rúbrica se puede elegir.
- PR #707 — el bloque de fuentes y formato lo escribe el sistema.
