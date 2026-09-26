# Phase 8 — La máquina pregunta según el tipo de fuente

## Estado

`shipped` en sus dos etapas (PRs #693 y #694). Queda un pendiente que NO es de
búsqueda: ver «Metzger: el problema es la extracción» al final.

Nació como `planned`. Sale del segundo uso real del módulo, el trabajo práctico semanal de griego
(Santiago 2:1–13, 2026-09-23), y se hace **inmediatamente después** de cerrar ese trabajo.

## El problema, medido

Al armar el corpus de Santiago 2:1–13, tres de las siete fuentes quedaron en **0 fragmentos**
y por lo tanto no aportan nada a la generación. El sistema lo avisa —«Esta fuente no tiene
fragmentos seleccionados — no contribuirá a la generación»— pero no dice por qué, y el porqué
es el mismo en los tres casos:

| Fuente | Tipo | Fragmentos | Por qué |
|---|---|---|---|
| Porter, *Idioms of the Greek NT* | Gramática / sintaxis | 0 | No habla de Santiago 2. Habla de partículas y participios. |
| Léxico Griego-Español | Léxico técnico | 0 | No habla de pasajes. Habla de palabras, en orden alfabético. |
| Metzger, *Textual Commentary* | Comentario textual | 0 | Sí habla de Santiago, pero la consulta no lo alcanzó. |

A las tres hubo que ponerles los tramos de hojas **a mano** para que aportaran algo —Metzger
10 tramos, el Léxico 2, Porter 4—, y ese trabajo manual es exactamente el que esta fase
retira.

`RetrieveChunksExcerptExtractor` arma **una sola consulta de embeddings** con la referencia
del pasaje más un trozo del encuadre, y se la hace a todos los libros por igual. A un
comentario verso por verso esa es la pregunta correcta: Mayor devolvió 30 fragmentos y
Adamson 11. A una gramática temática es la pregunta equivocada, y el cero que devuelve es
correcto: Porter no tiene nada que decir sobre «Santiago 2:1–13» porque su índice no está
organizado así.

**La forma del libro decide la forma de la búsqueda, y hoy el sistema hace siempre la misma.**

## El hallazgo que cambia el diseño: el índice YA ESTÁ, y se tira

Medido sobre el propio ejemplar de Porter, al abrir «Ajustar páginas»:

- **329 de sus 332 hojas tienen sección nombrada**, con **465 secciones distintas**
  (medido sobre `document_chunks.metadata.section` el 2026-09-23).
- Y las secciones SON las categorías que el trabajo necesita:

```
2.2. Independent Participle            2.19. μέν (Conjunction, Adversative…)
2.3. Commanding Participle             2.23. νῦν (Particle, Inferential)
4.1. Time and the Participle           2.28. οὖν (Conjunction, Inferential…)
4.2. Subsequent Use of the Aorist…     2.4.6. Subjective genitive.
10. Participles                        1. Classification of Conditional Clauses
```

El libro está perfectamente estructurado, y el camino estructural **no lo descarta por falta
de encabezados**: `outlineStructureQuality` solo mide `headingCount >= 2`, que Porter cumple
con holgura. Lo descarta el paso siguiente. `selectChunksForPassage` busca en el esquema los
encabezados cuya REFERENCIA BÍBLICA solapa el pasaje; los títulos de Porter nombran
categorías gramaticales y no referencias, así que la selección vuelve con
`chunkCount === 0`, y tanto `StructuralExcerptExtractor` como `SheetRangeProposer` caen al
camino semántico tirando las 465 secciones. Nadie pregunta lo otro: si los encabezados
nombran CATEGORÍAS.

Así que el problema no es que la recuperación semántica sea mala. Es que hay un índice
perfecto en la base de datos y el sistema no lo mira porque no está en el formato que
esperaba.

### Lo que costó, medido

La sugerencia semántica para Santiago 2:1–13 propuso **11 tramos, 46 hojas, 103 % del
presupuesto del trabajo**. Contra las cuatro preguntas del trabajo práctico:

| Pregunta | Dónde vive en Porter | ¿La sugerencia la trajo? |
|---|---|---|
| Función de los genitivos | hojas 88–98 | sí |
| Función de `ἐάν` (condicional de 3.ª clase) | hojas 254–257, 261–263 | **no, ninguna** |
| Significado de `μέντοι` | hojas 211–215 | sí |
| Función del participio | hojas 184–193 | parcial (190–192) |

Ocho de los once tramos no servían a ninguna pregunta —entraron porque Porter cita
versículos de Santiago como ejemplo en otras secciones, como Jas. 5:2–3 en la hoja 41— y
el tramo que contesta la pregunta 2 no entró. Con el índice de secciones delante, los
cuatro tramos salen exactos y suman 33 hojas en vez de 46.

## Defecto menor del mismo camino: el rótulo del tramo miente

En el carrito, un tramo se rotula con la sección de su PRIMERA hoja. El tramo 184–193 —la
sección de participios— aparece como «2.1. Genitive Absolute», que es la sección que
termina justo antes; el 88–98 aparece como «2.2. The Vocative Case» cuando adentro está
«2.4.6. Subjective genitive». El rótulo debería nombrar la sección que domina el tramo, o
las secciones que cubre.

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

| Tipo de fuente | Qué se le pregunta | Contra qué |
|---|---|---|
| Comentario (crítico, expositivo, textual) | El pasaje, como hoy | Los encabezados por referencia |
| Gramática / sintaxis | Las categorías que el análisis nombró: genitivo de aposición, participio adverbial, condicional de tercera clase, la partícula concreta | **Los títulos de sección**, que ya están indexados |
| Léxico técnico | Los lemas del pasaje, uno por uno | El título de sección o el texto |
| Aparato crítico | El versículo | Los encabezados por referencia |
| Diccionario teológico | Los lemas de peso teológico | Los títulos de sección |

La columna de la derecha es la parte que faltaba en la primera versión de este documento:
para una gramática **no hace falta buscar en el texto**. Basta cotejar las categorías del
análisis contra los títulos de sección, que son pocos, están estructurados y son
exactamente el vocabulario que el análisis produce.

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
