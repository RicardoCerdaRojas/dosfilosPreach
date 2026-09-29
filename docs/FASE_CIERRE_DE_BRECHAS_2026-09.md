# Fase — Cierre de brechas · septiembre 2026

**Qué es.** Ocho pendientes ordenados por daño actual y valor para quien usa
el producto. Ninguno agrega una función nueva: todos cierran un lugar donde el
sistema pierde trabajo, pierde libros o afirma algo que nadie comprobó.

**De dónde salen.** Lo que el barrido de punta a punta del 2026-09-02
(`docs/SESION_PRUEBAS_2026-09-02.md`) dejó sin PR, más lo que apareció al
probar en producción los PRs #539-#542.

**Definición de terminado, por ítem.** Cambio desplegado, probado a mano en
producción y con la regla durable escrita en byblos. Un ítem no se cierra
porque el código exista: se cierra cuando alguien lo vio funcionar.

---

## Estado

| # | Pendiente | Estado |
|---|---|---|
| 1 | Autosave del editor de recursos, sin acuse | ✅ desplegado (#543) |
| 2 | El auto-indexador no dispara en creación | ✅ desplegado (#544, #546, #547) |
| 3 | Higiene de datos de la biblioteca | ✅ cerrada (NTG 28 sustituido por un born-digital) |
| 4 | Informe previo al subir un PDF | ✅ hecho (terminal + aviso en la app) |
| 5 | Fork de la guía de estilo por trabajo | ✅ hecho |
| 6 | El binding `allUsers` del auto-indexador | ✅ quitado y verificado en producción |
| 7 | Telemetría de extracción | pendiente · pide diseño |
| 8 | `completeRegistration` sin rate-limit propio | ✅ desplegado (#495, anterior a este documento) |

---

## 1 · Autosave del editor de recursos, sin acuse

**Qué pasa hoy.** `updateMarkdown` guarda 1,5 s después de que el usuario deja
de escribir. No dice «guardando» ni «guardado», y si falla no se entera nadie:
la mutación sólo invalida al terminar.

**Por qué va primero.** Es el único pendiente de la lista que puede DESTRUIR
trabajo del usuario. Los demás degradan calidad o hacen esperar; éste borra lo
que alguien escribió.

**Dónde.** `useFacultyExtractions.updateMarkdown`, montado desde
`pages/faculty/library.tsx` y `pages/faculty/ProjectLibraryPage.tsx` sobre
`FacultyDocumentEditor`, cuya barra ya tiene el hueco donde vive
«Procesando…».

**Decisiones del fundador:** dónde va el indicador, y si hay que avisar al
cerrar o navegar con cambios sin guardar.

## 2 · El auto-indexador no dispara en creación

**Qué pasa hoy.** `autoIndexOnExtractionReady` es un `onDocumentUpdated`:
exige una TRANSICIÓN de `textExtractionStatus` a `ready`. La subida normal la
produce; un documento que NACE en `ready` no la produce nunca — que es el caso
de la biblioteca clonada de la cuenta embajador. Y su tope de 540 s no alcanza
para libros de más de 500 chunks: Wallace, con 959, hay que indexarlo por el
callable de 900 s.

**Qué significa para el usuario.** Un libro sin indexar NO EXISTE para el
sistema: no aparece en búsquedas, no se puede citar, y el trabajo se escribe
sin él sin declarar que faltaba.

**Mitigación ya desplegada (#541):** la tarjeta deja de girar para siempre y
recupera su botón «Procesar». Falta que no haga falta pulsarlo.

## 3 · Higiene de datos de la biblioteca

**Corrección al barrido:** los duplicados que reportaba (Kittel ×2, NTG 28 ×2,
Barrick ×3, Gelston ×2) se habían medido sobre la colección entera, con las
DOS bibliotecas juntas. Veintidós títulos existen en la cuenta del fundador y
en la del embajador, y eso no es un duplicado: es que cada usuario tiene su
copia.

**Hecho (2026-09-05):**
- 5 copias reales borradas —detectadas por páginas + caracteres, no por
  título, que es por lo que dos se llamaban distinto— y 3.373 chunks huérfanos
  con ellas. El proyecto «Teología II - Cristología» quedó apuntando a las
  copias completas antes del borrado.
- Cobertura medida chunk a chunk en los 49 libros de más de 50 páginas: 43
  estaban completos, 6 no. Tres eran duplicados; los otros tres se
  re-extrajeron y quedaron al 100% —MacArthur pasó de la página 64 de 1.011 al
  libro entero—. Costo real: cero páginas, porque Gemini agotó tokens en los
  tres y pdf-parse, que es gratis, entregó el texto completo.

**El NTG 28 se quitó y se sustituyó.** Era un escaneo puro —cero fuentes, 2.040
caracteres extraíbles en 1.020 páginas— cuyo griego venía de OCR sin acentos ni
espacios. Gemini se niega a transcribirlo (`finishReason=RECITATION`) y
LlamaParse `premium` costaría 45.900 créditos contra un cupo de 10.000. En su
lugar entró un NA28 born-digital: 1.006 páginas, índice completo, ratio de
diacríticos 0,198 y los signos críticos preservados. Costo cero.

**El aparato crítico queda en Metzger**, con `exegeticalType: 'critical-apparatus'`
(rol técnico): nombra los testigos en prosa sin ambigüedad. El NA28 nuevo sirve
para el TEXTO, no para el aparato — su capa de texto rinde `ℵ` como `a` (que en
el aparato es un latino antiguo) y `𝔓` como `P`. No se corrige automáticamente:
una regla que acierte casi siempre fabrica testimonio falso el resto de las
veces.

**Pendiente heredado:** el BHQ de los Doce Profetas tiene cero letras hebreas en
el índice. El AT sigue sin aparato usable.

**El NA28 born-digital entró después** (1.006 págs, índice completo, griego
buscable) y quedó marcado como uso personal —`All rights reserved /
permission required` + `approved_metadata_only`—: su aparato pierde dos siglas
al convertirse en texto (`ℵ`→`a`, `𝔓`→`P`) y no se redistribuye. La reparación
de esas siglas tiene requerimiento propio en
`docs/APARATO_REPARACION_DE_SIGLAS.md`.

Lo que sigue no es desarrollo: es limpieza sobre datos reales.

| Qué | Efecto |
|---|---|
| Duplicados — Kittel ×2, NTG 28 ×2, Barrick ×3, Gelston ×2 | El mismo pasaje vuelve dos veces y **parece confirmación cruzada de dos fuentes**. Es evidencia falsa dentro de un trabajo académico. |
| NTG 28 sin acentos — 681.644 letras griegas, ratio de diacríticos 0,000 | Buscar `ὀνειδίζοντος` no lo encuentra. Sirve para leer, no para buscar formas, que es para lo que se usa. |
| El léxico de Tuggy tipado `grammar` | No pre-filtra bajo el rol correcto al elegir corpus. Ojo: la rúbrica valida contra el `SourceType` del PAPER, no el de la biblioteca. |
| 36 recursos sin `coversBibleBooks` | El ranqueador no puede priorizarlos por pasaje. El botón «Detectar» ya existe. |
| Metadatos que mienten — Metzger rotulado «UBS4» siendo el compañero del UBS3 | Una bibliografía citaría edición y año equivocados. |

**Lección transversal, todavía sin explotar:** los datos de publicación se
pueden LEER de las primeras páginas del propio `structured.md`. La portada
indexada es una fuente de verdad gratis que hoy no se usa.

## 4 · Informe previo al subir un PDF

**Qué pasa hoy.** Subir → nueve minutos → debitar páginas → descubrir que el
libro entró mudo.

**Qué se sabe sin gastar nada.** Los cuatro libros del barrido se
diagnosticaron en menos de un segundo cada uno, con herramientas locales, sin
modelo y sin gastar una página. El nombre de la fuente en `pdffonts` predice
la familia de falla: `GlyphLessFont` es capa OCR de Tesseract; encoding
`Custom` sin embeber es griego mal mapeado.

**Límite honesto que el copy debe respetar:** predice la fidelidad del
CONTENIDO, no la fiabilidad del SERVICIO. No habría anticipado el
`failed: unknown` de LlamaParse.

**Hecho (2026-09-05).** `diagnosePdfSource` vive en el dominio, probado contra
seis libros reales, y lo usan las dos superficies: `npm run diagnosticar` desde
la terminal y un aviso en el formulario de subida que lee el PDF **en el
navegador**, sin subir nada.

Dos decisiones del fundador quedaron fijadas: **sólo advierte, nunca bloquea**
—hay libros que el diagnóstico no puede juzgar y quien decide es quien conoce
el libro—, y **el copy no usa jerga**: «este archivo son fotos de las páginas,
no texto», no «carece de capa de texto».

Y una tercera, aprendida equivocándose: **se muestrea el MEDIO del libro**. La
primera versión miraba 40 páginas y aprobó un interlineal hebreo de 2.013
cuya portada es inglés y cuyo hebreo entero son códigos latinos.

## 5 · Fork de la guía de estilo por trabajo

**Qué pasa hoy.** La rúbrica y el encuadre se COPIAN al trabajo; la guía de
estilo sólo se referencia por id. Editarla afecta a todos los papers que la
apunten, **incluidos los ya entregados**. No hay selector por trabajo:
`styleGuideId` sólo se escribe desde los defaults del planificador.

## 6 · El binding `allUsers` del auto-indexador

`autoIndexOnExtractionReady` es un disparador de Firestore: lo invoca Eventarc
con una cuenta de servicio, no un navegador. El binding `allUsers` →
`roles/run.invoker` es superficie abierta sin motivo. Detectado por
`scripts/check-functions-invokers.sh` en su primera corrida contra producción.

Valor de usuario: cero. Costo: un comando. Está en la lista porque es gratis,
no porque compita con lo de arriba.

**Hecho (2026-09-05).** Antes de quitarlo se comprobó que sus tres hermanos
—`extractpdfwithgemini`, `indexresourcetask`, `generarplanjob`— corren con CERO
bindings y funcionan: la invocación viene del `roles/run.invoker` que la cuenta
de servicio tiene a nivel de proyecto. Quitado el binding, se forzó un
reindexado real y el disparador encoló e indexó igual. `check-functions-invokers`
queda en verde por primera vez.

## 7 · Telemetría de extracción

`scripts/extraction-bakeoff/` mide fidelidad de escritura, costo y cobertura
por motor, offline. La extracción en producción corre sobre libros reales
todos los días y no registra ninguna de esas métricas.

**Restricción:** la ficha guarda números y perfiles derivados. Nunca páginas.
Los libros son material con derechos.

### Diseño (acordado con el fundador, 2026-09-29)

**Qué hay hoy.** Los tokens de Gemini se registran agregados por día, mes y
función (`llmUsageDaily/Monthly`, feature `library.pdfExtraction`), pero nunca
por recurso ni por corrida. Duración y reintentos viven sólo en memoria.
`scriptCensus` cuenta letras por escritura, no diacríticos, niqqud, U+FFFD ni
marcas huérfanas; y el camino por cola (`extractRangeTask`) ni siquiera lo
escribe. El informe del saneador sólo va a `console.log`.

**Preguntas que la ficha tiene que contestar.**

1. ¿Qué motor resuelve los libros reales, y a qué costo por libro?
2. ¿Cuándo sale roto el texto sin que nadie se entere? Griego con pocos
   diacríticos, hebreo sin niqqud o invertido, U+FFFD, marcas huérfanas.
3. ¿Dónde se cae? Razón, reintentos, duración contra el tope de 540 s, cola
   frente a pasada única.
4. ¿El informe previo al subir predice el resultado?

**La ficha: `extraction_runs/{runId}`, una por corrida.** Sólo números:

- identidad: `resourceId`, `uid`, camino (única · cola · reproceso · `processWithGemini`);
- tiempo: inicio, fin, `durationMs`;
- cascada: cada motor intentado con su tiempo, resultado y razón; `extractionVersion` final;
- páginas: esperadas, emitidas, cobertura, faltantes;
- costo: tokens de Gemini (entrada, salida, pensamiento) y USD; créditos de LlamaParse;
- reintentos de la cola;
- desenlace: `ready` · `failed` · `stalled` · `cancelled`, con su razón;
- `fidelity`: los números de `scriptFidelity` más la dirección del hebreo;
- conteos del saneador;
- el veredicto del informe previo, con sus números.

**Decisiones.**

- **El veredicto del informe previo se guarda al subir.** La web ya lo calcula
  (`usePdfPreflight`); se persiste en el recurso y la corrida lo copia, para
  poder contestar la pregunta 4.
- **Retención indefinida.** Es un documento chico por corrida; la historia por
  motor tiene que poder compararse en el tiempo.
- **Sólo administración.** Quien usa la app ya ve el diagnóstico de su tarjeta
  (`assessExtraction`); la ficha es para nosotros.

**Alcance: un PR con UI.**

1. `scriptFidelity` pasa del bakeoff a `domain`, con prueba de paridad.
2. `recordExtractionRun` en `functions`, llamado en las escrituras de `ready` y
   `failed` de los cuatro puntos de entrada, más `sweepStalledExtractions` y
   `cancelExtraction`. Una falla al registrar nunca tumba la extracción.
3. El camino por cola escribe `scriptCensus`, que hoy le falta.
4. Página `/admin/extraccion`: totales por motor (costo por página, tasa de
   fallo, alertas de fidelidad) y lista de corridas. Reglas: sólo lectura
   para administración.

## 8 · `completeRegistration` sin rate-limit propio

Residual del endurecimiento de auth previo al lanzamiento. Riesgo bajo,
documentado desde el cierre de aquel bloqueador.

**Ya estaba hecho cuando se escribió esta lista.** El PR #495 (2026-08-27)
puso el tope por IP —20 intentos por hora, bucket `registration`— sobre el
limitador compartido `shared/rateLimit.ts`, fail-open. La lista heredó el
pendiente de la memoria del bloqueador de auth, que no se había actualizado.
Queda sin ver en producción un documento `rate_limits/registration__*`; el
código lleva un mes desplegado en todos los deploys a main.
