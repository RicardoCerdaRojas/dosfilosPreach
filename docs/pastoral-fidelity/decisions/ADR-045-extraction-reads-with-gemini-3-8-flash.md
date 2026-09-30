# ADR-045 — La extracción por visión lee con Gemini 3.8 Flash, una sola copia por página

## Estado

`accepted`

## Fecha

2026-09-30

## Contexto

La extracción por imágenes usaba `gemini-2.5-flash` con el SDK
`@google/generative-ai`, que no tiene soporte desde el 2025-11-30. El caso que
lo disparó fue una gramática hebrea de 78 páginas cortada por `MAX_TOKENS`.

Dos hallazgos cambiaron el diagnóstico:

- **Cambiar de modelo no evita el corte.** Todos los Gemini tienen un tope de
  salida de 65.536 tokens, y en 3.x el razonamiento consume parte de ese tope.
- **Producción pedía cada página dos veces** (`text` + `md`). Con ~780 tokens por
  página densa y copia, eso deja ~42 páginas por llamada. La causa real del corte
  era la copia duplicada, no el modelo.

Para elegir motor se comparó en `scripts/extraction-bakeoff/` con tres libros
reales: Niccacci pp. 115-124, un léxico griego-español pp. 580-590 y el Salterio
de la BHS pp. 18-27.

## Decisión

**Gemini 3.8 Flash lee los libros, pidiendo una sola copia por página.**

- `MODEL_VISION = gemini-3.8-flash`, con razonamiento `LOW` (medido: 0 tokens de
  pensamiento) y resolución de imagen alta.
- Sólo se pide Markdown. El texto plano se deriva con `markdownAPlano`.
- Tamaños: pasada única hasta 24 páginas; tandas de hasta 40; **más de 40 páginas
  va a la cola** (`PAGINAS_PARA_LA_COLA` y `BATCH_THRESHOLD_PAGES`, de 80 a 40),
  por velocidad (~9 s por página).
- El prompt no pide LaTeX. Consecuencia buscada: deja de transcribir la masora
  parva y el texto bíblico queda intacto.
- Cada recurso guarda `extractionModel` y cada ficha de corrida su `model`.
  `llmCost` tiene el precio con fecha, incluido el cambio de 2027.
- Todo el servidor migra a `@google/genai`, y la frontera del navegador prohíbe
  los dos SDK. Los embeddings resultaron idénticos (coseno 1,0), así que no hubo
  que reindexar.

## Alternativas consideradas

| Alternativa | Por qué descartada |
|---|---|
| Seguir con 2.5 Flash | Pierde el daguesh, cambia vocales y produce formas imposibles en hebreo (Sal 23:1 `אֶחְסֶר`). Además es legado. |
| Gemini 3.5 Flash-Lite, al mismo precio | Mete letras árabes, griegas y latinas dentro del hebreo e invierte palabras. De ahí salió la métrica `mixedScriptWords`. |
| GPT-6 Luna | $0,20-0,34 por libro, pero pierde el 13 % de la BHS, no transcribe cantilación, sustituye palabras e inventa griego en el aparato. |
| GPT-6.1 Sol | Calidad equivalente a 3.8, pero $4,34-9,00 por libro. |
| Mistral OCR | Descartado por el fundador: ya había fallado en el banco de agosto. |

## Consecuencias

### Positivas

- 3.8 Flash es el único motor que transcribe cantilación y masora parva en la
  BHS. Sal 23:1 sale exacto.
- Los libros largos terminan. Wallace GGBB, 872 páginas, pasó por la cola en
  20 tandas, sin reintentos, en 52 minutos y por US$4,19, con 0 palabras de
  escrituras mezcladas.
- La telemetría de corridas (`extraction_runs`, #718) mide cada libro real.

### Negativas

- **El precio se duplica el 2027-01-01**, de $0,75/$3,75 a $1,50/$7,50 por millón
  de tokens. Con una sola copia y modo lote, el costo queda como el de 2.5 hoy.
  Sin modo lote, sube. Hay que implementar el modo lote (50 %) antes de esa
  fecha, y eso pide una decisión de UX porque el resultado puede tardar hasta 24 h.
- Los libros hebreos extraídos con 2.5 conservan sus errores hasta reprocesarlos
  (se reconocen porque les falta `extractionModel`).

### Neutrales

- Sin LaTeX, se pierde la masora parva de la BHS. Es aceptable: no es texto
  que el usuario cite.
