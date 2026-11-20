# Fase «Del corpus al texto». Diseño

> Versión 2, 2026-11-05, tras una crítica independiente contra el código. **Sin código.** Requiere OK del
> fundador. Evidencia: [FAMILIA_A_INVESTIGACION_2026-11.md](FAMILIA_A_INVESTIGACION_2026-11.md), secciones 8 a 11.
> Rótulos: **medido**, **leído**, **supuesto**.

## 1. El problema

El sistema pierde material en cuatro eslabones, y arreglar uno no basta (medido, §10):

| Eslabón | Qué falla hoy | Evidencia |
|---|---|---|
| 1. Hallar | Caminos separados; la hoja por categoría no se halla | Hoy 1 de 7 señaladas y mediana de 44 hojas (§11) |
| 2. Llegar | Lo elegido no cabe; lo fijado va a todos los pasos | Llega 24–32 % como máximo; TP #8: fijado 79 % (§9.1) |
| 3. Nombrar | El análisis no nombra el valor de la forma ni lo que el texto muestra | Dativo y cambio de persona: 0 en todas las versiones (§10.3) |
| 4. Conservar | La prosa descarta lo que el análisis ya tiene | Unicidad, paréntesis, jactancia (§8.3) |

**Objetivo:** que el estudiante, sin Claude y sin saber qué hoja buscar, reciba por paso las hojas con su razón,
vea qué leyó el análisis y qué no se halló, y obtenga una respuesta que nombre y evalúe.

**Lo que esta fase no resuelve, dicho de frente:** 9 de las 21 observaciones son de forma y precisión del
razonamiento (§8.1). En §10.3, «cómo conviven conflicto y cuerpo» no se movió con nada. Eso sigue en la familia D. El
banco no debe aparentar cubrirlo.

**Hallar sigue sin estar probado donde más importa:** rutas juntas, 3,7 de 7 señaladas; en el TP #9, 0 de 3 (§11). Una
compuerta lo ataca antes de construir (§9).

## 2. Principios

1. **Primero lo determinista.** El modelo solo elige entre encabezados reales; nunca propone una página.
2. **La unidad es el paso.** La pregunta es razón y rótulo dentro del paso (§3).
3. **Toda hoja dice por qué está, y el sistema dice qué rutas probó sin hallar.**
4. **Lo fijado pertenece a un paso.** Fijar para todo el trabajo es una decisión explícita.
5. **Se registra lo que quedó en el prompt tras todo recorte**, no lo recuperado.
6. **Nada se aplica sobre una decisión del estudiante.** Ningún escritor del plan pisa lo que fijó o quitó.
7. **Trabajos existentes intactos**, con una marca explícita de modo.
8. **Lo global es lo que vale para todos; lo de un curso va en las reglas de ese curso.**
9. **Umbrales fijados antes de correr**, sobre hojas del sistema y no sobre las elegidas a mano.

## 3. La unidad: el paso

Análisis, recuperación y fijado corren por paso (leído). Proponer por pregunta y guardar por paso dejaría cifras sin
sentido. La propuesta se indexa por `stepId` y cada ítem lleva `questionNumbers`.

| Caso | Regla |
|---|---|
| Paso con varias preguntas | Una propuesta; cada ítem dice a qué pregunta sirve; un presupuesto. La consulta une sus textos, con límite de largo |
| Pregunta sobre un rango («5:1–6») | Hoy `CAPITULO_VERSICULO` captura solo 5:1 (leído). Se corrige la lectura del rango; el dueño sigue siendo el primer versículo y `verseKeys` cubre todos |
| Pregunta sin versículo | No tiene paso: se muestra aparte como «sin paso», con búsqueda manual |
| Introducción y conclusión | Sin propuesta automática en esta fase |
| Sin preguntas | Unidad = versículo. Tarea al modelo: las formas en que se apoya la sintaxis del verso. **Sin medir**: primera prueba en la unidad 6 |
| Varios capítulos | No se siembran pasos hoy (leído): sin propuesta, con aviso |

## 4. Eslabón 1: hallar

| Tipo de fuente | Ruta | Estado |
|---|---|---|
| Comentario | Estructura y `refs` | Existe; se corrige |
| Léxico o diccionario | Entrada del lema de la consigna | Existe; se corrige. Sin preguntas: solo verbo principal y formas de la sintaxis, nunca todos los lemas |
| Gramática | Encabezados con modelo **y** `refs` | Nueva; `refs` existe |
| Aparato y comentario textual | Camino propio | Existe |
| Monografía, artículo, trasfondo | **Ninguna** | Se dice: «sin propuesta para este tipo» |

**Cifras reales del modelo sobre encabezados** (medido, §11): Wallace 3,7 de 7 señaladas. Citadas, 8 de 10 en Wallace y
14 de 18 en Robertson, a una hoja de distancia y con sesgo a favor de `refs`. Robertson depende de `refs`.

**Cupo por forma.** En 4:17 el modelo anotó αὐτῷ y agotó las 8 entradas en otras formas. Se prueba un cupo por cada
forma, en vez de 8 globales (compuerta A).

**Propuesta.** `ProposeStepReadingUseCase` produce, por paso:

```ts
interface StepReadingProposal {
    stepId: string;
    fingerprint: string;       // encuadre + fuentes + esquema: dice si quedó vieja
    items: Array<{
        sourceId: string; sheets: SheetRange[]; questionNumbers: number[];
        route: 'structure' | 'refs' | 'lemma' | 'heading' | 'apparatus';
        reason: string;        // «Encabezado: "Perfect with a Present Force"; para εἰδότι»
        estimatedChars: number; fitsByDefault: boolean;
    }>;
    routesWithoutResult: Array<{ form: string; searchedIn: string[] }>;
}
```

- **Se guarda** en `perStep`, medido contra el límite de 1 MB, y queda vieja por `fingerprint`, como `isStepPlanStale`.
- **Sin papel de «rival» en el esquema:** el experimento no lo produjo. Se agrega solo si la compuerta A lo mide.
- **«Qué no se halló»** solo existe por forma buscada y se redacta «no hallado por estas rutas». No afirma que no exista.
- **Fuera de las fuentes vetadas:** `excludedSources` se filtra en dominio, con prueba. Ese defecto ya ocurrió (leído).
- **Esquema sin persistir:** `getDocumentOutline` ya da `sectionPath` sin texto (leído). Se guarda solo si una medición lo pide.
- **Modelo:** ruta `exegesis.proposeReading`, en Luna, US$ 0,004 por libro y paso (medido). Va a la lista permitida y al
  catálogo; se decide el cobro como lote: una reserva por operación no admite 12 llamadas (leído).
- **Hebreo y arameo:** el prompt y los filtros del arnés son griegos. Se adaptan y se miden antes de declararlos cubiertos.

**Detectores, con diagnóstico primero y aceptación por libro:**

| Libro | Cambio | Estado de la causa |
|---|---|---|
| Kittel | Reconocer «griego [glosa]» | Medido: de 2 a 7 de 12 |
| Ortiz | Reconocer «— (I) **raíz**» y número previo | Leído. Falta decidir cómo una forma derivada llega a su raíz |
| Adamson | «(5:1–6)» en comentario de un solo libro | Medido: 0 encabezados. Falta h. 200 |
| Ropes | Sin decidir | **Causa sin cerrar:** el reconocimiento existe (leído); se diagnostica en la unidad 0 |
| Mayor | Tapar «1 Pet. v. 1» | Medido |
| Green y Watson | Quedan por parecido, con aviso | Medido, §9.5 |

**Claves:** «consecutiv» no se retira, porque hebreo la usa para wayyiqtol (leído). Se arregla la lectura del encuadre. No se agrega
el tiempo: la sugerencia por secciones deja de ser una ruta.

## 5. Eslabón 2: llegar

### Datos y alcance

```ts
interface StepSourcePlanEntry {
    // …lo de hoy
    pinnedSheets?: Readonly<Record<string, ReadonlyArray<SheetRange>>>; // sourceId → hojas
    readingProposal?: StepReadingProposal;
}
```

Una sola función de dominio, `effectiveScope(source, stepEntry)`: el alcance de la fuente, más las hojas de ese
paso. **No escribe en `sheetRanges`.** Así una hoja de un paso no compite en los demás.

`readingMode: 'per-step'` en el trabajo distingue nuevo de viejo. Sin la marca, todo funciona como hoy.

| Consumidor | Qué cambia |
|---|---|
| Análisis y generación (`retrievalScopeOf`, `CallableCuratedCorpusRetriever`) | Usan `effectiveScope` del paso. Una fuente con solo hojas de paso deja de quedar fuera |
| Verificador (`VerifierSourcesBuilder`) | Lee la unión de todos los pasos. Si no, pierde la detección de página, o toda cita vuelve «no encontrada» (leído) |
| Medidor (`corpusFootprint`) | Mide el máximo por paso, no la suma |
| Revisión por pregunta | Mira lo fijado en el paso |
| Consistencia y aviso de fuente sin páginas | Miran el alcance efectivo |
| Quitar hojas del carrito | Recorta también lo fijado por paso |
| `stepPlanWithoutSource` | Limpia `pinnedSheets` y lo propuesto |
| Herencia de series | Trae solo fijado de todo el trabajo; `stepId` no cruza. Tras heredar, ofrece la propuesta |
| Carrito | Distingue «para este paso» de «para todo el trabajo», con el peso a la vista |

### Protección de lo fijado

- **Hoy se perdería:** `ProposeStepCorpusAllocationsUseCase` y `UpdateStepCorpusAllocationUseCase` reconstruyen la
  entrada campo por campo (leído). Se les agrega el campo, con una prueba que recorre todos los escritores de `perStep`.
- **Carrera:** `setStepPlan` lee y escribe el plan entero sin transacción (leído). Lo fijado usa una operación
  transaccional `setStepPins`.
- **Fuentes sin receta:** no pasan por `SelectSourcePagesUseCase`, que vacía `excerpts` (leído).

### Tres listas, una regla

| Lista | Significado |
|---|---|
| `pinnedSources` | La fuente debe usarse (el prompt lo exige, leído) |
| `pinnedSheets` | La hoja llega con espacio reservado; **no** obliga a citarla |
| `suppressedSources` y `excludedSources` | Mandan: sus hojas no se proponen ni se fijan |

### Reparto con tope

Por paso, lo marcado por defecto no pasa de **40.000 caracteres** (40 % del presupuesto), y reserva espacio al resto.
Lo que no cabe se muestra sin marcar, con su peso. Motivo: con medianas de 8 y 14 hojas, marcar todo puede volver a
llenar el paso (cálculo; densidad sin medir). Con A1 lo fijado bajó de 79.357 a 17.201–38.784 en las preguntas del
TP #8, pero eran hojas a mano (medido, no extrapolable).

### Prioridad: diagnóstico antes de cambiar

**El dato de §9.2 no separa encabezado de texto**, porque `refs` los mezcla (leído). `namesVerse` existe para que gane la hoja de
gramática que nombra el versículo con bajo parecido (leído), y no debe romperse.

- **La unidad 0 mide** qué hojas de gramática citadas dependen hoy de esa marca.
- **Cambio:** limitado a comentarios. Se separan refs de encabezado y de texto, si cuesta poco; si no, se usa el ancho del rango solo en comentarios.
- **Aceptación:** ninguna hoja de gramática que hoy gana pierde; ningún comentario pierde su sección.

**Consulta:** versículo, griego y texto de las preguntas del paso. El análisis y la generación hoy difieren: uno lleva griego
y el otro no (leído); se unifica en un ayudante. A1 no probó este cambio: se mide aparte.

### Propuesta más chica

En el TP #8, el sistema propuso 53 de las 57 hojas de Kittel (medido): 68 % de lo elegido. Un léxico propone solo la entrada del lema.

### Registrar lo que quedó en el prompt

`materialRead` en cada versión: por fuente, hojas tras selección **y** tras el recorte de `allocateSourceBudgets`, que puede
cortar incluso lo fijado (leído). Se guarda como texto compacto («160-164,170»); estimación 1–3 KB por versión (supuesto). `appendStepVersion` debe copiarlo y
la deduplicación debe contarlo. `droppedRanked` pasa a ser por fuente.

## 6. Eslabón 3: nombrar

Es el menos seguro. Solo se construye si pasa la compuerta B.

- **Observaciones calculadas.** Como conjunto, no como último verbo: 4:16 trae segunda plural **y** tercera singular, y comparar
  verbos no detecta el cambio (leído). En Sal 23:4 el cambio a la segunda persona está en pronombres y sufijos, no en verbos
  (leído). Se calcula el conjunto de personas del versículo con pronombres y sufijos, más lemas retomados y conector de apertura.
  Griego y hebreo requieren lector propio. Se miden falsos positivos en una epístola, una narrativa y un salmo.
- **Valor de la forma.** El prompt ya pide categoría por forma verbal y genitivo, y entradas por participio y frase preposicional (#825,
  leído). No se agrega otra lista: se extiende a tiempo y a casos oblicuos **en las formas de la pregunta y las que sostienen la decisión**.
  Con página si la gramática llegó; si no, marcada como juicio propio.
- **Cita de categoría.** Es la de mayor riesgo: la página de Wallace define la categoría, no clasifica esa forma. Se comprueba de forma determinista que la página
  cae bajo un encabezado que nombra la categoría, y la aplicación al versículo se rotula como juicio propio.
- **Tipos de pregunta:** agregar `function` y `translation`, con su regla de método. 10 de 44 quedan hoy sin tipo (medido).

## 6 bis. Eslabón: argumentar (agregado 2026-11-05, tras la devolución del TP #10)

**Por qué:** las 3 correcciones de fondo del TP #10 fueron de argumentación, y en 2 el material estaba disponible
(`research_notes/tp10_congelado_2026-11-05/devolucion.md`). Para 5:6, el analizador recibió 5:2–6 como contexto (radio 4, leído
en `pericopeContext.ts`) y no usó 5:4–5. La prosa nueva no tocó ninguna de las tres (0/3).

**Criterio de mantenibilidad:** primero datos calculados, después campos del esquema y, en último lugar, frases en el prompt.

| Pieza | Forma | Verificación |
|---|---|---|
| Concordancia interna del libro | **Calculada**, sin modelo: lemas de contenido del versículo y de la perícopa con ≤ 8 apariciones en el libro, con referencias. Griego por MorphGNT y hebreo por OSHB, ambos con lema por palabra (leído) | Prueba de dominio; tope de 2.500 caracteres |
| Argumento principal de la rival | **Campo** por pregunta: argumento, respuesta y fuentes | Las fuentes, con `verifyAttributedQuotes` |
| Criterio que discrimina | **Campo**: si el criterio vale también para la rival, y por qué | Si vale, la confianza no puede ser firme (regla de dominio) |
| Apoyo en el contexto | **Campo**: versículo y lo que aporta | El versículo debe estar en la perícopa o en la concordancia dada (determinista) |

La prosa los recibe como parte de la respuesta (marca KEEP). No se agrega una regla de prosa.

**Compuerta R (antes de construir).** Se emulan los campos con instrucciones, sobre los mismos campos actuales del esquema. Se compone con la
prosa **vigente** (C0), para aislar el efecto del análisis. Brazos: R0 = analizador vigente; R1 = R0 más concordancia más las tres
exigencias. Mismas hojas (receta del trabajo). Sol, esfuerzo bajo.

| Corrección | Pasa si (R1, 3 repeticiones) |
|---|---|
| O6, 5:3: θησαυρίζω sin objeto | La prosa responde que el verbo puede ir sin objeto, con prueba (Lc 12:21 o Mayor), en ≥ 2 de 3 |
| O8, 5:6: contexto | La prosa apoya con 5:4, 5:5 o 2:6 en ≥ 2 de 3 |
| O2, 5:1: medio o manera | Un juez ciego acepta en ≥ 2 de 3 que el texto reconoce que el criterio también apunta a manera y da otra razón, o ajusta la preferencia |
| Controles: TP #8 4.1, TP #9 4.12 y 4.17 | Sin empeorar: citas retiradas y palabras ≤ presupuesto + 8 %; juez ciego con la clave de §10 ≥ media de A0 − 1,5 |
| Vínculos inventados | 0, según el juez ciego |

**Lo que ya existe (leído en `responseSchema.ts`):** `argument` pide «el argumento más fuerte a su favor» y `decisiveCriterion`
avisa que «un criterio que vale para las dos no decide nada». El modelo no lo cumplió. Repetirlo no basta: R1 exige
**responder** el argumento rival dentro de `whyThisOverThat`, **probar** el criterio contra la rival y usar datos calculados.

R0 se corre 1 vez más la versión aceptada (n = 2). Costo estimado: US$ 2,70. Si R pasa, las piezas entran al PR 3 junto con «nombrar»
(reemplaza el C1 de prosa, que no se publica tal cual). Si falla, se diagnostica antes de seguir. Sin ablación: no separa concordancia de instrucciones.

**Resultado de R (2026-11-05, US$ 2,58; `research_notes/compuerta_r_2026-11-05/resultado.md`):**

| Corrección | Resultado |
|---|---|
| O8, contexto | Pasa solo con R1 **y** la regla de vecinos de la prosa (3/3); con la prosa vigente, 0/3 |
| O6, rival | Pasa (2/3), pero R0 también: no atribuible |
| O2, medio o manera | No concluyente: el juez aprobó la prosa que el profesor marcó |
| Inventados | 0 de 22 |
| Controles | −1 (n = 1) |
| Largo | +12 % en 2 de 3 con las dos piezas |

**Decisión de diseño:** las piezas de argumentar y la regla de vecinos de §7 van **juntas** en el mismo PR. La concordancia,
si se conserva, trae el texto también para los lemas de la perícopa. El presupuesto de palabras se hace cumplir.
«Nombra el valor» y «evalúa, no calles» de C1 no mostraron efecto en las correcciones: no se publican sin evidencia.

## 7. Eslabón 4: conservar

- **En el prompt global** solo cambia una cosa: la prohibición absoluta de vecinos pasa a «cuando el análisis los vincule». Se
  condiciona a trabajos con preguntas hasta medirla en un TI, porque se probó con 300 palabras y no con secciones por versículo.
- **Principios y preferencias, separados** (decisión del fundador, 2026-11-05). Cada observación del profesor se clasifica:
  - **Principio de método**, al prompt global y en el **análisis**: nombrar el valor de la forma y no solo su categoría (10);
    que la categoría coincida con la traducción (2); evaluar la lectura rival con quien la defiende (12); el versículo vecino
    como evidencia (11); no decidir un elemento con la clasificación de otro (7). Pasa si (a) lo respalda una obra de método
    además del profesor, citada en la regla; (b) sostiene la compuerta B en el pasaje de control y en un trabajo sin curso, sin
    subir señales ni largo. Si falla, queda en las reglas del curso.
  - **Preferencia del curso**, a las reglas del curso, que ya llegan a analizador y compositor (leído): gramática de
    referencia (8), comillas y raya (9), voces recientes (12), edición de cada obra (13).
  - **Expresión por producto:** el análisis guarda el principio; la prosa lo dice según el producto. El TP lo nombra con
    terminología; el sermón lo hereda del trabajo y no lo vuelve jerga.
- **Qué conservar:** valor de la forma, lecturas rivales con defensor, ecos del AT, enlaces de contexto y **elementos del
  mismo versículo que pesan en la decisión**, con la misma marca de las respuestas. Lo último sale de la compuerta 0: con la
  regla nueva, «ἐν ἐσχάταις ἡμέραις» de 5:3 quedó fuera en 3 de 3, mientras Is 13:6 y ἀντιτάσσεται volvieron en 3 de 3 (medido,
  `research_notes/tp10_congelado_2026-11-05/resultados_prosa.md`).
- **Qué se recorta primero:** repetición. **No** la morfología: la consigna la pide.
- **Con sustento:** sin hojas, la prosa nueva dio 4 señales en 12 textos; con hojas, 0 en 12 (medido).
- **Qué quedó fuera:** contrato **aparte** de `verseAnalysisCoverage`. Ese contrato no sirve: da por cubierto lo de menos de 4 palabras
  («dativo de desventaja»), y alimenta `enforceAnalysisCoverage`, que reemplaza el verso entero (leído). Coincide por categoría, informa y no bloquea.

## 8. Lo que ve el estudiante

Una vista nueva, con componente y hook propios, porque `CorpusSubStep.tsx` tiene 2.639 líneas (leído).

| Superficie actual | Destino |
|---|---|
| «Selección sugerida», secciones sugeridas | Se retiran; quedan integradas |
| «¿Qué responde cada pregunta?» | Se integra: sus avisos pasan a la vista nueva |
| Plan de uso | Se conserva; su relación se decide con la pantalla real |
| Búsqueda manual y selector | Se conservan |

```text
4:17 · Pregunta 4                                 Fijado 31.000 · reservado para consultar 69.000
Tu lectura: [ ... ]
  ☑ Wallace   h. 615–616  Encabezado «Perfect with a Present Force» · εἰδότι      ☐ leída
  ☑ McCartney h. 250      Comentario de 4:17                                     ☐ leída
  ☐ Robertson h. 842      Cita Stg 4:17 · no cabe marcada
  No hallado por estas rutas: αὐτῷ, en Wallace y Robertson.             [Buscar]
```

Cada análisis muestra «Qué leyó este análisis», plegado, con aviso si algo fijado no quedó en el prompt.

**Metodología, no capturador.** Una lista marcada con razón se acepta con un clic. Por eso: «Mi lectura» (`studentReading`, ya existe)
se muestra antes de la propuesta y se marca hoja leída. Si se exige leer antes de generar es decisión del fundador (§12).

## 9. Compuertas, previas a construir

| | Qué | Prueba | Pasa si | Costo estimado |
|---|---|---|---|---|
| **0** | Predecir el TP #10 **antes** de su devolución. No toca el trabajo entregado | (a) Predicciones escritas de qué marcará el profesor en lo entregado, por causa (gratis). (b) Salidas locales de los prototipos, con fecha, sin escribir en Firestore | Archivado | US$ 2 |
| **A** | Hallar lo implícito | Cupo por forma, en Luna, en los 15 pasos | TP #9 ≥ 1,5 de 3, y TP #10 ≥ 3 de 4, con mediana ≤ 12 hojas | US$ 0,50 |
| **B** | Nombrar | Observaciones y valor, en 4:12 y 4:17, más dos pasajes no vistos (griego y hebreo) y uno donde el cambio no importe | Dativo y persona salen de 0; no inventa en el pasaje de control; señales no suben | US$ 2 |

**Resultado de A (2026-11-05, US$ 0,37, Luna, 3 repeticiones; archivos `*-cupo3-*` en `research_notes/familia_a_mediciones_2026-11-05/encabezados/`): FALLA.**

| | 8 globales (§11) | Cupo 3 por forma | Unión (exploratorio, sin costo) | Umbral |
|---|---|---|---|---|
| TP #9 | 0/3 | 1/3 (dativo 3/3) | 1/3 | ≥ 1,5 |
| TP #10 | 3,7/4 | 2,7/4 (concomitante 0/3) | 3,7/4 | ≥ 3 |
| Mediana de hojas, Wallace / Robertson | 8 / 14 | 7 / 20 | 11 / 29 | ≤ 12 |

**Causa (medida):** en 4:17, el modelo trató εἰδότι como participio (función) en 3 de 3 y nunca como perfecto (tiempo). Una forma tiene
varias dimensiones y el modelo elige una sola. «Presente habitual» de 4:12 es supuesto, no dicho por el profesor: el máximo comprobable del TP #9 es 2.
**Candidata A2 (sin correr):** expandir cada forma por sus dimensiones calculadas de MorphGNT (tiempo, caso, función del participio) y dar
un cupo a cada dimensión, con los mismos umbrales y un solo intento.

**A2 corrida (2026-11-05, US$ 0,24, archivos `*-dim2-*`): FALLA.** TP #9 1/3, TP #10 2/4, mediana 7 hojas. Con las dimensiones, el modelo
sí mira el perfecto de εἰδότι (3/3), pero elige el perfecto intensivo (h. 610) y no «Perfect with a Present Force» (h. 615): no sabe que
οἶδα pertenece a esa categoría. Es un hueco léxico; una lista de esos verbos sería ajustar la prueba a un ejemplo. Con 2 entradas por
dimensión, el TP #10 pierde las rivales (concomitante y proléptico, 0/3). **Se acepta la falla, como se acordó.**

**Qué significa en la práctica:**
- **Pregunta que nombra la forma** (TP #10: «el participio ὀλολύζοντες», «los verbos σέσηπεν y γέγονεν»; TP #9: «el participio δυνάμενος»,
  «el infinitivo»): se proponen secciones de gramática por encabezado, 8 globales, con su razón. Medido: 3,7 de 4 en el TP #10.
- **Pregunta que no nombra forma** (TP #9: «¿Qué función tiene Santiago 4:17 en el contexto?»): comentarios por `refs` y léxico, sin
  secciones de gramática por categoría. La vista dice: «Esta pregunta no nombra una forma: no propongo secciones de gramática. Si tu
  respuesta se apoya en un tiempo o un caso, búscalo en la gramática», con el buscador al lado.
- **Lo implícito pasa a «nombrar» (compuerta B):** el análisis puede nombrar el valor de una forma no preguntada como juicio propio,
  sin página. Con la hoja llega a 2 de 2 (§10.3); sin hoja, B mide si lo nombra sin inventar.

**¿Es un problema de lectura? No** (comprobado 2026-11-05): el texto de Wallace h. 615–616 está bien extraído y nombra los verbos
de esa categoría. El modelo recibió **solo el índice de encabezados**, no el cuerpo; eligió bien el capítulo y mal la sección. Visión no ayuda.

**Candidata A3 (vista sobre estos datos: NO se mide sobre ellos).** Cruce determinista: hojas del capítulo que el modelo eligió para una
dimensión ∩ hojas cuyo texto contiene el lema de la forma. Para εἰδότι: capítulo del perfecto (h. 609–618) ∩ 25 hojas con formas de
οἶδα = h. 616. Se prueba sin ver en el próximo TP real. Pasa si halla ≥ 1 hoja esperada no nombrada por la pregunta y agrega ≤ 3
hojas por pregunta.

**Compuerta B, ejecución (umbrales fijados 2026-11-05, antes de correr).** Brazos sobre el analizador con argumentar (R1):
B0 = R1; B1 = R1 + observaciones calculadas (personas de verbos, pronombres y sufijos frente al versículo anterior; lemas
retomados de los 4 previos; conector de apertura; griego por MorphGNT y hebreo por códigos OSHB) + «nombrar el valor» en el
análisis, con página si la gramática llegó y como juicio propio si no. Prosa vigente con la regla de vecinos corregida (C2). Sin
ejemplos que nombren lo esperado. B0 reutiliza R1-1 en 4:1, 4:12 y 4:17.

| Caso | Pasa si (B1, prosa) |
|---|---|
| 4:17 dativo de desventaja o de interés (αὐτῷ) | ≥ 2 de 3 (hoy 0) |
| 4:17 cambio de persona | ≥ 2 de 3 (hoy 0) |
| 4:12 valor del presente | ≥ 1 de 2 (hoy 0) |
| TP #7 3:13, no visto: categoría del genitivo coherente con la traducción | No peor que B0, juez ciego |
| TI #2 Sal 23:4, no visto, hebreo, sin preguntas: el paso a la segunda persona, señalado y evaluado | ≥ 2 de 3 |
| Control 4:1: sin afirmar un cambio que no importa | 0 afirmaciones forzadas, juez ciego |
| Todos | Inventados y categorías sin sustento: B1 ≤ B0; palabras ≤ presupuesto + 8 % |

Gasto estimado: US$ 2,50 (tope 3,00). Concordancia: solo griega; en hebreo, R1 sin concordancia.

**Resultado de B (2026-11-05, US$ 2,68; `research_notes/compuerta_b_2026-11-05/resultado.md`): PARCIAL.** Pasan 4:17 persona
(0→2, 3/3), 4:12 presente (0→2) y el control (0 forzadas); el perfecto de 4:17 sube a 2 sin hoja. Fallan 4:17 dativo (0/3), Sal 23:4
(describe, no evalúa: 1/3), 3:13 por poco (1,5 frente a 2), 2 rótulos discutibles y 1 texto a +8,7 %.
**Decisión propuesta:** el PR 3 entra con alcance reducido y rotulado: observaciones calculadas y valor de la forma **en griego, para
las formas del alcance de la pregunta**. No se promete el caso de formas no preguntadas (dativo). Hebreo y trabajos sin preguntas
quedan **sin validar**, hasta la prueba 3 (un TI hebreo con devolución).

Si A falla, esa parte no se promete: la hoja por categoría queda propuesta solo cuando la pregunta nombra la forma. Si B falla, el eslabón 3 se rediseña.

## 10. Unidades

Antes de todo, `WRITE_COMPACT_VERSIONS` se despliega en su propio PR (desde 2026-11-06), porque `materialRead` agrega peso.

**PR 1, «Se ve lo que pasa»:**

| # | Unidad | Aceptación |
|---|---|---|
| 0 | Banco en el repositorio, con los defectos del arnés corregidos y gasto por corrida | Reproduce §10 y §11 dentro de un margen; diagnostica Ropes y `namesVerse` |
| 1 | Registrar y mostrar lo que quedó en el prompt | Sin cambio en el análisis; prueba contra recorte real |
| 2 | Regla de vecinos y qué conservar | Sobre versión actual, banco sube ≥ 1,5; palabras ≤ presupuesto + 8 %; señales no suben |

**PR 2, «Hallar y llegar»:**

| # | Unidad | Aceptación |
|---|---|---|
| 3 | Detectores | Por libro, §4. Avisos falsos: 0 de 2 con causa cerrada; δίκαιος se mantiene |
| 4 | Alcance efectivo y fijar por paso | Los consumidores de §5, con prueba; trabajo sin marca idéntico; 100 % de lo fijado queda en el prompt |
| 5 | Prioridad y consulta | §5, medida antes y después |
| 6 | Propuesta y vista nueva | Con **hojas del sistema**: compuerta A sostenida; default ≤ 40.000; banco ≥ 8,5 de 20 frente a 7,3, con 5 repeticiones |

**PR 3, «Nombrar»** (solo si pasa B):

| # | Unidad | Aceptación |
|---|---|---|
| 7 | Observaciones, valor, cita de categoría y tipos | Con hojas del sistema, banco ≥ 10 de 20; señales no suben |

Los umbrales quedan fijados aquí. 8,5 sale de un cálculo sobre §10.3; 11,7 no es meta, porque salió de hojas a mano y es una media de 10, 13 y 12.

**Requiere excepción** a «una fase = un PR»: dividir entrega valor temprano y permite medir por partes.

**Prueba sin ver:**

1. **TP #10:** cuando llegue la devolución, comparar con lo congelado, por causa, contra predicciones escritas.
2. **Próximo TP real**, sin que Claude elija hojas. Mide cuántas correcciones por causa y qué decidió el estudiante.
3. **Un TI hebreo**, con su devolución, antes de declarar hebreo cubierto.

## 11. Lo que queda mal servido, sin disimular

| Tipo | Estado |
|---|---|
| TP griego con preguntas | Evidencia real, de un profesor y una biblioteca |
| TI y hebreo | Sin experimento. Requiere la prueba 3. Hasta entonces, propuesta rotulada como no validada |
| Trabajo sin preguntas | Sin medir; primera prueba en la unidad 6 |
| Series y sermón | Herencia definida; propuesta solo ofrecida; sin medir |
| Otros usuarios | Solo 2 tienen recursos: sin validar |

**Fuera de alcance:** verificador general (familia B, salvo la comprobación de categoría de §6); fuentes y corpus común (familia C);
índices de los libros; forma y precisión (familia D). Se revisa la etapa 5 de `FASE_LECCIONES_TI2_2026-11.md` al iniciar el PR 2 para no duplicar.

## 12. Decisiones del fundador (respondidas 2026-11-05)

1. **Diseño y orden:** aprobados.
2. **Excepción a un PR** por fase: aprobada, tres PR.
3. **Leer antes de generar:** no se exige. Se muestra «Mi lectura» y se marcan hojas; se mide en el próximo TP y se decide con datos.
4. **Reglas del curso:** lo particular del trabajo va a las reglas del curso; los principios de método van a todos, con la prueba de §7.
5. **Gasto:** aprobado. Compuertas US$ 4,50 y cerca de US$ 11 en tres corridas del banco (estimado), con saldo revisado antes de cada una.
6. **Compuerta 0:** autorizada con (a) y (b), y HECHA el 2026-11-05 (US$ 0,42). Archivo en `research_notes/tp10_congelado_2026-11-05/`,
   con hashes. Predicciones fijadas antes de leer la prosa; K2 y K3 se cumplen; K1 queda en 2,5 de 4, con meta de 3.
