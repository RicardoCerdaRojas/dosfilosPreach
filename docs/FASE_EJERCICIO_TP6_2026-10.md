# Fase: lo que destapó el TP #6 (Santiago 3:1-12) · octubre 2026

**Qué es.** Arreglos surgidos de un ejercicio real en producción entre el 6 y el 7 de octubre de 2026: el trabajo práctico #6 de griego del NT del fundador, sobre Santiago 3:1-12, con cuatro preguntas de sintaxis y entrega el 7 de octubre. Se recorrió todo el camino:

- crear el trabajo con un perfil y armar la rúbrica;
- la portada, el corpus, el plan de uso y el plan estructural;
- el análisis de 3:2, 3:6 y 3:7;
- la verificación de citas, el ensamble y el Word.

Se anotaron 26 hallazgos en la bitácora (`project_ejercicio_tp6_santiago3`).

**Tres se resolvieron en el momento** porque bloqueaban o arruinaban la entrega:

- **#747:** crear un trabajo con un perfil guardado dejaba la página en blanco, porque una variable se usaba antes de declararse.
- **#748:** la portada TMS heredaba 12 pt después de cada renglón, repetía el pasaje y escribía el signo menos (−) en lugar de un guion medio.
- **Hallazgo #25:** el «p.» que muestra el editor es por diseño. Se explicó y no se tocó.

**Cómo se entrega.** **Un solo PR**, con **un commit por unidad**, en el orden de abajo. Cada commit queda completo y se puede probar en la interfaz.

**Antes de cada commit:**

1. Se corren las pruebas en local.
2. Se pasa la revisión adversarial (`docs/REVISION_ADVERSARIAL.md`), incluidas las preguntas 8 y 9: un estimador se escribe leyendo a su consumidor, y nada se predice sin medirlo.
3. Cada prueba nueva se rompe a propósito una vez, para confirmar que falla.

**Terminado** significa desplegado y probado en producción con el TP #7.

**Decisiones del fundador (2026-10-07):**

- **F (visor y edición: #22-#25) va en una fase propia.** Es un rediseño del visor y del editor, y se diseña con el fundador antes de construirlo.
- **Las fuentes excluidas** aparecen **al final de la lista y marcadas** («Citada en el TP #5»), no ocultas: el sílabo de otro curso podría permitirlas.
- **Orden:** B → A → C → D → E → G.

Para cada hallazgo se indica su número en la bitácora y lo que se verificó en el código el 2026-10-07.

---

## B. Exportar sólo lo entregable (#19, #21, #14, #26)

**#19, ficha incompleta dentro del Word.**
- **Qué pasa:** la bibliografía salió con «[FICHA INCOMPLETA, faltan: author, title, city, publisher, year]».
- **Causa (leído):**
  - el marcador es una decisión de diseño anterior y bien fundada (`renderBibliography`): omitir la obra dejaría el cuerpo citando un libro que la bibliografía no nombra, y completarla de memoria sería inventar;
  - pero los campos salían con su clave interna en inglés;
  - y el aviso de la pantalla llegaba DESPUÉS de la descarga, como un mensaje pasajero, y pasó sin verse.
- **Arreglo:**
  - el marcador se mantiene, pero en el idioma del trabajo («faltan: autor, ciudad, editorial, año»);
  - antes de descargar, un diálogo (`IncompleteBibliographyGate`) lista los libros incompletos, deja completar cada ficha ahí mismo, y sólo exporta «igual» si se decide.

**#21, título vacío: era un error de lectura.**
- No había un título vacío: el título «Bibliografía» llevaba un salto de página DENTRO del párrafo, y el lector del XML lo mostró como dos renglones.
- De todos modos se cambió a `pageBreakBefore`: con el salto adentro, Word deja un renglón con estilo de título al pie de la hoja anterior.

**#14, el lector de portadas no lee el libro.** «Leer las portadas» le dijo a Adamson que «no tiene texto extraído», aunque el libro tiene 19 fragmentos indexados.
- **Causa (leído):** `CoverBibliographyReader.ts:69` lee `resource.textContent`, y en ese libro está vacío.
- **Arreglo:**
  - si `textContent` no alcanza, se lee el arranque desde los primeros fragmentos del índice (`firstChunksText`: igualdad + `in`, sin índice compuesto);
  - el mensaje ya no afirma que el libro «no tiene texto»: dice que no se encontró la portada y que hay que escribirla a mano;
  - **supuesto:** que los primeros fragmentos traen la portada y los créditos (se mide en producción con Adamson).

**#26, la ficha es un dato del libro.**
- La ficha persiste en el recurso (`useSaveBibliography` → `libraryService.updateResource(..., { bibliography })`, leído), así que sirve para todos los trabajos.
- **Pero:**
  - la biblioteca no la muestra ni la edita;
  - el libro guarda dos juegos de datos que no se comunican: `author` y `title`, que muestra la tarjeta (Wallace sí tenía autor), y `bibliography`, la ficha, que decía «falta autor».
- **Arreglo:**
  - «Editar recurso» en la biblioteca muestra el estado de la ficha («Ficha para citar») y la abre;
  - la ficha se prellena con `author` y `title` de la biblioteca cuando le faltan, marcados «de la biblioteca: revísalo» (`prefillFromLibrary`).

## A. Verificador sin falsas alarmas (#15, #16, #17, #18)

**Medido:** de las 5 citas que el fundador revisó a mano, **las 5 eran falsas alarmas**. Todas estaban bien citadas.

**#18, «página no coincide» aunque la página citada sea correcta.**
- **Pasó tres veces:**
  - la 140 propuso la 141;
  - la 111 propuso la 109;
  - la 144 propuso la 145.
- **Causa (leído):**
  - `GeminiLlmCitationVerifier.ts:240-250`: el modelo devuelve UN solo fragmento de apoyo, y si su página no es la citada, la cita queda como `page-mismatch` (`pageVerdictFor`);
  - la página citada nunca se comprueba por sí misma.
- **Arreglo:**
  - antes que nada, cotejar contra los fragmentos de la PÁGINA CITADA;
  - si alguno respalda la afirmación, queda verificada;
  - `page-mismatch` sólo cuando la citada no alcanza y otra sí.
- **Además:** aceptar un **rango**, como «(Adamson, 144–145)», cuando la afirmación ocupa dos páginas.

**#16, frases que combinan varias fuentes.**
- **Ejemplos:** «Adamson y Mayor difieren…» y «…depende del aparato de NA28 y de la evidencia registrada por Mayor», cada una con una sola cita.
- El verificador exige que esa fuente respalde la frase COMPLETA.
- **Lo que no cubre lo anterior:** el arreglo D de #727 (`otherSources`) cubre la síntesis de varias fuentes con varias citas, no las frases que comparan con una sola cita.
- **Arreglo:** pedir al verificador que juzgue sólo lo que la frase le atribuye a la fuente citada, y no las conclusiones propias ni lo que se atribuye a otras.

**#15, libro sin su griego.**
- La copia extraída de Adamson no tiene NI UN carácter griego, y eso causó dos problemas:
  - el aviso «Griego que no está en la fuente» (6 + 3 + 8 formas en los tres versículos);
  - una «no encontrada» falsa: la nota 28 de la p. 145, toda en griego.
- **Arreglo:**
  - la biblioteca detecta un libro de NT o AT cuya copia no tiene escritura original y avisa «se perdió el griego al extraer; reprocesar»;
  - el verificador, en un libro así, no da «no encontrada» por formas griegas: lo marca para revisar con esa razón;
  - **reprocesar Adamson**, que es una acción de operación y se coordina con el fundador porque consume cuota.

**#17, la revisión a mano no avanza.** Después de «Marcar como revisada»:
- el panel queda en la misma cita y sigue ofreciendo el botón;
- el aviso de página sigue visible;
- el recuadro del griego no se puede dar por visto.

Debe pasar a la siguiente cita pendiente y dejar la revisada como estado.

## C. Fuentes excluidas (#6, #5, #7)

**#6, la regla del sílabo no se respeta al elegir.**
- **Qué pasa:** el diálogo «Extraer de mi biblioteca» recomendó McCartney, Varner, Ropes y Robertson, las cuatro prohibidas, sin ningún aviso.
- **Por qué:**
  - el ranking es por relevancia de los fragmentos y no lee el encuadre;
  - `sourceMemory` sólo avisa en la tarjeta de una fuente YA agregada (`CorpusSubStep.tsx:909`).
- **Arreglo:**
  - «Fuentes excluidas de este trabajo» como dato estructurado del trabajo;
  - se prellena con lo citado en la entrega anterior (`previousDelivery`) y el estudiante la confirma o la edita;
  - en el diálogo y en las recomendaciones, las excluidas van al final y marcadas («Citada en el TP #5»);
  - si igual se agrega una, se pide confirmación;
  - los pasos que redactan también la reciben.

**#5, texto de ayuda que no sigue a la rúbrica.** «Siembra los tres roles» sugiere unas 13 fuentes (4-5 anclas, 4-5 contrastes y 3-4 técnicas) aunque la rúbrica pide 6. Debe salir de los mínimos de la rúbrica.

**#7, libro mal clasificado.** Subukjian, *Volvamos a la predicación bíblica*, es homilética y figura como «Comentario expositivo» que cuenta para Santiago. Hay que revisar cómo se clasifica un recurso (por tipo y por libros bíblicos) y que un recurso sin libro bíblico no cuente para un requisito de comentario.

**Cómo quedó C (2026-10-07):**
- `excludedSources` en el trabajo: `null` = sin confirmar (se propone lo citado en la entrega anterior), `[]` = confirmado que no hay.
- Los pasos que REDACTAN (análisis, prosa, introducción, conclusión, ensamble, coherencia, plan de uso, pasos de ministerio) reciben el encuadre + la línea de exclusiones (`briefWithExclusions`). Las consultas al corpus y el ranking de la biblioteca NO: un nombre en la consulta acercaría justamente ese libro.
- **#7, desvío del plan:** un comentario cuya ficha de biblioteca dice que comenta OTROS libros no cuenta. Uno SIN libros registrados sigue contando, con aviso y enlace a la biblioteca: un archivo subido desde el corpus queda así, y no hay dato que lo distinga de un libro mal clasificado (supuesto: no se midió cuántos recursos del corpus están sin libros). Si Subukjian figura con alcance «toda la Biblia», este arreglo no lo atrapa: hay que corregir su ficha.
- Sin confirmar, las LISTAS (orden, marca, preselección, confirmación, herencia de la serie) ya tratan lo citado en la entrega anterior como excluido; los pasos que redactan sólo leen lo confirmado.
- Se excluye por APELLIDO (de cada coautor, con partícula: «de Silva»), no por cualquier palabra del autor.
- **Brechas aceptadas:** (a) el aviso de «requisitos faltantes» que reciben el análisis y la generación de pasos sigue contando por tipo, sin mirar si el comentario cubre el libro (no tienen la biblioteca a mano); (b) el sermón generado desde un trabajo recibe el encuadre sin las exclusiones: un sermón no lo corrige el sílabo.

## D. El perfil guarda lo que configuraste (#2, #4, #3)

**#2, el perfil no guarda la rúbrica.**
- **Qué pasa:** al crear el TP #6, el perfil aplicó la rúbrica por defecto: 12 páginas, doble espacio, nota al pie y 13 fuentes.
- **Causa (leído):** `ExegesisPaperSetupPage.tsx:150` monta `SaveWorkProfileButton` SIN `rubricTemplateId` ni `briefTemplateId`.
- Además, el perfil guarda una PLANTILLA y no la rúbrica ajustada dentro del trabajo.
- **Arreglo:** guardar la rúbrica y el encuadre efectivos del trabajo, ya sea por valor o creando la plantilla al guardar el perfil. La decisión se toma con el fundador.

**#4, la portada trae la fecha vieja.** Al prellenarla con la del trabajo anterior, el número avanza (#6) pero la fecha queda en «SEPTIEMBRE 2026». Debe proponer el mes en curso.

**#3, justificaciones de la rúbrica.** El «Aparato crítico» muestra el texto genérico de los comentarios, y el «Comentario expositivo» muestra el texto de ejemplo.

## E. Plan de uso coherente con el encuadre (#10, #11, #12, #13)

**#10, el plan de uso planifica de más.**
- Armó fuentes para los 12 versículos, más la introducción y la conclusión, aunque el encuadre deja sólo 3:2, 3:6 y 3:7.
- Puso NA28 y Metzger en 3:11, que no tiene pregunta, y no en 3:6, que trata la puntuación.
- **Arreglo:** planificar sólo los pasos incluidos y darle al planificador las preguntas de cada versículo.

**#11, fuente fantasma.** Después de quitar el Wallace en español del corpus, el plan siguió mostrando su id crudo (`64a71b9d-…`). Hay que limpiar las referencias a fuentes que ya no están.

**#12, editar borra los roles.** «Editar» las fuentes de un paso dejó todas como «SIN ROL», incluso las que ya tenían uno. Debe conservar los roles existentes.

**#13, el plan estructural confunde.** Muestra la introducción y la conclusión aunque el encuadre las excluya. Debe indicarlo («excluida por el encuadre»).

## G. Claves de cita (#8, #9)

- **#8:** una obra de varios autores propone la clave del primero («Carson»). Debe proponer «Carson y Moo».
- **#9:** Nestle-Aland propone «Aland». Debe proponer «NA28»: el texto crítico se cita por su sigla.

---

## Fuera de esta fase

- **F, visor y edición (#22-#25), en una fase propia:**
  - abrir las fuentes desde la página del trabajo;
  - el visor, y no el PDF suelto, desde la configuración;
  - «ir a página impresa»;
  - resaltar los resultados;
  - «Citar esta página», que inserta la cita ya verificada;
  - que el editor muestre la forma de cita que se entrega;
  - «agregar una idea» a una sección sin regenerarla.
- **Composición (#22, segunda mitad):** por qué no se usó la evidencia más fuerte que el verificador ya había confirmado (Mayor, pp. 14 y 111, para la pregunta 2). Requiere investigarlo antes de proponer algo.
