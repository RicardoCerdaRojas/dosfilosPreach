# ADR-042 — «No pude comprobar» no es «no existe»

## Estado

`accepted`

## Fecha

2026-09-27

## Contexto

El verificador de citas tenía una rama para el caso en que reconoce la fuente
pero no hay fragmentos legibles contra los cuales cotejar. Devolvía `not-found`,
**el mismo veredicto que una cita cuya fuente no está en el corpus**.

Los dos casos se ven iguales en pantalla y no lo son. Uno es un hallazgo: ninguna
fuente del trabajo lleva ese nombre, y la cita es sospechosa. El otro es una
ausencia de información nuestra, y la cita puede estar perfecta.

De los dos errores posibles, el peor es el segundo, porque tiene una
consecuencia que el primero no tiene: **el autor borra una cita correcta**. La
pantalla le dice que la fuente no respalda lo que escribió.

Medido en el estudio de Jonás 4:3. Las citas a Calvino en las hojas 60 y 61
volvieron «no encontrada» con esta nota:

> Los fragmentos proporcionados comentan el inicio del libro de Jonás
> (capítulo 1), mientras que la cita se refiere al deseo de muerte del profeta,
> un evento que ocurre más adelante.

La hoja 60 de ese mismo libro, leída de `document_chunks`, dice: «esta oración
brotó de un celo piadoso y santo; empero Jonás pecó en cuanto a su medida o
exceso». La afirmación del análisis era «Calvino considera que la oración de
Jonás, aunque surge de un celo piadoso, es pecaminosa en su exceso». La cita era
correcta y la hoja estaba admitida.

## Decisión

**Una fuente reconocida sin evidencia legible devuelve `manual-pending`, no
`not-found`.** No poder comprobar no es haber comprobado y no hallar.

La fuente entra al verificador aunque venga vacía, para que la **reconozca**:
dejarla fuera devolvía «ninguna fuente coincide», que se informa igual que una
cita inventada. Por eso `VerifierSourcesBuilder.build` deja pasar una fuente con
receta aunque no tenga fragmentos.

Una cita cuya fuente no está en el corpus sigue siendo `not-found`, sin cambios:
ahí sí se sabe algo.

## Cambio de política

`manual-pending` **no bloquea** la aceptación del paso; `not-found` **sí**. Una
cita cuya evidencia no se pudo leer deja de bloquear.

Es deliberado: este camino significa que algo de infraestructura falló, y trabar
al autor sin salida no lo ayuda a decidir —marcaría «revisada» y seguiría
igual—. Pero es una decisión de producto y corresponde dejarla escrita, no
enterrada en un cambio de string.

Si en el futuro se prefiere que bloquee, el cambio está en
`unreviewedBlockingCitations` y afecta también a las `manual-pending` que vienen
de una llamada fallida al modelo.

## Alternativas consideradas

**Un estado nuevo, `evidence-unreadable`.** Es el nombre más honesto, y se
descartó por costo: obliga a tocar los contadores, la interfaz y los textos de
las dos lenguas para un caso que sólo aparece cuando la infraestructura falla.
`manual-pending` ya significa «un humano tiene que mirar esto», que es
exactamente lo que corresponde.

**Dejar `not-found` y mejorar la nota.** La nota ya explicaba el problema y no
alcanzó: el contador de la cabecera dice «No encontrada · 2» en rojo, y eso es
lo que el autor lee.

## Consecuencias

- Los contadores de la pantalla de revisión cambian de forma en este caso: lo que
  salía en rojo sale ahora como revisión manual.
- El texto del veredicto pasa a nombrar la causa real: «No se pudo leer la
  evidencia admitida de esta fuente; revisa la cita a mano».
- Una cita sin comprobar puede llegar a la entrega sin que nada la trabe. Es el
  costo aceptado arriba.

## Impacto

`GeminiLlmCitationVerifier.verifyOne`, `VerifierSourcesBuilder.build`.

## Referencias

- PR #714.
- [ADR-040](./ADR-040-curated-source-never-falls-back-to-whole-document.md) — por qué la fuente puede quedarse sin evidencia.
