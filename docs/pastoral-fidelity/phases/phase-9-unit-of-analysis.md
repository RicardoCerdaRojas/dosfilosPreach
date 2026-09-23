# Phase 9 — La unidad de análisis: el versículo no es la unidad de la sintaxis

## Estado

`planned`, y con prioridad sobre la fase 8. Sale del trabajo práctico de Santiago 2:1–13
(2026-09-23), pero el defecto no es de ese trabajo: afecta a todo lo que el módulo ha
producido.

## El hallazgo

El módulo analiza **un versículo por paso**. Eso es una decisión de producto razonable para
repartir el trabajo y para que el pastor revise de a poco. El problema es que se coló en el
ANÁLISIS: la sintaxis griega no respeta los versículos, y hoy el analizador tampoco puede
verla cruzar.

Tres comprobaciones sobre el código, todas verificadas:

1. **El texto original que ve el analizador es el de su propio versículo.**
   `AnalyzeVerseCanonicallyUseCase.loadOriginalLanguageText` llama a
   `provider.getChapterContent(bookId, chapter)` —que devuelve el CAPÍTULO ENTERO— y
   acto seguido lo recorta a `[verseStart, verseEnd]` del paso. El contexto ya está en
   memoria y se tira.

2. **Hacia atrás hay continuidad; hacia adelante, ninguna.**
   `collectPriorAcceptedAnalyses` filtra `s.order < currentStep.order`. El análisis de 2:4
   puede ver el de 2:2 —si 2:2 ya fue ACEPTADO—, pero el de 2:2 no puede ver el de 2:4 de
   ninguna manera.

3. **El paso de prosa no ve a sus hermanos.**
   `GenerateStepUseCase.collectPriorAccepted` abre con `if (step.kind === 'verse') return [];`.
   La introducción y la conclusión sí reciben los pasos aceptados; los versos, no.

## Por qué esto importa: la sintaxis no se resuelve de izquierda a derecha

El caso testigo es la pregunta 2 del trabajo práctico, que el propio profesor formuló
cruzando versículos: *«¿Cómo funciona ἐάν (Stg. 2:2)? ¿Qué relación tiene con el
versículo 4?»*.

Santiago 2:2–4 es **un solo período condicional**. La prótasis son cuatro subjuntivos
aoristos que corren desde el v.2 hasta el v.3 —ἐὰν εἰσέλθῃ… εἰσέλθῃ δὲ… καὶ ἐπιβλέψητε…
καὶ εἴπητε— y la apódosis es el v.4: οὐ διεκρίθητε ἐν ἑαυτοῖς. Hoy el analizador ve el v.2
solo: una prótasis sin su apódosis. No puede decir qué clase de condición es ni qué función
cumple, porque la evidencia está dos versículos más adelante y el sistema la recortó.

No es el único caso del mismo trabajo:

| Construcción | Dónde está la evidencia | ¿La ve hoy? |
|---|---|---|
| Período condicional con `ἐάν` (2:2) | apódosis en 2:4 | no |
| Partícula adversativa `μέντοι` (2:8) | el contraste, en 2:6–7 | solo si 2:6–7 ya fueron aceptados |
| Participio `ἐλεγχόμενοι` (2:9) | el argumento de la ley, en 2:10–11 | no |

**Y el defecto es viejo.** En la biblioteca de trabajos hay dos sobre Hebreos 1:1–4, que en
griego es **una sola oración periódica**. El sistema la analizó como cuatro versículos
independientes.

## Lo que NO es

No es un problema de cantidad. Generar los trece versículos no arregla nada: cada análisis
seguiría viendo su propio versículo, y la conexión seguiría sin aparecer. Tampoco es un
problema del modelo: es el recorte que le llega.

## Opciones de diseño

**A. Ventana de contexto en el análisis.** El analizador sigue produciendo un análisis por
versículo, pero recibe el texto original de toda la perícopa, con su versículo marcado. El
prompt ya distingue `paperPassage` de `verseRef`, así que la pieza existe. Costo de datos:
CERO —el capítulo ya está cargado y se recorta—; costo de prompt: unas pocas líneas de
griego. Resuelve las tres filas de la tabla.

**B. El período como unidad del paso.** Los pasos dejan de ser «un versículo» y pasan a ser
«una unidad sintáctica»: 2:1, 2:2–4, 2:5–7, 2:8–9, 2:10–11, 2:12–13. Es lo correcto desde la
gramática y lo más caro: hay que detectar los períodos, y equivocarse parte una oración por
la mitad, que es justo lo que se quiere evitar.

**C. Mapa de períodos como paso previo.** Una pasada sobre la perícopa que solo marque dónde
empieza y termina cada oración o período, y después cada paso de versículo recibe los límites
de su período y el texto completo de ese período. Es B sin renunciar al versículo como unidad
de revisión.

**D. Continuidad hacia adelante en la prosa.** Levantar el `return []` de los pasos de verso
para que vean a sus hermanos aceptados. Ayuda hacia atrás y no resuelve la asimetría: el v.2
sigue sin poder mirar el v.4.

## Recomendación

**A ahora, C después.** A es casi gratis —el dato ya está cargado y se descarta— y cierra el
caso que el profesor preguntó explícitamente. C es la forma correcta de la unidad y necesita
diseño propio: cómo se detecta un período, qué pasa cuando el modelo se equivoca al marcarlo,
y cómo se revisa un paso que cubre tres versículos sin volver al paper de doce páginas.

B no la haría: cambia la unidad de revisión sin haber medido si la detección de períodos es
confiable.

## Cómo se mide

Sobre Santiago 2, que ya está armado y es el caso testigo:

- El análisis de 2:2 nombra la apódosis del v.4 y clasifica la condición. Hoy no puede.
- El análisis de 2:8 nombra contra qué contrasta `μέντοι` sin depender de que 2:6–7 hayan
  sido aceptados antes.
- El análisis de 2:9 nombra la función del participio apoyándose en 2:10–11.

Y sobre lo viejo, que es la prueba de que esto no es de este trabajo: reanalizar Hebreos
1:1–4 con la ventana y ver si el análisis del v.1 reconoce que la oración no termina ahí.

## Decisiones abiertas

1. **Cuánta ventana.** ¿La perícopa del trabajo, el capítulo, o el período detectado? La
   perícopa es lo más barato y lo más defendible: es lo que el usuario declaró como su
   unidad de estudio.
2. **Qué hacer con la asimetría hacia atrás.** Si el análisis ya ve el texto de todos los
   versículos, ¿sigue teniendo sentido que además reciba los análisis aceptados anteriores?
   Probablemente sí, pero por otra razón: para no repetir el trabajo léxico, no para la
   sintaxis.
3. **Si la ventana cambia lo que ya está aceptado.** Un análisis hecho sin ventana y otro
   con ventana pueden contradecirse. Hace falta decidir si se marca, se regenera o se deja.

## Bitácora

- **2026-09-23** — Documentada al preparar el trabajo práctico de Santiago 2:1–13, después
  de que el fundador preguntara si no haría falta analizar el pasaje completo. La respuesta
  corta es que sí, y que generar los trece versículos tampoco alcanzaría.
