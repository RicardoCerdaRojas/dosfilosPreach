# Fase: lo que destapó el TP #7 (Santiago 3:13-18) · octubre 2026

> **Estado: APROBADA 2026-10-14, en espera.** El fundador adelantó F (visor de PDF): va primero, en su propia fase y con una sesión de diseño. Después viene esta fase, en el orden A → B → C → D → E → H → G. Decisiones al final.

**Qué es.** Arreglos surgidos de un ejercicio real en producción el 14 de octubre de 2026: el trabajo práctico #7 de griego del NT del fundador, sobre Santiago 3:13-18, con cuatro preguntas de sintaxis y entrega el mismo día a las 19:59. Era también la prueba de la fase del TP #6 (`docs/FASE_EJERCICIO_TP6_2026-10.md`, #749-#752).

Se recorrió todo el camino:

- crear el trabajo con un perfil, la rúbrica, el encuadre y las fuentes excluidas;
- el corpus, el plan de uso y el plan estructural;
- el análisis de 3:13, 3:15 y 3:18, con sus regeneraciones;
- la revisión de citas, el ensamble, la reescritura del fundador y el PDF final.

Se anotaron 33 hallazgos en la bitácora (`project_ejercicio_tp7_santiago3_13`). La entrega salió, pero con mucho trabajo a mano: cuatro bloqueos y unas diez vueltas que no debieron hacer falta.

**Lo que se resolvió en el momento:**

- **Ruteo:** `exegesis.planStepCorpus` pasó de OpenAI (Luna) a `gemini/gemini-3.8-flash` en `config/llmRouting` (#17). Lo escribió el fundador con el PATCH de un solo campo. **Producción ya no coincide con `scripts/llm-routing/ruteo.json`.**
- **Robertson llegó al análisis** (#28) reduciéndolo a 7 hojas fijadas, porque lo fijado de una fuente grande se recortaba en el prompt.
- **El sujeto de 3:15** (#13): se agregó «(Stg. 3:15)» al encuadre y se incluyó el versículo a mano.

**Cómo se entrega.** Igual que el TP #6: **un solo PR**, con **un commit por unidad**, en el orden de abajo. Cada commit queda completo y se puede probar en la interfaz.

**Antes de cada commit:**

1. Se corren las pruebas en local.
2. Se pasa la revisión adversarial (`docs/REVISION_ADVERSARIAL.md`).
3. Cada prueba nueva se rompe a propósito una vez.

**Terminado** significa desplegado y probado en producción con el TP #8.

---

## Lo que ya funciona (no tocar)

Comprobado en producción el 2026-10-14:

- **Fuentes excluidas (A del TP #6):**
  - la propuesta llega prellenada con lo citado en la entrega anterior;
  - en el diálogo de la biblioteca, las excluidas van al final y marcadas.
- **«Editar» en el plan de uso conserva los roles** (el #12 del TP #6 está arreglado).
- **El plan estructural muestra la introducción y la conclusión «excluidas por el encuadre»** cuando el plan las saca.
- **El verificador del versículo** separa lo que dice la fuente del análisis propio (#752). Sus alarmas en 3:13 y 3:15 eran correctas.
- **Datos para citar:** 7 de 7 con ficha completa.
- **Portada:** el pasaje ya no se repite.

---

## A. Que un proveedor no tumbe un paso (#12, #17, #19)

Tres fallas de OpenAI en un día. Las tres dejaron al fundador sin poder seguir, y ninguna era culpa de su trabajo.

**#12, el planificador en bucle.**
- **Qué pasó:** «Proponer plan» (Luna, sin razonamiento, `json_object` sin esquema, tope de 32.768) escribió durante 181 s hasta `max_output_tokens`. El pedido pesaba 12 KB, para 4 pasos y 7 fuentes.
- **Respuesta normal:** de 1.000 a 2.000 tokens.

**#17, el rechazo por política de uso.**
- **Qué pasó:** `OpenAI HTTP 400 invalid_prompt «flagged as potentially violating our usage policy»`. Es un falso positivo, probablemente por Stg 3:15 («δαιμονιώδης / demoníaca»).
- **Lo que no pasó:** `runLlmPrompt` no cae a Gemini cuando OpenAI falla (`porOtroProveedor` relanza el error).

**#19, cortes de red.**
- `ECONNRESET` en `analyzeVerse`, a los 61 s, y en `classifySourceType`.
- `OpenAiLlmClient.pedir` reintenta 429/5xx, pero un `fetch` que lanza sale del bucle sin reintento.

**Arreglo:**
- En `runLlmPrompt`, un rechazo de política, un `incomplete` o un error de red de OpenAI/Anthropic **cae a la ruta Gemini de respaldo**. Hay que registrarlo y medirlo.
  - Cuidado: reintentar un pedido largo duplica el costo, así que se cae a Gemini una vez y no se reintenta en OpenAI.
- `OpenAiLlmClient`: trata `fetch failed` / ECONNRESET como transitorio, con un solo reintento.
- El planificador:
  - esquema estricto (las claves dinámicas de los pasos pasan a un arreglo);
  - tope de 4.000-8.000 tokens, para que un bucle falle en segundos y no en 3 minutos.
- Sincronizar `ruteo.json` con producción, o decidir volver `planStepCorpus` a Luna cuando exista el respaldo.

## B. Lo que el estudiante fija llega entero al análisis (#28, #20, #22, #27, #8)

Es el hallazgo de más peso de este ejercicio: **el estudiante eligió y fijó las páginas correctas, y el análisis no las recibió, sin aviso.**

**#28, lo fijado se recortaba.**
- `selectForPrompt` mete lo fijado completo.
- Después, `analyzerPrompts.ts › formatSources` reparte el presupuesto **en partes iguales por fuente** (`allocateSourceBudgets`, peso 1) y `truncate` corta desde el final.
- Con 45 hojas de Robertson fijadas (~124.000 caracteres), al analizador le llegaron solo las pp. 493–498, y lo dijo en el texto: «las páginas 880–881… no están incluidas en el corpus suministrado».

**#20, una gramática vacía contaba para la rúbrica.**
- Robertson quedó con 0 fragmentos: la búsqueda por el pasaje no encuentra nada en una gramática.
- Aun así, el corpus decía «cumple la rúbrica».

**#22, el índice coincide por palabra.**
- «Secciones del índice que responden al encuadre → genitiv» trajo «With the Genitive» (preposiciones) y «With genitives» (artículo), pero no el capítulo del caso genitivo.
- Agregarlas metió 11 tramos inútiles.

**#27, rótulos de tramo equivocados.** «570–593 · (i) DOUBLE ACCUSATIVE» es el genitivo, y «959 · 1. INDICATIVE» es el perifrástico.

**#8, las gramáticas no se recomiendan.** Robertson, la única gramática permitida, no salió entre los recomendados.

**Arreglo:**
- **Lo fijado no se trunca:** el presupuesto de cada fuente parte de lo que tiene fijado. Si aun así no cabe, se avisa en la pantalla antes de generar, nombrando qué hojas quedan fuera.
- **Una fuente con 0 fragmentos y sin hojas elegidas:** aviso en su tarjeta y no cuenta para la rúbrica.
- **Gramáticas:**
  - las secciones se buscan por capítulo y caso (Cases → Genitive / Dative / Instrumental), no por cualquier título que contenga la palabra;
  - el rótulo de cada tramo sale de su propio encabezado;
  - para cubrir un requisito «Gramática ≥1» se recomienda por tipo, no solo por fragmentos.

## C. Una sola manera de revisar citas (#29, #33, #24, notas al pie)

**#29, callejón sin salida.**
- Con el paso «listo para revisar», «Verificar citas» abre el **modal viejo** (`CitationVerificationDialog`), que solo muestra.
- Aceptar está bloqueado hasta revisar.
- El enlace a la página nueva (`/pasos/:stepId/revision`) solo aparece con el paso **ya aceptado** o en un aviso pasajero.
- El fundador tuvo que entrar por URL.

**#33, falsas alarmas del ensamble.**
- McCartney, 204, salió «no encontrada» y McCartney, 203, salió «página no coincide».
- El fundador comprobó en el PDF que las dos estaban bien, y ambas se habían verificado en el análisis del versículo. El verificador del ensamble no ve el mismo material.

**#24, notas meta.** El análisis trajo una nota sobre el corpus («La asignación de Robertson como fuente técnica no autoriza a reconstruir una sección ausente del corpus…»).

**Notas al pie con atribución de más.** Las tres alarmas de 3:15 eran análisis propio colgado de Varner y de Robertson en `footnoteExtensions.sources`.

**Arreglo:**
- «Revisar citas» siempre que exista `canonicalAnalysis`; retirar el modal viejo.
- El verificador del ensamble usa el mismo material que el del versículo y comprueba primero la página citada (lo pendiente del #18 del TP #6).
- El esquema de la nota separa «respaldo» de «análisis propio».
- El prompt prohíbe hablar del corpus, de los fragmentos o de la asignación.

## D. Encuadre, plan de uso y documento coherentes (#13, #16, #14, #25, #26, #15, #18)

**#13, «el versículo 15» sin capítulo.**
- `briefQuestions.ts › versesIn` descarta un «versículo N» si la misma pregunta no trae antes una referencia capítulo:versículo.
- 3:15 nació fuera del documento: la pregunta 3 se habría quedado sin respuesta.
- **Arreglo:** si el pasaje es de un solo capítulo, el número hereda ese capítulo.

**#16, editar el encuadre no recalcula.**
- `inclusionAtBirth` corre solo al crear los pasos, y la inclusión se cambia únicamente desde la página del trabajo.
- **Arreglo:**
  - al guardar el encuadre, proponer los cambios («3:15 ahora tiene pregunta: ¿incluirlo?»);
  - el plan de uso muestra los pasos que quedaron fuera, con su interruptor.

**#14, «Sin introducción, sin conclusión».** El texto libre del encuadre no saca esas secciones. **Arreglo:** proponer quitarlas cuando el encuadre lo dice; lo decide el estudiante.

**#25, BUG: guardar el plan estructural borraba el plan de uso de la vista.**
- `UpdateStepPlanUseCase` pierde `proposedAt` y `proposalCorpusSourceIds`.
- **Arreglo:** dos líneas y una prueba, igual que `UpdateStepCorpusAllocationUseCase`.

**#26, las fichas del plan muestran el título cortado.** **Arreglo:** mostrar la clave de cita (McCartney, Ropes…) y dejar el título en el tooltip.

**#15, la gramática fuera de la pregunta de sintaxis.**
- Robertson quedó en 3:13 y no en 3:18, a pesar de la regla del prompt.
- **Arreglo:** validar después del planificador que cada pregunta de sintaxis tenga la gramática; si falta, agregarla.

**#18, el ancla queda en 0.** En el plan estructural, los tipos sugeridos para «Versos» no incluyen «Comentario expositivo», aunque la rúbrica lo exige. **Arreglo:** la sugerencia toma los tipos de la rúbrica.

## E. Crear y configurar sin trampas (#1, #4, #9, #10, #2, #11, #21, portada)

**#1, la rúbrica elegida al crear se pierde.**
- El fundador eligió «TP Semanal» y el trabajo quedó con la del paper (12 páginas, 13 fuentes).
- La plantilla estaba bien guardada.
- Causa probable (leída, no reproducida): el efecto del perfil por defecto en `ExegesisCreatePage` corre mientras `perfilAplicado` es falso, y tocar el selector de rúbrica no lo pone en verdadero.
- **Arreglo:** reproducirlo con una prueba (perfiles que cargan tarde) y que cualquier elección del estudiante cuente como «tocado».

**#4, elegir una plantilla de rúbrica toma 3 pasos y el encabezado dice «Desde plantilla» sin decir cuál.** Lo pidió el fundador. **Arreglo:**
- la lista de plantillas, a la vista;
- «Rúbrica · TP Semanal Griego NT» en el encabezado.

**#9, la decisión sobre las excluidas queda pendiente sin aviso.**
- Desmarcar una propuesta vive en un `useState`.
- Mientras no se pulse «Excluirlas», los pasos que redactan no reciben la exclusión.
- **Arreglo:** guardar al marcar o desmarcar, o avisar antes del plan.

**#10 y #2, el origen de las excluidas.**
- Las confirmadas dicen «agregada por ti», y la propuesta dice «(trabajo anterior)».
- `proposeExclusions` / `previousDelivery` pierden el título, que la tarjeta de NA28 sí conoce.

**#11, aviso redundante.** NA28 sigue avisando «no debería entrar» aunque se desmarcó a propósito.

**#21, siete fuentes «desactualizadas» por agregar «(Stg. 3:15)» al encuadre.** **Arreglo:**
- la huella usa solo lo que cambia la búsqueda: el pasaje y las preguntas normalizadas;
- o la pantalla dice qué cambió y deja decidir.

**Portada: «SEPTIEMBRE 2026» en octubre.**
- Es el #4 del TP #6 sin resolver: al prellenar desde la entrega anterior, la fecha se copia.
- **Arreglo:** proponer el mes en curso.

## F. Visor de PDF con búsqueda (#31): adelantarlo

El fundador lo pidió **dos veces el mismo día** («esto es muy necesario»):

- para comprobar NA28, 723, tuvo que salir del trabajo;
- para confirmar McCartney, 203 y 204, abrió el PDF fuera de la aplicación y buscó «tautologous» a mano: 6 apariciones, en las pp. 145, 204, 258, 279 y 287.

Ya estaba acordado como fase propia (los #22-#25 del TP #6):

- abrir la fuente desde la página del trabajo y desde cada cita;
- «Ir a página impresa»;
- buscar en todo el libro y resaltar;
- «Citar esta página».

**Propuesta:** que sea la siguiente fase, con una sesión de diseño con el fundador antes de construir.

## G. La voz del autor (#32)

**Qué pasó.**
- El compositor escribe en un registro demasiado técnico («núcleo semántico», «sustantivo rector», «adjudicación exegética»).
- El fundador reescribió las cuatro respuestas a mano. Con esas palabras rechazó una frase de Claude: «no lo entiendo y no lo escribiría yo».

**Lo que se vio en su reescritura** (memoria `user_voz_escritura_academica`):
- **Rasgos de su voz:**
  - guía al lector («Para resolver esta cuestión, primero…», «Por un lado… Por otro lado…»);
  - glosa en español cada palabra griega;
  - usa conectores explícitos.
- **Riesgos de su estilo:**
  - recorta la morfología completa que exige la consigna;
  - despega la cita de la afirmación que respalda;
  - usa intensificadores que dicen más que la fuente («sólido apoyo», «considerablemente»).

**Arreglo:**
- Una sección «Registro y voz» en la guía de estilo, con una muestra del autor (su texto de las preguntas 3 y 4).
- El compositor la sigue. Es el primer uso real de la huella de voz de la Fase 4.
- Reglas fijas del compositor:
  - la morfología completa abre cada respuesta;
  - la cita va en la misma oración que lo que la fuente dice;
  - sin intensificadores que la fuente no respalda.

## H. Bibliografía (#30 y el PDF final)

**#30, el ensamble no asegura citar las fuentes que la rúbrica exige.**
- El documento citó 5 de las 7 fuentes del corpus; NA28 y Tuggy quedaron sin citar.
- La bibliografía las listó igual, sin cita en el texto.
- **Decisión abierta:** ¿la bibliografía lista solo lo citado, o todo el corpus?
- **En cualquier caso:** avisar antes de exportar cuando una fuente de un requisito de la rúbrica no aparece citada.

**Formato.**
- NA28 salió «Eberhard Nestle y Kurt Aland.», sin invertir y ordenada por «Eberhard».
- **Arreglo:** el primer autor de una obra con varios autores va invertido («Nestle, Eberhard, y Kurt Aland») y ordena por el apellido.

**Varner, sin subtítulo.** La ficha dice *The Book of James* y debería decir *The Book of James: A New Perspective*, como el recurso de la biblioteca. Es el mismo problema de datos duplicados del #26 del TP #6.

---

## Menores (si alcanza)

- **#5:** en el diálogo de la biblioteca, Varner, McCartney y Ropes aparecen sin tipo.
- **#6:** se recomiendan libros de otro libro bíblico con 1 o 2 fragmentos (2 Pedro y Judas, Kistemaker) y libros de consejería (Tripp).
- **#7:** Subukjian (homilética) sigue clasificado como «Comentario expositivo».
- **#3:** la justificación genérica del «Aparato crítico» viene de la rúbrica guardada.

## Orden propuesto

**A → B → C → D → E → H → G.** F va en la fase siguiente, con una sesión de diseño primero.

- **A, B y C** son las que hicieron perder más tiempo y las que pueden dar un resultado incorrecto **sin aviso**: un análisis que no recibe las páginas fijadas o un paso que no se puede aceptar.
- **D y E** son coherencia entre la configuración y el documento.
- **G** necesita la muestra del autor, que ya existe.

## Decisiones del fundador (2026-10-14)

1. **Respaldo de A:** cuando OpenAI (o Anthropic) falla, se cae a Gemini **en silencio**, con registro en los logs y en el medidor de uso, pero sin aviso al estudiante.
2. **`planStepCorpus` vuelve a Luna**, con Gemini de respaldo, una vez desplegado A. Al cerrar A se escribe la ruta en producción (pide OK) y `ruteo.json` vuelve a coincidir.
3. **La bibliografía lista solo lo citado.** Cambia el aviso de H: si una fuente que pide la rúbrica no aparece citada, se avisa antes de exportar, porque al quedar sin cita sale de la bibliografía.
4. **F (visor de PDF con búsqueda) se adelanta:** va antes que esta fase, en la suya propia y con una sesión de diseño primero.
5. **Tercera persona:** la guía de estilo la fija («se prefiere», «se adopta»). El compositor no usa «yo» ni «nosotros».
