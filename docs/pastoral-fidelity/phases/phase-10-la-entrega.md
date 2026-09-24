# Fase 10 — La entrega no tiene la forma del pasaje, tiene la forma de la pregunta

> Estado: propuesta. Medido el 2026-09-23 contra el trabajo práctico de Santiago 2:1–13,
> que hubo que armar a mano aunque el estudio ya estaba completo y verificado dentro del sistema.

## El caso que lo destapó

El 2026-09-23 el estudio de Santiago 2:1–13 estaba terminado dentro del sistema: seis análisis
canónicos aceptados (2:1, 2:2, 2:3, 2:4, 2:8, 2:9), 36 citas verificadas contra la página impresa,
dos revisadas a mano, cero sin resolver. El corpus tenía fichas bibliográficas para tres de las
cuatro fuentes. La portada estaba configurada. La voz estaba configurada.

Y el documento se escribió a mano, fuera del sistema.

Esto no ocurrió porque faltara el exportador. `packages/web/src/lib/exegesis/exportPaperToDocx.ts`
ya produce un `.docx` con portada, márgenes y tamaño de hoja TMS, notas al pie **nativas**,
bibliografía con sangría francesa en página nueva, y alineación derecha para el hebreo. Es un
exportador serio. Ocurrió porque **lo que el exportador recibe no tiene la forma de una entrega.**

## Lo que ya existe (no reconstruir)

| Pieza | Dónde | Qué hace |
|---|---|---|
| Exportador Word | `packages/web/src/lib/exegesis/exportPaperToDocx.ts` | portada, notas al pie nativas, bibliografía con sangría francesa, hebreo RTL |
| Maquetación TMS | `packages/web/src/lib/exegesis/tmsLayout.ts` | hoja, márgenes, interlineado, estilos de párrafo |
| Portada como dato | `PaperCover` en `packages/domain/src/exegesis/entities/ExegeticalPaper.ts` | `institution`, `assignmentTitle`, `author`, `place`, `date`, `course` |
| Ficha bibliográfica | `formatBibliographyEntry`, `hasCompleteBibliography`, `missingBibliographyFields` | formatea y valida una ficha |
| Tarjeta de bibliografía | `packages/web/src/components/exegesis/PaperBibliographyCard.tsx` | muestra las fichas en pantalla |
| Ensamblado | `assembleFromAcceptedSteps` en `packages/domain/src/exegesis/entities/exportPaperToMarkdown.ts` | concatena pasos aceptados |

## Las seis brechas, medidas

### 1. La salida se organiza por versículo; la entrega se organiza por pregunta

`assembleFromAcceptedSteps` emite `## Versículo N` por cada paso aceptado, en orden de pasaje.
El encuadre de esta semana pedía cuatro respuestas numeradas:

| Pregunta | Versículos que necesita |
|---|---|
| 1 — los genitivos | 2:1 |
| 2 — `ἐάν` y su relación con el v. 4 | 2:2 **y** 2:4 |
| 3 — `μέντοι` | 2:8 |
| 4 — el participio `ἐλεγχόμενοι` | 2:9 |

El sistema habría emitido seis secciones (una por versículo estudiado, incluidos 2:3 y 2:4 sueltos)
y **ninguna** habría respondido la pregunta 2, porque esa pregunta cruza dos versículos que el
ensamblado mantiene separados. La unidad de salida está cableada al versículo.

Esto emparenta con [phase-9](./phase-9-unit-of-analysis.md), pero no es lo mismo: la fase 9 dice que
el versículo no es la unidad de *análisis*; esta dice que tampoco es la unidad de *entrega*, y que
quien fija la unidad de entrega es el encuadre, no el pasaje.

### 2. La cabecera del markdown es un artefacto de trabajo, no de entrega

`exportPaperToMarkdown` antepone siempre `# título`, `**Pasaje:**`, `**Exportado:**` y el encuadre
completo como blockquote, seguidos de `---`. Un trabajo académico con portada no lleva nada de eso:
el cuerpo empieza en la pregunta 1. Cuando `paper.cover` existe, esa cabecera debe suprimirse.

### 3. El formato de cita está cableado a nota al pie

`CITATION_PATTERN` (línea 358) busca `(Autor, "Título", p. N)` y lo convierte en nota al pie nativa.
El encuadre de esta semana pedía cita parentética `(Apellido, página)` más bibliografía al final —
sin notas. Son dos convenciones académicas legítimas y la rúbrica es quien debe elegir. Hoy no hay
dónde declararlo, y el patrón además **exige el título entre comillas**: una cita escrita
`(Porter, 262)` no coincide, no se convierte, y queda en el cuerpo como texto suelto.

### 4. Nadie genera la bibliografía

El exportador sabe *maquetar* una bibliografía: si encuentra un encabezado que casa con
`/^(bibliograf|works cited|bibliography)/i`, le pone sangría francesa y la manda a página nueva.
Pero **nada la produce**. `formatBibliographyEntry` solo se usa en pantalla
(`PaperBibliographyCard`, `BibliographyEditDialog`). El puente falta entero:

1. juntar las fuentes efectivamente citadas en los pasos aceptados,
2. resolver la ficha de cada una,
3. ordenarlas por `authorSorted`,
4. emitir la sección.

Y falta el aviso: **Adamson tiene `bibliography: null`** en el corpus, porque su PDF no tiene página
legal detectable. Hoy eso no se descubre hasta que alguien mira el documento entregado y ve una
entrada vacía. `missingBibliographyFields` ya existe para decirlo antes.

### 5. El interlineado está cableado a doble

`BODY_PARAGRAPH` usa `TMS.doubleLine` (`tmsLayout.ts:44`). El encuadre de esta semana pedía
interlineado simple con una línea en blanco entre párrafos. Es la norma de la casa contra la norma de
la entrega, y hoy gana la de la casa sin que nadie pueda cambiarlo. La maquetación debe poder
tomarse de la rúbrica.

### 6. Nadie sabe qué fuentes usó la entrega anterior

La norma del curso prohíbe repetir **fuentes secundarias** (comentarios y artículos académicos) entre
trabajos consecutivos — no alcanza a gramáticas, léxicos ni aparato crítico. Esta semana esa
restricción se aplicó a mano: Ropes quedó fuera por haberse usado la semana pasada; Wallace se
mantuvo por ser gramática. El sistema no tiene memoria entre trabajos y no puede avisarlo.

## Orden propuesto

1. **Brechas 2 y 5** — mecánicas, sin decisiones de diseño. La cabecera se suprime cuando hay
   portada; la maquetación sale de la rúbrica.
2. **Brecha 4** — la bibliografía, con el aviso de ficha incompleta antes de exportar. Es la que
   más riesgo de entrega quita y toda la pieza ya está construida salvo el puente.
3. **Brecha 3** — el formato de cita como campo de la rúbrica, y el patrón tolerando
   `(Apellido, página)` sin título.
4. **Brecha 1** — la unidad de entrega. La más grande y la que conviene resolver después de
   [phase-9](./phase-9-unit-of-analysis.md), porque comparten la pregunta de fondo.
5. **Brecha 6** — memoria entre entregas. Separable; puede esperar.

## Lo que este documento NO propone

No propone reemplazar el exportador Word: es bueno y hay que conservarlo entero. No propone que el
modelo redacte el trabajo de punta a punta sin el paso de aceptación — el estudio ya se acepta paso
a paso y ese control no se toca. La brecha está entre el estudio aceptado y el archivo entregado, y
solo ahí.
