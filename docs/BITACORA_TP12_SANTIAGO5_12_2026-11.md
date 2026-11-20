# Bitácora del TP #12 de NT785 (Santiago 5:12–20)

> Abierta el 2026-11-18. Es la segunda prueba del procedimiento v3, ya con las mejoras
> del TP #11: las reglas de voz del autor van dentro del criterio de cada prueba, la
> regresión se repite cuando el texto cambia, y se aplica la prueba de las pruebas.
> Bitácora anterior: `BITACORA_TP11_SANTIAGO5_7_2026-11.md`.

## 0. Entradas y matriz de requisitos

**Las preguntas:**
1. ¿Cómo deben entenderse las cláusulas en Santiago 5:13–14a?
2. ¿Cómo funciona el participio τὸν κάμνοντα (Stg. 5:15)? ¿Qué es lo que denota σώσει?
3. ¿Cómo funciona el participio ἐνεργουμένη (Stg. 5:16)?
4. ¿Qué significa la frase καλύψει πλῆθος ἁμαρτιῶν (Stg. 5:20)? ¿A quién se refiere?

**Fuentes prohibidas** (los comentarios del TP #11): Allison, Ropes y Varner. **Los
comentarios elegidos:** McKnight (NICNT, 2011), McCartney (BECNT, 2009) y Martin (WBC,
1988). Los tres trabajan sobre el griego y tienen páginas calibradas. Las gramáticas, los
léxicos y NA28 están permitidos.

**Matriz de requisitos:** la misma del TP #11 (R1–R12), más estos requisitos nuevos:

| # | Requisito | Origen |
|---|---|---|
| R13 | Coherencia entre respuestas: σώσει (5:15) frente a σώσει ψυχήν (5:20); la oración y la sanidad en 5:14–16 | capa 2 |
| R14 | **Reglas de voz del autor dentro del criterio de cada prueba:** todo en español (citas inglesas traducidas), términos técnicos explicados entre paréntesis, oraciones sin ambigüedad | lección del TP #11 |
| R15 | La variante de 5:20 (αὐτοῦ), razonada en la pregunta 4 | aparato |

## 1. Decisiones

| # | Decisión |
|---|---|
| N1 | Se hace hoy, en la conversación, con el procedimiento v3 corregido |
| N2 | Solo se prohíben los comentarios del TP #11; el asistente elige McKnight, McCartney y Martin |

## 2. Registro del proceso

| Fecha | Paso | Qué se hizo | Herramienta | Nota para el flujo |
|---|---|---|---|---|
| 18-nov | 1. Entradas | Preguntas, texto SBLGNT, fuentes prohibidas. Riesgos visibles desde el comienzo: σώσει aparece dos veces (5:15 y 5:20), con posibles sentidos distintos; ἐνεργουμένη puede ser medio o pasivo; la variante αὐτοῦ en 5:20 decide «a quién se refiere» | MorphGNT | — |
| 18-nov | 2. Lectura | Dos lectores en paralelo, cada uno con extractos textuales y su página: (a) los tres comentarios; (b) gramáticas, léxicos, NA28 y Metzger. MorphGNT analiza ἐνεργουμένη como presente **medio** | agentes + MorphGNT | — |
| 18-nov | 2b. Verificación de extractos | Antes de redactar, el asistente cotejó con la fuente los extractos que van a sostener las respuestas: Martin, en el PDF (pp. 201, 205, 209, 210, 212, 217 y 220); McKnight, en la imagen de página (pp. 448 y 459); McCartney, en el texto de la biblioteca (6 extractos). **Encontró 1 error:** el extracto «do not suggest a simple conditional sense» de Martin está en la p. 200 (hoja 311), no en la p. 201. Hay además una discrepancia entre las fuentes: Martin (p. 212) pone a Ropes con la pasiva, mientras que McKnight y McCartney lo ponen con la media; como Ropes está prohibido, el TP no lo cita | pdftotext, imágenes | La verificación de los extractos del lector antes del borrador (principio 11) vuelve a encontrar un error de página. Debe seguir siendo un paso fijo |
| 18-nov | 2c. Verificación de gramáticas | Se cotejaron Wallace (pp. 416, 486, 603 y 619), Metzger (pp. 685–686) y NA28 (p. 695) con sus hojas, y BDAG por lema y acepción. NA28 se miró en la imagen de la página: puntúa 5:13–14 con comas, mientras que SBLGNT usa signo de interrogación. Este dato textual se vuelve un argumento de la pregunta 1. La imagen quedó en `05_Respaldo_citas/` | pdftoppm | Mirar la página impresa de la edición crítica, y no solo el texto extraído, dio un argumento que ningún comentario usaba |
| 18-nov | 3. Borrador v1 | `03_Borradores/TP12_v1.md`: 1.710 palabras, 3 páginas de cuerpo (como el TP #11 entregado). Decisiones: (1) preguntas con valor de condición, seguidas de un mandato; (2) participio sustantivado, el enfermo, y σώσει = sanar; (3) media, adverbial de medio, según las definiciones de Wallace (pp. 627–628), y no «de modo» como lo llama McCartney; (4) los pecados son los del pecador que vuelve, y el que hace volver es el instrumento. SHA `99634e2615f5` | armar_trabajo.py TP=1, Word | — |
| 18-nov | 4. Capa 1 | Cuatro pruebas unitarias en paralelo, con un criterio común escrito (`scratchpad/tp12/pruebas/CRITERIO.md`) que incluye las reglas de voz (R14). **Prueba de las pruebas:** dos errores sembrados que el revisor no conoce: en P2, (Martin, 209) cambiado a 208; en P3, una cita inglesa de McCartney sin traducir | 4 agentes | El criterio va escrito en un archivo común, para que las cuatro pruebas usen la misma vara |
| 18-nov | 4a. Resultado de la capa 1 en v1 | **Las 4 NO PASAN**: P1 con 1 alto y 6 medios; P2 con 2 altos y 5 medios; P3 con 4 altos y 6 medios; P4 con 3 altos y 8 medios. **Prueba de las pruebas: PASA.** Los dos errores sembrados se detectaron: Martin 208 en P2 (ALTA) y la cita inglesa en P3 (MEDIA, C1). Patrones: (a) **atribuciones exageradas o desplazadas**: un «consenso» de Martin que no es el de la tesis, un «simple» omitido, lo de McKnight sobre ψαλλέτω, «de modo» atribuido a McCartney cuando es una etiqueta del informe de lectura, y la glosa temporal de McKnight, que es de Ropes; (b) **argumentos que no discriminan**: el contraste con 5:20 en P2 (2:14 y 4:12 tampoco tienen ψυχήν), la redundancia en P3 y las razones sobre el alma que no deciden los pecados en P4; (c) **el argumento PRINCIPAL de la rival sin responder**: la diatriba en P1 y el cambio de sujeto en 5:19b en P4 | 4 agentes | El error más frecuente fue **atribuir lo que dice el informe del lector en vez de lo que dice la fuente**. La verificación previa (paso 2b) comprobó que el extracto existía, pero no que la paráfrasis del redactor fuera fiel. La capa 1 sí lo detecta |
| 18-nov | 5. v2 → v3 | v2 corrige todos los hallazgos ALTOS y MEDIOS, pero sube a 2.355 palabras: 4 páginas de cuerpo, por sobre el límite. v3 se comprime a 1.846 palabras, exactamente en 3 páginas, sin quitar los argumentos que pidieron las pruebas. Se quitaron datos secundarios: Louw y Nida 269, 1 Ts 2:13, el «también en 5:15» de P4 y el contexto de Elías en P1. SHA `7f66e5d12a69` | Word | **Nuevo:** las correcciones de la capa 1 suman texto. En un trabajo con tope de páginas, medir después de corregir y recortar ANTES de volver a probar, para que la segunda ronda pruebe la versión que va a caber |
| 18-nov | 6. Capa 1, segunda ronda, en v3 | Cuatro re-pruebas en paralelo; cada revisor recibe sus hallazgos anteriores para marcarlos como resueltos o no, y revisa desde cero | 4 agentes | — |
| 18-nov | 6a. Resultado de la segunda ronda | **Ningún hallazgo ALTO.** Medios: P1 1 (nomenclatura «miembro»/«cláusula»); P2 1 (Martin cita Sab 4:16 y 15:9 como enfermedad, pero ahí κάμνω es «morir» según BDAG 3 y McKnight 441: **error de la fuente heredado**, se quita); P3 3 (Elías no descartaba la lectura temporal, «su obrar» ambiguo, tautología sin cita); P4 3 (la lectura dividida atribuida a Martin cuando es de McCartney 263 n. 2; «mismo sujeto» no discrimina; términos sin glosar). Se corrigieron todos, y los bajos que no cuestan espacio. Dos bajos que el v2 había resuelto se habían perdido al recortar en el v3 | 4 agentes | **Nuevo:** recortar para caber reintroduce hallazgos ya resueltos. La segunda ronda tiene que mirar también lo que se perdió, y así se le pidió |
| 18-nov | 7. v4 | Correcciones de la segunda ronda + recorte para caber: 1.849 palabras, 3 páginas exactas. SHA `38c908e86db0` | Word | — |
| 18-nov | 8. Capa 2 en v4 | Integración del cuerpo entero: coherencia entre respuestas (R13), nomenclatura, matriz R1–R15, ortografía y acentos, y además la verificación en la fuente de las correcciones posteriores a la segunda ronda, que ninguna prueba había visto | 1 agente | La capa 2 también hace de control de los cambios que ninguna prueba vio (principio 9) |
| 18-nov | 8a. Resultado de la capa 2 | **NO PASA**, sin hallazgos ALTOS y con 4 MEDIOS: (1) el remate nuevo de la P1, «un acto puntual», cae en la falacia del aoristo puntual que Wallace rechaza (p. 11) y contradice el «acto completo» de McKnight; **lo introdujo una corrección de la segunda ronda**; (2) SBLGNT se cita pero no está en la bibliografía; (3) «afligido» rompe la nomenclatura «el enfermo»; (4) la rival escatológica no tiene una voz que la sostenga (se agrega Vouga, Martin 201, verificado). Coherencia entre respuestas (R13): **cumple**. Las 50 formas griegas coinciden con MorphGNT. R1: cumple. Se aplicaron además 8 bajos sin costo de espacio | 1 agente | **Nuevo:** una corrección pedida por un hallazgo BAJO introdujo un error MEDIO de gramática. Las correcciones de una ronda necesitan control, igual que el texto original |
| 18-nov | 9. v5 y Word para el autor | 1.832 palabras, 3 páginas exactas; SBLGNT (Holmes 2010) en la bibliografía. `03_Borradores/TP12_v5_para_comentarios.docx` y `TP12_v5_vista.pdf`. SHA `f91fc30f0176` | armar_trabajo.py, Word | La regresión (capa 5) se corre sobre el texto que salga de los comentarios del autor, no antes |
| 19-nov | 10. Respaldo de citas | **El autor detectó que faltaba**: `05_Respaldo_citas/` tenía solo la imagen de NA28. Se generaron 31 respaldos: imágenes de página de Martin (8), McKnight (8), BDAG (5), Louw y Nida y NA28, y extractos de texto de McCartney (7), Wallace (6), Metzger y Kittel. `00_INDICE.md` une cada una de las 40 citas del v5 con su respaldo y falla si falta alguno. La imagen de BDAG s.v. «κάμνω» confirma que Sabiduría 4:16 y 15:9 están en la acepción 3 («morir»), y respalda haberlos quitado en la P2 | pdftoppm, script de índice | **Omisión del asistente: el autor fue otra vez la última barrera (principio 14).** El respaldo se hizo en el TP #11, pero en este TP no estaba en la lista de pasos que seguí. Corrección: el respaldo se genera junto con la verificación de extractos (paso 2b), y el índice que falla si falta un respaldo pasa a ser condición de la puerta final, igual que la regresión |

| 19-nov | 11. Auditoría de omisiones | El autor preguntó «¿hay algún otro paso que te hayas saltado?». La auditoría contra el procedimiento (etapas, §4c y la lista final de §5) encontró 6 omisiones más, además del respaldo: (1) la coherencia no se repitió sobre el v5 antes de dárselo al autor, después de unas 12 correcciones; (2) no se corrió el script de citas bíblicas; (3) no hubo punto de aprobación ✋ para las decisiones discutibles (P3 y P4); (4) no se leyó el TP #11 ENTREGADO, solo su borrador; (5) no se registraron las entradas de la etapa 0, incluido el plazo; (6) el criterio de las pruebas no tenía todas las reglas de voz | lectura del procedimiento | **Causa: seguir el procedimiento de memoria.** Corrección: lista de control al inicio (byblos `01M7SPFDSQ…`) |
| 19-nov | 11a. (4) TP #11 entregado | Comparación palabra por palabra entre la vista generada y el Word entregado: el único cambio del autor es la portada, «SANTIAGO 5:7–11» en lugar de «JACOBO». `portada.json` del TP #12 corregido a «SANTIAGO 5:12–20», para el v6 (no se toca el Word que el autor comenta) | python difflib | — |
| 19-nov | 11b. (5) Entradas | **Plazo:** el calendario del plan pone el TP de 5:7–11 y el de 5:12–20 el 11-nov, ya vencido según el plan; el autor sabrá si Canvas da otro. **Devolución nueva:** ninguna; la última es la del TP #10 (5-nov), ya incorporada. **Hallazgo:** el resumen en español de Wallace del curso (`~/Downloads/Wallace-Resúmenes de sintaxis…pdf`) marca con «IGNORA» los genitivos de producción, de producto, atribuido y plenario. Las categorías del TP #12 coinciden con sus nombres (imperativo de mandato, participio sustantivado, participio de medio). **Riesgo para el TP #11 entregado:** su P4 defendió «genitivo subjetivo, o de producción» | pdftotext | La gramática del curso tiene categorías vetadas: entra al criterio de las pruebas (C12) |
| 19-nov | 11c. (2) Citas bíblicas | Herramienta nueva, `verificar_citas_tp.py`, para TP: las cadenas griegas contra MorphGNT (forma o lema) y las referencias a otros libros contra la RV1960. Resultado en v5: 73 cadenas coinciden; 3 se revisaron a mano y están bien (ὁ κάμνων en nominativo de cita, ἐνεργέομαι como forma media del lema). Las 5 referencias de otros libros y las 7 de la carta dicen lo que el texto les atribuye (1:15, 1:21, 2:14, 4:12, 5:17, Pr 10:12, Sal 32:1, Ro 14:2, Heb 12:3, Ez 3:18–21). **Mutación detectada** (código de salida 1). La primera versión del script tenía 3 errores (lemas, id de Proverbios y un `| head` que tapaba el código de salida), y la mutación ayudó a verlos | script | — |
| 19-nov | 11d. (6) Criterio | `CRITERIO.md` + C7–C12: palabra llana; no refutar lecturas que el texto no presentó; muletillas conocidas; la cita en la misma oración; el valor exacto de la forma; los nombres de la gramática del curso, sin categorías «IGNORA» | — | — |
| 19-nov | 11e. (1) Coherencia sobre v5 | Capa 2 repetida sobre v5 `f91fc30f0176`, con el criterio completo | 1 agente | — |
| 19-nov | 11f. byblos | 3 lecciones globales (procedimiento como lista de control; las correcciones también se controlan; verificar la paráfrasis, no solo el extracto), 2 hechos del curso (resumen de Wallace con «IGNORA»; portada «SANTIAGO» y plazos) y el estado del TP #12 | byblos | — |

| 19-nov | 12. Comentarios del autor (v5) | Un comentario sobre «tautológica»: «en palabras técnicas estamos agregando lo que significa para un lector que no maneje el concepto». Una edición sin control de cambios: la portada, «SANTIAGO 5:12–20». **El v2 tenía la glosa** («es decir, que repetiría lo mismo con otras palabras») y **se perdió al recortar en el v3**, de nuevo el patrón de byblos `01M7SPFDV6…`. Ninguna capa lo vio: las pruebas posteriores al v3 revisaron el v3, pero no buscaron lo que el recorte quitó de una glosa. Se aplicó el comentario a todo el texto: también se explican «la glosa de BDAG» → «la traducción que da BDAG», «SBLGNT/NA28» → «las dos ediciones críticas del texto griego» y «𝔓⁷⁴ y el Vaticano» → «el papiro 𝔓⁷⁴ y el códice Vaticano» | lectura de comments.xml + diff completo | El comentario del autor se aplica como regla a todo el texto, no solo a la palabra marcada |
| 19-nov | 13. v6 | Comentarios del autor + `cambios_pendientes_v6.md` (los 3 medios de la capa 2 sobre el v5) + portada. Recortes para caber, **leídos uno por uno**: uno rompió una oración de la P3 («va después explica»), que se corrigió; además «El contexto responde» → «El texto responde», porque el primer argumento es gramatical. Se quitó Martin 205 («la mayoría lee…»), que era apoyo y no argumento. 1.822 palabras, 3 páginas exactas. SHA `33e4c479db27` | Word | Leer el resultado de cada recorte (principio 12) encontró un error antes que la prueba |
| 19-nov | 13a. Herramientas para TP | `indice_respaldo_tp.py`: índice de respaldo para citas entre paréntesis; con el v6 da 41/41 citas con respaldo y ningún archivo sobrante, y la mutación (borrar un respaldo) da código de salida 1. `verificar_citas_tp.py` con el v6: 75 cadenas bien, y la mutación también da código 1. **Trampa repetida:** `… \| tail -1; echo $?` muestra el código de salida de `tail`, no el del script; pasó dos veces en este trabajo | scripts | Las pruebas de las herramientas se corren sin tubería |
| 19-nov | 14. Capa 5 (regresión) | Sobre el texto exacto del v6 y su PDF: los cambios v5→v6 en la fuente, los términos técnicos explicados (comentario del autor), coherencia en 3 niveles y forma | 1 agente | — |
| 19-nov | 14a. Resultado de la capa 5 en v6 | **NO PASA**, sin hallazgos ALTOS y con 3 MEDIOS: (1) el futuro gnómico como «no un hecho del último día» **exagera la fuente**: McCartney dice «probably» y deja abierta la referencia final; (2) ese argumento **no discrimina y choca con la P4**, porque en 5:20 un futuro gnómico expresa la salvación eterna; (3) términos sin explicar o falsos: «las dos ediciones críticas» (hay más), «verbo general» y «referente». **Los tres nacieron de correcciones**: (1) y (2), de aplicar al pie de la letra la propuesta M2 de la capa 2 sobre el v5; (3), de aplicar el comentario del autor. Forma, portada y bibliografía: bien | 1 agente | **Una corrección propuesta por un revisor también es una afirmación que se verifica**, no solo se aplica. La propuesta M2 venía con su fuente, y la fuente decía «probably» |
| 19-nov | 15. v7 | El futuro deja de usarse como argumento: «El futuro no decide: σώσει es probablemente un futuro gnómico… también en 5:20…; decide el contexto». Se quitó Wallace 571. Glosas: «dos ediciones del texto griego reconstruido a partir de los manuscritos», «verbo general, de sentido amplio», «la persona de la que se habla». Bajos: el agente de Mayor, «de ustedes» en 1:5, «de los dos verbos». Para caber se acortó Proverbios 10:12: la nota «hebreo, no Septuaginta» ya no decidía nada. 1.817 palabras, 3 páginas exactas. SHA `a7bcd49ac7b6`. Respaldo 40/40. El número de página de la bibliografía va en el mismo lugar que en el TP #11 entregado (bajo B7: no se cambia) | Word, scripts | — |
| 19-nov | 16. Capa 5 repetida en v7 | El texto cambió, así que la regresión se repite | 1 agente | — |

## 3. Registro de controles por versión

| Control | Versión | Resultado |
|---|---|---|
| Verificación de extractos (2b–2c) | informes de lectura | 1 error de página (Martin 200, no 201) |
| Capa 1 (4 pruebas) + prueba de las pruebas | v1 `99634e2615f5` | NO PASA las 4; los 2 errores sembrados, detectados |
| Capa 1, segunda ronda | v3 `7f66e5d12a69` | NO PASA las 4, sin ALTOS (8 medios) |
| Capa 2 (integración) | v4 `38c908e86db0` | NO PASA, sin ALTOS (4 medios); R13 cumple |
| Respaldo de citas (índice que falla si una cita no tiene respaldo) | v5 `f91fc30f0176` | 40 citas, todas con respaldo; ningún archivo sobra |
| Citas bíblicas (`verificar_citas_tp.py` + mutación) | v5 `f91fc30f0176` | 73 cadenas griegas bien, 3 revisadas a mano; 12 referencias verificadas; mutación detectada |
| Capa 2 repetida, criterio C1–C12 | v5 `f91fc30f0176` | NO PASA: 0 altos, 3 medios (la cita fuera de su oración; el futuro sin valor ni respuesta a Vouga; la refutación de «los dos» no discrimina). Las correcciones están en `03_Borradores/cambios_pendientes_v6.md`, para el v6. Se rechaza el recorte B2, porque reabre un hallazgo ya resuelto de la capa 1 |
| Decisiones discutibles ✋ (P3, P4) | v5 | **El autor confirmó**: P3 adverbial de medio; P4 los pecados del pecador (19-nov) |
| Comentarios del autor | v5 `f91fc30f0176` | 1 comentario (glosar términos técnicos) + portada; aplicados en el v6 |
| Respaldo (`indice_respaldo_tp.py`) + citas bíblicas (`verificar_citas_tp.py`) | v6 `33e4c479db27` | 41/41 citas con respaldo; 75 cadenas griegas bien; las dos mutaciones, detectadas |
| Capa 5 (regresión) | v6 `33e4c479db27` | NO PASA: 0 altos, 3 medios (todos nacidos de correcciones) |
| Respaldo + citas bíblicas | v7 `a7bcd49ac7b6` | 40/40; 75 cadenas griegas bien |
| Capa 5 (regresión), repetida | v7 `a7bcd49ac7b6` | **PASA** (0 altos, 0 medios, 6 bajos) |
| Decisión del autor ✋ sobre los bajos | v7 | «Corregir y repetir»: B1 (frase de 5:20) y B2 («futuro gnómico» sin su gramática, criterio 21) |
| Respaldo | v8 `2ea34abfbcd6` | 41/41 (vuelve Wallace 571) |
| Capa 5 (regresión), sobre el texto de entrega | v8 `2ea34abfbcd6` | **PASA** (0 altos, 0 medios). Un bajo opcional no se aplica: cambiar el orden de las citas en la frase del futuro gnómico; aplicarlo reabriría la puerta. Los bajos B3–B6 del v7 quedan anotados |
| Documento de entrega | v8 → `04_Entrega/Trabajo Practico 12 - Santiago 5_12-20.docx` (+ vista PDF) | Word idéntico al medido (SHA del .docx `3c92af9fa7c3`); 5 hojas, portada «SANTIAGO 5:12–20» |
| Lectura en voz alta y entrega en Canvas | — | pendiente: autor |

## 4. Qué cambia respecto del TP #11

**Cifras del TP #12:**
- **Versiones:** 8.
- **Rondas de prueba:**
  - capa 1, dos rondas de 4 pruebas;
  - capa 2, dos veces;
  - capa 5, tres veces.
- **Hallazgos ALTOS:** 10 en la primera ronda de la capa 1; ninguno desde la segunda ronda.
- **Origen de los hallazgos MEDIOS después de la capa 1** (12 en total): la mayoría nació de correcciones o de recortes, no del texto original. Por ejemplo:
  - el aoristo «puntual»;
  - la glosa de «tautológica», perdida al recortar;
  - el futuro gnómico exagerado, por aplicar una propuesta sin verificarla;
  - «las dos ediciones críticas», al aplicar un comentario.
- **Omisiones del asistente:** 7 pasos del procedimiento. El autor encontró 1, la auditoría encontró las otras 6, y todas se corrigieron.

**Lo que este TP agrega al procedimiento**, pendiente de llevarlo al documento como v4:
1. Al empezar, las etapas y la lista final se copian a la bitácora como casillas (byblos `01M7SPFDSQ…`).
2. Las correcciones y los recortes tienen su propio control; en un trabajo con tope de páginas, se mide y se recorta ANTES de la siguiente ronda (byblos `01M7SPFDV6…`).
3. Lo que propone un revisor se verifica en la fuente antes de aplicarlo, como cualquier otra afirmación.
4. La verificación de citas tiene dos pasos: que el extracto exista y que la paráfrasis sea fiel (byblos `01M7SPFDWK…`).
5. Un comentario del autor se aplica como regla a todo el texto, no solo a la palabra marcada, y lo que se agrega al aplicarlo también se verifica.
6. Herramientas para TP: `indice_respaldo_tp.py` y `verificar_citas_tp.py`, cada una con su mutación. Las pruebas de las herramientas se corren sin tubería, porque `| tail` oculta el código de salida.
7. La gramática del curso, que es el resumen de Wallace con sus categorías «IGNORA», entra al criterio de las pruebas.

- **Respaldo de citas en un TP:** el procedimiento ya lo exige (§ respaldo y la lista final: «Todas las notas que citan página tienen su imagen»), pero `indice_respaldo.py` lee notas al pie, y el TP cita entre paréntesis. El índice del TP #12 se hizo con un script de una sola vez, que lee «(Autor, N)» y «(BDAG, s.v. …)». Pendiente: incorporar ese modo a `indice_respaldo.py`, para que la herramienta sirva para los dos formatos y el paso no dependa de la memoria.
- **Fuentes de la biblioteca sin imagen de página** (McCartney, Wallace, Metzger, Kittel): el respaldo es el extracto de texto de la hoja, con su desfase escrito en el encabezado.
