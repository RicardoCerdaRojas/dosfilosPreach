# Phase 8 — La máquina pregunta según el tipo de fuente

## Estado

`planned`. Sale del segundo uso real del módulo, el trabajo práctico semanal de griego
(Santiago 2:1–13, 2026-09-23), y se hace **inmediatamente después** de cerrar ese trabajo.

## El problema, medido

Al armar el corpus de Santiago 2:1–13, tres de las seis fuentes quedaron en **0 fragmentos**
y por lo tanto no aportan nada a la generación. El sistema lo avisa —«Esta fuente no tiene
fragmentos seleccionados — no contribuirá a la generación»— pero no dice por qué, y el porqué
es el mismo en los tres casos:

| Fuente | Tipo | Fragmentos | Por qué |
|---|---|---|---|
| Porter, *Idioms of the Greek NT* | Gramática / sintaxis | 0 | No habla de Santiago 2. Habla de partículas y participios. |
| Léxico Griego-Español | Léxico técnico | 0 | No habla de pasajes. Habla de palabras, en orden alfabético. |
| Metzger, *Textual Commentary* | Comentario textual | 0 | Sí habla de Santiago, pero la consulta no lo alcanzó. |

`RetrieveChunksExcerptExtractor` arma **una sola consulta de embeddings** con la referencia
del pasaje más un trozo del encuadre, y se la hace a todos los libros por igual. A un
comentario verso por verso esa es la pregunta correcta: Mayor devolvió 30 fragmentos y
Adamson 11. A una gramática temática es la pregunta equivocada, y el cero que devuelve es
correcto: Porter no tiene nada que decir sobre «Santiago 2:1–13» porque su índice no está
organizado así.

**La forma del libro decide la forma de la búsqueda, y hoy el sistema hace siempre la misma.**

## Lo que ya existe y no está donde hace falta

Las dos piezas están construidas y viven en habitaciones equivocadas:

- **Búsqueda de texto dentro de un libro** (`searchDocumentText`, con modo `texto` y modo
  `lema`): solo se alcanza desde `CitationSourceModal`, o sea en la revisión de citas, al
  FINAL del proceso. Cuando el corpus ya está armado y generado.
- **Propuesta de páginas por lema** (`LemmaPagesPanel`, en `ExegesisSourcePagesPage`): vive en
  «Ajustar páginas», que es el sitio correcto, pero está condicionada a `esLexico` —las
  gramáticas no la reciben— y se alimenta de los lemas del análisis canónico, que todavía no
  corrió cuando uno arma el corpus.

Y el dato que falta tampoco hay que inventarlo. Cada fuente ya declara su tipo en el corpus
(«Comentario crítico-técnico», «Gramática / sintaxis», «Léxico técnico», «Aparato crítico»), y
el análisis canónico ya produce, por versículo, las construcciones con su `syntacticFunction`,
las `discourseParticles` y los `lexicalAnalyses` con sus lemas. Esa es la llave de búsqueda.
El sistema la calcula y después no la usa para ir a buscar páginas.

## Qué se construye

**La consulta se arma según el tipo de la fuente**, no según el pasaje a secas:

| Tipo de fuente | Qué se le pregunta |
|---|---|
| Comentario (crítico, expositivo, textual) | El pasaje, como hoy |
| Gramática / sintaxis | Las categorías que el análisis nombró: genitivo de aposición, participio adverbial, condicional de tercera clase, la partícula concreta |
| Léxico técnico | Los lemas del pasaje, uno por uno |
| Aparato crítico | El versículo |
| Diccionario teológico | Los lemas de peso teológico |

Y cuando la consulta devuelve cero, el aviso deja de ser un cuadro amarillo mudo: dice que
este libro no está organizado por pasajes y ofrece el camino —«Ajustar páginas»— con las
categorías o los lemas ya propuestos como puntos de entrada.

## El orden importa

Hay un problema de secuencia que hay que resolver de frente: las categorías y los lemas salen
del análisis canónico, que corre DESPUÉS de armar el corpus. Dos salidas posibles, y la
decisión es del fundador:

1. **Un análisis ligero al armar el corpus** que nombre las construcciones y los lemas del
   pasaje sin redactar prosa, solo para alimentar la búsqueda.
2. **Corpus en dos tiempos**: los comentarios entran al armar; las gramáticas y los léxicos se
   completan solos cuando el primer verso termina su análisis.

La segunda es más barata y más honesta con lo que el sistema sabe en cada momento; la primera
le da al usuario todo el corpus antes de generar, que es lo que la pantalla promete hoy.

## Cómo se mide

Sobre el propio corpus de Santiago 2:1–13, que es el caso testigo:

- Porter devuelve fragmentos para «μέντοι» y «participio adverbial» (medido a mano: hojas
  213–214 y 185, 187, 330, 331).
- El Léxico devuelve la entrada `3305 μέντοι` (hoja 586), que lista Stg. 2:8 entre las ocho
  apariciones de la partícula en el NT, y la combinación `εἰ μέντοι` (hoja 272), que cita Stg.
  2:8 como ejemplo.
- Ninguna fuente del corpus queda en 0 fragmentos sin una explicación en pantalla.

La vara real: **que el fundador no necesite pedirle a nadie que le busque las páginas**. Hoy
esas seis hojas salieron de consultar la base de datos por fuera del producto.

## Por qué esto no es una mejora de recuperación

Es la diferencia entre una herramienta y una máquina. La herramienta espera la pregunta
correcta; la máquina sabe qué preguntarle a cada libro. El usuario tiene que quedarse con lo
que es suyo —decidir qué lectura gana y por qué, que es lo que el profesor califica— y no con
adivinar que a una gramática temática no se le pregunta por un versículo.

## Bitácora

- **2026-09-23** — Documentada durante el armado del trabajo práctico de Santiago 2:1–13,
  después de que tres fuentes seguidas quedaran en 0 fragmentos.
