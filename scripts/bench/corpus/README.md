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

## Medidas

- **Recall**: hojas citadas que alguna ruta propone.
- **Precisión mínima**: aciertos / hojas propuestas. Es una **cota inferior**: una hoja útil que no se citó
  cuenta como error.
- **Misma pregunta**: la hoja aparece en la tarjeta de la pregunta en que se citó.
- **Por tipo**: comentarios y texto, gramáticas, léxicos y diccionarios.

## Línea base (2026-11-20, rutas de «Del corpus al texto», #826–#829)

| Conjunto | Recall | Precisión mínima | Misma pregunta | Gramáticas | Léxicos |
|---|---|---|---|---|---|
| Desarrollo | 70,8 % (92/130) | 12,9 % | 11/44 | 50,0 % | 75,0 % |
| Prueba | 79,1 % (91/115) | 11,4 % | 49/95 | 64,9 % | 53,3 % |

Con solo la propuesta inicial y la tarjeta por pregunta, el desarrollo da 63,8 % de recall y 29,0 % de
precisión mínima (la cifra de la etapa 0a). Meta de la fase A: ≥ 85 % de recall con ≥ 50 % de precisión
mínima en los dos conjuntos [supuesto: se revisa al medir].
