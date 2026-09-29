# ADR-041 — El ancla nunca calla, y elegir evidencia no es cotejar página

## Estado

`accepted`

## Fecha

2026-09-27

## Contexto

Cada fragmento que llega al modelo va rotulado con un ancla —`p. 583`,
`hoja 199`, `§ 3.2`— y el modelo copia ese rótulo dentro de la cita. Toda la
disciplina de citación descansa en esa cadena: si el ancla dice una hoja
rotulada como página impresa, la cita apunta a otro sitio del libro.

`citationAnchorFor` escribía la hoja **sólo** cuando el recurso no declaraba
numeración:

```ts
const page = printed !== null
    ? `p. ${printed}`
    : numbering === null && chunk.sheet   // ← sólo sin numeración
        ? `hoja ${chunk.sheet}`
        : '';
```

Un libro cuya numeración **sí** está guardada y declara que no lleva folio —un
tramo con `offset: null`— caía en la rama del medio y llegaba al prompt con el
ancla **vacía**. Había un test que lo fijaba a propósito, llamado «una hoja sin
número sigue sin tenerlo».

El supuesto era que callar es seguro. No lo es. Quien recibe el ancla tiene que
escribir un número, y sin ninguno lo consigue por su cuenta. Medido en el
estudio de Jonás 4: Farfán —numeración confirmada, un solo tramo sin folio—
volvió citado en **`p. 0`**. Ortiz había hecho lo mismo en la corrida anterior,
con el locator «tentative page, not provided». El fixture del test de anclas ya
traía un `page: 0` copiado de ese comportamiento, y nadie lo había leído como el
síntoma que era.

El segundo hecho es de la misma familia. `analysisClaimsToCitations` deja
`pages` en `null` cuando el libro no tiene numeración confirmada, y la decisión
es correcta: comparar una hoja contra una página impresa reprueba lo que está
bien. Pero **ese mismo valor gobierna una segunda decisión**:
`prioritizeChunksForCitedPage` lo usa para ordenar los fragmentos por cercanía y
el verificador se queda con los ocho primeros.

```ts
const range = parsePageRange(citedPages);
if (!range) return [...chunks];      // sin página, sin orden
```

Sin orden, los ocho primeros son los del principio del libro. Apagar la
comparación apagaba también la selección.

## Decisión

**Sin página impresa se rotula la hoja, sepamos o no cómo numera el libro.**

Un recurso del que no sabemos nada ya decía «hoja N». Saber MÁS del libro no
puede producir una etiqueta peor. La hoja es falsa como página y exacta como
hoja, y es un hecho verificable del archivo.

**Elegir la evidencia y cotejar la página son dos preguntas distintas, y las
contestan dos valores distintos.** `ParsedCitation` gana `evidencePage`: el
número con el que se ELIGE la evidencia, en la unidad en que están rotulados los
fragmentos de esa fuente. Casi siempre es `pages`; cuando `pages` es null por
falta de calibración, es la hoja. El cotejo sigue usando `pages` y sigue
apagándose cuando corresponde.

`pageNumberOfHint` ya leía «hoja 12» → 12, así que el lado del fragmento no
cambió: lo que faltaba era el número del lado de la cita.

### El sello de `pageKind`, que no podía quedarse igual

`stampCitationPageKind` deducía `printed` preguntándole al **libro** si resolvía
*alguna* página, apoyado en que las dos formas nunca convivían dentro de una
fuente. Con el cambio de arriba conviven —Mayor numera de la hoja 317 en
adelante y no antes— así que la fuente entera se habría sellado `printed` y una
hoja habría salido con el rótulo de página impresa comprobable: el defecto que
todo el trabajo de anclas existe para evitar, reintroducido por la puerta de
atrás.

La deducción pasa a mirar **las hojas que la fuente ofrece**: `printed` sólo si
todos los tramos de su receta resuelven, `sheet` en cuanto uno no. Y mira los
SEGMENTOS que cada tramo toca, no sus dos extremos: un tramo 50-250 sobre un
libro que no numera las hojas 101-200 tiene los dos extremos resueltos y un
hueco en el medio.

## Alternativas consideradas

**Dejar el ancla vacía y enseñarle al modelo a omitir la página.** Se apoya en
que el modelo obedezca una instrucción negativa. El proyecto ya decidió lo
contrario en `stampCitationPageKind`: «el modelo ya demostró que copia el rótulo
que se le da sin cuestionarlo, y esa obediencia es justamente lo que produjo el
defecto».

**Rotular `p. 0` explícitamente.** Escribe un número falso con forma de página.
Peor que la hoja, que al menos es verdadera en su unidad.

**Hacer que `pages` lleve la hoja y arreglar el cotejo aparte.** Devuelve el
problema al otro lado: el cotejo compararía una hoja contra una página impresa,
que es lo que `pages: null` existe para evitar.

## Consecuencias

- Tres pruebas que afirmaban el ancla vacía cambiaron de expectativa. Se
  actualizaron con la causa medida escrita al lado, no se borraron.
- Aguas abajo la cadena cierra sola: `extractPageFromHint` saca el número del
  rótulo sin anclar, así que «hoja 100» se coteja como 100. Una cita que antes
  quedaba en `page-unverifiable` —y bloqueaba la aceptación porque su número no
  venía de ningún rótulo— ahora tiene con qué compararse. El bloqueo sigue firme
  para el caso real: un fragmento sin hoja no lleva ancla y no la va a tener.
- Una fuente cuya receta cruza un tramo sin folio se sella `sheet` entera, aunque
  parte de sus citas pudieran ser páginas impresas. Es conservador a propósito:
  el sello es por fuente y marcar `printed` pondría el rótulo de comprobable
  sobre un número que nadie puede comprobar.

## Impacto

`pageNumbering.ts` (`citationAnchorFor`, y por arrastre `relabelExcerptAnchor`),
`analysisClaims.ts`, `CitationVerification.ts`, `stampCitationPageKind.ts`,
`GeminiLlmCitationVerifier.ts`.

## Referencias

- PR #711 — el ancla y el sello.
- PR #713 — `evidencePage`.
- [ADR-040](./ADR-040-curated-source-never-falls-back-to-whole-document.md) — la fuente curada y el documento entero.
