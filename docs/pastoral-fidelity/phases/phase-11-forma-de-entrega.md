# Phase 11 — La forma de entrega: un estudio, muchos entregables

> Estado: propuesta. Sale del primer trabajo compuesto de punta a punta por el sistema
> (Santiago 2:1–13, 2026-09-24), que pidió 2–3 páginas y produjo 16.

## El caso

| | |
|---|---|
| La rúbrica pedía | 2–3 páginas |
| El trabajo ensamblado trajo | 6.529 palabras |
| Tres pasos aceptados produjeron | 7.308 palabras — ~2.400 por versículo |
| El presupuesto real por versículo era | ~150 palabras |

Unas **ocho veces** por encima. Y el formato no tiene la culpa: el espacio simple recién
incorporado ya estaba funcionando —por eso salieron 16 páginas y no 26—. Lo que sobra es
volumen, no maquetación.

## Por qué, medido contra el código

1. **El presupuesto no llega a quien escribe.** `expectedLength` sólo lo conoce
   `composerPrompts.ts`, el compositor del trabajo entero. Los tres compositores por partes
   —versículo, introducción, conclusión— tienen **cero** menciones. Componiendo por partes,
   que es el camino normal, ningún compositor se entera de que hay un límite.

2. **La cuenta correcta ya existe y no sale de la pantalla.** `wordsPerVerseTarget` hace
   exactamente la aritmética —páginas × 300 × 0,8 ÷ versículos— y su único llamador es
   `ExegesisPaperPage`, donde aparece como sugerencia en el diálogo de recomposición. Nunca
   entra a un prompt.

3. **La tarjeta de extensión mide después y no bloquea.** Avisa cuando ya está escrito.

## Lo que este documento propone, y lo que NO

**NO propone parametrizar la exportación.** Ningún parámetro de formato convierte 22 páginas
en 3: produce 22 páginas en letra más chica. La compresión no es un problema de maquetación.

Propone separar dos cosas que hoy están pegadas:

- El **estudio** — los análisis canónicos, sus citas verificadas, el griego, los comentaristas.
  Es la materia prima y tiene su propio rigor.
- El **entregable** — una selección y reorganización de ese estudio, con una forma declarada.

El mismo estudio de Santiago 2:1–13 debe poder rendir:

| Entregable | Forma | Presupuesto |
|---|---|---|
| Trabajo práctico semanal | 4 secciones, una por pregunta, cruzando los versículos que haga falta | ~400 palabras cada una |
| Trabajo exegético largo | introducción + versículo por versículo + conclusión | 15–25 páginas |
| Ensayo | tesis + desarrollo + cierre, sin aparato visible | 1.500–3.000 palabras |
| Artículo de blog | gancho + dos o tres ideas + aplicación | 800–1.200 palabras |
| Sermón, devocional, guía de estudio | las tres formas que ya existen | según la forma |

## El problema de escala, medido

Hoy cada tipo de salida es CÓDIGO, no dato. El sermón cuesta un puerto
(`ISermonComposer`), una clase de caso de uso (`ComposeSermonFromAnalysesUseCase`), un
compositor de infraestructura (`GeminiSermonComposer`), su cableado en `ExegesisService`, un
hook de web y una entrada de interfaz. El devocional y la guía de estudio repiten el patrón
entero.

Agregar «ensayo» y «artículo de blog» con el diseño actual significa repetirlo dos veces más.
Eso no escala, y el síntoma se ve en el propio repositorio: tres interfaces casi idénticas en
un mismo archivo de 178 líneas.

**Criterio de aceptación falsable de esta fase:** agregar «artículo de blog» no debe requerir
una interfaz nueva, una clase nueva ni una pasada de cableado. Si las requiere, el diseño
falló.

## La pieza: `FormaDeEntrega`

Un dato, no una clase. Declara:

```
id, displayName
register        — academic | pastoral | divulgative   (gobierna el tono, no el contenido)
totalBudget     — palabras o páginas, de donde se derivan las de cada sección
citationPolicy  — footnote | parenthetical | none      (ya vive en PaperRubric.formatting)
sections[]      — en orden:
    title           — el rótulo, o la pregunta misma cuando la forma sale del encuadre
    answers         — qué tiene que responder esta sección
    feeds           — qué material del estudio la alimenta (qué versículos, qué bloques
                      del análisis: sintaxis, léxico, comentaristas, cruces textuales)
    budget          — palabras, derivadas del total
```

Un **único** caso de uso compone una sección a partir de su declaración y del estudio. Los
tres compositores de ministerio que ya existen pasan a ser tres formas declaradas; no se
borran en esta fase (ver «Migración»).

## De dónde sale la forma, por orden de fiabilidad

1. **Las preguntas del encuadre, cuando las hay.** Es la fuente más fiable y la que el caso
   testigo tenía delante: el profesor formuló cuatro preguntas numeradas y el sistema compuso
   por versículo. Una pregunta ES una sección, con su título y con lo que debe responder.
2. **Un trabajo modelo.** El sistema YA ingiere uno: existe el tipo de fuente `model-paper`,
   mapeado a `style-template-paper`, y hoy se usa sólo como referencia de estilo. Leerle la
   estructura —cuántas secciones, cómo se titulan, cuánto mide cada una— reutiliza máquina
   construida: el extractor de rúbricas ya convierte un sílabo en estructura.
3. **Una plantilla guardada,** como las plantillas de rúbrica y de encuadre que ya existen.
4. **Presets de la casa** para las formas conocidas.

Derivar la forma de UN ejemplo es frágil, y por eso va segundo: cuando el encuadre trae
preguntas, las preguntas mandan y el modelo sólo rellena lo que el encuadre calla.

## El presupuesto deja de ser un aviso y pasa a ser una instrucción

Cada sección lleva el suyo, derivado del total. El compositor lo recibe en el prompt y la
tarjeta de extensión pasa a comprobar lo que se pidió en vez de descubrirlo al final.

Esto es lo que cierra el 8× de forma estructural. La versión táctica —enchufar
`wordsPerVerseTarget` a los tres compositores actuales— se hace ANTES y por separado, porque
no necesita ninguno de los conceptos de esta fase y el costo medido ya está sobre la mesa.

## Dependencias y riesgos

- **Depende de la fase 9.** Una sección que responde «¿qué relación tiene ἐάν con el v. 4?»
  necesita material que hoy vive en dos análisis que no se ven entre sí.
- **Migración, no reescritura.** Sermón, devocional y guía de estudio funcionan. La fase AGREGA
  el mecanismo y migra después; reemplazarlos primero pondría en riesgo lo que ya sirve.
- **El registro no es el contenido.** `divulgative` cambia el tono, no la exigencia de que toda
  afirmación siga anclada a una fuente verificada. Un artículo de blog sin aparato visible
  sigue siendo un artículo que no inventa.
