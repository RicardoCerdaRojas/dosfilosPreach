# Banco del corpus

Mide si el sistema propone las hojas de cada libro que un trabajo terminado **citó de verdad**.
Es la medición 0a de la fase «Asistente del corpus» (`docs/FASE_ASISTENTE_CORPUS_ETAPA0_2026-11.md` §7)
convertida en prueba de regresión: toda mejora de las rutas de hojas se mide aquí antes de desplegarse
(diseño §4, principio D7).

## Casos

| Archivo | Trabajo | Conjunto |
|---|---|---|
| `tp11-stg5-7.json` | TP #11, Santiago 5:7–11 | desarrollo |
| `tp12-stg5-12.json` | TP #12, Santiago 5:12–20 | desarrollo |
| `ti-stg3-1.json` | Trabajo de investigación, Santiago 3:1–5a | desarrollo |
| `tp7-stg3-13.json` … `tp10-stg5-1.json` | TP #7–#10 | prueba |
| `ti3-sal23-1.json` | TI #3, Salmo 23:1–6 (hebreo) | prueba |

- **Desarrollo** se mira al mejorar las rutas. **Prueba** solo se mide: nunca se ajusta una ruta mirando sus
  pérdidas, para que la cifra no se infle.
- Cada caso guarda **solo referencias**: ids de recurso, tipo de fuente, etiqueta de página, hoja del PDF y
  pregunta. **Ningún texto de libros** entra al repositorio (procedimiento §3).
- La verdad se congeló el 2026-11-20 desde los respaldos y los Word entregados (campo `origen` de cada caso).
  Una misma hoja citada en dos preguntas cuenta dos veces: la tarjeta por pregunta tiene que encontrarla en
  cada una.

## Correr

```bash
npx tsx scripts/bench/corpus/correr.ts --comparar scripts/bench/corpus/linea-base.json
```

- Solo lee Firestore de producción (`library_resources`, `document_chunks`) con las credenciales de
  aplicación por defecto de gcloud. No llama modelos ni embeddings: no gasta saldo.
- Necesita la morfología de `scripts/language-structure/build.mjs` en `.cache/language-structure/`
  (en un worktree la busca en el checkout principal). El hebreo todavía corre sin lemas.
- `--conjunto desarrollo|prueba|todos`, `--rutas inicial,pregunta,seccion,lema`, `--json salida.json`.
- Con `--comparar`, sale con código 1 si baja el recall (total o por tipo), los aciertos en la misma pregunta,
  o la precisión mínima más de 2 puntos.

Pruebas de las métricas: `npx vitest run --root scripts/bench/corpus`.
- `SECCIONES_DESDE=<carpeta fuera del repo>`: si hay `<carpeta>/<resourceId>.md`, la ruta de sección de cada fragmento
  se recalcula con el separador del código (`markdownChunker.ts`) en vez de la guardada. Sirve para medir un cambio del
  separador ANTES de reescribir producción (A8d).

## Medidas

- **Recall**: hojas citadas que alguna ruta propone.
- **Precisión mínima**: aciertos / hojas propuestas. Es una **cota inferior**: una hoja útil que no se citó
  cuenta como error.
- **Misma pregunta**: la hoja aparece en la tarjeta de la pregunta en que se citó.
- **Por tipo**: comentarios y texto, gramáticas, léxicos y diccionarios.

## Línea base (rutas de «Del corpus al texto», #826–#829)

`linea-base.json`, con las cuatro rutas actuales como propuesta (`inicial`, `pregunta`, `seccion`, `lema`).

| Conjunto | Recall | Precisión mínima | Misma pregunta | Gramáticas | Léxicos |
|---|---|---|---|---|---|
| Desarrollo | 70,8 % (92/130) | 12,9 % | 11/44 | 50,0 % | 75,0 % |
| Prueba | 84,3 % (97/115) | 12,1 % | 55/95 | 64,9 % | 93,3 % |

Corrección del 2026-11-21: en TP #8 y TP #10, hechos en la plataforma, «Kittel y Friedrich, N» es la **hoja** N (la
numeración de Kittel declaraba desfase 0 y el sistema citaba la hoja). Con eso el conjunto de prueba pasó de 79,1 % a
84,3 %.

## Fase A (`fase-a.json`)

```bash
npx tsx scripts/bench/corpus/correr.ts --rutas inicialFaseA,pregunta,lemaPregunta \
  --navegacion region,lema,seccion --tarjeta-fase-a --comparar scripts/bench/corpus/fase-a.json
```

Las **propuestas** cuentan para la precisión; la **navegación** (regiones de gramática, entradas de todos los lemas del
pasaje, secciones sugeridas) solo para la cobertura. Es la meta de gramáticas en dos pasos que decidió el fundador
(2026-11-21): antes del análisis, la pregunta lleva a la región; la hoja exacta la da la opción de la decisión (fase B).

| Conjunto | Recall de propuestas | Cobertura | Precisión mínima | Comentarios | Gramáticas (cobertura) | Léxicos (cobertura) |
|---|---|---|---|---|---|---|
| Desarrollo | 65,4 % | 86,2 % | 33,1 % (257 hojas) | 93,8 % | 75,9 % | 100 % |
| Prueba | 86,1 % | 87,8 % | 25,3 % (391 hojas) | 96,8 % | 70,3 % | 93,3 % |

Qué cambió y cuánto aportó (medido):
- **Kittel por firma** (`lemmaEntriesIn`): el artículo nuevo empieza tras la firma «[Autor, tomo, páginas]» del
  anterior, en el mismo renglón; sin cabeza, el artículo entre firmas donde más aparece el lema. Léxicos de desarrollo
  75 % → 100 %.
- **Léxicos proponen por la pregunta**: las entradas de los lemas de cada pregunta son propuesta; las de todos los
  lemas del pasaje, navegación. Precisión total 12 % → 31 %.
- **Regiones de gramática** (`grammarCategoryRegions`): la categoría se lee en la ruta completa de secciones. Cobertura
  de gramáticas de desarrollo 50 % → 76 %.
- **Contorno del comentario** (`withCommentaryContour`, ±1 hoja): comentarios de desarrollo 89 % → 94 %.
- **Extracto corto** (`shortResourceSheets`): la BHS de 2 hojas del TI #3 se propone entera.

### Segundo paso de las gramáticas (`fase-b-gramatica.json`, solo prueba)

```bash
npx tsx scripts/bench/corpus/correr.ts --conjunto prueba --rutas inicialFaseA,pregunta,lemaPregunta,opciones \
  --navegacion region,lema,seccion --comparar scripts/bench/corpus/fase-b-gramatica.json
```

La ruta `opciones` lee el análisis guardado de cada TP hecho en la plataforma (`trabajoId`, solo lectura): las opciones
de cada pregunta, la caracterización de cada punto discutible y la función sintáctica de cada construcción, y las lleva
a la subsección exacta de la gramática (`grammarSheetsForCategoryLabels`). Gramáticas de prueba: hoja exacta 64,9 % →
73,0 % (+42 hojas); las tres citas de Wallace que faltaban (627 y 642 en TP #10 P1, 581 en P2) ahora se proponen. Lo
que falta: Robertson en TP #7, cuya ruta de secciones está rota (los títulos son el encabezado corrido «A GRAMMAR OF
THE GREEK NEW TESTAMENT»; se corrige en A8), e IBHS en el TI #3, que no se hizo en la plataforma y no tiene análisis.

Precisión: la meta de 50 % no se cumple y el banco explica por qué. Un comentario se propone por su sección (≈3 hojas
por hoja citada) y eso es lo que el estudiante tiene que leer; la precisión mínima cuenta como error toda hoja útil que
no terminó citada.

### Tarjeta por pregunta (A3, `--tarjeta-fase-a`)

La tarjeta «¿Qué responde cada pregunta?» suma, por cada pregunta, la **sección del comentario** que trata su
versículo (`commentarySectionsByVerse`, con el contorno de ±1 hoja) y, en ediciones, aparatos y comentarios textuales
de hasta 4 hojas elegidas, **el pasaje en el texto**. Lo ya mostrado por referencia o por lema no se repite.

| Conjunto | Misma pregunta antes | Misma pregunta con A3 |
|---|---|---|
| Desarrollo | 12/44 | 25/44 |
| Prueba | 55/95 | 79/95 |

Costo: 5 hojas más en desarrollo y 12 en prueba; la precisión mínima baja 0,6 y 0,8 puntos. Recall y cobertura no
cambian: las hojas ya se proponían, ahora aparecen en la pregunta correcta.
