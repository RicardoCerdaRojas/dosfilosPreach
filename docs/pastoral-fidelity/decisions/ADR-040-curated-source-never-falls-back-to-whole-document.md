# ADR-040 — Una fuente con receta nunca cae al documento entero

## Estado

`accepted`

## Fecha

2026-09-27

## Contexto

Cuando el autor elige las hojas de un libro en el selector de páginas, esa
selección se guarda como `excerptRecipe.sheetRanges`. El texto NO se guarda: la
receta declara qué admitió el trabajo y el material se lee cuando hace falta.

Tres caminos distintos arman texto a partir de una fuente —el analizador
canónico, el generador de pasos y el constructor de evidencia del verificador— y
los tres tenían el mismo respaldo para el modo `full-document`: leer el
documento completo.

Ese respaldo existe por una razón legítima: la carga directa de un extracto
acotado (Caso 3 del diseño v1.5) no tiene receta, y ahí el documento entero **es**
la curaduría. El problema es que también atrapaba a las fuentes que SÍ tienen
receta, cuando la lectura curada no entregaba nada.

Medido sobre el trabajo de Jonás 4:1, con once comentarios de biblioteca y 5.498
fragmentos indexados:

- La recuperación curada se saltea entera si ninguna fuente declara receta
  (`scopes.length === 0 → return null`).
- El respaldo inlinea cada libro recortado a `220.000 / 11 ≈ 20.000` caracteres:
  **las primeras siete páginas impresas de cada obra**.
- Resultado: `commentatorEngagement` vacío en un estudio cuya rúbrica pone el
  comentario expositivo como ancla del versículo, y tres citas contra libros que
  el modelo no llegó a ver —una con `page: 0` y locator «tentative page, not
  provided»—. McComiskey quedó citado en la p. 6 de un libro de 425 páginas
  porque ahí se cortaba lo único visible.

El mismo agujero tenía una segunda boca, más silenciosa.
`CallableCuratedCorpusRetriever` siembra `byResource[resourceId] = []` para cada
fuente con receta antes de repartir los fragmentos. Un arreglo vacío es
verdadero en JavaScript, así que `if (retrieved)` daba paso y la fuente entraba
al prompt **con el cuerpo vacío y su clave de cita a la vista**. El código ya
tenía escrito por qué eso es grave:

> A source that contributed no text is not offered to the model at all. Listing
> it with an empty body is an invitation to cite from memory: the key looks
> available, the shelf is bare, and nothing downstream can tell the difference.

El guard existía; ese camino lo esquivaba. La prueba que lo ataba dejaba la
fuente FUERA de `byResource`, forma que el retriever real nunca produce, así que
pasaba en verde sobre la conducta equivocada.

Y una tercera boca, del lado del verificador. `VerifierSourcesBuilder.buildChunks`
caía al mismo respaldo, y el verificador se queda con los primeros 4.000
caracteres de cada fragmento: la portada. Con esa evidencia, **toda cita a una
página interior vuelve `not-found`**. En Jonás 4:3, las citas a Calvino en las
hojas 60 y 61 volvieron «no encontrada» mientras la hoja 60 decía, palabra por
palabra, lo que la afirmación sostenía.

## Decisión

**Una fuente que declara qué hojas admitió el trabajo no aporta nunca las hojas
que el trabajo dejó afuera.** El documento entero contradice la curaduría.

La pregunta «¿esta fuente declara qué hojas admitió el trabajo?» vive una sola
vez, en `packages/domain/src/exegesis/services/curatedScope.ts`:

```ts
export function hasCuratedScope(source: Pick<ProjectSource, 'excerptRecipe'>): boolean {
    return (source.excerptRecipe?.sheetRanges.length ?? 0) > 0;
}
```

Los tres caminos la llaman, y los tres aplican la misma regla:

1. La recuperación curada se pide para las fuentes con receta.
2. Un resultado vacío para una de ellas **no** habilita el respaldo: la fuente se
   retira del prompt, como cualquier otra fuente sin texto.
3. Una fuente **sin** receta conserva la conducta anterior sin cambios.

El `if (retrieved)` pasa a `if (retrieved && retrieved.length > 0)` en los dos
casos de uso que arman el bloque de fuentes.

## Alternativas consideradas

**Dejar el respaldo y ampliar el presupuesto.** No resuelve nada: el problema no
es cuánto texto entra sino cuál. Veinte mil caracteres del frente de un
comentario no hablan del versículo por muchos que sean.

**Dejar entrar la fuente con cuerpo vacío y confiar en el prompt.** Es lo que
hacía. El modelo ve una clave de cita disponible y cita de memoria; nada río
abajo distingue esa cita de una verdadera.

**Deduplicar también la copia de `retrieveCuratedCorpus.ts`.**
`packages/functions` corre en otro runtime y no puede importar del dominio. Se
dejó la tercera copia, verificando que su modo de falla quede del lado seguro:
si divergiera, la fuente llegaría sin entrada en `byResource` y caería en el
guard nuevo.

## Consecuencias

- Un paso puede generarse con menos fuentes que las que el plan asignó. Es lo
  correcto: una fuente que no aportó texto no debe aparecer como si lo hubiera
  hecho. El `console.warn` nombra cuáles quedaron afuera.
- Del lado del verificador, la fuente entra **vacía pero reconocida**, para que
  pueda decir «no se pudo comprobar» en vez de «no encontrada». Ver
  [ADR-042](./ADR-042-could-not-check-is-not-not-found.md).
- La medición que motivó el cambio vale para un solo trabajo de diecinueve —era
  el único con fuentes de biblioteca en modo `full-document`— pero la segunda
  boca del defecto alcanza a **43 fuentes con receta repartidas en 8 trabajos**,
  cada vez que la recuperación vuelve vacía para alguna.

## Impacto

`AnalyzeVerseCanonicallyUseCase`, `GenerateStepUseCase`, `VerifierSourcesBuilder`,
y el nuevo `curatedScope.ts` en dominio.

## Referencias

- PR #710 — el analizador y el generador.
- PR #714 — el verificador.
- [ADR-041](./ADR-041-the-anchor-never-stays-silent.md) — por qué el ancla nunca calla.
- [ADR-042](./ADR-042-could-not-check-is-not-not-found.md) — «no pude comprobar» no es «no existe».
