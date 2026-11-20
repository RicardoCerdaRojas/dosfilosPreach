# Bitácora del Trabajo Práctico #10 (Santiago 5:1–6, NT785)

> Abierta el 2026-11-04, en producción. Trabajo `40pjrOE2gOAl0symSHm5`, creado
> ese día a las 15:42 UTC. Proyecto `h4CAYlISkfChq1YfwOW7`, perfil «TP Semanal» (`Ym8NYgULoDfsnp3M7n60`), guía
> `EHAh9XLcCwpExmadhPMX`. Sigue a la bitácora del TI #2 (B47–B69).
> Rótulos: **medido** (contado en producción o en el Word), **leído** (en una
> fuente o en el código), **supuesto** (sin comprobar).
> Quién lo resolvió: **[motor]**, **[Claude]** o **[fundador]**.

Entrega: 2026-11-04, el mismo día; hora por confirmar.

Propósito: reunir evidencia antes de la etapa 5 de
[FASE_LECCIONES_TI2_2026-11.md](FASE_LECCIONES_TI2_2026-11.md). P2 queda fuera
de esta prueba: `ANALYZER_WRITES_PREMISES` sigue apagado hasta el 2026-11-06 y
estos análisis no traerán premisas.

## 1. Hallazgos

| # | Hallazgo | Evidencia | Estado |
|---|---|---|---|
| B70 | Al crear, las 12 fuentes del estado del arte vienen marcadas, también las que no se pueden repetir, sin ningún aviso junto a ellas. La regla rige en este proyecto (`noRepeatSources: true`). | Leído: `ProjectBibliographyOffer.tsx` no consulta la entrega anterior. Medido: captura del fundador. | abierto |
| B71 | Varner escapa de la regla de no repetir. El proyecto y el TP #9 lo clasifican como monografía, tipo libre para la regla; el TP #7 lo tenía como comentario crítico-técnico. El encuadre prohíbe a «McCartney, Motyer y Ropes», sin Varner. | Medido en el encuadre del trabajo. Causa leída en `excludedSources.ts`. | abierto |
| B72 | La rúbrica no se puede cumplir con lo permitido esta semana. Quedan Adamson y Mayor: crítico-técnico 2 de 2, expositivo 0 de 1. Si Adamson cuenta como expositivo, como en el TP #8, queda 1 de 2 y 1 de 1. Falta un requisito en cualquier caso. | Leído en producción: los comentarios de Santiago de la biblioteca son seis, y el TP #9 citó cuatro. | abierto |
| B73 | Adamson cambió de tipo: expositivo en los TP #6 y #8, crítico-técnico en el proyecto. El mismo libro cuenta distinto según el trabajo. | Leído en producción. | abierto |
| B74 | Dos fichas del sílabo apuntan al libro equivocado del mismo autor: «Santiago» (Burt) a su comentario de Jonás, y «Santiago y 1–3 Juan» (Kistemaker) a su comentario de Pedro y Judas. Son candidatas, así que no aparecen al crear; si se aprueban, un filtro por libro podría ocultarlas, y el curso creería tener esos libros. | Leído en producción. | abierto |
| B75 | La portada del tipo «TP Semanal» guarda la fecha «SEPTIEMBRE 2026». | Medido: el trabajo nació con «NOVIEMBRE 2026». No hubo daño. | descartado |
| B76 | El trabajo se creó con tres fuentes que no pueden repetirse (Motyer, Ropes, Varner) y sin Adamson ni Mayor, que sí se pueden usar. Motyer y Ropes quedan a la vez en el corpus y prohibidos en el encuadre, y ninguna pantalla lo advirtió al crear. Hipótesis: desmarcado a mano; quizá la tabla de Claude, que decía «Prohibidas en TP #9, libres ahora», confundió. | Medido en producción: 9 fuentes. Leído: los tres libros existen y la creación descarta una fuente solo si no existe o falla al guardarla. Sin comprobar con el fundador. | abierto |
| B80 | «Extraer de mi biblioteca» vuelve a preseleccionar a Varner, recién quitado del corpus. Sigue B71: como no figura entre las excluidas, entra por el ranking. Lo quitado a mano no se recuerda. | Medido: captura y corpus en producción. Causa leída en `extractionDefaults.ts`; supuesto que entró por el ranking y no a mano. | abierto |
| B81 | Mayor aparece como «· Técnica» en la tarjeta y «Según el tipo: Contraste» en el selector. Repite el #8 del TP #8. | Medido: captura del fundador. | abierto |
| B77 | Claude predijo que la propuesta de excluidas sacaría a Wallace y Robertson. Salió mejor: aparecen sin marcar, con «se puede repetir, conviene alternar». Sigue un roce menor: sus tarjetas dicen «esta no debería entrar» mientras las excluidas no se confirman. | Medido: capturas del fundador. | descartado |
| B82 | «¿Qué responde cada pregunta?» dio 3 avisos y los 3 son falsos. Adamson p. 195 y 196 tratan el juramento de 5:12–13. Mayor p. 163 (h. 441) dice «1 Pet. v. 1», leído como Stg 5:1: el índice toma «v. 1» de otra carta. Lo pedido ya está en el corpus: Adamson h. 186–196 y Mayor h. 426–434. Causa en Adamson sin leer. | Medido: texto de las hojas en producción. | abierto |
| B83 | Metzger se ve como «Edición del texto bíblico» en el selector, pero su tipo guardado es comentario del aparato. Si se guarda ese selector, la regla de no repetir dejaría de alcanzarlo. | Medido: captura y producción. Efecto de guardarlo: supuesto. | abierto |
| B84 | La extracción de Metzger dio 0 fragmentos y lo correcto es que no aporte: en Santiago 5:1–6 solo trata la variante de 5:4 (h. 724–725), que nadie preguntó. El índice de pasajes tampoco tiene ninguna referencia suya (0 en todo el libro, como en el TP #8). | Medido en producción. | abierto |
| B85 | Las hojas que responden P1 y P2 en Wallace (h. 617, perfecto proléptico; h. 663, participio de manera) no nombran Stg 5, y el índice de pasajes no las halla. La entrada δίκαιος de Tuggy (h. 243) tampoco salió entre las de Stg 5:6. Se necesita el camino por tema gramatical y por lema, como en el TP #8 (#18 y #19). | Medido en producción; h. 663 solo por el índice del libro. | abierto |
| B86 | Sigue en pantalla «Te faltan 1 fuentes» (TP #8, #11). Mejoró el aviso de imposible: ya dice que ninguna fuente permitida cubre el tipo (TP #8, #13 resuelto). | Medido: captura del fundador. | abierto |
| B78 | La portada del trabajo no trae título de la entrega. El Word usaría el título del trabajo, «Santiago 5:1-6», con guion corto. | Medido en producción (el TP #9 traía «SANTIAGO 4:11-17»). Leído: `exportPaperToDocx.ts`. | resuelto por el fundador en este trabajo: «SANTIAGO 5:1–6»; la causa sigue |
| B87 | Las hojas «elegidas a mano» no quedan fijadas: `pinnedRanges` vacío en las cuatro fuentes. Sin fijar compiten por presupuesto, y las que no nombran el versículo, como Wallace h. 617 y 663, pueden no llegar al análisis. La pantalla no lo dice. | Medido en producción. Efecto leído en `selectCorpusChunks.ts`; no medido en un análisis. | abierto |
| B88 | Tras elegir hojas de Tuggy aparecieron 3 avisos por lema, de otro tipo que los de B82. δίκαιος incompleta (falta h. 244) es cierto y útil: Claude lo había pasado por alto. γίνομαι (h. 195–197, sin Stg 5:2 en el índice de pasajes) rinde poco; πῦρ (h. 786, entrada sin leer completa) es opcional para una pregunta de sintaxis. | Medido en producción. | a favor del motor |
| B90 | Plan de uso: mejoró frente al TP #8 (#22). Tuggy y Kittel entran en varios pasos, sin el tope de 4 fuentes, y el planificador ya recibe las hojas con evidencia. Solo 5:1, 5:2, 5:3 y 5:6 quedan en el documento. | Medido: captura. Leído: `GeminiStepCorpusPlanner.ts`. | a favor del motor |
| B91 | En P4, «contraste» no contrasta: Adamson (h. 193) y Mayor (h. 433) coinciden en que «el justo» es genérico. Las lecturas rivales (Cristo; Santiago el Justo) las mencionan ellos mismos para descartarlas. El rol se asigna por tipo de fuente, no porque las voces se opongan. Vigilar que el análisis lo diga así, sin inventar una oposición. | Medido: texto de las hojas. Efecto en el análisis: por comprobar. | por comprobar |
| B79 | Siguen en la plantilla de rúbrica tres detalles anotados en el TP #8: la errata «eloos», el comentario expositivo sin justificación y «Cubre 3 de 4 áreas» sin decir cuál falta. También lista Introducción y Conclusión, que el encuadre excluye. | Medido: captura del fundador. | abierto |

### B89: por qué Claude halló hojas que el sistema no halló (pregunta del fundador)

Medido contra `proposedRanges`: de las 14 hojas o tramos de la lista de Claude, el
sistema propuso 7. Wallace 1 de 3, Robertson 3 de 3, Tuggy 0 de 4, Kittel 3 de 4.
En Adamson y Mayor la extracción trajo por sí sola las hojas de las 4 preguntas. A
su vez, el sistema vio la h. 244 de Tuggy, que Claude había omitido. La lista de
Claude aún no se prueba en un análisis: que sea mejor es supuesto.

Diferencias:

1. **Qué busca.** El sistema busca dónde se nombra el versículo. Claude partió de
   lo que pide la pregunta: de la pregunta a la categoría gramatical, y de ahí al
   índice del libro. Wallace h. 617 y 663 no nombran Stg 5.
2. **Lemas.** La revisión ya conoce la entrada de cada lema de la consigna, pero
   solo avisa. La propuesta de Tuggy no trajo ninguna (medido; causa sin leer).
3. **Leer.** La revisión es determinista y «no lee ningún texto» (leído en
   `corpusQuestionReview.ts`); por eso no descarta los falsos de B82.
4. **Fijar.** Solo se fija con un clic del estudiante (`addAndPinSheets`).

Propuesta, sin aplicar: empezar la etapa 5 por aquí. Las entradas de lema se
proponen y fijan sin modelo; la categoría gramatical necesita un paso pequeño con
modelo sobre el índice del libro. Banco de prueba: las hojas elegidas en los TP #8,
#9 y #10. Viene pendiente desde el TP #8 (#18 y #19).

**Corrección (2026-11-05):** el «7 de 14» y el «Tuggy 0 de 4» miden solo la propuesta
automática. El camino por lema existe y trae las hojas citadas de Tuggy; el hueco real es la
hoja gramatical por categoría. Ver
[FAMILIA_A_INVESTIGACION_2026-11.md](FAMILIA_A_INVESTIGACION_2026-11.md).

### Análisis de 5:1, versión 1 (P1)

Generado con gpt-6.1-sol, 54.753 tokens; sin verificación de citas todavía
(medido). Cotejo de Claude contra las hojas:

- **Bien (medido):** Wallace 627 (h. 663), Adamson 184, Mayor 148, Kittel 525 y
  206, NA28 (⸆υμιν ℵ 5; Nil), Robertson 299 y 949. La hoja fijada de Wallace es el
  centro del análisis. Medio y manera van con `defenders: []`: no inventó defensor.
- **B92, falta la lectura rival real:** la circunstancia concomitante, que es como
  traduce la RVR 1960 («Llorad y aullad», medido). Wallace p. 642 (h. 678) da cinco
  rasgos; ὀλολύζοντες no tiene tres: es presente, va después del verbo y el texto no
  es narrativo. Esa hoja no está en el corpus: la lista de Claude también la omitió.
- **B93, el criterio choca con sus fuentes:** dice que el verbo no nombra una
  actitud, sino una actividad vocal. Pero Kittel 525 lo define como grito «en
  expresión de gran dolor del alma», Mayor y Adamson hablan de dolor violento, y
  Wallace define la manera por la emoción que acompaña. Patrones 3 y 5 del profesor.
- **B94, opciones que no compiten:** las de Adamson (intensificación) y Mayor
  (léxico) no responden cómo funciona el participio. Patrón 7.
- **B95, menores:** nombra a Runge, que no está en el corpus; «provisionalmente» en
  la decisión. Sin confirmar: Robertson 757 («apelación directa») y 1106.

### Análisis de 5:1, versión 2

Regenerado por el fundador con la h. 678 fijada y la indicación de Claude; 53.971
tokens; sin verificación todavía (medido). Trae las tres lecturas, responde la
objeción y ya no nombra a Runge ni dice «provisionalmente». Se prefiere medio;
manera queda como alternativa plausible.

Cotejado por Claude contra las hojas, todo bien: Adamson 182 («weep and howl»),
Wallace 627 notas 37 y 38, Wallace 642 y su nota 71 (rasgos más centrales).

Reparto: la rival y la objeción las dio **[Claude]**; el apoyo lo halló el **[motor]**:
la traducción coordinada de Adamson como testigo citable, la nota 38 (una actitud
puede ser medio si es definitoria) y la nota 71. Lectura: con la hoja correcta el
motor razona bien; falla antes, al hallarla (B89). Un solo caso: es indicio, no medición.

Queda sin usar Wallace p. 628 (h. 664, fuera del corpus): «grieving» es manera y
«walking» es medio. Es la prueba más directa para este criterio.

Verificación de la versión 2 (medido): 11 verificadas, 1 coincidencia baja.

**B96, primera prueba de «Diagnosticar esta cita»: tipo a medias, remedio errado.**
La alarma (Tuggy 644) es falsa: la lista de 5 glosas declara dos fuentes, Tuggy 644
y Kittel 525, y el verificador la cotejó solo contra Tuggy. Las 5 tienen respaldo
(medido: «lamentar(se), gritar» en Tuggy; grito, júbilo, dolor y espanto en Kittel).
Es el #31 del TP #8 con varias fuentes en vez de varias páginas. El diagnóstico dice
«Afirmación mixta» y propone sacar a otra oración «una conclusión que la fuente no
dice», sin mencionar a Kittel. En «la fuente dice» repite la frase de la oración, no
el texto del léxico. Resuelta a mano, sin el remedio propuesto. Conteo de alarmas:
con el remedio propuesto 0, a mano 1.

### Análisis de 5:2, 5:3 y 5:6, versión 1, sin indicación [motor]

Con las hojas fijadas por Claude y el fundador. Verificación medida: 5:2 14/14; 5:3
12/14; 5:6 15/15.

- **5:2, bien.** Decide anticipación profética contra estado resultante. Halló solo
  que Wallace p. 581 sitúa el proléptico en la apódosis de una condicional y advierte
  que no se debe aplicar sin más; usa Robertson 898 y Wallace 400. Patrón 8 resuelto.
  Menor: «“Profético” clasifica el uso temporal…» en la decisión (patrón 6).
- **5:6, bien.** Genérico; no inventó oposición entre Adamson y Mayor (B91 resuelto).
  Trata a Cristo y a Santiago como rivales. Dos detalles: Adamson figura como defensor
  de la lectura de Santiago, y solo la refiere (es de Bishop); traduce «¿No se les
  opone?» con la puntuación del texto base, sin razonarlo.
- **B97, 5:3: el criterio no distingue (patrón 5).** Que la herrumbre sea sujeto de
  φάγεται y que cambie el sujeto en ἐθησαυρίσατe ocurre en las dos lecturas. Lo que
  distingue es consumir y fuego, con los paralelos de Mayor 151. Las 2 alarmas son
  correctas: NA28 694 no dice lo que se le cuelga; es inferencia propia. Se pierde
  la nota 11 de Adamson (*thesaurizastis iram*) y lo que muestra la variante ὁ ἰός.
- **B98, entre respuestas:** 5:3 sigue la puntuación de NA28 contra el texto base; 5:6
  sigue el texto base contra NA28. Ninguna lo explica. Riesgo de incoherencia.

**5:3, versión 2 (con indicación de Claude):** 15 verificadas, 1 no encontrada. El
criterio ya decide por consumir y fuego. El motor sumó solo la reconstrucción de
Torrey (vía Adamson). **B99:** la alarma es falsa y bloquea aceptar: el criterio cita
tres fuentes y el verificador cotejó la oración entera contra Adamson 185, citado solo
por la nota 11 (*thesaurizastis iram*, medido en la h. 189). Es la misma causa de B96.

**B101, segunda prueba de «Diagnosticar esta cita»: falló.** Sobre B99 dijo «Ninguna
fuente lo dice» y «Esta cita es de la prosa: corrígela en el texto». Es el falso «no
está en el libro» que había que vigilar: la nota 11 existe, y el texto citado viene
del criterio del análisis, no de la prosa. Si se le hace caso, se quita una cita buena
y se busca en la prosa algo que no está ahí. Conteo acumulado de alarmas de análisis:
con el remedio propuesto 0, a mano 2.

**B100:** la primera composición de prosa no admite indicación; solo «Recomponer
prosa», después. Obliga a gastar una generación de más.

Lectura: sin indicación, 2 de 3 salieron bien con hojas buenas. Coincide con B89, sobre
tres casos más; sigue sin ser medición del banco.

### Ensamble, versión 1: auditoría con los criterios del profesor

1.235 palabras; verificación del documento sin correr (medido). Cotejado sin hallar
errores: Mayor 148 y 151, Kittel 139, 208 y 776, Adamson 185 y su nota 11, NA28 693 y 694.

**B102, lo que el motor perdió entre análisis y prosa:**

- 5:2 omite el límite de Wallace 581, que el análisis sí traía (patrón 8). Se compuso
  sin recomponer, y la primera composición no admite indicación (B100).
- 5:3 copia a la prosa una frase que venía de la indicación de Claude («Mantener la
  herrumbre como sujeto…»): el lector no conoce esa objeción (patrón 6).
- Cinco cierres afirman dos cosas (patrón 1); una frase sin relevancia clara en 5:2
  (patrón 6); «discriminante» es jerga.

Correcciones por Claude: 10 ediciones a mano en total. El contenido de fondo llegó
del análisis; casi todo lo corregido es forma. Lo de la variante ὁ ἰός en 5:3 es
inferencia de Claude, sin fuente.

### Word exportado (2026-11-04, 15:45 local)

Medido en el .docx: citas sin «p.», también en rangos; griego en Times New Roman, sin
asteriscos ni comillas rectas; bibliografía de 7 obras. El aviso de bibliografía se lee
bien (TP #8, #43 resuelto) y el aviso de cambios no llegó a verse: el ensamble estaba al
día. **B103, fichas de la biblioteca:** Robertson pierde «A» en el título; el título de
Mayor trae mayúsculas y sin coma; Kittel usa otro orden de autores que Nestle. Se
corrigen a mano en el Word: si no se arreglan las fichas, se repetirán.

## 2. Fuentes para este TP

Citadas en el TP #9 (`9aacADPo7monLfUug0Bh`, medido en su texto ensamblado):
McCartney, Ropes, Varner, Motyer, Tuggy, NA28, Wallace y Robertson. Kittel estaba en su
corpus y no se citó. Adamson, Mayor y Metzger estaban prohibidos en él.

| Fuente | Decisión | Razón |
|---|---|---|
| McCartney, Ropes, Motyer | desmarcar | comentarios citados la semana anterior |
| Varner | desmarcar | citado la semana anterior; se trata como comentario (B71) |
| Adamson, Mayor, Metzger | dejar | no se citaron en el TP #9 |
| NA28, Tuggy, Kittel | dejar | texto y léxicos: la regla no los alcanza |
| Wallace, Robertson | dejar | el curso permite repetir gramáticas (TP #9, B15); falta decidir si se alterna |

Corpus con que nació el trabajo (medido): Motyer, Ropes, Varner, NA28, Metzger,
Kittel y Friedrich, Tuggy, Wallace y Robertson. Faltan Adamson y Mayor; sobran
Motyer, Ropes y Varner (B76).

A las 15:46 UTC el fundador quitó a Motyer, Ropes y Varner [fundador]. Después,
en el diálogo de extracción, quedaron elegidos Varner, NA28, Metzger, Adamson y
Mayor; Varner sobra (B80). Adamson va como expositivo: la taxonomía de la rúbrica
pone a NICNT ahí, igual que en los TP #6 y #8 (crítico-técnico queda 1 de 2).

Preguntas del encuadre:

1. ¿Cómo está funcionando el participio ὀλολύζοντες (Stg. 5:1)?
2. ¿Qué denotan los verbos σέσηπεν y γέγονεν (Stg. 5:2)?
3. ¿Qué modifica la frase ὡς πῦρ (Stg. 5:3)?
4. ¿Qué significa τὸν δίκαιον (Stg. 5:6)?

## 3. Cómo incorporarlo (borrador, sin aprobar)

Fase de un solo PR, después de entregar. Cada punto se mide contra el banco de los
TP #8, #9 y #10, sin Claude.

| Lo que hoy hizo Claude o el fundador | Lo que haría el sistema | Modelo | Caso de prueba |
|---|---|---|---|
| Desmarcar repetidas (B70, B71, B80) | Dejarlas desmarcadas al crear, con su razón; recordar las quitadas; tratar a Varner como comentario | no | Motyer, Ropes, Varner, McCartney |
| Hallar entradas de léxico | Proponer y fijar la entrada completa de cada palabra de la consigna | no | Tuggy 243–244, 644, 806–807; Kittel 525, 775–776 |
| Hallar la hoja gramatical (B85) | De la pregunta a las categorías posibles, y de ahí al índice del libro | sí, pequeño | Wallace 617, 663 |
| Hallar la lectura rival (B92) | Mapa por pregunta: lecturas posibles, con hoja y defensor, o «sin defensor», antes de generar | sí, pequeño | Concomitante, Wallace 642, Adamson 182 |
| Objetar el criterio (B93, B94) | Prueba interna del análisis contra los patrones 3, 5 y 7, sin tarjeta nueva | sí | Dolor en Kittel 525 contra «actividad vocal» |
| Descartar falsas alarmas (B82, B96) | Corregir «1 Pet. v. 1»; cotejar la lista contra todas sus fuentes; diagnosticar con el texto de la fuente | no | Mayor 163, Adamson 195–196, Tuggy 644 |

Límite: las hojas de Claude no son respuesta perfecta; omitió Tuggy 244 y Wallace 678.
Validar el banco con las correcciones del profesor. Pendiente de decisión: la prueba
interna no debe revivir la «Revisión antes de entregar», dada de baja el 2026-11-02.

## 4. Conteo

| Quién lo resolvió | Cantidad |
|---|---|
| [motor] | 1 (entrada δίκαιος incompleta, B88) |
| [Claude] | 3 (revisión de las fuentes, de la configuración y mapa de hojas) |
| [fundador] | 0 |

## 5. Evidencia para la etapa 5

Cada fuente, página o entrada de léxico buscada a mano, con lo que costó.

| Qué se buscó | Dónde | Costo | Quién |
|---|---|---|---|
| P1 participio | Wallace h. 663 (p. 627, sin leer); Tuggy h. 644; Kittel h. 525 | 5 lecturas de producción, en total | [Claude] |
| P2 perfectos | Wallace h. 436 (p. 400) y h. 617 (p. 581); Robertson h. 484 y 976; Tuggy h. 806–807; Kittel h. 775–776 | ídem | [Claude] |
| P3 ὡς πῦρ | En el corpus: Mayor h. 429, Adamson h. 189, NA28 h. 805 | ídem | [motor] |
| P4 τὸν δίκαιον | Robertson h. 835; Tuggy h. 243; Kittel h. 137–140 (solo el encabezado) y h. 326. En el corpus: Adamson h. 192–193, Mayor h. 432–433 | ídem | [Claude] |
