# Familia A: hallar y fijar hojas. Investigación

> 2026-11-05. Solo lectura de código y de producción; no se escribió nada en producción.
> Rótulos: **medido**, **leído**, **supuesto**. Sigue a
> [BITACORA_TP10_SANTIAGO5_2026-11.md](BITACORA_TP10_SANTIAGO5_2026-11.md).
> Mediciones: `scripts/rag-eval/.medir-familia-a.ts` y `a2` a `a5`.

Hallazgos que cubre: B82, B84, B85, B87, B89 y B92.

## 1. Conclusión

El problema no es que al sistema le falte una búsqueda. Tiene varias, separadas, y solo
una llena el carrito. El único hueco grande de búsqueda es llegar a la hoja gramatical
por categoría, y el dato para hacerlo ya está indexado.

Esto corrige mi diagnóstico de B89, que medía solo la propuesta automática.

## 2. Qué existe hoy (leído)

| Camino | Dónde vive | ¿Llena el carrito solo? | ¿Fija? |
|---|---|---|---|
| Versículo o sección del comentario | `proposeSheetRanges` | Sí | No |
| Entrada del lema de la consigna | Panel y «Selección sugerida» | No: botón, libro por libro | No |
| Sección por categoría gramatical | Panel y «Selección sugerida» | No: botón, libro por libro | No |
| Revisión por pregunta | Tarjeta del corpus | No: avisa y ofrece un clic | Solo con el clic |

El plan del TP #8 (A2.3) pedía proponer la entrada de cada lema «ya fijada». Eso no quedó
hecho: `proposeSheetRanges` no recibe lemas y solo `useAddAndPinSheets` fija.

## 3. Cuántas hojas citadas halla cada camino (medido)

Hojas citadas en el trabajo final, contra lo que cada camino halla hoy.

| Trabajo | Citadas | Propuesta guardada | Por versículo | Por lema | Algún camino |
|---|---|---|---|---|---|
| TP #8 | 22 | 11 | 17 | 3 | 21 |
| TP #9 | 30 | 28 | 19 | 5 | 30 |
| TP #10 | 21 | 7 | 13 | 3 | 15 |
| **Total** | **73** | **46** | **49** | **11** | **66** |

De las 7 sin camino:

- **4 son huecos reales:** Wallace h. 617, 663 y 678, y Kittel h. 139.
- **1 es falsa:** Mayor h. 426 la trae la selección estructural (426–434, medido), que este
  conteo no simulaba.
- **2 no se simularon:** NA28 h. 803 y 805 tienen su propio camino.

**Este cuadro favorece al sistema.** Solo se cita lo que entró al corpus, así que no ve lo
que nunca entró.

> **Corregido por la devolución (§8).** Aquí puse como ejemplo de hueco que el TP #9, P1 no
> citara una hoja de Wallace sobre participios. El profesor calificó esa clasificación de
> «excelente» y no pidió esa hoja: pidió el valor del presente y la alusión a la unicidad de
> Dios.

## 4. Causas

### 4.1 La hoja gramatical (B85, B92), el hueco mayor

El camino por categoría sugirió 26 secciones de Wallace en el TP #10, y ninguna hoja citada
cae en ellas (medido). Tres causas:

1. **Compara solo el último título, que suele ser genérico** (leído en `sectionsForKeys`).
   La h. 663 aparece como «d) Illustrations»; su ruta nombra el participio adverbial.
2. **Las claves no salen de la palabra preguntada.** Salen de los términos que escribe el
   encuadre y del modo verbal del pasaje entero, nunca del tiempo (leído). σέσηπεν es
   perfecto y no genera esa clave (medido).
3. **Hay una clave falsa.** «consecutiv» aparece en los tres TP (medido); supuesto: viene de
   «semanas consecutivas» en el encuadre, que no leí para esta medición.

El dato ya está en el árbol de encabezados de Wallace (medido):

| Hoja | Encabezado | Sirve para |
|---|---|---|
| 617 | «F. Proleptic (Futuristic) Perfect» | P2 |
| 663–664 | «2) Manner» | P1 |
| 664–665 | «3) Means» | P1 |
| 676–680 | «2. Attendant Circumstance» | P1, la lectura rival que faltó (B92) |

Esa lista son las lecturas rivales de la pregunta, escritas por el propio libro.

El tamaño es manejable: bajo «participle» hay 57 hojas y 94 rutas; bajo «perfect», 34 hojas
y 75 rutas (medido). Elegir sobre esa lista no permite inventar una página. Que un modelo
elija bien sobre ella es **supuesto**: no lo probé.

El árbol existe en los libros consultados: en las 12 gramáticas medidas, griegas y hebreas,
entre el 81 % y el 100 % de los fragmentos tiene ruta de dos niveles o más (medido). El
tipo de la ficha está vacío en esas gramáticas (se relaciona con la familia C y B56).

### 4.2 Las entradas de léxico (B85, parte de lema)

- **Tuggy funciona:** el camino por lema trae las hojas citadas 243 y 244 (medido). El «0 de
  4» de B89 medía la propuesta automática, que no usa ese camino.
- **Kittel casi no se reconoce:** la detección exige negrita o título, y Kittel suele abrir
  con «σήπω [pudrir]…» en texto plano. Con los 12 lemas de los tres TP, hoy halla 2. Sumando
  esa forma de línea llega a 7, entre ellos δίκαιος h. 137, que cubre el hueco de la h. 139
  (medido). Los otros 5 pueden no tener artículo propio: sin comprobar.
- **Ortiz, en hebreo, falla del todo:** 0 de 6 entradas buscadas a mano en el TI #2 (medido).
  Causa sin leer. Cualquier diseño debe resolver esto, o hebreo queda fuera.

### 4.3 Los avisos falsos (B82), tres causas distintas

| Aviso | Causa | Rótulo |
|---|---|---|
| Mayor h. 441 | «1 Pet. v. 1»: la cita con capítulo romano no se tapa y «v. 1» se lee como Stg 5:1 | medido |
| Adamson h. 199 | El encabezado «5:1–18 CONCLUSION» da 5:1–6 a todos sus fragmentos | medido |
| Adamson h. 200 | Sus `refs` traen 5:6; no alcancé a ver de qué renglón sale | causa sin cerrar |

Además, la regla del hueco se activó porque Adamson traía una hoja suelta, la 203: 197–202
quedó «entre» hojas elegidas (hoja suelta medida; encadenamiento leído). Se conecta con 4.4.

### 4.4 Adamson entra por parecido, con ruido

Adamson escribe «(5:1–6)» sin nombre de libro; el analizador reconoce 0 encabezados y cae a
la búsqueda semántica (simulado con el código actual, y el modo guardado es `semantic`).
Resultado en el TP #10: 22 hojas, 11 de ellas ajenas al pasaje (20, 49, 65–68, 83, 108, 112,
163, 203) (medido). Mayor, Motyer, McCartney, Ropes y Varner sí dan selección estructural
(medido).

Una fuente extraída así queda sin receta: 3 de las 7 del TP #10. Sin receta,
`editable` es falso y «Agregar y fijar» no se puede usar (leído).

### 4.5 Fijar pesa en todos los pasos (B87)

`pinnedRanges` es por fuente, no por pregunta: la hoja de σήπω también viaja a la pregunta
sobre δίκαιος (leído).

| Trabajo | Fijado | Frente a 100.000 por versículo |
|---|---|---|
| TP #8 | 79.357 | 79 % |
| TP #9 | 44.784 | 45 % |
| TP #10 | 54.308 | 54 % |

Ese peso se paga entero en cada paso: el análisis y la generación consultan todas las
fuentes del trabajo con todo lo fijado, y el plan de uso solo marca prioridad (leído en
`AnalyzeVerseCanonicallyUseCase` y `GenerateStepUseCase`). En el TP #10 quedan unos 46.000
caracteres para competir por paso. Fijar más sin cambiar esto reduciría esa parte (cálculo
directo); cuánto daña al análisis es supuesto. **Fijar solo requiere primero fijar por
pregunta.**

### 4.6 Metzger (B84)

Sin problema de búsqueda en este pasaje: solo trata la variante de 5:4, y nadie la
preguntó. Sí sigue pendiente que su índice de pasajes dé 0 hojas por escribir «4.5», como
en el TP #8 (medido).

## 5. Límites de esta investigación

- **Hebreo no está medido en serio.** El TI #2 no tiene preguntas por versículo y el formato
  de sus citas no se leyó bien: 6 citas parseadas. Solo vale el dato de Ortiz.
- **La lista de hojas de Claude no es respuesta correcta.** Omitió Tuggy 244 y Wallace 678.
- **Aún no sé si las hojas nuevas mejoran el análisis.** Hay indicios en 5:1 (B89), un solo
  caso.

## 6. Banco de prueba propuesto

| Nivel | Qué mide | Contra qué |
|---|---|---|
| 1. Hojas | Por pregunta: ¿llegan la definición, las rivales y la entrada? | Citadas en los TP #8, #9 y #10, más las halladas aquí: Wallace 664–665 y 676–680 |
| 2. Ruido | Hojas propuestas por pregunta y por fuente, y peso fijado por paso | Tope a fijar en el diseño |
| 3. Avisos | Falsos y verdaderos | Mayor 441, Adamson 199–200 (falsos); Tuggy δίκαιος sin 244 (verdadero) |
| 4. Análisis | ¿Mejora la respuesta con las hojas del sistema, sin Claude? | Patrones 3, 5, 7 y 8 del profesor, y su devolución |

- **Ajuste:** TP #8, #9 y #10.
- **Prueba sin ver:** TP #7 (`qTwuqEMK4qm9vLh0reuk`) y el próximo TP real.
- **Hebreo:** falta armar a mano una lista por pregunta del TI #2, Salmo 23:4–6.

## 7. Requisitos que salen de esto para el diseño

Son requisitos, no el diseño.

1. Un solo cálculo por pregunta que reúna los caminos, en vez de cuatro superficies.
2. Cada hoja dice por qué entra, y el sistema dice qué no pudo hallar.
3. Lo fijado se asigna por pregunta.
4. Sirve para griego y hebreo, TP y TI.
5. El modelo elige entre encabezados reales: nunca propone una página.
6. Una regla por causa de aviso falso, sin bajar el aviso verdadero de δίκαιος.

**Estos requisitos quedan en revisión:** la sección 8 muestra que hallar hojas explica solo
una parte de lo que corrigió el profesor.

## 8. Lo que corrigió el profesor en los TP #8 y #9

Fuente: capturas de sus comentarios (J. L. A. García Villanueva), entregadas por el fundador
el 2026-11-05. Mediciones: `scripts/rag-eval/.medir-devolucion.ts` y `2` a `5`.

### 8.1 Resultado

Las 21 observaciones de falta o corrección, por causa. La clasificación es lectura mía: un
solo lector, sin pesar puntos.

| Causa | Cuántas | Parte |
|---|---|---|
| Forma y precisión del razonamiento: no falta material | 9 | 43 % |
| La fuente estaba en una hoja elegida y no llegó al texto | 5 | 24 % |
| Observación del griego que ninguna hoja nombra | 3 | 14 % |
| Hoja gramatical sin elegir, en un libro permitido | 3 | 14 % |
| Otras voces que esa semana no se podían citar | 1 | 5 % |

**Mejores hojas resuelven de forma directa 3 de 21.** Es menos de lo que suponía la
investigación de las secciones 1 a 7.

Lo que esto **no** dice:

- **No dice que la selección esté bien.** Estos corpus pasaron por revisión de Claude y del
  fundador; muchas hojas se agregaron y se fijaron a mano. No mide qué pasaría con el sistema
  solo.
- **No mide TP #10.** Su devolución está pendiente, y ahí se hallaron los mayores huecos.

**Total confirmado con los PDF anotados:** 21 observaciones. Las 5 marcas sin texto tienen
opacidad cero: no se ven y no son comentarios. Fechas: TP #8, 2026-10-23; TP #9, 2026-10-29.

### 8.2 Las 21, una por una

**Forma y precisión (9).** TP #8: [E/T] explicar «predicado»; [B] edición de las obras; [SPC]
cómo conviven el enfrentamiento y el origen corporal; [FDA] si «literal» significa que
mataban; [FDA] la forma media de la cláusula final; [FDA] por qué el causativo favorece a
Dios. TP #9: [FDA] la atributiva no es menos probable solo por eso; [SPC] concretar el valor
del presente que se defiende; [FDA] unificar la terminología de los participios.

**Estaba en una hoja elegida (5).**

| Falta | Dónde estaba | ¿Lo propuso el sistema? | Hasta dónde llegó |
|---|---|---|---|
| Más rango léxico (μέλος, 4:1) | Kittel h. 447–449 | Sí | Nunca al análisis, que usa Tuggy para el rango |
| Lectura figurada (φονεύετε, 4:2) | Adamson h. 171–172: odio, 1 Jn 3:15, Mitton | Sí, por parecido | Una salvedad en la prosa generada, quitada al editar; no se evaluó |
| Unicidad de Dios (4:12) | Varner h. 164 (Dt 6:4), Ropes h. 291 | Sí | En el análisis; nunca en la prosa |
| Nombrar paréntesis o anacoluto (4:14) | Varner h. 167: «the anacoluthon» | Sí | «Paréntesis» en el análisis; nunca en la prosa |
| Vínculo con la jactancia (4:17) | Motyer h. 163, Varner h. 170, McCartney h. 250 | Varner y McCartney sí; Motyer h. 163 no | En una opción del análisis; nunca en la prosa |

**Observación del griego (3).** Ninguna hoja elegida la nombra así:

- **Estructura cruzada de 4:2–3:** Adamson h. 171–172 da solo un apoyo parcial.
- **Posición del interrogativo en 4:14:** Ropes h. 294 y Varner h. 168 descartan la pregunta
  indirecta por otro argumento, no por el orden.
- **Cambio de 2.ª a 3.ª persona en 4:17:** no lo hallé en los comentarios permitidos.

**Hoja gramatical sin elegir (3).** Las tres en Wallace, permitido esa semana:

- **Perfecto con valor de presente:** h. 615–616, «D. Perfect with a Present Force», que
  menciona οἶδα. Varner h. 170 solo lo roza.
- **Dativo de desventaja:** h. 178–180, «Dative of Interest». McCartney h. 250 trata otros
  valores de ese dativo.
- **Valor del presente en δυνάμενος:** h. 557–561, «Customary Present». Que esa sea la
  categoría que el profesor tenía en mente es **supuesto**.

**Otras voces (1).** Anticipación del v. 6 «con voces más recientes». Esa semana estaban
prohibidos McCartney, Motyer, Robertson, Ropes y Varner; de los comentarios solo quedaban
Mayor y Adamson. La biblioteca solo tiene esos seis comentarios de Santiago. Corresponde a la familia C.

### 8.3 Dónde se pierde

Por versión guardada (medido, con búsqueda por palabras; lo dudoso se leyó):

- **Unicidad, paréntesis y jactancia** están en el análisis desde la primera versión, y en
  ninguna prosa, ni generada ni editada.
- **Perfecto, dativo, cambio de persona, estructura cruzada y Kittel para μέλος** no están en
  ninguna versión del análisis.
- **El espacio es real:** el análisis pesa 56.000–72.000 caracteres en JSON; la prosa,
  8.400–10.200. Son 1.250–1.600 palabras para un límite de 2 a 3 páginas (medido). Incluir una
  cosa obliga a quitar otra. Falta un criterio de qué entra.

### 8.4 Dos patrones nuevos del profesor

1. **Nombrar el valor exacto de la forma, no solo describirla morfológicamente:** valor del
   presente, perfecto como presente, dativo de desventaja, paréntesis o anacoluto. La
   consigna pide «análisis morfológico»; él premia y pide el paso siguiente.
2. **Atar la respuesta al versículo vecino:** v. 16, Dt 6:4 al abrir 4:12, estructura de
   4:2–3, cambio de persona.

Y una señal de nivel: ocho juicios generales, de «muy buen» a «excelente». Lo que pide es
completar, no rehacer.

### 8.5 Auditoría de mis citas

| Trabajo | Citas en el ensamble | Pares fuente-página | Sin convertir | Comentaristas del análisis ausentes del ensamble |
|---|---|---|---|---|
| TP #8 | 28 | 24 | 0 | 0 de 17 |
| TP #9 | 36 | 30 | 0 | 4 de 18 |
| TP #10 | 24 | 19 | 1 («pp. 188–189») | 0 de 10 |

Mido el ensamble guardado, no el Word final, que el fundador editó a mano. La cifra de 73
hojas no cambia de orden, pero queda por revisar esa cita del TP #10.

### 8.6 Banco independiente

Estas observaciones son el primer dato de respuesta esperada que no sale de lo citado. Se
agregan al nivel 4 del banco: no prueban hojas, prueban la **respuesta final**. Cuentan como
ajuste y no como prueba sin ver, porque ya las leí.

## 9. De la hoja elegida al texto, y el resto de la biblioteca

Mediciones: `scripts/rag-eval/.medir-llegada.ts`, `2`, `3` y `.medir-biblioteca.ts`.

### 9.1 «Elegida» no significa «llegó»

Simulé `selectForPrompt` con la receta final de cada trabajo, sin calcular el coseno. Da lo
seguro, no el reparto exacto.

| Trabajo | Elegido (caracteres) | Cabe como máximo | Fijado | Queda por paso | Lo que nombra el versículo | Espacio para todo lo demás |
|---|---|---|---|---|---|---|
| TP #8 | 415.957 | 24 % | 79.357 | 20.643 | 36.402–41.424 | **0** |
| TP #9 | 308.152 | 32 % | 44.784 | 55.216 | 22.184–43.315 | 11.901–33.032 |
| TP #10 | 326.035 | 31 % | 54.308 | 45.692 | 25.157–42.165 | 3.527–20.535 |

Lo que se sigue de esto:

- **Lo fijado domina:** en el TP #8 ocupa 79 % de cada paso, aunque la hoja sea de otra pregunta.
- **Un léxico grande casi no entra:** Kittel fue 68 % de lo elegido en el TP #8 (282.476
  caracteres, 57 hojas). Sus entradas no nombran el versículo, así que dependen del piso por
  fuente: 3.440 caracteres, uno o dos fragmentos. Por eso sus hojas casi no se citan.
- **Corrige §8.2:** Kittel h. 447 sobre μέλος probablemente nunca llegó al análisis
  (**supuesto** fuerte; falta el coseno para afirmarlo). Las otras cuatro sí llegaron, porque
  están en el análisis.
- **La búsqueda usa una consulta general:** versículo, griego y encuadre entero, con todas las
  preguntas del trabajo (leído). No busca por la pregunta del paso.
- **Sin registro:** el reparto real se escribe en la consola del navegador
  (`CallableCuratedCorpusRetriever`), no en el servidor (leído). No se puede reconstruir lo que
  recibió un análisis pasado, ni el usuario lo ve.

### 9.2 Los `refs` reparten mal la prioridad

Un fragmento que «nombra el versículo» gana siempre al coseno. Fragmentos con ref exacta:

| Versículo | Mayor | Adamson | McCartney | Motyer | Ropes | Varner |
|---|---|---|---|---|---|---|
| 4:12 | 4 | 13 | 56 | 1 | **0** | 6 |
| 4:14 | 7 | 15 | 20 | 2 | **0** | 5 |
| 4:17 | 5 | 15 | 19 | 3 | **0** | 6 |
| 5:1 | 1 | 29 | 34 | 5 | **0** | 14 |

- **Ropes:** 0 fragmentos con ref en los 12 versículos preguntados de los tres TP. Causa
  **supuesta**: su notación de versículos, sin nombre de libro.
- **Rangos anchos:** en Adamson, McCartney, Motyer y Varner, entre 34 % y 41 % de los fragmentos
  tiene 5 versículos o más: el rango de un encabezado, no una mención. Mayor, 2 %.
- **Hojas clave sin ref:** Varner h. 164 (Dt 6:4 en 4:12) y h. 167 (anacoluto en 4:14) no nombran
  su versículo; compiten por parecido.

### 9.3 Las reglas de la prosa chocan con lo que pide el profesor (leído)

| Regla vigente | Lo que pide el profesor |
|---|---|
| «NUNCA escribas sobre versículos vecinos. Solo este versículo.» (mayo de 2026, #110, antes de que existieran las preguntas) | Jactancia del v. 16, estructura de 4:2–3 |
| «Recorta amplitud, nunca rigor. Menos puntos» | Más puntos: los echa en falta |
| Solo las respuestas llevan «KEEP»; los ecos del AT no llevan marca | Dt 6:4 |
| «Cuando la decisión se apoya en una conjugación o en una cadena constructa» (#825, posterior a estos TP) | Valor de tiempo, caso y recurso sintáctico en griego |

Que estas reglas causaran cada pérdida es **supuesto** hasta el experimento.

### 9.4 Encabezados de gramáticas: no sirven en todos los libros

Hojas bajo un encabezado que nombra la categoría (medido; `modo` da falsos positivos):

| Libro | Perfecto-presente | Dativo de interés | Presente habitual | Medio | Circ. concomitante | Anacoluto |
|---|---|---|---|---|---|---|
| Wallace | 2 | 3 | 13 | 10 | 6 | 0 |
| Wallace en español | 17 | 9 | 10 | 11 | 20 | 0 |
| **Robertson** | **0** | **0** | **0** | **0** | **0** | **0** |
| Porter | 2 | 0 | 0 | 8 | 0 | 0 |

- **Corrige §4.1:** tener ruta de dos niveles no significa nombrar la categoría. En Robertson el
  árbol no sirve para esto, y es gramática citada en dos TP.
- **Ningún encabezado griego nombra el anacoluto.**
- **Hebreo:** Waltke-O'Connor es sólido (piel 24, hifil 16, constructo 45). Niccacci y Andersen
  sirven para su tema. Farfan, Barrick y Arnold-Choi traen pocas hojas por categoría.
- **Índices:** Wallace 57 hojas, Robertson 98, Waltke-O'Connor 53. No medí si llevan a la página
  correcta.

### 9.5 Comentarios en toda la biblioteca

De 22 comentarios, 3 no tienen estructura reconocible con su libro correcto: Adamson, Green
(Jude) y Watson. Caen a la búsqueda por parecido, con el ruido de §4.4. Calvino y Stuart también
dieron «no», pero la medición dedujo mal su libro (por los `refs` más frecuentes), así que quedan
sin confirmar; lo mismo vale, en sentido contrario, para el «sí» de Kistemaker.

### 9.6 Hebreo: Ortiz

0 de 8 lemas hallados, y ahora con causa leída: la entrada abre con «— (I) **[raíz]**» o con
número, y la detección exige que la línea empiece por `**`. Además la raíz suele ir sin vocales.
Falta medir un trabajo hebreo real: la devolución de un TI.

### 9.7 Tipos de pregunta

44 preguntas en los 11 trabajos con preguntas (incluye copias): sintaxis 18, léxica 9, ambas 6,
identificar 1, **sin tipo 10 (23 %)**. Sin tipo quedan «¿Qué función tiene…?» y «¿Cómo se debe
traducir…?»: no reciben regla de método. 4:17, sin tipo, acumula 5 de las 11 observaciones del
TP #9; es un solo caso. Otros 17 trabajos no tienen preguntas: una solución por pregunta no los
cubre.

### 9.8 Otros usuarios y fuentes

- **Usuarios:** además del fundador (64 recursos, 33 trabajos), solo 2 usuarios tienen recursos
  (22 y 1) y 3 tienen trabajos (18, 1 y 1). Casi todo lo medido es de una sola biblioteca.
- **Fuentes:** 6 comentarios de Santiago y 2 léxicos griegos, con veto semanal. «Otros
  diccionarios» y «voces más recientes» no siempre tienen respuesta en esta biblioteca, y el
  sistema no lo advierte.

### 9.9 Por qué la fase del TP #8 no bastó (leído)

Entregó el detector de entrada (A2), la revisión por pregunta (A4) y fijar por hoja (A5). Pero:

- La entrada del lema quedó dentro de «Selección sugerida», que el fundador nunca usó.
- Fijar más empeora §9.1: A5 hizo fácil subir lo fijado sin bajar su costo en cada paso.
- Ninguna medición siguió la hoja hasta el análisis ni hasta el texto.

### 9.10 Estado del diagnóstico

| Pregunta | Estado |
|---|---|
| ¿Cuánto de lo corregido nace de material faltante? | TP #8 y #9: 3 de 21 por hoja, 1 por voces vetadas, 1 probable por no llegar. Falta TP #10 |
| ¿Qué debía llegar a cada tipo de pregunta? | Parcial: 21 observaciones, 44 preguntas tipificadas |
| ¿Cuánto ruido agrega cada camino? | Medido en peso: lo elegido triplica o cuadruplica lo que cabe |
| ¿Lo elegido llega? | No: 24–32 % como máximo. Falta el reparto exacto, con coseno |
| ¿Tener la hoja mejora la respuesta? | Medido en §10: sí donde la hoja trae el tema; no basta en todos los casos |

Pendiente: comparar formas de elegir (tarea 14), los índices, y las devoluciones del TP #10 y de
un TI.

## 10. Experimento: hojas y reglas de la prosa

Autorizado por el fundador el 2026-11-05. Gasto estimado: US$ 4,80. No escribió en producción.
Arnés: `scripts/rag-eval/.experimento-familia-a.ts`. Resultados, en archivos locales de la sesión.

### 10.1 Diseño

4 preguntas (4:1, 4:2, 4:12 y 4:17), 3 repeticiones por versión, modelo de producción, sin
indicación de nadie.

- **A0:** lo fijado de la receta final.
- **A1:** solo fijado lo de esa pregunta, más la hoja que faltaba (Kittel μέλος; Wallace dativo,
  presente y perfecto). El resto de lo elegido sigue compitiendo.
- **C0:** compositor vigente.
- **C1:** sin «NUNCA escribas sobre versículos vecinos», con «nombra el valor» y «evalúa, no
  calles». Sus ejemplos no mencionan ninguna de las respuestas esperadas.

Dos evaluadores independientes, a ciegas, con 10 criterios tomados de las observaciones del
profesor; se usa el segundo, con criterio más estricto. Concordancia: 78 de 94 puntajes iguales y
94 de 94 a un punto o menos. Control: las 4 respuestas que recibió el profesor.

### 10.2 Resultado (promedio sobre 20)

| Versión | Puntaje | Palabras (presupuesto 300) |
|---|---|---|
| Lo que recibió el profesor | 5,0 | 308 |
| Análisis aceptado + prosa actual | 5,7 | 301 |
| Análisis aceptado + prosa nueva | 9,3 | 313 |
| Análisis nuevo + prosa actual | 7,3 | 310 |
| Análisis con hojas de la pregunta + prosa actual | 10,0 | 309 |
| Análisis con hojas de la pregunta + prosa nueva | **11,7** | 317 |

### 10.3 Por criterio (repeticiones, 0 a 2)

| Criterio | Actual (A0+C0) | Con hojas (A1+C0) | Hojas + prosa (A1+C1) |
|---|---|---|---|
| 4:1 segundo diccionario | 0 0 0 | 2 2 0 | 2 1 0 |
| 4:1 cómo conviven conflicto y cuerpo | 1 2 1 | 1 1 1 | 1 1 1 |
| 4:2 lectura figurada | 2 2 2 | 2 2 2 | 2 2 2 |
| 4:2 ¿mataban de verdad? | 2 2 2 | 2 2 1 | 1 2 2 |
| 4:12 valor del presente | 0 0 0 | 0 0 0 | 0 2 2 |
| 4:12 unicidad de Dios | 1 1 1 | 1 1 1 | 1 2 1 |
| 4:17 dativo de desventaja | 0 0 0 | 0 0 0 | 0 0 0 |
| 4:17 cambio de persona | 0 0 0 | 0 0 0 | 0 0 0 |
| 4:17 perfecto como presente | 0 0 0 | 2 2 2 | 2 2 2 |
| 4:17 jactancia del v. 16 | 1 1 1 | 1 1 1 | 1 1 2 |

### 10.4 Lectura

1. **La hoja importa cuando trae el tema:** Kittel y el perfecto con valor de presente pasan de 0
   a 2. Mecánicamente, Kittel entra al rango de μέλος en 3 de 3 análisis con hojas, y en 0 de 3 sin
   ellas.
2. **La hoja no basta:** Wallace h. 178–180 llegó en los 3 análisis con hojas de 4:17 y nadie dijo
   «dativo de desventaja»: 0 en todas las versiones. El cambio de persona, tampoco. El valor del
   presente solo aparece con hoja y regla juntas.
3. **Las dos palancas suman:** ninguna alcanza por sí sola. Sobre el análisis aceptado, la prosa
   nueva sube 3,6; sobre el análisis nuevo, las hojas suben 2,7 y la prosa 1,7 más.
4. **El sistema ya mejoró solo:** 4:2 da 2 en la lectura figurada sin ningún cambio, frente a 0 en
   lo que recibió el profesor. Los cambios posteriores al TP #8 funcionaron ahí.
5. **Hay costos:** 4:1 pierde algo en el segundo criterio, por competir por las mismas 300 palabras.
   La prosa nueva se pasa 6 % del presupuesto. Sin las hojas, la prosa nueva generó 4 señales de
   categoría sin sustento en 12 textos; con hojas, 0 en 12.
6. **Las citas se sostienen:** las 336 citas revisadas en los análisis, de libros con desfase
   conocido, apuntan a hojas que llegaron. Mide la página, no que digan lo afirmado. Sin Tuggy, NA28
   ni Motyer.

### 10.5 Límites

- **El evaluador no es el profesor**, y aun con el criterio estricto fue indulgente con el control
  en 4:1 (segundo criterio).
- **A1 lo armé yo, conociendo las respuestas.** Prueba qué pasa si la hoja llega, no que el sistema
  sepa hallarla.
- **C1 se escribió después de leer las observaciones.** Es optimista hasta probarla sin ver: TP #10
  con su devolución.
- **Pocas repeticiones**, un solo libro, griego. Nada de hebreo.
- **Medición posterior:** ver la sección 11 sobre si el sistema puede hallar la hoja.
- **Defecto de mi arnés:** en la prosa de los análisis nuevos las páginas salen mal convertidas
  («Mayor, p. cxi»): faltó un paso de marcado que sí está en producción. No afecta los criterios,
  pero esa prosa no sirve para evaluar páginas. El arnés también omitió las muestras de voz y las
  alertas del verificador.

## 11. ¿Puede el sistema hallar la hoja? (tarea 14)

Autorizado por el fundador el 2026-11-05. Gasto estimado: US$ 0,37. No escribió en producción.
Script: `scripts/rag-eval/.medir-encabezados.ts`. 15 preguntas de los TP #7 a #10, 2 libros y 3
repeticiones, con el modelo barato de producción (Luna).

Tres caminos: **R**, hojas cuyo `refs` nombra el versículo; **S**, `sectionsForKeys`, la sugerencia
de hoy; **M**, el modelo eligiendo hasta 8 entradas del esquema real de encabezados. Una hoja cuenta
si cae en lo elegido o a una hoja de distancia.

| Libro y blanco | R | S (hoy) | M | R + M | Hojas por pregunta, mediana (R / S / M) |
|---|---|---|---|---|---|
| Wallace, 10 citadas | 7 | 0 | 4 | 8 | 1 / 44 / 8 |
| Wallace, 7 señaladas | 0 | 1 | 3,7 | 3,7 | 1 / 44 / 8 |
| Robertson, 18 citadas | 13 | 6 | 5,7 | 14 | 2 / 92 / 14 |

Las «señaladas» son hojas que no salen de lo citado: las de la devolución y las halladas aquí.

Lectura:

1. **Las rutas se complementan.** `refs` halla lo que nombra el versículo y no llega a ninguna
   categoría. El modelo sobre encabezados llega a la categoría. Ninguna sustituye a la otra.
2. **Donde la pregunta nombra la forma, el modelo acierta:** TP #10, 3,7 de 4, incluidas las rivales
   manera, medio, circunstancia concomitante y el perfecto proléptico.
3. **Donde el profesor espera más que lo preguntado, no:** TP #9, 0 de 3. En 4:17 el modelo anotó
   αὐτῷ como forma a clasificar y no eligió el dativo; prefirió participios, infinitivo y οὖν.
   Coincide con §10.4: nombrar el valor exacto de la forma es un problema aparte.
4. **Robertson depende de `refs`:** sus encabezados dan poco, como anticipó §9.4. En el TP #7, R y M
   juntos hallan 2 de 6.
5. **Lo elegido por el modelo no se inventa:** 0 identificadores inválidos en 90 corridas.

Límites: «citadas» favorece a `refs`, porque muchas de esas hojas entraron por ahí. Falta probar otro
modelo, hebreo y los índices.
