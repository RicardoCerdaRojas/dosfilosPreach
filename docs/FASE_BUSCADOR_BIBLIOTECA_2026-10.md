# Fase: un buscador de la biblioteca que encuentre lo pertinente · octubre 2026

> **Estado: APROBADA (2026-10-16).** El fundador aprobó el plan; el reordenador es Luna, con Gemini 3.8 Flash como alternativa en el ruteo.

**Qué resuelve.** El fundador probó «Buscar temas» con «la oración por los enfermos» (2026-10-15). Recibió muchas citas, pero varias no tenían que ver con el tema: el «héroe sufriente» griego del Kittel, oraciones de MacArthur, la liturgia de los Salmos en Craigie y tablas latinas de Mayor sobre el juramento. Pidió revisar la evidencia, investigar cómo aprovechar mejor la biblioteca y pensar una arquitectura robusta y escalable.

## La evidencia (medida el 2026-10-15/16)

**Cómo busca hoy** (leído en el código):

- El vector de cada fragmento se arma con su **texto crudo**. No lleva el libro, la sección ni el contexto, y no se usa el parámetro `title` del modelo de embeddings.
- El vector se recorta a **768 dimensiones** (de 3.072), por el tope de Firestore.
- Se busca **sólo por similitud de vectores**. No hay búsqueda por palabras ni un segundo paso que reordene.

**Los puntajes no distinguen nada.** En «la oración por los enfermos», del 1.º al 30.º resultado el puntaje va de 0,858 a 0,839. En las 10 búsquedas del banco, la diferencia entre el 1.º y el 10.º va de **0,008 a 0,038**. Para el vector, un fragmento que trata el tema y uno que sólo comparte una palabra están «igual de cerca». Con esa diferencia tampoco se puede poner un umbral de corte.

**El buscador mezcla dos temas sueltos.** «Oración por los enfermos» trae lo que habla de la oración en general y lo que habla de la enfermedad en general. No exige que estén las dos cosas.

**Calidad de los fragmentos.** Sobre los 51.445 fragmentos de la biblioteca del fundador:

| Problema | Fragmentos |
|---|---|
| Traen marcas de bloque de código («```python»); 968 son de Mayor, que quedó envuelto entero al extraerlo | 1.026 |
| Tablas casi sin prosa | 934 |
| Muy cortos (menos de 150 caracteres) | 2.236 |

**El material está; lo que falla es encontrarlo.** En los primeros 40 candidatos de cada búsqueda hay entre **19 y 46 fragmentos que tratan directamente el tema**.

## El banco de evaluación

Son 10 búsquedas reales de la biblioteca: la oración por los enfermos, la sabiduría de lo alto, el juramento, la fe sin obras, la lengua como fuego, los ricos que oprimen, Jonás huye a Tarsis, las ilustraciones en el sermón, el waw consecutivo y Elías y la lluvia.

El juez es **Luna**, de otro proveedor que el reordenador Gemini. Califica cada resultado con 2 (trata el tema), 1 (lo toca de paso) o 0 (no lo trata).

En la tabla, **P@10** es la proporción de los 10 primeros resultados que tratan el tema. Es lo que el pastor ve primero.

| Método | P@10 (trata el tema) | P@10 (al menos de paso) | Tiempo |
|---|---|---|---|
| **Hoy:** sólo vectores | **0,59** | 0,95 | ~2 s |
| Reescribir la búsqueda (Luna: inglés, pasaje, términos griegos) | 0,76 | 0,97 | +1 llamada |
| Vector con libro y sección (Gemini, dentro del pozo) | 0,63 | 0,93 | reindexar |
| Vector de OpenAI `text-embedding-3-large` (dentro del pozo) | 0,46 | 0,81 | reindexar |
| **Reordenar los 40 primeros con Luna** | **0,87** | 1,00 | **~4,3 s** |
| Reordenar con Gemini 3.8 Flash (razonamiento por defecto) | 0,95 | 1,00 | 19–35 s |
| **Reordenar con Gemini 3.8 Flash (razonamiento bajo)** | **0,93** | — | **~6,4 s** (mediana) |
| Reescribir y después reordenar con Luna | 0,84 | 1,00 | +1 llamada |

**Conclusiones (medidas):**

1. **Lo que más mejora es reordenar.** Leer los 40 candidatos y quedarse con los que tratan el tema sube la precisión de 0,59 a 0,87–0,93.
2. **Reescribir la búsqueda ayuda sin reordenar (0,76), pero no suma después de reordenar (0,84 contra 0,87).** No se justifica la llamada extra.
3. **Cambiar el modelo de embeddings a OpenAI empeora (0,46).** No se cambia de proveedor de embeddings.
4. **Agregar libro y sección al vector mejora poco (0,63)** y obliga a reindexar todo. Queda para cuando haya que reindexar por otra razón (ver la etapa 3).

**Costo de reordenar una búsqueda** (40 fragmentos, ~10.500 tokens de entrada; estimado con los precios de `llmCost.ts`):

| Reordenador | Costo por búsqueda | Nota |
|---|---|---|
| Luna | ~US$0,0014 | |
| Gemini 3.8 Flash (razonamiento bajo) | ~US$0,012 | el doble desde 2027-01-01 |

**Límite del banco.** Son 10 búsquedas, con un juez automático. El fundador revisó a mano sólo una. Las cifras sirven para comparar métodos entre sí; no son la precisión absoluta.

## La arquitectura propuesta

Es un buscador en etapas. Cada etapa mejora lo que entrega la anterior, y todas se pueden medir con el banco.

```
consulta
  │
  ├─ 1. Candidatos (barato, amplio)
  │     vectores por userId (Firestore findNearest), 40–60 por búsqueda
  │     + fragmentos que citan el pasaje, si la consulta nombra uno (índice de referencias, etapa 3)
  │     → se mezclan por posición (RRF)
  │
  ├─ 2. Reordenar (preciso)
  │     Luna lee los candidatos y puntúa 0–10 cuán directamente tratan el tema
  │     ruta propia en config/llmRouting (`library.rerank`): se cambia a Gemini 3.8 Flash sin deploy
  │     si el reordenador falla: queda el orden de los vectores (degrada, no rompe)
  │
  ├─ 3. Cortar
  │     sólo lo que pasa un umbral (calibrado con el banco) y a lo sumo N por libro
  │
  └─ 4. Usar
        «Buscar temas»: muestra lo que pasó el corte, agrupado por libro
        «Preguntar» y «Preguntar a este libro»: el asistente recibe los mejores 14 ya reordenados
        (y después: el trabajo exegético, el sermón y Facultad, que hoy usan retrieveChunks)
```

**Por qué escala:**

- **Los candidatos** siguen en Firestore, con el índice vectorial que ya existe (`userId`, `embedding`). Cada búsqueda lee 40–60 documentos, así que el costo no crece con el tamaño de la biblioteca. La biblioteca común del sistema entra por el filtro `stores`, que también ya está indexado.
- **Reordenar** cuesta lo mismo con 50 o con 5.000 libros: siempre son 40 candidatos. Se puede cambiar de modelo, por ejemplo al Ranking API de Vertex AI (~US$1 cada 1.000 registros, menos de 100 ms), sin tocar el resto.
- **El banco queda en el repo** (`scripts/rag-eval/`), con sus juicios guardados. Cada cambio del buscador se mide antes de entrar, como ya se hace con los modelos.

## Cómo se entrega (tres etapas)

### Etapa 1: reordenar (un PR)

Es lo que más mejora (medido).

- **R1. Reordenar con Luna**, con ruta `library.rerank` y respaldo sin reordenar.
  - **Medido con el pedido de producción** (`scripts/rag-eval/evaluar.ts`, 2026-10-16, ya con la salida en esquema estricto): la proporción de los 10 primeros que tratan el tema sube de **0,59 a 0,93**. Luna tarda ~2,9–3,6 s por búsqueda.
  - **Umbral calibrado: ≥ 7.**

    | Umbral | Resultados por búsqueda | Tratan el tema | Pertinentes que quedan afuera |
    |---|---|---|---|
    | ≥ 6 | ~23 | 79 % | ~2,2 |
    | **≥ 7** | **~21** | **81 %** | **~3,3** |
    | ≥ 8 | ~17 | 86 % | ~5,5 |

    Se eligió ≥ 7 porque el fundador pidió menos resultados que no tienen que ver con el tema.
  - **Revisión adversarial.** Se corrigieron estos puntos:
    - el reordenador no cae al respaldo caro (Gemini 2.5 Pro) y tiene un plazo duro: si falla, sigue el orden de los vectores;
    - la salida va en esquema estricto, con un tope de 1.500 tokens y un reintento. Una vez Luna se desbocó hasta el tope de 6.000;
    - con varios libros elegidos, cada libro tiene un mínimo de candidatos, para que uno denso no tape a los demás;
    - en un seguimiento («¿y el aceite?»), la pregunta anterior va como contexto y no como lo buscado;
    - un renglón del libro que imite la cabecera de un candidato no pasa por otro candidato;
    - el banco registra su consumo como `library.rerank.eval`.
  - **Deploy.** Cargar la ruta `library.rerank` en `config/llmRouting` **antes** de desplegar functions. Sin ella, el reordenador caería a Sonnet.
- **R2. «Buscar temas» y «Consultar»** usan el reordenador. «Buscar temas» muestra sólo lo que pasa el corte, y su texto de ayuda deja de decir «no redacta respuesta ni cuenta como consulta» si empieza a costar algo.
- **R3. El banco en el repo.** El script, las 10 búsquedas, los juicios y un comando para comparar.

### Etapa 2: limpiar los fragmentos (otro PR)

- **Mayor:** reextraer o limpiar las marcas «```python» (968 fragmentos).
- **Al indexar:** quitar marcas de código, y no indexar tablas sin prosa ni fragmentos de menos de 150 caracteres que no sean de un léxico.

### Etapa 3: índice de pasajes (un PR, sin reindexar)

**Lo que se hizo (2026-10-16).** Cada fragmento guarda los pasajes bíblicos que nombra, como claves `JAS.5` y `JAS.5.14`. Las claves salen de su texto y del encabezado de su sección: «Santiago 5:13-18» rige todo lo que cuelga de él. Una búsqueda que nombra un pasaje («Santiago 5:14», «santiago 5:14-15 aceite») suma hasta 16 fragmentos que lo citan, y el reordenador los puntúa igual que al resto (40 + 8 candidatos como mucho).

- **El reconocedor** (`functions/src/library/pasajes/`) usa una copia del canon del dominio, con prueba de paridad. A esa copia le suma las abreviaturas de los comentarios que el dominio no tiene («Matt», «Exod», «Pss», «Mr», «I Co»). No van en el dominio porque allí también se infiere el libro por las palabras del título de una obra.
  - Reconoce grafías en español y en inglés, rangos de versículos y de capítulos («5:14-16», «Mateo 5-7», «1:18-3:20») y listas («Ac 7.12; 8.40», «Rom 2:6, 12»).
  - En los libros de un solo capítulo, la cifra es el versículo: «Judas 4».
  - En la prosa exige mayúscula inicial («the time is 5:30» no es Isaías), y una cita no cruza de renglón.
  - **El encabezado da el contexto.** Con «Santiago 5» › «vv. 13-18», o con «Romans» › «8:28-30», el «v. 14» y el «1:17» sueltos del texto se leen como de ese libro. Antes se tapan las citas que ya tienen libro, para que el «5:14» de «Rom 5:14» siga siendo Romanos. Un encabezado que sólo nombra el libro («Numbers», en una gramática) no basta para leer las cifras del texto.
- **Revisado a mano** sobre 8.000 fragmentos reales (617 grafías distintas): los errores son raros, como «W. J., Jr. 14» o un índice «Calvin, John 2.3.1d».
- **Lo que los vectores no ven (medido, biblioteca del fundador, 54.170 fragmentos):**

| Búsqueda | Fragmentos que citan el pasaje | De ellos, entre los 40 de los vectores |
|---|---|---|
| Santiago 5:14 | 94 | 9 |
| la unción con aceite en Santiago 5:14-15 | 117 | 18 |
| Salmo 23:4 | 26 | 5 |
| Juan 3:16 | 135 | 20 |
| Génesis 2:17 | 34 | 5 |
| Jonás 4:6 | 72 | 4 |
| Santiago 3:6 la lengua es un fuego | 83 | 11 |
| Santiago 2:14-26 fe y obras | 293 | 17 |

- **Sin reindexar.** El indexador escribe `refs` en los fragmentos nuevos sin cambiar `indexerVersion`. Los 93.852 existentes se completan con `scripts/rellenar-refs.ts`, que no vuelve a calcular los vectores. Es idempotente y cuesta unos US$0,17 en escrituras. El 62 % de los fragmentos nombra algún pasaje: 806.000 claves, 8,6 por fragmento.
- **La lectura va libro por libro** (12 fragmentos por libro), con el índice (resourceId, userId, refs). Un `limit` sobre toda la biblioteca devolvía en orden de id, y llenaba el tope con los libros que van primero en el abecedario. El índice de campo único de `refs` está apagado: no se usa, y sus entradas cuentan para el tamaño de las tandas del indexador. Si una tanda de 500 resulta demasiado grande, se parte en dos.
- **Una búsqueda con versículo también pide su capítulo.** El versículo pesa 2 y el capítulo 1.
- **Sin reordenador** (si falla), manda el orden de los vectores y los fragmentos del pasaje van detrás, porque nadie los juzgó.
- Mientras el índice se construye, o si falta el relleno, la búsqueda por pasaje devuelve vacío y queda la de vectores.

**El vector con contexto se pospone.** Agregar libro, autor y sección al vector dio 0,63 contra 0,59 dentro del mismo pozo de candidatos. No justifica reindexar toda la biblioteca (~US$5 estimados, sin medir) mientras el reordenador ya lleva la precisión a 0,93. Se hace cuando haya que reindexar por otra razón.

## Fuera de esta fase

- **Búsqueda por palabras (BM25).** El texto completo de Firestore está en vista previa. Los términos exactos que importan (pasajes, griego, hebreo) los cubre el índice de pasajes de la etapa 3. Se mide después si hace falta.
- **Cambiar de proveedor de embeddings.** Medido, empeora.
