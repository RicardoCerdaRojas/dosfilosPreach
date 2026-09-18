# Phase 7 — Exégesis reform

## Estado

`active` desde **2026-09-17**. Se activa antes de lo previsto (el placeholder decía «6 meses
post-launch») porque el primer uso real del módulo de exégesis para un trabajo de seminario
(Salmo 23:1–3, investigación #1, OT603) dejó los huecos a la vista y con evidencia. Lo que
sigue es el plan de esa retrospectiva, en el orden acordado con el fundador.

## Objetivo

Que un pastor pueda entregar un trabajo exegético producido con el sistema **sabiendo por qué
confía en él**: qué fuentes usó y por qué, qué cita está verificada contra qué página, y que
el documento salga en el formato y la extensión que el seminario exige.

## Lo que el primer uso real dejó medido (Sal 23:1–3, 2026-09-16/17)

- 13 PRs de defectos mergeados durante el ejercicio (#616–#628); cinco afectaban qué texto
  leía el asistente.
- **El verificador de citas nunca corrió** sobre los cinco pasos del trabajo: lee `markdown`,
  y los pasos con análisis canónico lo tienen vacío. `lastRunAt: null` en todos.
- Revisión manual contra los PDF: **5 errores de cita por verso** en la primera versión de
  cada uno (página equivocada, referencia que el autor no hace, datos bibliográficos
  inventados, «piel/polel intensivo»). Dos vueltas de regeneración por verso.
- Composición final: 23:2 y 23:3 salieron como fichas mecánicas con 16 notas huérfanas;
  ~930 palabras de prosa útil frente a ~3.000 que exigen 12 páginas TMS.
- Ortiz (léxico, LlamaParse): definiciones legibles, formas hebreas invertidas; el sistema
  no lo dijo.

## Etapas (orden acordado)

| # | Etapa | Estado | Métrica de efectividad |
|---|---|---|---|
| 1 | **Verificación del análisis canónico + oración textual obligatoria** (P2.1, P2.2) | `done` (#629, #630) | Recall sobre errores conocidos ≥ 4/5; falsos «no encontrada» ≤ 10 % sobre citas correctas; `citationsWithoutVerbatim` → 0 |
| 2 | Word según la guía + extensión como contrato (P3.3, P3.2) | `done` (#637, #638) | El .docx generado abre en Word con 12 ± 1 páginas de cuerpo, notas al pie reales y bibliografía; 0 retoques manuales de formato |
| 3 | Recomposición dirigida, paso «Revisión», correcciones persistentes (P3.1, P4.1, P4.2) | `done` (#631-#636, #639) | 0 versos publicados con render mecánico; una indicación marcada «para todo el trabajo» aparece en el prompt de cada paso siguiente |
| 4 | Salud del recurso y datos bibliográficos al ingerir (P1.3, P2.3) | `done` (#640, #641) | Ortiz muestra «formas hebreas ilegibles»; 0 datos bibliográficos inventados en la bibliografía |
| 5 | Bibliografía del curso, perfil de trabajo, páginas por lema (P1.1, P1.2, P1.4) | `next` | Propuesta de páginas de un léxico acierta ≥ 10 de 12 entradas del pasaje |
| 6 | Perfil de voz y glosario terminológico (P3.4, P3.5) | `planned` | 0 términos del glosario en la salida («tronco», calcos del inglés) |

## Etapa 1 — Verificación del análisis canónico

### Qué cambia

- `collectAnalysisClaims` (domain): un solo recorrido de los seis sitios del análisis que
  devuelve cada afirmación con su cita y, si la hay, la oración textual. `collectAnalysisCitations`
  se deriva de aquí.
- `ICitationVerifier` acepta `citations` ya reconocidas y `language`; los adaptadores solo
  parsean el markdown cuando no las reciben.
- `VerbatimFirstCitationVerifier` (application, decorador): una cita con oración textual se
  coteja buscando la oración en las hojas de la fuente, sin modelo; lo que no aparece o no
  trae oración pasa al verificador LLM.
- `VerifyStepCitationsUseCase`: camino del análisis; la página de la cita se lleva a la unidad
  de la evidencia (`pageInEvidenceUnit`) para no cotejar impresa contra hoja.
- El resumen guarda `verifierVersion: 'analysis-v1'` y `citationsWithoutVerbatim`; la versión
  guarda `citationVerdicts` para que la interfaz señale cada cita sin volver a pagar.

### Cómo se mide

Verdad de referencia: la auditoría manual contra los PDF de las **versiones aceptadas** del
trabajo `exegeticalPapers/NjX4cEAkyuiAcimOqflW`. Errores conocidos que el verificador debe
atrapar:

| Verso | Cita | Qué está mal | Veredicto esperado |
|---|---|---|---|
| 23:1 | Andersen, p. 42 (Regla 1) | La regla está en p. 39 | page-mismatch |
| 23:2 | Ortiz, p. 438 (נחה) | Está en p. 437 | page-mismatch |
| 23:3 | Waltke-O'Connor, p. 440 (polel/hifil de שׁוב) | El contraste está en p. 436; la 440 trata el hifil interno | not-found o page-mismatch |
| 23:3 | Ross, p. 564 con Ez 20:9, 14; 36:22 | Ross no cita Ezequiel | not-found (la afirmación excede la página) |
| 23:3 | Ortiz, p. 438 (נחה, loading) | Está en p. 437 | page-mismatch |

Las ~40 citas restantes de los tres versos se verificaron a mano como correctas; sobre ellas se
mide la tasa de falsos negativos («no encontrada» o «página no coincide» sin razón).

Procedimiento: tras desplegar, pulsar «Verificar citas» en cada verso; leer `citationVerdicts`
de la versión aceptada con un script de administración; tabular. Registrar el resultado en la
bitácora de abajo.

## Decisiones tomadas

- [ADR-030](../decisions/ADR-030-fidelity-per-marker-belongs-to-paper-sermon-narrative.md) — la
  verificación claim↔fuente vive en el paper. Esta etapa es su implementación sobre el
  análisis canónico.
- «Bloquear lo que está mal, no lo que está incompleto» (gating aprobado para el Estudio Madre)
  se reutiliza para aceptar un paso: `not-found` bloquea sin revisión manual; `fuzzy-low` y
  `manual-pending` no. Se implementa en la etapa 3 (paso «Revisión»).

## Decisiones pendientes

- Testigo 4 (consenso académico) y six-step para el paper: siguen diferidos; no bloquean las
  etapas 1–6.
- Persistir veredictos por cita para pasos de prosa (hoy sí, acotados a 300 y notas de 400
  caracteres): revisar tamaño real del documento del trabajo tras un ciclo completo.

## Bitácora

- **2026-05-22** — Placeholder creado. Fase explícitamente diferida.
- **2026-09-17** — Activada tras la retrospectiva del trabajo de Sal 23:1–3. Etapa 1 en PR (#629).
- **2026-09-17** — **Medición 1 (23:1, tras #629):** 16 citas · verificadas 3 · página no coincide 2 ·
  coincidencia baja 1 · **no encontrada 10**. Recall sobre errores conocidos del verso: 2/2
  (Andersen p. 42, dos entradas). **Falsos negativos: 10/14 = 71 %** (meta ≤ 10 %). Causa,
  legible en las notas del modelo («los fragmentos llegan hasta la página 205» sobre una cita a
  la 206): el adaptador recortaba la evidencia a los primeros 8 fragmentos de la fuente en orden
  de hoja, sin mirar la página citada. Corrección: `prioritizeChunksForCitedPage` +
  `selectEvidenceChunks` (la página citada y sus vecinas sobreviven al tope). PR #630.
- **2026-09-17** — **Medición 2 (23:1–3, tras #630):** 54 citas · verificadas 44 · coincidencia
  baja 3 · página no coincide 5 · no encontrada 2. Las 15 citas con oración textual se
  verificaron sin modelo (5 de ellas) o con él; ninguna oración textual resultó inventada.
  - **Falsos negativos sobre citas correctas: 0/49.** Los 5 «página no coincide» son todos de
    Ortiz y todos corridos una página (430→431, 432→433, 455→456): la **calibración del
    recurso está mal** (segmento −1 declarado hasta la hoja 457; el folio impreso cambia a −2
    cerca de la hoja 382–432). El verificador detectó un problema real del libro; la interfaz
    lo atribuye a la cita. Va a la Etapa 4 (salud del recurso) y a la nota de la Etapa 3.
  - **Recall:** Waltke-O'Connor p. 440 citado para el polel de שׁוב → 2 de 3 entradas
    «no encontrada» («los fragmentos no mencionan el tronco Polel»): **atrapado**. La tercera
    entrada trae una oración textual que sí está en la p. 440 (sobre el hifil interno) y pasó
    como verificada: la oración es real, la afirmación que la rodea es un estiramiento.
    Límite conocido: **oración hallada ≠ afirmación sostenida**. Ross p. 564 con Ezequiel:
    pasó; en el análisis las referencias a Ezequiel no se atribuyen a Ross (la atribución
    equivocada la hizo el compositor), así que el veredicto es defendible. Andersen p. 42 se
    retiró de los errores conocidos: la página discute la Regla 1 por nombre.
  - Además flagueó (coincidencia baja / página no coincide) tres citas donde la fuente apoya
    menos de lo que el análisis afirma (W-O p. 513 sobre לֹא; W-O p. 436 como rango léxico de
    רבץ; Ross p. 561 sobre «pastizales de alta calidad»). Las tres son avisos legítimos.
  - **Conclusión:** la Etapa 1 cumple su métrica (0 % de falsos negativos reales; los errores
    de fondo atrapados). Dos límites quedan anotados para la Etapa 3: (1) cuando hay oración
    textual, mostrar oración y afirmación lado a lado, porque el verificador solo garantiza la
    primera; (2) un «página no coincide» de ±1 debe decir «puede ser la calibración del
    libro» y enlazar a calibrar.
- **2026-09-17** — **Etapa 3, primera mitad (PRs #631–#636).** Página de revisión de citas
  (`/pasos/:stepId/revision`), revisión manual con motivo y gate de aceptación (#631); el visor
  abre la hoja que lleva impresa la página citada (#632); taller de cotejo —hojear, «ir a p.»
  por folio impreso, el problema en un panel al lado del PDF— (#633); búsqueda literal en todo
  el libro (#634); corrección de la cita en el análisis con re-verificación de esa sola (#635);
  cierre de duplicados y pista de calibración (#636).
  - **Caso testigo, medido sobre el trabajo real:** la cita «Waltke-O'Connor, p. 440» para el
    Polel de שׁוב que la Etapa 1 marcó como «no encontrada» **no era una invención**: la
    afirmación es correcta y está en la **página impresa 436** («to restore (Polel for Piel)
    (lit., make restored) Jacob to him», contrastado con el Hifil de Gen 28:15). La p. 440
    trata el Hifil, como dijo el verificador. Sin buscar en el libro entero, el desenlace
    esperable era marcar la cita como dudosa y borrar una afirmación verdadera: **la
    verificación sin herramientas de resolución empuja a borrar lo correcto**.
  - Dos límites de la Etapa 1 quedan cubiertos: la afirmación y la oración se ven juntas en el
    panel, y un «página no coincide» de ±1 dice que puede ser la calibración y enlaza a
    arreglarla.
  - Falta de la etapa: **P3.1**, recomposición dirigida de un verso incompleto (el render
    mecánico de 23:2 y 23:3 sigue sin remedio propio).
- **2026-09-17** — **Etapa 2 (PRs #637, #638).** El .docx sale con el formato de la guía
  —Times New Roman 12, doble espacio, sangría 0,5", márgenes de 1", portada, numeración,
  notas a 10 pt, bibliografía con sangría francesa, hebreo de derecha a izquierda— y las
  pruebas leen el XML del archivo, porque el formato ES el entregable. La extensión exigida
  por la rúbrica (`expectedLength`, guardada desde siempre y nunca comparada) ahora se mide
  contra lo escrito, con desglose por verso: 250 palabras por página de cuerpo, 500 por
  página de notas.
- **2026-09-17** — **Etapa 3 cerrada (PR #639): recomposición dirigida (P3.1).** Un verso
  que salió corto o como ficha se vuelve a redactar solo, con indicación del autor y
  extensión objetivo, y la prosa nueva entra en su sección del trabajo ensamblado
  (`replaceVerseSection`). Antes la única salida era recomponer el trabajo entero —caro, y
  reescribe lo que ya estaba bien—. El análisis no se toca: las citas verificadas y las
  revisiones manuales sobreviven a la recomposición, que era la condición para que esto no
  deshiciera la Etapa 1.
- **2026-09-17** — **Etapa 4 (PRs #640, #641).**
  - *Datos bibliográficos (P2.3).* El compositor recibía `author` = clave de cita y `title` =
    nombre del archivo; ciudad, editorial y año los ponía el modelo porque Turabian los exige.
    Ahora la ficha vive en el RECURSO, la escribe una persona mirando la portada, y los cuatro
    compositores citan con ella. Regla: lo que no está no se escribe —ni «s.f.» ni «n.p.»,
    que afirman que el dato no existe cuando lo que pasa es que nadie lo escribió—.
  - *Salud del recurso (P1.3).* **Medición nueva sobre las 67 obras de la biblioteca real:**
    cuatro libros extrajeron su hebreo AL REVÉS —Ortiz 11,8 % de palabras con letra final al
    inicio, «Gramática Hebreo» 13,3 %, «Léxico Griego-Español» 9,7 %, «Diccionario Teológico
    del NT» 10,3 %— contra 0,0–0,1 % en todo el resto. Las letras finales (ך ם ן ף ץ) sólo
    cierran palabra; al invertir el texto quedan al principio, y eso separa las dos
    poblaciones sin nada en el medio.
  - **Corrección a una afirmación de la Fase anterior:** «Gramática Hebreo» de Farfán se citaba
    como prueba de que el sistema podía con ese tipo de libro (65.188 caracteres hebreos
    extraídos). Los extrajo invertidos. **Tener el alfabeto y tenerlo utilizable son dos cosas
    distintas**, y el censo de alfabetos sólo veía la primera.
  - Los cuatro recursos de la biblioteca del fundador quedaron con los contadores calculados
    desde sus fragmentos indexados; los libros nuevos los traen desde la extracción.
