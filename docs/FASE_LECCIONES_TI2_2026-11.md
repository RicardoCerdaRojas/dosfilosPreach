# Fase «Lecciones del TI #2»: que el próximo trabajo de investigación no repita nada de esto

> Borrador 1, 2026-10-29, al cerrar el Trabajo de Investigación #2 (Salmo 23:4–6, OT603 Exégesis de Hebreo, MDiv TMS). Reúne cuatro auditorías:
> - la conversación completa de la sesión;
> - el código;
> - la devolución del profesor al TI #1 (98/100) frente al TI #2 entregado;
> - la bitácora [BITACORA_TI2_SALMO23_2026-10.md](BITACORA_TI2_SALMO23_2026-10.md) (B47–B68).
>
> Continúa a [FASE_REVISION_AUTONOMA_2026-10.md](FASE_REVISION_AUTONOMA_2026-10.md) (P1–P4, TP #9) y la absorbe.
> Rótulos: **medido** (contado en producción, en el código o en el Word), **leído** (en una fuente o en el código), **supuesto** (sin comprobar).
> Regla de la casa: una fase = un PR, un commit por unidad, cada commit probado en local por el fundador.

---

## 0. Estado al cerrar (medido)

| Qué | Estado |
|---|---|
| PR #817 (devolución desde PDF, escritorio sin esperas, Word TMS) | **Mergeado y desplegado** el 2026-10-29 09:01 (`57117c4a`, «Deploy Production» success). Durante la sesión se dijo dos veces que no lo estaba: error del asistente. |
| 4 commits de código posteriores, **solo en local** (rama `feat/devolucion-desde-pdf`) | `5cd73a2c`: reglas del curso, tesis y sin «Ibid.» en la introducción y la conclusión. `1d3743e1`: notas Turabian. `6cde1ecb`: «Ibid.» en cursiva. `4e6efe20`: «)» suelto. **No están en producción.** El TI #2 se exportó desde local, así que los tiene. |
| 3 commits de documentación | `68696b2a`, `b0143c22`, `0c8a69a1` (bitácora) |
| Escrituras en producción hechas con OK | Fichas de 7 obras (la de Niccacci es **supuesto**: falta verificarla con la portada). 14 patrones de la devolución renombrados. Análisis del v. 6 corregido (qal, «el SEÑOR» ×16). Regla 22 en «Guia Test 2026». |
| Word entregado del TI #2 (16:51) | Sin índice, sin subtítulos temáticos y con «Salmos» (decisión del fundador: «no avanzaremos con esto»). Quedaron detalles de las ediciones a mano: nota 17 «208..», nota 34 «Psalms., 566», espacio antes de las llamadas ¹¹ y ²⁸, «aqui» y «versiculo». |

**Lo primero de la fase nueva:** una rama desde `origin/main` fresco, con los 4 commits de código y los 3 de documentación por *cherry-pick*, y un PR. Sin eso, nada de §3.1 rige en producción.

---

## 1. Resumen: lo que aprendimos

### 1.1 Lo que funcionó y hay que conservar

- **Crítica textual con criterio propio.** El profesor la elogió en el TI #1 (nota 7) y el sistema la repitió bien en el TI #2:
  - conjeturas sin testigos rechazadas (יַנְחֻנִי, la «arma» de Power);
  - lectura más difícil bien aplicada en וְשַׁבְתִּי;
  - retroversiones distinguidas de testimonios hebreos.

  Medido en el Word.
- **Decidir entre fuentes con argumento propio.** Por ejemplo, el perfecto דִּשַּׁנְתָּ frente a la lectura gnómica de Ross. Es lo que piden las reglas 13 y 19.
- **Reglas en los compositores.** Con las reglas del curso, la conclusión **sin indicación** (v4) pasó de una lista de traducciones (v1) a sostener una tesis con gramática y a cerrar volviendo a ella. Comparación medida v4 frente a v1, sin cambiar nada más.
- **Citas verificadas al cerrar:** 88 citas en total, 0 no encontradas y 0 con la página dudosa (medido en producción).
- **La devolución del profesor se lee del PDF** (15/15 comentarios con su página y su frase, medido). Las fortalezas se separan de las correcciones; 12 de los 15 comentarios eran elogios.

### 1.2 Lo que costó: dónde se fue el tiempo

| Frente | Medido |
|---|---|
| Defectos del Word que exportaba el sistema, encontrados leyendo el XML | 8 tipos. Los dos más frecuentes fueron 37 espacios antes de la llamada y 10 «)» sueltos (7 + 3); los otros: forma corta de dos autores, «Ibid., N» de la misma página, «Ibid.» sin cursiva, «ed..», títulos entre asteriscos y la cita combinada partida en dos notas. Todos corregidos en local. |
| «Ibid.» al comienzo de página (guía, hoja 22) | El exportador no puede saberlo. El fundador lo revisó a mano y, al hacerlo, metió 4 errores nuevos: notas enteras en cursiva, «208..», una nota 21 «*Ibid.*, 208» que remitía a Ross en vez de Craigie, y «Psalms.». |
| Correcciones de prosa que hizo una persona | Unas 30: 4 de rigor (refutar lecturas no presentadas, lectura más corta mal aplicada), 15 de vocabulario, 13 «hablante» → «salmista» y erratas. La «Revisión antes de entregar» no corre en la introducción ni en la conclusión. |
| Estructura que el TI #1 tenía y el sistema no produce | Índice, títulos temáticos, hebreo del versículo, subtítulos por cuestión, «Salmo». En el TI #1 los hizo el fundador a mano en Word: el borrador tenía 1.188 palabras y el Word entregado, 3.384. |
| Errores del asistente | 12 registrados (ver §2.10). Dos de ellos fueron consejos de forma sin base: quitar la coma Oxford y el ida y vuelta de «Salmo/Salmos». |

### 1.3 Las cinco lecciones que más pesan

1. **El trabajo se termina fuera del sistema, y eso es lo que se evalúa.** El Word entregado del TI #1 tiene estructura, índice y forma que el sistema nunca produjo. La evidencia para corregir es el trabajo **entregado** (Google Drive), no el borrador.
2. **Las reglas en el prompt bajan los errores; no los eliminan.** La v4 de la conclusión refutó «una supuesta intensidad verbal» con la regla 11 en el prompt. Hace falta una revisión **después** de generar, en todas las secciones.
3. **La tesis se formula después del análisis, y se guarda aparte.** Sin una tesis guardada, la introducción tomó la **última** oración de la conclusión como tesis (medido).
4. **El .docx no tiene páginas; el Word guardado por Word sí.** `w:lastRenderedPageBreak` da la página de cada nota (medido: 34 notas en 13 páginas). Con eso, el «Ibid.» y la revisión final del documento son deterministas.
5. **Toda corrección se contrasta con la guía y con el trabajo entregado anterior.** Dos de tres consejos de forma del asistente estaban mal por no hacerlo.

---

## 2. Lecciones por tema

### 2.1 Método y tesis
- La tesis va **después** de aceptar los análisis: el método va de la observación al análisis y de ahí a la síntesis. Escribirla antes invita a la eiségesis, y se retiró esa propuesta (B63, bitácora §2).
- Una buena tesis, según el profesor en el TI #1, es interpretativa, concreta y verificable, no descriptiva (regla 18).
- El cierre vuelve explícitamente a la tesis y la sostiene versículo por versículo (elogio 15 del TI #1). **Falta pasarlo a la guía.**
- Criterios que no distinguen entre lecturas, en el análisis:
  - v. 4: «"no temeré" sería compatible con ambas… no decide», sin dar después el criterio que decide;
  - v. 5: el criterio contra la lectura gnómica también encaja con ella.

  Se corrigieron a mano en la prosa; en el sistema, va con P2.
- El análisis no atendió una pregunta de «Mi lectura»: en el v. 6 dio אַךְ como aseverativo sin discutir la lectura restrictiva. Mismo patrón que el B38 del TP #9.
- Un borrador de «Mi lectura» que escribe el asistente se verifica contra las fuentes antes de darlo. En el v. 4 dijo «WO concesivo», y es falso: WO lo da como condicional irreal (p. 638).

### 2.2 Crítica textual
- La lectura más corta compara **lecturas transmitidas**. La brevedad de una conjetura sin manuscritos no es un criterio.
- «Se conserva la lectura masorética por su respaldo…» (v. 4) no dice cuál es ese respaldo (regla 12).
- «Sin respaldo manuscrito» no es lo mismo que «sin respaldo en el manuscrito».

### 2.3 Fuentes y corpus
- **No basta que la fuente exista: hay que medir que cubra el pasaje nuevo.** Medido:
  - Andersen salió del corpus porque no trata 23:4–6;
  - Ross y Craigie quedaron «sin páginas para este pasaje»;
  - la sugerencia de Ross trajo 559–574, las páginas del TI #1, y le faltaban 557–558 y el final del v. 6;
  - Ortiz sugirió 26 hojas, y las entradas (חֶסֶד, רדף, נחם, שׁוב/ישׁב, שֵׁבֶט) se buscaron a mano.
- **El «Plan de uso» se saltó herramientas que sí tratan cada versículo:** Arnold y Ortiz en el v. 4, WO y Elliger en el v. 5, y los tres en el v. 6.
- **El profesor premia la fuente específica aplicada a la ambigüedad real**, como Andersen sobre רֹעִי en el TI #1. En el TI #2, Niccacci solo **define** la categoría: no resuelve nada.
- **La transparencia metodológica se debilitó.** El TI #1 tenía una nota con el texto base y aclaraba que las traducciones son propias, y el profesor la llamó «ejemplar». Las gramáticas casi desaparecen del cuerpo: Waltke baja de 12 menciones a 2 y Arnold de 6 a 1 (medido).
- **Las fichas tienen que estar antes de redactar.** «Datos para citar 1/7»: sin ficha, la nota del Word salía como copia del paréntesis. Se resolvió escribiendo 7 fichas en producción.
- **Claves y títulos de biblioteca opacos o sucios:**
  - «Elliger» por la BHS: «no me suena a una de nuestras fuentes»;
  - «Word Biblical Commentary Vol_ 19»;
  - «Sintaxis del hebreo bíblico Test».

### 2.4 Citas y notas al pie (guía de TMS, hojas 21–27 y 50)
- **«Ibid.»:**
  - para la nota inmediatamente anterior de la misma obra;
  - solo, si es la misma página;
  - en cursiva;
  - **nunca al abrir una página nueva** (hoja 22);
  - los léxicos son una excepción (nota 31; es lectura propia de una frase breve).
- **MDiv/MMB:** *IBHS* para Waltke-O’Connor en las citas posteriores. La entrada léxica va entre comillas en la forma abreviada (hoja 50).
- **Una cita combinada «(A; B)» es una sola nota**, con punto y coma.
- **Rangos de páginas.** El TI #1 los abrevió («563–64») y el exportador escribe «567–568». **Supuesto:** Turabian/Chicago abrevian; hay que confirmarlo en la guía.
- **Nombres de autor de una sola forma en el cuerpo:**
  - el TI #2 mezcla «Waltke-O’Connor» con «Waltke y O’Connor»;
  - y «Arnold» con «Arnold y Choi».
- **Formas de cita mezcladas en la prosa** que el exportador tiene que reconocer:
  - «(WO, "Título", p. 638)»;
  - «(Ross, Título (Serie), 564)»;
  - «(Ross, 565)».
- **El reconocedor de citas no las devuelve en orden y deja fuera el «)»** (medido). Ya lo compensa el exportador.

### 2.5 Formato y estructura del Word (guía, hojas 8–11, y el TI #1 entregado)
- **Niveles de título.** El cuerpo empieza en **Nivel uno** (centrado, negrita) y los subtítulos van en nivel dos. El TI #2 exportó todo en nivel dos, sin negrita (medido): incumple la guía.
- **Espaciado de títulos:**
  - dos líneas antes y una después;
  - dos después de los títulos en mayúsculas;
  - un título en tope de página empieza en el margen.

  Fue la única corrección de forma del TI #1 (comentario 1) y el TI #2 la repite.
- **«CONTENIDO».** Opcional según la guía («muy recomendable»):
  - índice automático, con la página «i» en números romanos;
  - la bibliografía cuenta como nivel uno.

  El TI #1 lo tuvo, y el enunciado del TI #2 dice «mismos lineamientos que el primero».
- **Estructura del TI #1:**
  - la introducción va bajo el título del trabajo;
  - un título temático por versículo, con «(v. N)»;
  - debajo, el hebreo del versículo (con vocales y sin acentos) y su traducción;
  - subtítulos de nivel dos por cuestión.
- **«Salmo 23» para un solo salmo.** El TI #1 entregado lo dice 9 veces y nunca «Salmos». El sistema escribe «Salmos» (`BibleCanon.ts:141`).
- **Apóstrofo tipográfico (’)**, que el profesor marcó en el TI #1. Ya corregido y desplegado (`51f22a6e`).

### 2.6 Tono y vocabulario (bitácora §3; regla 22 escrita)
- Un término técnico que no es de la gramática del curso se explica entre paréntesis la primera vez. En el TI #2 eran 15 casos, entre ellos «tronco», que introdujo una corrección del asistente.
- Una sola nomenclatura: perfecto e imperfecto, no qatal y yiqtol a la vez. El Word final todavía mezcla «qatal», «weqatal» y «yiqtol» (medido).
- Si existe una palabra llana que dice lo mismo, se usa la llana.
- No se refuta una lectura que el texto no presentó.
- La voz del texto es «el salmista». «Creyente» no, porque lleva a la aplicación.
- Muletillas medidas en el cuerpo:
  - 18 cierres con «sin + infinitivo»;
  - 21 impersonales («se prefiere», «se conserva», «se adopta»…);
  - una frase repetida 3 veces.
- La gramática se aplica al texto, no solo se nombra. El profesor elogió en el TI #1 el hifil explicado (9), el polel (11) y el piel frente al hifil con WO (13). En el TI #2 los piel solo se nombran. Las cadenas constructas (בְּגֵיא צַלְמָוֶת, בְּבֵית־יְהוָה, כָּל־יְמֵי חַיָּי) no llevan categoría ni gramática (reglas 10 y 16).

### 2.7 Morfología
- **OSHB también se equivoca:**
  - etiqueta יִרְדְּפוּנִי como piel, cuando la vocalización es de qal;
  - lematiza וְשַׁבְתִּי en יָשַׁב, cuando la vocalización es de שׁוּב.
- **El analizador recibe OSHB como dato «no negociable»** (`verseMorphologyBriefing.ts:176-190`, leído). Eso empuja el error. El análisis del v. 6 salió «imperfecto piel» y hubo que corregirlo en producción.
- **El tutor de hebreo sobrescribe con OSHB** (`oshb-contrast.ts:113`). Para la exégesis hace falta lo contrario: mostrar la diferencia y razonarla con la vocalización.
- **La extracción de la BHS tiene errores de vocalización**, y la búsqueda no encuentra צַלְמָוֶת ni וְשַׁבְתִּי.

### 2.8 La devolución del profesor
- Se importa bien del PDF. Faltó 1 de 15 marcas: la de «afimar», que no tiene texto. Hace falta un patrón «Erratas».
- **Ningún compositor ni revisor lee la devolución** (leído en el código). El único camino es que el estudiante pase un patrón a la guía. Quedan 10 de 14 patrones `pending`.
- **Trampa de la copia de la guía:** un trabajo con `styleGuideSnapshot` no recibe las reglas que se agregan después (`courseStyleRules.ts:18`). El TI #2 no tenía copia, así que leyó las reglas en vivo (medido).
- **«Guia Test 2026» la comparten NT785 (griego) y OT603 (hebreo).** Las reglas 2–17 vienen del profesor de griego y de Turabian, y la regla 22 rige en los dos cursos.

### 2.9 Flujo y pantallas
Pendientes de la bitácora:
- B47: «Traer trabajos» escondido.
- B48: el campo «Curso» sin explicar.
- B49: «Estrategia» sin explicar.
- B50: dos botones de guardar, y la guía en dos lugares.
- B53: el nombre del patrón es la primera oración.
- B54: no hay grupo «del trabajo anterior».
- B55: propone fuentes de griego en hebreo.
- B56: Niccacci sin tipo.
- B57: el selector de pasajes viejos marca de antemano.
- B60: aviso del orden de generación.
- B61: se pierde la vuelta al proyecto.

Además:
- «Agregar a mano» crea una ficha suelta, sin enlace al libro.
- «Extraer de mi biblioteca» preselecciona obras que ya están en el corpus y arriesga duplicarlas.
- El aviso de «roles dialécticos» pide un ancla expositiva que la rúbrica no exige.
- No se explica que las citas del cuerpo bajan a nota al pie en el Word: «¿es un error mío?».
- No es evidente que «Mi lectura» conviene llenarla antes de generar.
- El editor de citas induce errores: al corregir Niccacci, el fundador borró la cita buena (p. 27) y dejó la mala (p. 81).
- Del TP #9 siguen pendientes:
  - B32: editar el análisis;
  - bajar la biblioteca (39 MB) sin `textContent`.

### 2.10 Proceso del asistente (no es código: es cómo trabajar)
1. **Consultar `gh pr view` antes de afirmar el estado de un PR.** Se dijo dos veces que el #817 no estaba mergeado.
2. **Al empezar un trabajo, leer:**
   - la fecha de entrega en el calendario del curso (se preguntó 4 veces);
   - el PDF de la guía;
   - el **trabajo entregado** anterior y su devolución.
3. **Medir antes de corregir.** Con la línea DIAG en pantalla, el esqueleto se resolvió en dos pasadas, después de horas de deducir.
4. **No tocar la copia que sirve Vite mientras el fundador prueba.** Las pruebas y mutaciones van en un *worktree*. Además:
   - avisar antes de cualquier recarga;
   - nunca pedir una recarga forzada con cambios sin guardar (se perdieron cambios una vez).
5. **Si el fundador pide arreglar el sistema, no ofrecer texto propio para pegar.** Pasó con los compositores (B62).
6. **Al dar una indicación, que sea literal y completa.** Se dejó un marcador «[la misma tesis de arriba]» en una indicación.
7. **No proponer pasos innecesarios.** Sugerir regenerar sin motivo hizo perder tiempo. La prueba justa la definió el fundador: la v4 sin indicación contra la v1.
8. **Probar con datos reales completos.** La primera prueba del exportador sin `bibliography` produjo una alarma falsa.
9. **Las correcciones van como «busca esto → reemplázalo por esto», con el texto exacto.** Lo que comprime la explicación no se entiende.
10. **Un término que introduce una corrección también cumple la regla 22.**
11. **Toda afirmación de forma se contrasta con la guía y con el trabajo entregado anterior**, o se presenta como preferencia propia.
12. **Cuando el fundador elige el rigor sobre el plazo** («prefiero retardar un poco la entrega»), se arregla el sistema y no se parcha el texto.

---

## 3. Plan de implementación

Orden por dependencias y por impacto en el próximo trabajo. Cada etapa es un PR; cada unidad, un commit probado en local por el fundador. Para cada unidad se indica:
- **Por qué:** la evidencia;
- **Dónde:** el código, leído;
- **Cómo se mide**;
- **Tamaño:** S ≤ ½ día, M 1–2 días, L > 2 días.

### Etapa 0 · Antes de empezar (S, sin código nuevo)
1. PR con los 4 commits de código y los 3 de documentación, en una rama desde `origin/main` fresco, por *cherry-pick*.
2. `CHOKIDAR_USEPOLLING=1` en el script `dev` de la web: las recargas espurias por Spotlight y Time Machine.
3. Confirmar las 3 entradas de byblos que quedaron «propuestas».
4. Verificar la ficha de Niccacci contra la portada del PDF.
5. Decisiones del fundador (§5).

**Hallado en la revisión adversarial de la etapa 0 (2026-10-29).** Se corrigió en el mismo PR lo que el diff introducía: el «Ibid.» ignoraba `footnotes.ibid` de la guía; una nota sin página tras una con página salía «Ibid.» solo; `shortAuthor` partía «Ramón y Cajal, Santiago», entidades con «y», tres autores y coautores con «Jr.»; el prompt de la conclusión daba por tesis la del encuadre. Queda para la etapa 1, porque ya estaba antes (leído con sondas sobre el exportador):
- `Como dice Ross (p. 565)` → «Como dice ¹»: el nombre del autor desaparece de la prosa.
- `(Ross, 565; Génesis 19, 25)` → una sola nota a Ross con página 25: la forma con título sin comillas toma «565; Génesis 19» como título.
- `(Ross, Commentary, 565; Craigie, 12)` → la parte de Ross queda en la prosa y solo Craigie baja a nota.
- Dudas sin confirmar: la conjunción se copia de la ficha («Arnold and Choi» en un trabajo en español; la guía espera «y»); «Keil and Delitzsch» sale con un solo apellido; el manifiesto en JSON del prompt sigue diciendo `ibid.enabled: true` junto a «NUNCA Ibid» (en la prosa no aplica); la llamada pegada a hebreo RTL falta verla en Word.

### Etapa 1 · El Word como lo pide TMS y como salió el TI #1 (L)
**Por qué:**
- el formato es la única corrección de forma que hizo el profesor en el TI #1;
- 8 defectos del exportador medidos;
- y la estructura que el fundador arma a mano.

1. **Niveles y espaciado de títulos (B69, nuevo).**
   - El título del trabajo y los títulos de versículo, conclusión y bibliografía van en Heading1, centrados y en negrita.
   - Los subtítulos van en Heading2.
   - Espaciado: dos líneas antes y una después; dos después de los títulos en mayúsculas.
   - Un título en tope de página sin espacio antes.
   - *Dónde:* `tmsLayout.ts`, `exportPaperToDocx.ts:142,299-307`.
   - *Mide:* la prueba del XML, y el PDF del TI #1 como referencia (51 pt después de un párrafo).
   - **Hecho (2026-10-29).** Medido en el PDF del TI #1: Word pone el espacio extra del doble espacio **debajo** de cada línea, así que el párrafo anterior ya deja una línea en blanco. Con 24 pt antes, el TI #1 tuvo **tres** líneas en blanco antes de cada título (51,6 pt entre líneas base): eso marcó el profesor. Los 12 pt de hoy (nota 10 de la guía) dan las dos que pide; después, una (25,8 pt); en tope de página Word quita el espacio. El defecto real era el nivel: el ensamble escribe cada sección en `##` y el Word la pasaba a nivel dos. Ahora `#` y `##` son nivel uno, `###` nivel dos y `####` nivel tres (`nivelDeWord`), sin tocar el markdown. BIBLIOGRAFÍA va en nivel uno sin negrita, como en la propia guía (redonda en su PDF, hoja 66).
2. **«Salmo» para un solo salmo (B68a).**
   - *Dónde:* `formatPassageReference` (`passage-reference.ts:326`, `BibleCanon.ts:141`).
   - *Riesgo:* 153 llamadas; `sectionHeadings` y `replaceVerseSection` buscan el rótulo escrito. Se aceptan las dos formas al leer y se escribe la nueva.
   - **Hecho (2026-10-29).** `formatPassageReference` escribe «Salmo 23:4» / «Psalm 23:4» con un solo salmo; un rango de salmos sigue en plural. Una auditoría de los llamadores encontró tres lugares que comparan con texto guardado y que se habrían roto en un trabajo sobre un salmo: la huella de extracción de cada fuente (todas habrían salido «desactualizadas», y «Re-extraer» reemplaza las páginas elegidas), la búsqueda de la sección en el ensamble al recomponer un versículo, y el aviso de edición a mano del ensamble. Los tres, más la búsqueda de la lista de trabajos, comparan con `sameBookNameForPsalms`, que trata «Salmo» y «Salmos» como el mismo libro. El analizador lee las dos formas (alias de `BibleCanon.ts:142`).
3. **«CONTENIDO» automático y paginación por secciones, como pide la guía (B68b).**

   La guía (leída, hojas 8, 10, 17 y 57) arma el documento en cuatro secciones, cada una con su numeración:

   | Sección | Número | Dónde |
   |---|---|---|
   | Portada | ninguno | — |
   | CONTENIDO | romanos en minúscula (i, ii…), **forma parte de la portada** | abajo al centro, en todas sus páginas |
   | Cuerpo | arábigos, **empieza en 1** | página 1 abajo al centro; las siguientes, arriba a la derecha |
   | BIBLIOGRAFÍA | arábigos, **sigue la numeración del cuerpo** | **su primera página abajo al centro**, «como si comenzara un nuevo capítulo» (hoja 17); las siguientes, arriba a la derecha |

   El APÉNDICE, si lo hay, va como la bibliografía: página nueva y encabezado de título.

   **El índice:**
   - campo automático (`TableOfContents` + `features.updateFields`; docx 9.6.1 los trae, leído);
   - títulos a la izquierda, números a la derecha y línea de puntos en medio;
   - 12 pt y sin negrita;
   - tres niveles, con sangría por nivel;
   - espaciado de doble (nivel uno) a simple (niveles más bajos);
   - la bibliografía entra como nivel uno.

   **La bibliografía (hoja 17):**
   - entradas a espacio simple, separadas por 12 pt, con sangría francesa de 0,5";
   - **una entrada no se parte entre dos páginas** (`keepLines`);
   - dos espacios simples entre el título y la primera entrada;
   - las subsecciones, si las hay, en nivel uno y en negrita.

   **Estado actual (leído en `exportPaperToDocx.ts`):**
   - la portada va sin número;
   - el cuerpo tiene la primera página abajo al centro y las siguientes arriba a la derecha (`titlePage`);
   - **la bibliografía va dentro de la sección del cuerpo, con `pageBreakBefore`, así que su primera página sale arriba a la derecha.** Va en una sección propia, que continúa la numeración, con `titlePage` y el pie centrado.

   **El TI #1 entregado** (medido en el PDF) cumplió con la portada, el índice en «i» y el cuerpo; **la bibliografía llevó el «13» arriba a la derecha**, contra la hoja 17. El profesor no lo marcó.

   **Mide:**
   - exportar, abrir en Word por AppleScript, guardar como PDF;
   - leer la posición y el valor del número en cada página: portada sin número; índice «i» abajo al centro; cuerpo «1» abajo al centro y las siguientes arriba a la derecha; bibliografía con su primera página abajo al centro, continuando la numeración;
   - comprobar que el índice trae las páginas reales.

   **Supuesto:** que Word para Mac actualice el campo al abrir. Si no lo hace, el índice va con las entradas guardadas y un aviso «Actualizar tabla».

   **Hecho (2026-10-29).** Medido en Word para Mac: el campo se arma solo al abrir, con las páginas correctas (el supuesto se cumple). Exportado con el exportador real y pasado a PDF por Word: portada sin número; CONTENIDO «i» abajo al centro; cuerpo «1» abajo al centro y 2–5 arriba a la derecha; BIBLIOGRAFÍA «6» abajo al centro y «7» arriba a la derecha; ninguna entrada partida entre páginas. La guía deja el índice a la tarea (hoja 3: «puede requerirse … para tareas específicas»), así que es un campo de la rúbrica, `formatting.tableOfContents` («Con CONTENIDO» en el editor del formato), que el extractor del sílabo marca si lo pide. Para el TI #3 hay que marcarlo en su rúbrica.
4. **Hebreo y traducción bajo el título del versículo (B68c).** De `originalText` del análisis (`CanonicalVerseAnalysis.ts:56`) y de la traducción final, sin acentos (como el TI #1).
   - **Hecho (2026-10-29).** Medido contra el TI #1: el WLC de Sal 23:1–3 sin te'amim (U+0591–U+05AF) ni meteg (U+05BD) es idéntico, en NFC, a lo entregado. El paseq (׀, Sal 23:5–6) también se quita: es del sistema de acentos; **decisión, no medida** (el TI #1 no lo tenía). Formato del TI #1: espacio simple, sangría de 0,5" a los dos lados, el hebreo a la derecha con 6 pt después y la traducción entre comillas con 18 pt después. Va solo bajo un título de sección cuyo rótulo es el del versículo: un TP titulado con las preguntas no lo lleva. El análisis se lee de la versión del paso (`accepted ?? current`), como el compositor de la prosa.
   - **Para la etapa 3:** los títulos temáticos ya no dirán «Salmo 23:4». El vínculo título → versículo tendrá que salir del paso, no del texto del título.
5. **~~La introducción bajo el título del trabajo, sin el rótulo «Introducción»~~ (B68d). Corregido por el fundador (2026-10-29): al revés. Con portada, el cuerpo NO repite el título del trabajo (ya está en la portada) y empieza en «Introducción», nivel uno.**
   - **Hecho (2026-10-29).** El exportador quita el `#` del título cuando hay portada. Sin portada se queda. Queda anotado, fuera de esta unidad: sin portada el Word trae el título dos veces (la cabecera de trabajo y el del ensamble).
   - *Dónde:* `assemblyContents.ts:240-246`, prompt de `GeminiIntroductionComposer.ts:215`.
6. **Notas por tipo de obra (B66).**
   - Campo `abbreviation` en la ficha (*IBHS*), y `sourceType` en `BibliographyEntry`.
   - Léxico: la entrada entre comillas en la forma corta y sin «Ibid.».
   - *Dónde:* `bibliography.ts:16`, `paperBibliography.ts:25`, `exportPaperToDocx.ts:228`.
   - **Hecho (2026-10-30).** Leído en la guía («Léxicos y gramáticas», hoja 50, y nota 31) y medido en su PDF: las ocho obras de su tabla (BDAG, BDB, BDF, *BHRG*, GKC, *HALOT*, *IBHS*, Joüon) se reconocen por el título, con su cursiva (las de título en cursiva, las de autor en redonda). La nota siguiente de un léxico es «"entrada", *HALOT*, 2:457»; la de una gramática, «GKC §18» (sin coma) o «*IBHS*, 436». Léxicos, diccionarios y artículos no llevan «Ibid.» (nota 31). La ficha tiene un campo nuevo, «Abreviatura», para otra obra. La entrada del léxico sale del título entre comillas de la cita o de «s.v.». **Supuesto:** que la ficha de Waltke-O’Connor del TI #2 diga «An Introduction to Biblical Hebrew Syntax»; si no, basta escribir «IBHS» en su abreviatura.
7. **Rangos de páginas abreviados**, si la guía lo confirma («567–68»).
   - *Dónde:* `appendPages` (`bibliography.ts`).
   - *Mide:* lectura de la guía primero (supuesto hoy).
   - **Hecho (2026-10-30).** Confirmado en la guía («Números», leído): raya corta; si el primer número es menor que 100, el segundo entero (92–137); si es 100 o más, al menos dos cifras (162–75, 2156–89) y sin cero inicial (103–6). Un múltiplo de 100 va entero (100–104), como Turabian y Chicago. `paginasAbreviadas` se aplica en todas las notas (completa, abreviada, *Ibid.* y obras de referencia, también con tomo: «2:457–58»).

**Revisión adversarial de la etapa 1 (2026-10-30).** Corregido antes del PR (seis defectos reproducidos y uno de concordancia):
- títulos de la tabla de la guía demasiado amplios: Louw–Nida y Thayer salían BDAG, y Holladay salía *HALOT*. Ahora se exige también el autor;
- la «entrada» de un léxico salía del título de la cita, que en la tubería real es el nombre de la obra. Ahora solo sale de «s.v.»;
- un rango de cuatro cifras con tres que cambian iba abreviado (1496–504). Ahora va entero;
- con portada se quitaba cualquier `#` inicial. Ahora solo el título del trabajo;
- un título con raya corta no encontraba su versículo;
- una abreviatura escrita a mano salía siempre en redonda. Ahora va en cursiva si se escribe entre asteriscos;
- `yaTraeBibliografia` leía hasta `###` y el Word hasta `####`.

Queda para etapas siguientes:
- **Etapa 2:**
  - el hebreo bajo el título es la copia del analizador (`originalText`), no el WLC: verificar contra el WLC;
  - el índice sin entradas guardadas sale vacío fuera de Word (Google Docs, Pages): avisar;
  - Word para Windows preguntaría si actualizar campos (supuesto).
- **Etapa 4:**
  - la tubería no lleva la entrada del léxico a la cita: hace falta para la forma «"entrada", *HALOT*, 2:457»;
  - la nota siguiente de un léxico pierde el tomo que solo está en la ficha;
  - en las notas, los artículos se arman como libros (ya pasaba antes).
- **Etapa 3:** el compositor del trabajo entero titula los versículos con `###` y el respaldo sin ensamble con «Versículo N». En esos dos casos no sale el hebreo.

### Etapa 2 · «Revisar el Word antes de entregar» (M) — nuevo, B65 + B70
**Por qué:** el «Ibid.» de página nueva solo se sabe en el Word guardado por Word, y las ediciones a mano metieron 9 errores en el Word final (medido).

El estudiante sube el .docx que guardó en Word. El sistema lee:
- `w:lastRenderedPageBreak` y la página de cada nota;
- el texto de las notas;
- el cuerpo.

Y marca, sin modelo:
- «Ibid.» al abrir página, con la forma abreviada propuesta;
- «Ibid.» que no remite a la nota anterior: la nota 21 remitía a Ross;
- nota con la página repetida o con «..»;
- toda la nota en cursiva;
- espacio antes de la llamada (regla 2);
- «)» o «(» sueltos;
- palabras frecuentes sin tilde («aqui», «versiculo», «INVESTIGACION»; una lista cerrada y medida, no un corrector general);
- mezcla de nomenclatura (qatal o yiqtol junto a perfecto o imperfecto, regla 22);
- formas de autor mezcladas («Waltke-O’Connor» y «Waltke y O’Connor»).

*Dónde:* nuevo servicio de dominio puro sobre el XML, y JSZip como dependencia directa de la web. *Mide:* con el Word del TI #2 de las 16:51, debe marcar los 9 casos medidos y nada más.

### Etapa 3 · La tesis y la forma del argumento (L)
**Por qué:** la introducción tomó la última oración como tesis; la tesis precisa la trajo una indicación; los títulos temáticos dependen de la tesis y de las decisiones.

1. **Campo `thesis` en el trabajo (B63).** Un campo, no un tipo de paso nuevo: hay 24 comprobaciones de `kind` (leído).
   - Se propone **después** de aceptar los análisis: 2 o 3 tesis con su respaldo versículo por versículo.
   - Cualquier tesis, también la del estudiante, se revisa con los 6 criterios de la bitácora §2:
     1. interpretativa;
     2. cubre todos los versículos;
     3. cada parte tiene respaldo;
     4. distingue entre lecturas;
     5. se conecta con la unidad anterior;
     6. responde al enunciado.
   - *Mide antes de construir:* con el TI #1, que debe aprobar la tesis entregada, y con el TI #2, que debe aprobar la tesis acordada y marcar la de la v4 por no conectarse con los vv. 1–3. Gasto de API: se pide antes (prepago).
2. **La introducción y la conclusión leen `thesis`**, no la adivinan. La introducción termina con ella y la conclusión la retoma.
   - *Dónde:* `GeminiIntroductionComposer.ts:146,189-206` y `GeminiConclusionComposer.ts:120,153`.
3. **Títulos temáticos y subtítulos propuestos (B68e).**
   - Un título por versículo y uno por cuestión, sacados de las preguntas, de las decisiones y de la tesis.
   - El estudiante los acepta o los cambia.
   - *Dónde:* `sectionHeadings` (`assemblyContents.ts:223`) y `canonicalizeQuestionHeadings` (`composedVerseSections.ts:224`).
4. **Nota metodológica (nuevo):** el texto base, que las traducciones son propias y qué papel tiene cada fuente, como la nota 2 del TI #1, que el profesor llamó «ejemplar». La propone el compositor de la introducción.
5. **Aviso del orden (B60):** «Primero la conclusión; luego la tesis; al final la introducción».
   - Hoy la conclusión solo se bloquea con 0 versículos aceptados (`StepCard.tsx:425`), así que se genera con versículos pendientes y sin aviso.
   - Las pistas son solo tooltips (`:862, 881, 945, 964`).
   - Se agrega una advertencia suave si hay versículos sin aceptar.

### Etapa 4 · Revisión en todas las secciones y vocabulario en todo lo que se genera (M–L)
**Por qué:** la regla en el prompt no bastó (v4); hubo unas 30 correcciones humanas de prosa; la regla 22 no llega al sermón.

1. **«Revisión antes de entregar» en la introducción y la conclusión (B64).**
   - Quitar la exigencia de versículo (`ReviewVerseProseUseCase.ts:64`, `StepCard.tsx:1128`).
   - Criterios propios: responde a la tesis, no refuta lo no presentado, no agrega lo que el cuerpo no mostró.
   - Apagar `missing-criterion` y `translation-mismatch` ahí.
2. **Regla general de vocabulario en el código (B67).**
   - Se amplía `buildAcademicRegisterBlock` (`academicVoice.ts:287`): una sola nomenclatura, la palabra llana, «el salmista», no refutar lo no presentado. Además, se quita «se prefiere» del ejemplo, porque es una de las muletillas medidas.
   - Una variante **sin jerga** para `ministryComposers/*` (sermón, devocional y guía de estudio), que hoy ignoran el manifiesto (`MinistryComposerUseCases.ts:229`).
   - Llevarla también a `coherenceReviewer/reviewerPrompts.ts`.
3. **Controles deterministas en `reviewProseFixed`** (`proseReview.ts:72`):
   - muletillas contadas: «sin + infinitivo» al cierre y el mismo impersonal repetido en un versículo;
   - nomenclatura mezclada;
   - término técnico de una lista sin glosa en su primera aparición;
   - frase de más de 8 palabras repetida en el trabajo.
4. **La gramática aplicada, no nombrada** (nuevo criterio). Cada conjugación y cada cadena constructa que la decisión usa lleva su categoría y su gramática con página (reglas 10 y 16). Va como control del analizador y como criterio de la revisión.
5. **P1 · Lo que dice el aparato llega al criterio y a la prosa** (de la fase anterior; M). Determinista; se mide gratis sobre el TP #9 y el TI #2.
6. **P2 · Premisas con cita, inferencia sin cita** (L).
   - Hay 6 lectores de `decisiveCriterion.text` (leído).
   - *Riesgo:* los veredictos guardados están indexados por ruta.
   - Cubre los criterios que no distinguen (§2.1).
7. **P4 · Propuestas aplicables `{find, replace, why}`** (L). Depende de P1 y P2 y de una decisión del fundador (§5): ¿aplicar una propuesta vuelve a verificar las citas de esa oración? Hoy `SaveStepEditUseCase` no lo hace a propósito.
8. P3 ya está en el código desde #816 (leído); solo falta medirlo.

### Etapa 5 · Fuentes y corpus para el pasaje nuevo (M)
**Por qué:** §2.3, las horas que se fueron en páginas y entradas a mano.

1. **Cobertura medida por versículo antes de aceptar una fuente.** «Ross: 557–574 tratan 23:4–6; Andersen no lo trata».
2. **Páginas del pasaje nuevo, no las del trabajo anterior.** La sugerencia de Ross trajo las de 23:1–3.
3. **Léxico: proponer las entradas por lema de cada palabra decisiva**, no hojas al azar. Las de Ortiz se buscaron a mano.
4. **El «Plan de uso» cubre lo que cada fuente trata en cada versículo**, contra la cobertura medida.
5. **B54:** un grupo «Del trabajo anterior», con «Aprobar todas».
6. **B55:** filtrar por testamento según el curso.
7. **B56:** tipo de fuente con el clasificador existente (`ClassifySourceTypeUseCase`).
8. **Ficha completa antes de redactar.** «Datos para citar 7/7» es condición para componer, o al menos un aviso fuerte.
9. **Clave legible y título limpio:**
   - BHS en vez de «Elliger»;
   - sin «Vol_» ni «Test»;
   - corregirlos en la biblioteca.
10. **«Agregar a mano» enlaza al libro de la biblioteca**, y «Extraer de mi biblioteca» no preselecciona lo que ya está en el corpus.

### Etapa 6 · Morfología con criterio (M) — B59
1. Bajar el «no negociable» de OSHB en el prompt (`verseMorphologyBriefing.ts:176-190`) a «dato de referencia, contrastarlo con la vocalización».
2. Un control posterior en el dominio: compara el análisis con los tokens de OSHB y MorphGNT y muestra la diferencia, con la razón de la vocalización, **sin sobrescribir**.
   - Reusa `alignWordsToTokens` y `contrastVerbWithOshb` (`oshb-contrast.ts`).
   - *Mide:* 23:6 debe avisar en יִרְדְּפוּנִי (piel según OSHB, qal según la vocalización) y en וְשַׁבְתִּי (יָשַׁב frente a שׁוּב), y callar en los otros 6 verbos.
3. Ortografía de la BHS extraída: medir la vocalización, y la búsqueda de צַלְמָוֶת y וְשַׁבְתִּי.

### Etapa 7 · La devolución alimenta el trabajo siguiente (M)
0. **La guía en tres capas (decidido por el fundador el 2026-10-29; reemplaza el punto 4).**

   **Por qué:** hoy un trabajo apunta a UNA guía por id, sin copia al crearse (`CreateExegeticalPaperUseCase.ts:126`); la copia solo nace al volver a elegir la guía (`SetPaperStyleGuideUseCase.ts:32-67`). NT785 y OT603 apuntan a la misma, así que las reglas del profesor de griego rigen en hebreo, y un cambio en la guía alcanza a los trabajos ya entregados. `AddRuleToStyleGuideUseCase` escribe la regla del profesor en esa guía compartida. Además, sin guía, el servidor cae a TMS y el navegador a la guía activa del usuario (`useEffectiveStyleGuide.ts:10-13`): no coinciden.

   **El modelo:**
   | Capa | Qué tiene | Dónde vive | A quién alcanza un cambio |
   |---|---|---|---|
   | Institución | la guía de TMS (notas, portada, bibliografía, reglas de Turabian) | la guía (`UserStyleGuide`) | todos los cursos que la usan |
   | Mías | la forma de escribir del estudiante | el usuario | todos sus trabajos, de cualquier curso |
   | Curso | lo que pide el profesor, salido de sus devoluciones | el curso (`ai_projects`) | solo los trabajos de ese curso |

   - Una sola función arma las reglas vigentes (institución + mías + curso) y la usan el servidor y el navegador.
   - Si dos reglas chocan, gana la del curso: el profesor califica. El choque se muestra; no se resuelve en silencio.
   - «Pasar a la guía» desde una devolución escribe en la capa del **curso**. Desde ahí se puede subir a «Mías» si el estudiante la quiere en todos sus cursos.
   - Un trabajo **en curso** lee las reglas vigentes y avisa cuando se agrega una. Al **entregarlo**, se congela la copia con las reglas de ese día: un trabajo entregado no cambia nunca, y la devolución se lee contra las reglas con que se escribió.
   - Un proyecto sin curso (serie de sermones, proyecto exegético) usa solo institución y mías.
   - Las copias que ya existen se respetan hasta que se refresquen.

   **Migración de «Guia Test 2026»** (propuesta por origen; el fundador confirma regla por regla, con el texto leído de producción):
   | Reglas | Origen | Capa propuesta |
   |---|---|---|
   | 1–8 | Turabian y TMS | Institución |
   | 9–17 | profesor de griego (TP #7) | Curso NT785. Las 11, 12 y 13 se aplicaron en el TI #2 de hebreo: candidatas a «Mías» |
   | 18–21 | fortalezas del TI #1 de hebreo | Curso OT603 |
   | 22 | vocabulario, de las correcciones del fundador | Mías |

   **Descartado:** una copia completa de la guía por curso (la parte de TMS se desfasa entre copias); herencia de guías con bifurcación (lo mismo, más complejo, y no separa «mías» de «curso»).

   **Mide:** con los TP de NT785 y el TI de OT603, el prompt de cada uno lleva solo sus reglas de curso, más las de institución y las mías; un trabajo entregado conserva sus reglas aunque se edite la guía.
1. **Las fortalezas como reglas «a mantener».** Pasar a la guía las 4 que siguen `pending` y que el profesor elogió:
   - cierre que vuelve a la tesis;
   - transparencia metodológica;
   - fuente específica para la ambigüedad real;
   - gramática aplicada.
   - Con el OK del fundador, desde la pantalla.
2. **Patrón «Erratas».** Una marca sin texto («afimar») se importa como errata, no se descarta.
3. **La copia de la guía se refresca:** al agregar una regla, el sistema ofrece aplicarla a los trabajos abiertos que tienen copia (`SetPaperStyleGuideUseCase`).
4. ~~Una guía por curso, o una base común más las reglas del curso~~: resuelto en 7.0.
5. **La devolución del trabajo anterior como contexto del revisor.** Lo que el profesor corrigió una vez se vigila en el siguiente: espaciado, apóstrofo y errata en el TI #1.

### Etapa 8 · Flujo y pantallas (M)
Ubicaciones leídas en el código:

| # | Dónde | Qué falta | Tamaño |
|---|---|---|---|
| B47 | `CourseWorksTable.tsx:239` (`disabled` sin tipos); `ImportPreviousWorksUseCase.ts:93` exige `workTypeId` | Mostrar «Traer trabajos» sin tipos, y crear o elegir el tipo en línea | M |
| B48 | `ProjectCourseCard.tsx:45-49` | Una línea de ayuda con `aria-describedby` | S |
| B49 | `ProjectWorkTypesCard.tsx:142-154` (ya hay un patrón de ayuda en `:134`) | `strategyHint` en es y en | S |
| B50 | `CourseChargeSection.tsx:152-185`: dos tarjetas, cada una con su Guardar | Un solo Guardar, y la guía heredada del tipo | M |
| B53 | `suggestPatternName` (`pdfFeedback.ts:102-121`) | Un rótulo conceptual, por heurística o con modelo | S–M |
| B57 | `BriefSlotNotices.tsx:81,85`; `assignmentBriefSlots.ts:155-164` | Distinguir una mención citada («a la luz de…») de un hueco del encuadre | S |
| B61 | Los enlaces del trabajo a la configuración (`ExegesisPaperPage.tsx:457, 937, 999, 1052`), `ProjectSeriesSection.tsx:38,159`, el botón de error (`ExegesisPaperSetupPage.tsx:109`) y el `from` que viaja solo en el estado (`dashboard.tsx:668`, `SeriesDetail.tsx:262`) | Un `withFrom()` en todos | S |

Además:
- aviso de que las citas bajan a nota al pie;
- «Mi lectura» antes de generar;
- B32, editar el análisis;
- un editor de citas que no deje borrar la buena por error (va con P4).

Para la etapa 5 (leído):
- **B54:** `ExtractFromLibraryDialog.tsx:152-233` y `usePreviousCourseDelivery.ts:35-55`. El patrón análogo de series es `InheritCorpusFromSeriesUseCase.ts:65`. Riesgo: choca con «no repetir fuentes». Va después de B47.
- **B55:** `recomendadoPorPasaje.ts:18-40`, `bibliographyCandidates.ts:110-131` y `RetrieveChunksResourceRanker.ts:50`. Hace falta el testamento o la lengua en `LibraryResource`. Va después de B56.
- **B56:** `bibliographyCandidates.ts:120` descarta las fichas sin `exegeticalType`; `tipoAcademico.ts:53-56`.

---

## 4. Prueba de la fase

**El próximo trabajo de investigación.** **Ojo:** según la rúbrica, el TI #3 es «síntesis y exposición» y «necesita su propia rúbrica» (leído). Antes de empezar hay que:
- leer el enunciado del TI #3 y su calendario;
- crear su rúbrica;
- decidir si la exposición usa la voz académica o una variante sin jerga (etapa 4.2).

Si la próxima entrega es de otro curso, la prueba es la misma.

Se cuenta lo mismo que en el TI #2. La fase cumple si:

| Medida | TI #2 (medido) | Meta |
|---|---|---|
| Defectos del exportador encontrados leyendo el Word | 8 tipos | 0 |
| Errores en el Word final (revisión de la etapa 2) | 9 | 0 al entregar |
| Correcciones de rigor que encontró solo una persona | 4 | ≤ 1 |
| Correcciones de vocabulario que hizo una persona | 15 | ≤ 3 |
| Estructura del TI #1 (índice, títulos, hebreo, «Salmo») hecha a mano | toda | nada |
| Correcciones del profesor al trabajo anterior que se repiten | 3 de 3 (espaciado, erratas, «Salmo») | 0 |
| Páginas y entradas de léxico buscadas a mano | Ross, Craigie y 5 entradas de Ortiz | 0 |
| Avisos inventados de la revisión | 0 en el TI #2 | 0 |

---

## 5. Decisiones del fundador antes de empezar

1. **¿Separamos la guía por curso?** Hebreo y griego comparten hoy las reglas 2–17, que nacieron del profesor de griego. **Decidido (2026-10-29): tres capas —institución, mías y curso— con copia congelada al entregar (etapa 7.0).**
2. **Las «doce páginas» ya tienen interpretación.** Byblos tiene una entrada del 2026-09-17, del TI #1: 12 páginas de **cuerpo**, sin portada, contenido ni bibliografía, unas 3.000 palabras con alrededor de 50 notas. Con esa interpretación, el TI #2 quedó corto: 11 páginas de cuerpo, 2.740 palabras y 34 notas (medido). Solo falta confirmar que el criterio sigue vigente y, si se puede, preguntarlo al profesor. **Decidido (2026-10-29): sigue vigente, 12 páginas de cuerpo.**
3. **P4:** al aplicar una corrección propuesta, ¿se vuelven a verificar las citas de esa oración? Hoy una edición manual no las verifica, a propósito.
4. **Títulos temáticos:** ¿los propone el sistema y tú los apruebas, o los escribes tú y el sistema solo los revisa? **Decidido (2026-10-29): el sistema propone y el estudiante aprueba.**
5. **¿Pasamos a la guía las 4 fortalezas pendientes** (etapa 7.1) y el «Cierre que vuelve a la tesis»?
6. **Rangos de páginas abreviados («567–68»):** se confirma con la guía antes de cambiarlos.
7. **Orden de las etapas:** el propuesto es 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Si el TI #3 tiene fecha cercana, lo mínimo es 0, 1, 2 y 4.1–4.3. Esas etapas eliminan los defectos medidos del Word y la mayor parte de las correcciones humanas. **Decidido (2026-10-29): el orden completo, 0 → 8.**

## 6. Crítica previa

- **¿La etapa 2 no reemplaza a Word?** No: revisa, no edita. Cada aviso propone el cambio y lo hace el estudiante. La lista de tildes es cerrada y medida: un corrector general daría falsos avisos con el hebreo y con los términos técnicos.
- **¿Los títulos temáticos no escriben por el estudiante?** Se proponen desde sus propias decisiones y él los aprueba. El riesgo es que acepte sin leer; por eso la propuesta muestra de qué decisión sale cada título.
- **¿La tesis propuesta no es eiségesis al revés,** el sistema decidiendo por el estudiante? Las tesis salen de sus análisis aceptados y de «Mi lectura», y la revisión aplica los mismos 6 criterios a la tesis del estudiante. Si los criterios no distinguen la tesis buena de la v4, no se construye (medición previa).
- **¿«Salmo» rompe trabajos viejos?** Solo si la lectura exige la forma nueva. Se aceptan las dos al leer, con una prueba sobre un ensamble viejo.
- **¿El índice en Word para Mac?** Supuesto que el campo se actualiza al abrir. Se mide en la etapa 1.3 antes de darlo por hecho.
- **El costo de API (prepago):** las mediciones de B63, P2 y la revisión de la introducción y la conclusión regeneran contenido. Se estima y se pide antes.
