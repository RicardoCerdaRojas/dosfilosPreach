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
  - **Medido con el pedido de producción** (`scripts/rag-eval/evaluar.ts`, 2026-10-16): la proporción de los 10 primeros que trata el tema sube de 0,59 a 0,88. Luna tarda ~3–4,6 s por búsqueda.
  - **Umbral calibrado: ≥ 7.**

    | Umbral | Resultados por búsqueda | Tratan el tema | Pertinentes que quedan afuera |
    |---|---|---|---|
    | ≥ 6 | ~22 | 81 % | ~2,5 |
    | **≥ 7** | **~20** | **84 %** | **~3,5 de ~20** |
    | ≥ 8 | ~16 | 87 % | ~6 |

  - **Se eligió ≥ 7** porque el fundador pidió menos resultados que no tienen que ver con el tema.
  - **En «la oración por los enfermos»** el juez acepta 6 de los 10 primeros. Tres de los otros son el propio texto de Santiago 5:14 (traducción, diagrama, cita), que el juez calificó «de paso». El cuarto es una tabla latina de Mayor, ruido que se ataca en la etapa 2.
- **R2. «Buscar temas» y «Consultar»** usan el reordenador. «Buscar temas» muestra sólo lo que pasa el corte, y su texto de ayuda deja de decir «no redacta respuesta ni cuenta como consulta» si empieza a costar algo.
- **R3. El banco en el repo.** El script, las 10 búsquedas, los juicios y un comando para comparar.

### Etapa 2: limpiar los fragmentos (otro PR)

- **Mayor:** reextraer o limpiar las marcas «```python» (968 fragmentos).
- **Al indexar:** quitar marcas de código, y no indexar tablas sin prosa ni fragmentos de menos de 150 caracteres que no sean de un léxico.

### Etapa 3: índice de pasajes y vector con contexto (otro PR, con reindexado)

- **Al indexar,** cada fragmento guarda los pasajes bíblicos que cita (`refs: ['JAS 5:14', …]`), con las expresiones del modo «referencia» que ya existen. Una consulta que nombra un pasaje trae también esos fragmentos. Esto es la base de la etapa 2 de la biblioteca consultable («¿Qué dicen mis libros sobre Santiago 3:13?»).
- **El vector se arma con libro, autor y sección,** más el `title` del modelo.
- **Reindexado versionado** (`indexerVersion` 3.0), libro por libro. Costo estimado: ~US$5 en embeddings para los 51.000 fragmentos, sin medir. Se avisa antes porque Gemini es prepago.

## Fuera de esta fase

- **Búsqueda por palabras (BM25).** El texto completo de Firestore está en vista previa. Los términos exactos que importan (pasajes, griego, hebreo) los cubre el índice de pasajes de la etapa 3. Se mide después si hace falta.
- **Cambiar de proveedor de embeddings.** Medido, empeora.
