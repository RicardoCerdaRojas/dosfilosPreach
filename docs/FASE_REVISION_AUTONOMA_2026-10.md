# Fase «Revisión autónoma»: que el estudiante revise propuestas, no que cace errores

> Borrador 1, 2026-10-28. Nace del TP #9 (Santiago 4:11-17, curso NT785), hecho de punta a punta en local con la plataforma y con Claude al lado. Pregunta del fundador al terminar: «¿nuestro modelo de revisión no podrá crecer a ser autónomo?».
>
> Todo dato de este documento está **leído** en producción (documento del trabajo `9aacADPo7monLfUug0Bh` y fragmentos de las fuentes) o **medido** en la sesión. Lo **supuesto** se rotula.

## 1. Para qué

La plataforma enseña el método; el estudiante decide la exégesis y el profesor evalúa ese juicio. Por eso la meta no es que la plataforma entregue el TP sola. La meta es que **cada falla que hoy encuentra una persona la encuentre la plataforma, y que la proponga como una corrección concreta que el estudiante acepta, cambia o rechaza**.

Hoy el estudiante hace de revisor, de verificador del verificador y de editor. En el TP #9 eso llevó la tarde entera.

## 2. Lo que se midió en el TP #9

### 2.1 Alarmas de citas (cuatro pasos, 4:12, 4:14, 4:15 y 4:17)

| | Alarmas |
|---|---|
| Total | 15 |
| Falsas por el recorte de la afirmación (glosa, frase de otro párrafo, mención corta) | 6 — **corregido** (B35) |
| Falsa por una cita a varias páginas | 1 — **corregido** (B42) |
| Falsas porque el veredicto cambió sin que cambiara el texto | 2 — en curso (B46) |
| Verdaderas | 6 |

Las 6 verdaderas son **la misma falla**: el análisis atribuye a una fuente una conclusión propia. Son Robertson 767 en 4:14, Varner 165 en 4:15, McCartney 229 y Ropes 282 en 4:17, y Robertson 1069–1070 en 4:15, más el rango de ζωή de 4:14. Cuatro de ellas están en el **criterio decisivo** (B43).

«Diagnosticar esta cita» se midió en 3 alarmas: **2 aciertos** (Ropes 282 y Tuggy 540, «afirmación mixta») y **1 remedio equivocado** (Robertson 1069 → «otra página»).

### 2.2 Correcciones de la prosa: quién las encontró

Fueron 22 correcciones de contenido o de forma en las cuatro respuestas:

| Las encontró | Cuántas | Ejemplos |
|---|---|---|
| La tarjeta «Revisión antes de entregar» (controles fijos y criterios del curso) | 8 | cierre doble, en 4:12 y 4:15; la frase sin relevancia de 4:12 y la de 4:17; el criterio del vapor que no discrimina en 4:14; la rival sin nombre en 4:15; Robertson 735, gramática del curso |
| El verificador de citas | 3 | Robertson 767 y 1069 en la prosa; Varner 165 |
| Una lectura humana de las fuentes y del aparato | 11 | sobre qué texto decide 4:12; la puntuación de NA28 en 4:14; McCartney integra *con* τό; aposición al sujeto frente a aposición a los títulos; traducción concesiva; glosas; «Stg.»; «pp.» |

Además, la tarjeta dio **4 avisos falsos o inventados**: B37 (varias páginas y la segunda cita de un paréntesis), B39 («restituir» un criterio corregido a propósito) y B40 (una cita inventada, «Wallace, p. 961»).

### 2.3 Corrección a un diagnóstico de la sesión

Durante el TP se dijo que «el análisis no leyó el aparato aunque "Mi lectura" lo pedía». **Es falso** (leído en el análisis guardado):
- En **4:12**, `textualCriticism` registra la omisión de ὁ ante νομοθέτης por 𝔓74, 𝔓100 y B, y anota «Esta diferencia debe conservarse al evaluar la lectura atributiva».
- En **4:14** registra τὸ / τὰ / omisión con sus testigos, y que «la puntuación editorial no constituye por sí misma evidencia».

**Lo que falla es el paso siguiente.** El criterio decisivo de 4:14 («La presencia de τὸ permite reconocer… un objeto completo») descansa justo en la palabra que la crítica textual acaba de marcar como dudosa, y no lo dice. La prosa hereda el silencio. **El hallazgo está en el análisis; no llega a la decisión ni al texto que se entrega.**

## 3. Los cuatro cambios, por impacto

### P1 · Lo que dice el aparato llega al criterio y a la prosa

**Regla de dominio, determinista** (sin modelo): para cada pregunta, si el criterio decisivo —o la traducción decidida— **menciona una forma que tiene variantes** en `textualCriticism.variants` (lema, o lectura de una variante), la respuesta está **condicionada por el texto**. Entonces:
1. El análisis tiene que decirlo en el criterio: sobre qué lectura decide y por qué esa.
2. **Control fijo nuevo** en «Revisión antes de entregar»: «El criterio depende de τὸ, que el aparato da como dudoso (τὰ A P 33…; omite B), y la prosa no lo menciona».
3. El compositor de prosa recibe la variante como algo que **debe** aparecer en la respuesta cuando condiciona la decisión.

Además, la decisión siempre dice **sobre qué texto** decide cuando el texto base del estudio y la edición del curso difieren. En 4:12, el estudio sigue a SBLGNT, sin artículo, y el curso lee NA28, con artículo. Esto pide guardar en el curso **la edición de referencia** (B28).

Archivos (leído): `packages/infrastructure/src/exegesis/canonicalAnalyzer/analyzerPrompts.ts`, `responseSchema.ts`, `mapAnalyzerResponse.ts`; el compositor de prosa; las reglas fijas de la tarjeta (dominio).

Medición: con los análisis guardados del TP #9, el control debe saltar en 4:14 (τό) y en 4:12 (ὁ νομοθέτης), y callar en 4:15 y 4:17. Se mide **sin gastar**, sobre datos guardados.

### P2 · El análisis separa sus inferencias de lo que dicen las fuentes

Hoy `decisiveCriterion` es un texto con fuentes. El modelo escribe la **síntesis** y la cuelga de las fuentes que solo dan las **premisas**. Pasó cuatro veces en el TP #9.

**Cambio de esquema:** `decisiveCriterion = { inference, premises: [{ text, sources }] }`.
- `premises` son lo que cada fuente dice, verificable.
- `inference` es la conclusión del análisis, **sin cita**, rotulada en la prosa como propia («La combinación de… favorece…»). Es lo que la prosa de 4:17 ya hacía bien.

El verificador coteja solo las premisas. El paso viejo, con `text` y `sources`, se lee como una premisa única, sin migrar.

Riesgo: el compositor de prosa y la vista de estudio leen `decisiveCriterion.text`. Hay que adaptar ambos y las pruebas. *Supuesto:* la regla en el prompt sola bajaría el defecto, pero no lo elimina. La regla probada es la del esquema.

### P3 · El mismo texto da el mismo veredicto

Lo trabaja ahora el frente A1. Reusar el veredicto de una cita idéntica ya juzgada, y averiguar por qué la página citada no se impuso cuando también respaldaba la cita (Varner 162). Sin esto, cada «Volver a verificar» puede traer alarmas nuevas sobre texto que no cambió, y el estudiante deja de confiar en las alarmas.

### P4 · La revisión propone correcciones aplicables, no «Recomponer»

Hoy «Recomponer con estas observaciones» reescribe toda la prosa y se lleva las correcciones manuales. En el TP #9 nadie lo usó: cada corrección se hizo a mano, con «busca esto, reemplázalo por esto».

**Cambio:** cada observación (control fijo, criterio del curso, alarma de cita con diagnóstico) trae, cuando puede, una **propuesta concreta**:

```
{ find: string (texto exacto, único en la prosa), replace: string, why: string, source?: cita que la respalda }
```

En la tarjeta, cada propuesta se muestra como un antes y un después, con «Aplicar», «Editar antes de aplicar» y «Descartar».
- «Aplicar» guarda una versión `edited`, igual que «Editar contenido aceptado» (`SaveStepEditUseCase`), y vuelve a verificar **solo las citas de las oraciones tocadas**.
- Una propuesta cuyo `find` no aparece exactamente una vez no se ofrece.
- La alarma de cita con diagnóstico «afirmación mixta» propone partir la oración: lo de la fuente con la cita, y lo propio sin ella.

Esto también resuelve el **B36**: llevar a la prosa la corrección de una alarma desde la página de revisión.

**Lo que no se automatiza:** elegir entre dos lecturas. Una propuesta puede ser «nombra la rival» o «di sobre qué texto decides», pero nunca «cambia tu decisión».

## 4. Orden y medición

1. **P1 y P3** primero. P1 es determinista y se mide gratis sobre el TP #9. P3 ya está en curso.
2. **P2** después: cambia el esquema y el analizador, y se mide regenerando los 4 análisis del TP #9. Ese gasto se pide antes (la API es prepago).
3. **P4** al final: es la que más interfaz lleva, y se apoya en las tres anteriores para tener qué proponer.

**Prueba de la fase: el TP #10.** Contar lo mismo que en §2.2. La fase cumple si:
- las correcciones que solo encontró una persona bajan de 11 a 3 o menos;
- las alarmas falsas de citas bajan de 9 a 1 o menos;
- y la tarjeta no inventa nada.

## 5. Crítica previa

- **¿P1 no avisará de más?** Si una variante es trivial (orden de palabras sin efecto), el control saltaría igual. Mitigación: solo salta si la forma de la variante aparece en el **criterio** o en la **traducción decidida**, no en cualquier parte del análisis.
- **¿P4 no termina redactando por el estudiante?** Propone frases, sí. Pero cada una se ve, se puede editar y se aplica una por una, y nunca toca la decisión. El riesgo real es que el estudiante acepte todo sin leer. Por eso la propuesta muestra su `why` y su fuente, y no hay «Aplicar todo».
- **¿P2 rompe trabajos viejos?** No, si el lector acepta las dos formas. Hace falta una prueba con un análisis viejo guardado.
