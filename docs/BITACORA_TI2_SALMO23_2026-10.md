# Bitácora del Trabajo de Investigación #2 (Salmo 23:4–6, OT603)

> Entregado el 2026-10-29. Trabajo `mSLfvg1xkmpTFtBjQN5t`, proyecto
> `OWCzTduIUWphdi0xS8vb`, guía «Guia Test 2026» (`EHAh9XLcCwpExmadhPMX`).
> Sigue a la bitácora del TP #9 (B1–B46) y a
> [FASE_REVISION_AUTONOMA_2026-10.md](FASE_REVISION_AUTONOMA_2026-10.md).
> Rótulos: **medido** (contado en producción o en el Word), **leído** (en una
> fuente o en el código), **supuesto** (sin comprobar).

## 1. Hallazgos

| # | Hallazgo | Estado |
|---|---|---|
| B47 | «Traer los trabajos anteriores» queda escondido mientras el curso no tiene tipos de trabajo. | pendiente |
| B48 | El campo «Curso» no explica para qué sirve. | pendiente |
| B49 | «Estrategia» no tiene una línea que la explique. | pendiente |
| B50 | Dos botones de guardar en el mismo diálogo. | pendiente |
| B51, B52 | Línea «---» como párrafo vacío en el Word; encabezados TMS. | corregido (51f22a6e) |
| B53 | El nombre de un patrón de la devolución es la primera oración del comentario. | pendiente (14 renombrados a mano en prod) |
| B54 | Falta un grupo «del trabajo anterior» con «Aprobar todas» al elegir fuentes. | pendiente |
| B55 | Propone fuentes de griego del NT en un curso de hebreo. | pendiente |
| B56 | No propone Niccacci (la ficha no tiene tipo). | pendiente |
| B57 | El selector de pasajes viejos marca de antemano una mención referida. | pendiente |
| B58 | «Ibid.» en la prosa, que el verificador no resuelve. | corregido (5cd73a2c): la prosa nunca lo lleva; lo pone el exportador |
| B59 | Chequeo morfológico contra OSHB/MorphGNT. **Medido:** OSHB etiqueta יִרְדְּפוּנִי (23:6) como piel, pero la vocalización es de qal; y lematiza וְשַׁבְתִּי en יָשַׁב, cuando la vocalización es de שׁוּב. El chequeo debe mostrar la diferencia y razonarla con la vocalización, nunca sobrescribir. | pendiente |
| B60 | La conclusión se genera antes que la introducción, sin aviso antes de la primera generación. | pendiente |
| B61 | Se pierde el enlace de vuelta al pasar de la configuración al trabajo (no hay `?from=`). | pendiente |
| B62 | Introducción y conclusión no recibían las reglas de la guía del curso. | corregido (5cd73a2c) |
| B63 | Paso «Formular la tesis», **después** de aceptar los análisis y antes de la conclusión (ver §2). | diseño |
| B64 | «Revisión antes de entregar» solo corre en los versículos; extenderla a introducción y conclusión. **Medido:** la v4 de la conclusión refutó «una supuesta intensidad verbal» que el texto nunca presentó, con la regla 11 en el prompt. | pendiente |
| B65 | «Ibid.» al comienzo de página. La guía de TMS (hoja 22): «Evite el uso de "Ibid." si su nota al pie cae en una página nueva». El .docx no tiene páginas. Solución: el Word **guardado por Word** trae `w:lastRenderedPageBreak`; leerlo da la página de cada llamada (**medido** sobre el Word del TI #2: 34 notas, 13 páginas). Subir ese Word y marcar los «Ibid.» que abren página. | diseño |
| B66 | La ficha no distingue léxicos ni gramáticas con abreviatura. La guía (hoja 50) pide *IBHS* para Waltke-O’Connor en las citas posteriores (MDiv/MMB) y la entrada léxica entre comillas; la nota 31 hace de los léxicos una excepción al «Ibid.» (lectura propia de una frase breve). | pendiente |
| B67 | Regla general de vocabulario (ver §3). **Leído en el código:** las reglas de la guía llegan al analizador, la prosa por versículo, la introducción, la conclusión y la revisión de la prosa del versículo, pero **no** a los compositores de sermón, devocional y guía de estudio (`ministryComposers`), ni a la revisión de coherencia. La regla 22 en la guía cubre el trabajo del curso; la regla general va en código para todos, y en el sermón con más razón: ahí no va jerga, ni siquiera glosada. Regla 22 **escrita en producción el 2026-10-29** con OK del fundador (leída de vuelta: 22 reglas, las 21 anteriores intactas). Falta la regla general en código. | regla 22 hecha; código pendiente |

Corregidos en el exportador el mismo día (1d3743e1, 6cde1ecb, 4e6efe20), medidos en el Word:
- la cita combinada «(A; B)» salía como dos llamadas y un «)» suelto; ahora es una nota;
- la cita corta «(Ross, 565)» dejaba un «)» suelto (7 casos);
- había un espacio antes de cada llamada (37 casos);
- la nota abreviada de dos autores llevaba un solo apellido;
- tras una nota de la misma página iba «Ibid., N» en vez de «Ibid.» solo;
- «Ibid.» no iba en cursiva, como muestra el ejemplo de la guía;
- la bibliografía decía «5.ª ed..»;
- los títulos de las notas iban entre asteriscos.

## 2. La tesis: después del análisis, no antes

La primera propuesta de B63 (un campo «Tesis» en el encuadre, antes del análisis) se **retiró**: el método inductivo va de la observación al análisis y de ahí a la síntesis, y una tesis previa invita a la eiségesis. Antes del análisis caben la pregunta de investigación o una hipótesis que el análisis puede tumbar.

El paso propone 2 o 3 tesis con su respaldo versículo por versículo, y revisa cualquier tesis, también la del pastor, con criterios del curso:
1. afirmación interpretativa, no descripción del trabajo (regla 18);
2. cubre todos los versículos;
3. cada parte tiene respaldo en un análisis aceptado;
4. distingue entre lecturas (regla 13);
5. se conecta con la unidad anterior;
6. responde al enunciado.

Se valida antes de construirlo: con el TI #1 (98/100), con el TI #2 (debe aprobar la tesis acordada y marcar la de la v4 por no conectarse con 1–3) y con la devolución del profesor.

**Medido:**
- sin indicación, la conclusión v4 llegó a una tesis correcta pero genérica;
- la introducción tomó la **última** oración de la conclusión como tesis, cuando la tesis estaba en la primera;
- una tesis guardada aparte evita que tengan que adivinarla.

**Error propio:** la tesis larga que propuse decía «imperfectos para lo que el SEÑOR hace». De los cinco imperfectos, solo תַּעֲרֹךְ tiene al SEÑOR como sujeto.

## 3. Tono y vocabulario: lo que el fundador corrigió en el TI #2

Lecciones para los compositores y para la revisión de prosa, en todas las secciones:

1. **Un término técnico que no es de la gramática del curso se explica entre paréntesis la primera vez**, como lo hace el fundador («epexegético (o aclaratorio)»). Casos del TI #2:
   - pregnante, hendíadis, ditografía, gnómico, retroversión, colon y cultual;
   - «tronco», que salió de una corrección mía y aparecía una sola vez.
2. **Una sola nomenclatura.** El trabajo dice perfecto e imperfecto, así que no mezcla qatal, yiqtol ni «forma no perfectiva». Se conserva el término de una fuente cuando se la cita («yiqtol» de Niccacci), glosado.
3. **Palabra llana si dice lo mismo.**
   - «sentido aseverativo» → «como afirmación («ciertamente»)»;
   - «explicitación» → «para dejar claro que…»;
   - «regularización» → «cambiar por el más esperable…»;
   - «comunica idiomáticamente» → «de forma natural»;
   - «distribución sintáctica» → «quién actúa y quién recibe»;
   - «eficacia» → «fuerza».
4. **No se refuta una lectura que el texto no presentó** (regla 11). Casos:
   - «no es intensivo», tres veces;
   - «no hay referencia al castigo»;
   - «una supuesta intensidad verbal».

   Se dice lo positivo.
5. **Muletillas medidas en el cuerpo:**
   - 18 cierres con «sin + infinitivo» (sin exigir, sin añadir…);
   - 13 «Se prefiere» o «Se conserva» en tres versículos;
   - «sin exigir una referencia a la existencia después de la muerte», 3 veces.
6. **La voz del texto es «el salmista»**, que es como la nombra la tesis. «Creyente» no: lleva a la aplicación y afirma algo que el análisis no demostró. El fundador cambió los 13 «hablante» por «salmista».
7. **La lectura más corta compara lecturas transmitidas.** La brevedad de una conjetura sin manuscritos no es un criterio (regla 13).

Lo que el fundador decidió conservar: «Dentro del Salterio…» en la introducción.

Correcciones mías que estaban mal, para no repetirlas:
- quitar la coma Oxford, que la regla 5 de la guía exige;
- **retirar «Salmo»**: dije que el TI #1 usaba «Salmos», pero ese dato venía del borrador del sistema. El Word **entregado** (98/100) dice «Salmo 23» 6 veces y «Salmos» ninguna. La corrección original era correcta: un solo salmo es «Salmo».

**Antes de corregir, leer las reglas de la guía y el trabajo anterior ENTREGADO** (el Word en Google Drive), no el borrador del sistema. El fundador termina el trabajo a mano: el borrador del TI #1 tiene 1.188 palabras y solo títulos por versículo, y el Word entregado tiene 3.384 palabras, «CONTENIDO» y subtítulos temáticos.

## 4. Estructura del TI #1 entregado que el sistema no produce (B68)

Medido en el Word entregado del TI #1, frente al Word que exporta el sistema:

| TI #1 entregado | Exportación del TI #2 |
|---|---|
| «CONTENIDO» automático, con página «i» en números romanos (guía, hojas 8 y 10: opcional, «muy recomendable») | no hay |
| La introducción va bajo el título del trabajo («Análisis sintáctico y léxico de Salmo 23:1–3») | «Introducción» |
| Un título temático por versículo, en nivel 1: «El SEÑOR es mi pastor (v. 1)» | «Salmos 23:4» |
| El texto hebreo del versículo debajo de ese título | no está |
| Subtítulos de nivel 2 por cuestión: «Una identidad sin verbo», «Restaurar: el polel frente al hifil» | no hay |
| «Salmo 23» | «Salmos 23» (`formatPassageReference`) |

El enunciado del TI #2 dice «mismos lineamientos que el primero», y la rúbrica da 25 puntos a la organización. El sistema debe proponer esa estructura: títulos y subtítulos sacados de las preguntas y las decisiones del análisis, el índice como campo de Word con página romana, el hebreo del versículo y «Salmo» para un solo salmo.
