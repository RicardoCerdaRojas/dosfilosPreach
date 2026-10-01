# ADR-044 — Cada función usa el modelo que mejor la resuelve, no uno para todo

## Estado

`accepted`

## Fecha

2026-09-30

## Contexto

Todo el servidor usaba Gemini 2.5 (Flash y Pro) para todo: exégesis, tutores,
redacción del sermón, extracción de libros. Dos hechos obligaron a revisarlo:

- **2.5 es legado.** Sigue disponible, pero sólo para proyectos que ya lo usaban.
- **2.5 Pro comete errores de fondo en exégesis.** En el banco de texto invirtió
  la regla de Colwell y atribuyó a Lutero la lectura de genitivo subjetivo.

El gasto de septiembre fue de US$72: el 73 % en extracción y US$12 en
`exegesis_analyzeVerse` con 2.5 Pro. A escala se vuelve relevante: 100 pastores
con 20 análisis cada uno serían ~US$180 al mes sólo en esa función.

## Decisión

**El modelo se elige por función, en una tabla de datos, no en el código.**

- La tabla vive en `config/llmRouting`, con la forma `feature → {provider, model, reasoning}`.
  El proxy `runLlmPrompt` la lee con un caché de 1 minuto. Una función sin entrada
  conserva su comportamiento anterior. Revertir significa editar ese documento, sin deploy.
- La versión aprobada se guarda en `scripts/llm-routing/ruteo.json`, con una prueba
  que valida las claves y los precios.
- `rutaCompatible` impide mandar a otro proveedor una llamada que éste no puede
  cumplir, como `fileSearch` o una imagen fuera de Gemini. En ese caso la llamada
  sigue por Gemini y queda en el log.
- **Asignación vigente, 54 funciones:**

| Uso | Modelo | Por qué |
|---|---|---|
| El trabajo exegético (`analyzeVerse`, `compose*`, `generateStep`) | **GPT-6.1 Sol** | El más preciso en el banco de funciones reales y ~20 % más barato que 2.5 Pro. Confirmado por el fundador. |
| El resto de exégesis, los tutores, y la redacción del sermón y las series | **GPT-6 Luna** | Correcto, no inventa y cuesta ~35× menos que 2.5 Pro. Para la redacción lo eligió el fundador en una prueba a ciegas (opción C). |
| `extractRubric` y la lectura de libros por imagen | **Gemini 3.8 Flash** | Lee imagen. Ver [ADR-045](ADR-045-extraction-reads-with-gemini-3-8-flash.md). |

- **Gemini 3.8 Flash no se usa para escribir exégesis.** Sin fuentes provistas
  inventó cuatro citas a BDAG, todas en la p. 0, y las propagó al redactar.
- El esquema JSON es uno solo: `esquemaEstricto` traduce en el servidor los
  esquemas de Gemini al modo estricto de OpenAI, y `quitarNulosOpcionales`
  restituye el «ausente». No se tocó ningún archivo de los llamadores.

## Alternativas consideradas

| Alternativa | Por qué descartada |
|---|---|
| Un solo modelo nuevo para todo (3.8 Flash) | Inventa citas en exégesis y cuesta 2× el precio actual desde 2027. |
| Luna para todo, incluido el trabajo exegético | Correcto, pero su prosa es escueta y el trabajo académico es la función donde más pesa la precisión. |
| Dejar la exégesis en 2.5 Pro con un prompt mejor | Los errores eran de conocimiento (Colwell), no de instrucción, y el modelo es legado. |
| Elegir por intuición sin banco | La morfología satura (99-100 % en todos los modelos): sólo las tareas abiertas y las funciones reales separan. |

## Consecuencias

### Positivas

- La exégesis gana precisión y baja de costo. Las funciones menores cuestan
  casi nada.
- Cambiar un modelo es un cambio de datos, reversible en un minuto.
- Los bancos (`scripts/llm-bakeoff/`) se pueden volver a correr para decidir
  con evidencia cuando salga un modelo nuevo.

### Negativas

- Dependemos de dos proveedores y de dos secretos (`GEMINI_API_KEY`, `OPENAI_API_KEY`).
  OpenAI exige crédito prepago: con tarjeta sola responde `billing_not_active`.
- Anthropic sigue sin esquema estricto en el adaptador.
- La Facultad todavía no pasa por el proxy: necesita streaming en el adaptador de OpenAI.

### Neutrales

- `modelId` en las versiones de los pasos de exégesis todavía guarda el valor
  por defecto del cliente (`gemini-2.5-pro`), no el modelo que corrió. El dato
  verdadero está en `llmUsageDaily.byModel`. Queda pendiente guardar el modelo efectivo.
