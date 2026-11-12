# Fase: revisión del profesor sobre Rut y Santiago · noviembre 2026

**Origen.** PDF «Revisión de Preach 261014» (28 páginas): observaciones del profesor sobre el analizador de hebreo (Rut 1–3) y el de griego (Santiago 2–3), parafraseadas por el fundador. Son 23 observaciones con comentario, y hay dos páginas sin comentario (p. 7, abajo, y p. 19).

**Cómo leer este documento.** Cada afirmación lleva su rótulo:
- **medido**: se corrió el código o se contaron los datos;
- **leído**: se leyó en el código, en los datos o en el PDF;
- **supuesto**: conocimiento de gramática que hay que cotejar con el libro antes de convertirlo en regla.

**Antecedentes.** Esta fase sigue a `FASE_MODULOS_IDIOMA_2026-10.md` (G0–G5, H1–H7) y a `FASE_REGLAS_DESDE_GRAMATICAS_2026-10.md` (R0, R1, R4: infinitivo, participio y כִּי). Mucho de lo que pide el profesor ya existe a medias. El plan parte de lo que hay y no lo reemplaza.

---

## 1. Las cinco causas

Casi todas las observaciones salen de cinco causas.

| Causa | Observaciones | Gravedad |
|---|---|---|
| **A. Reglas del código que deciden mal y se muestran como «Regla»** | Stg 2:13, 2:17, 2:20; además, Stg 2:11, que el profesor no marcó | Alta: es el error con más autoridad aparente |
| **B. El prompt hebreo trata toda waw + no verbo como contraste** | Rut 1:21, 1:22, 2:1, 2:10, 2:13 | Alta: afecta cada cláusula disyuntiva del AT |
| **C. Capas que no existen** (preposición, artículo hebreo, función del verbo finito hebreo, ketiv/qere, frases, apertura de sección) | Rut 2:1 (×2), 2:7, 3:5, 3:6; Stg 2:16, 2:10 ἐν, 2:21, 3:1, 3:5 | Media: falta, no miente |
| **D. El asistente tiene la opción correcta y elige otra** | Stg 2:10 γέγονεν, 2:11 γέγονας, 2:10 τηρήσῃ | Media |
| **E. «Estructura» calca el árbol de MACULA; el profesor estructura por frases** | Stg 2:14, 2:18, 2:19, 2:20, 3:1 | Media-alta: es lo que más se ve distinto |

---

## 2. Observación por observación

### Hebreo

**H-1 · Rut 1:21 וַיהוָה עָנָה בִי (p. 1).** El profesor, según Putnam: causal o circunstancial, no contraste; se inclina por circunstancial.
- **Hoy:** «Sujeto antepuesto… la waw introduce una cláusula disyuntiva de contraste» y «pero el SEÑOR» (leído en la captura).
- **Causa (leído):** `hebrew-prompt-builder.ts`, sección de lectura de cláusulas: «waw disyuntiva de contraste → «pero», no «y»». El arreglo de Rut 1:14 (#754) se volvió una regla general. El «valor» de la fila es texto libre (`clauseReading.ts`) y la waw disyuntiva no está entre las relaciones que el asistente debe elegir de una lista (`OPCIONES` solo tiene ἵνα y ὅτι/כִּי).
- **Unidad:** U2.

**H-2 · Rut 1:22 וְרוּת … וְהֵמָּה (p. 2).** El profesor traduce «y Rut» y «y ellas»; el fundador pregunta por qué.
- **Respuesta:** la waw + no verbo marca una cláusula disyuntiva, pero eso dice que **corta la cadena del wayyiqtol**, no que contraste. En 1:22 el narrador cierra el episodio: «volvió Noemí, y Rut la moabita, su nuera, con ella… y ellas llegaron a Belén al comienzo de la cosecha». Son cláusulas de acompañamiento y de cierre (circunstancia, resumen), sin oposición entre Noemí y Rut. Traducir «pero» inventa un contraste que el texto no tiene (supuesto, coherente con A&C 4.3.3 (e) «circunstancial», que ya está en `ruleSources.ts`).
- **Medido:** `verseStructure` da «disjunctive» en las dos (correcto). La fila de וְרוּת no sale como «nominal» por el defecto A2.
- **Unidad:** U2 (y U1-b para «nominal»).

**H-3 · Rut 2:1 וּלְנָעֳמִי (p. 3).** El profesor quiere que se diga «waw + no verbo = cláusula disyuntiva, no necesariamente contrastiva», como aquí, donde es «y».
- **Hoy:** traduce «y para Noemí» y lee «presentación de paréntesis» (bien), pero la ficha no nombra la regla.
- **Unidad:** U2: la ficha dice la regla («waw + no verbo → disyuntiva») y el valor elegido de la lista («paréntesis: información de fondo»).

**H-4 · Rut 2:1 מוֹדַע, el círculo sobre la dalet (p. 4).**
- **Leído en los datos:** el versículo trae un **ketiv** מידע y el **qere** מוֹדַע (`ketiv: true` en `language-data/v1/he/Ruth/2.json`). La app lo usa solo para saltarlo al alinear (`alinearHebreo.ts`) y nunca lo muestra.
- **En el mismo capítulo 3, dos más:** 3:3 שמלתך y וירדתי. Probablemente son lo que el profesor encerró en círculo en la foto de la p. 7 (supuesto).
- **Para confirmar con el profesor (supuesto):** en la BHS, el círculo (*circellus*) remite a la **Masora parva** del margen, que aquí da el qere. El aparato crítico usa letras voladas (a, b).
- **Unidad:** U6.

**H-5 · Rut 2:1 לְאִישָׁהּ, lamed posesiva (p. 5).** El fundador pregunta si en los sustantivos no se identifica la función.
- **Hoy:** hay «Su función» en texto libre («complemento preposicional que especifica la relación familiar»). No hay lista cerrada de funciones de preposición en hebreo. El griego tiene la función de caso, pero tampoco la de la preposición (ver G-1).
- **Leído en los datos:** MACULA da a וּלְנָעֳמִי el rol «p» (predicado) de una cláusula nominal: «Noemí **tenía** un pariente». Es la lamed de posesión en el predicado, decidible por regla. En לְאִישָׁהּ («[pariente] de su marido») la lamed también es posesiva, pero dentro de la frase nominal.
- **Unidad:** U3.

**H-6 · Tooltip (p. 6).** El profesor pide que el tooltip muestre, además de lo que ya muestra, la función y **la raíz con su transliteración** (respuesta del fundador, 2026-11-11).
- **Leído:** el bloque `he.raiz` estaba en el tooltip antes del rediseño de la ficha (#763/#764), pero hoy no entra en el resumen (`tablaDestino`: «Resumen —»). La función sí está, aunque es texto libre truncado.
- **Unidad:** U12.

**H-6b · Rut 3:3 כַּלֹּתוֹ, el sufijo no se identifica (p. 7, abajo).** El fundador transmite «no identificamos 3 masculino plural».
- **Medido:** en Rut 3:2-4, OSHB no tiene ninguna forma 3mp. Las de 3.ª masculina son todas singulares: el sufijo de כַּלֹּתוֹ (`Vpc/Sp3ms`, «hasta que **él** termine»), נַעֲרוֹתָיו, מַרְגְּלֹתָיו y בְשָׁכְבוֹ. Probablemente el profesor anotó «3ms»; confirmar la palabra.
- **Leído:** sea cual sea la palabra, el defecto existe. El sufijo pronominal nunca se muestra como dato de la forma. En el nombre está excluido a propósito (`DESTINO_NOMBRE.suffix`: «Ni la tarjeta ni el tooltip lo mostraban»). En el verbo y el infinitivo no hay campo. Solo aparece en «Cómo se reconoce», en texto del asistente.
- En un infinitivo constructo, el sufijo es el **sujeto** (o el objeto) de la acción: el dato pedagógico clave.
- **Unidad:** U13.

**H-7 · Rut 2:7 בָעֳמָרִים, «en» y no «entre» (p. 7).**
- **Leído en los datos:** en 2:15 Booz dice גַּם **בֵּין** הָעֳמָרִים תְּלַקֵּט («que recoja aun **entre** las gavillas»). Cuando el autor quiere «entre», usa בֵּין. Eso respalda el argumento del profesor dentro del mismo libro.
- **Matiz (supuesto):** es un punto discutido en los comentarios. Unos leen que Rut pidió algo audaz (espigar entre gavillas ya atadas) y otros, que pidió juntar en gavillas. La app no debe decidirlo en silencio.
- **Hoy:** la traducción LITERAL dice «entre», que ya es una interpretación.
- **Regla propuesta:** en la literal, la preposición conserva su sentido base (ב = «en»). La interpretación va a la fluida y a una nota que nombre la alternativa.
- **Unidad:** U3.

**H-8 · Rut 3:5 אֶעֱשֶׂה, cohortativo por la determinación (p. 8).**
- **Hoy:** la ficha sí dice «Valor temporal: futuro volitivo o de compromiso», pero no lo nombra «cohortativo», y no hay bloque de función para el verbo finito hebreo. Solo existen los del infinitivo, el participio y כִּי.
- **Leído:** OSHB dice `Vqi1cs` (imperfecto). En un verbo III-he la ה final es de la raíz, así que la forma no puede mostrar la ה- del cohortativo. Lo volitivo es la función, igual que la fórmula de juramento de H3 (Rut 1:17).
- **Unidad:** U5.

**H-9 · Rut 3:6 הַגֹּרֶן, artículo anafórico (p. 9).**
- **Hoy:** el hebreo no tiene análisis del uso del artículo. La «era» ya se nombró en 3:2 y 3:3.
- **Hallazgo nuestro (leído):** la ficha dice «Objeto directo», pero MACULA le da el rol **adv**. וַתֵּרֶד הַגֹּרֶן es «bajó **a** la era»: acusativo de lugar o dirección, no objeto. La literal «descendió la era» lo arrastra. El dato tenía la respuesta y no se usó.
- **Unidad:** U4.

**H-10 · Rut 2:10 וְאָנֹכִי נָכְרִיָּה, «siendo yo» (p. 10).**
- **Respuesta:** waw + pronombre + predicado sin verbo, después de la oración principal, es la cláusula **circunstancial** clásica: describe la situación en que ocurre lo principal. En castellano el gerundio la traduce bien: «¿por qué hallé gracia… **siendo yo** extranjera?».
- **Leído:** nuestra traducción FLUIDA ya decía «siendo yo extranjera», pero la ficha decía «pero yo… contraste». Las dos salidas del mismo análisis se contradicen.
- **Unidad:** U2.

**H-11 · Rut 2:13 וְאָנֹכִי לֹא אֶהְיֶה, «aunque yo», concesiva (p. 11).** Mismo patrón: disyuntiva con valor **concesivo**, que el prompt empuja a «contraste/pero».
- **Unidad:** U2.

### Griego

**G-1 · Stg 2:16 ἐξ ὑμῶν, genitivo partitivo (p. 12).** El fundador pregunta por qué.
- **Respuesta:** «τις ἐξ ὑμῶν» = «alguno **de entre** ustedes». ὑμῶν es el todo del que se toma una parte. ἐκ + genitivo hace el trabajo del genitivo partitivo (supuesto: Wallace trata ἐκ + genitivo como sustituto del partitivo; cotejar la sección).
- **Hoy:** la ficha dice «Genitivo régimen de preposición». Es correcto como forma, pero no dice la función.
- **Leído en MACULA:** la preposición trae su sentido de Louw-Nida, **63.20** (dominio 63, «todo y parte»). El dato distingue el partitivo sin el asistente. En 2:21 y 2:24, «ἐξ ἔργων» trae 89.25/89.77 (dominio 89, «relaciones»: causa o medio).
- **Unidad:** U3.

**G-2 · Stg 2:16, reconocer ἐξ ὑμῶν como frase preposicional (p. 13), y p. 18 (Stg 2:21 ἐξ ἔργων): ¿un interruptor para marcarlas?**
- **Hoy:** en «Estructura», ἐξ y ὑμῶν salen como dos «S» sueltas, porque cada palabra hereda el rol de su constituyente. El hebreo sí subraya frases preposicionales, pero palabra por palabra y lo decide el asistente o la categoría (`syntacticMark.ts`). El griego no subraya nada.
- **Leído en MACULA:** hay 114 nodos `class="pp"` en Santiago. La frase preposicional está en el dato y no se exporta.
- **Unidad:** U11.

**G-3 · Stg 2:17 y 2:20 ἡ πίστις, artículo anafórico (p. 14 y p. 17).** El fundador cree que «lo reconocemos sin decir que es anafórico».
- **No es así (leído):** «Concuerda con πίστις» es la concordancia gramatical, no la anáfora. En 2:20 el asistente escribió «no retoma un sustantivo del versículo anterior». Es cierto para 2:19, pero el antecedente πίστιν está en 2:18.
- **Causa (medido):** `greekAnaphora` mira solo el versículo y el anterior. En 2:17 el antecedente está en 2:14, a tres versículos. Además, `applyNominalRules` respeta «con abstracto» si lo eligió el asistente, así que aun encontrándolo no lo corrige. Las dos fichas dicen «Con abstracto».
- **Medido en el NT:** hoy hay 2.267 anafóricos. Mirando 2 versículos atrás se agregan 719; 3, 463; 4, 314; 5, 244. La muestra se ve plausible (Hch 14:10 πόδας ← 14:8; 1 Co 1:13 ὄνομα ← 1:10), pero **la precisión no está medida**.
- **Unidad:** U1-c.

**G-4 · Stg 2:18, comparar la estructura y el quiasmo (p. 15).**
- **Diferencias (leído):**
  1. El profesor pone cada frase preposicional (χωρὶς τῶν ἔργων, ἐκ τῶν ἔργων) en su propia línea bajo lo que modifica (*phrasing* de Fee). Nosotros solo cortamos por cláusulas.
  2. Él marca el quiasmo A (πίστιν) B (ἔργων) B′ (ἔργων) A′ (πίστιν); nosotros no detectamos quiasmos.
  3. Él anota κἀγώ = καί + ἐγώ (crasis).
  4. Σὺ πίστιν ἔχεις, κἀγὼ ἔργα ἔχω es lo que dice «alguno» (contenido de ἐρεῖ). Nosotros lo rotulamos «Principal».
- **Unidad:** U11 (el quiasmo, en una etapa posterior).

**G-5 · Stg 2:19, comparar la estructura (p. 16).**
- **Medido:** colgamos «καὶ τὰ δαιμόνια πιστεύουσιν» como hija de «καλῶς ποιεῖς», cuando es coordinada. Además, su καί (aquí «aun / también») recibe el rol «S». Y «καὶ φρίσσουσιν» queda arriba como «Adición». La sangría sale del árbol de MACULA tal cual. El profesor alinea todo a la izquierda y sangra solo el contenido de ὅτι.
- **Unidad:** U11.

**G-6 · Stg 2:10 τηρήσῃ, πταίσῃ, función del verbo y aoristo «nómico» (p. 22).**
- **Leído:** «nómico» es casi seguro «gnómico».
- **Medido:** los dos subjuntivos reciben candidatos genéricos (exhortativo, deliberativo, prohibición, indefinido, «no sea que»). La regla del relativo indefinido exige ἄν, y aquí es «ὅστις… τηρήσῃ» sin ἄν, así que nada decide. El asistente no devolvió función, y la ficha no muestra bloque.
- **Respuesta:** en Wallace los usos del tiempo («gnómico») son sobre todo del indicativo. En el subjuntivo el aoristo no marca tiempo. El sentido general y atemporal lo da la **relativa indefinida** (ὅστις + subjuntivo: «cualquiera que…»), que plantea un caso general. Conviene confirmar con el profesor si llama «gnómico» a eso.
- **Unidad:** U7.

**G-7 · Stg 2:10 ἐν ἑνί, locativo por el sentido del verbo (p. 23).**
- **Hoy:** «Dativo régimen de preposición».
- **Leído en MACULA:** Louw-Nida 89.5, en el dominio de relaciones, no en el locativo espacial. Hay que ver la entrada: puede ser «con respecto a», cercano a la esfera que dice el profesor.
- **Unidad:** U3. El profesor decide la categoría y el dato la respalda o la discute.

**G-8 · Stg 2:10 γέγονεν, perfecto proléptico según Wallace (p. 24), y Stg 2:11 γέγονας, «futuro propedéutico» (p. 25).** El fundador cree que «no capturamos los usos de Wallace».
- **No es así (medido):** «proleptic» está en la lista cerrada del perfecto (`verbFunctions.ts`: intensive, extensive, proleptic, gnomic) y el asistente la recibió. Eligió «intensivo». Es un error de elección, no de taxonomía.
- «Propedéutico» es casi seguro «**proléptico**».
- **Supuesto:** Wallace cita Stg 2:10 como ejemplo de perfecto proléptico; cotejar la página.
- **Patrón:** perfecto indicativo en la apódosis de una condición general o tras una relativa indefinida («ὅστις… πταίσῃ… γέγονεν»; «εἰ… φονεύεις… γέγονας»).
- **Unidad:** U7.

**G-9 · Stg 2:13, ¿cómo sabe el profesor que la primera cláusula es nominal? (p. 26).**
- **Respuesta:** «ἡ γὰρ κρίσις ἀνέλεος» no tiene verbo finito. ἀνέλεος es adjetivo **sin artículo** junto a un sustantivo **con artículo** (ἡ κρίσις). Esa es la posición predicativa: «el juicio [es/será] sin misericordia». La cópula se sobreentiende.
- **Hoy (medido):** el dato ya rotula ἀνέλεος como «PRED», pero la fila no dice «Nominal (sin verbo)», aunque la vista sabe mostrarlo.
- **Causa (leído):** `verseStructure.ts` decide `verbless` mirando todo el subárbol, y el participio ποιήσαντι de la cláusula hija la vuelve «verbal».
- **Medido en el NT:** 300 filas con predicado, sin verbo propio y sin la marca. Ej.: 1 Co 1:9 «πιστὸς ὁ θεός», la cláusula nominal de manual.
- **Unidad:** U1-b.

**G-10 · Stg 2:14, comparar la estructura (p. 27).** Medido, nuestra salida:
```
Τί ὄφελος, ἀδελφοί μου            [Apódosis · Principal]
  ἐάν                              [Prótasis · 3.ª clase]   ← fila con solo el conector
      πίστιν ἔχειν                 [Infinitivo]             ← sale ANTES de su verbo
    λέγῃ τις                       [Principal]              ← «Principal» dentro de una prótasis
    ἔργα δὲ μὴ ἔχῃ                 [Desarrollo]
μὴ δύναται ἡ πίστις                [Principal]
  σῶσαι αὐτόν                      [Infinitivo]
```
- **El profesor:** pone la apódosis arriba y la prótasis entera en un bloque, con «ἐὰν πίστιν λέγῃ τις ἔχειν» en una línea y «ἔργα δὲ μὴ ἔχῃ» debajo, unidas con un corchete y una flecha a la apódosis. Resalta el par contrastado πίστιν / ἔργα.
- **Por qué somos tan distintos:**
  1. La fila con solo el conector (2.820 en el NT, dejadas así a propósito en G1) parte la prótasis.
  2. El infinitivo «πίστιν… ἔχειν» es discontinuo (envuelve a «λέγῃ τις»). Al sacarlo a su fila se rompe el orden del texto.
  3. Una cláusula sin conector propio sale «Principal», aunque esté dentro de una prótasis.
  4. El δέ de la segunda condición se lee «desarrollo» (Runge) y no se ve que es la segunda mitad de la misma prótasis.
  5. Solo cuenta como antepuesto lo que va antes de un verbo finito. Por eso πίστιN, antepuesto al infinitivo, no se resalta.
- **Unidad:** U11.

**G-11 · Stg 2:14 ἐάν, ¿qué es «tercera clase»? (p. 28).**
- **Respuesta:** Wallace clasifica las condicionales en cuatro clases por la partícula y el modo. La 3.ª es ἐάν + subjuntivo. Presenta la condición como posible, no como dada. Wallace distingue dos usos: **futuro más probable** («si alguien viene, lo recibiré») y **presente general** (una verdad que vale cada vez que se cumple la condición). Stg 2:14 es presente general: «cada vez que alguien dice tener fe y no tiene obras, ¿de qué sirve?» (supuesto; cotejar la sección).
- **Hoy:** la clase se ve solo en «Estructura» («Prótasis · 3.ª clase»). La ficha de ἐάν no la menciona.
- **Unidad:** U8.

**G-12 · Stg 3:1, imperativo + vocativo abren una sección (p. 20).**
- **Hoy:** ἀδελφοί μου lleva el rol «AUX» y nada más.
- **Leído:** en Santiago, las unidades abren con vocativo, casi siempre junto a un imperativo: 1:2, 1:16, 1:19, 2:1, 2:5, 3:1, 4:11, 5:7, 5:9, 5:10, 5:12. El bosquejo del profesor (p. 19) corta justo en 2:1, 2:5, 2:8, 2:14, 2:18 y 2:20.
- **Excepciones a medir:** en 3:10 y 3:12 hay vocativo sin imperativo y no abren sección. En 2:14 hay vocativo con pregunta y sí abre.
- El hebreo ya tiene un bloque «Apertura» (וַיְהִי): se puede reusar el concepto.
- **Unidad:** U9.

**G-13 · Stg 3:5 ἡλίκον … ἡλίκην, polisemia (p. 21).**
- **Leído en MACULA:** la glosa en contexto ya distingue: ἡλίκον = «a small» y ἡλίκην = «how great». Las dos llevan Louw-Nida 79.127.
- **Hoy:** nuestra LITERAL dice «qué gran fuego… qué gran bosque» (mal) y la FLUIDA, «un fuego pequeño… un bosque enorme» (bien). Otra vez se contradicen dos salidas del mismo análisis.
- **Unidad:** U10.

---

## 3. Lo que encontramos y el profesor no marcó

1. **Stg 2:11 «Μὴ φονεύσῃς»: la regla dice «no sea que».** Es una prohibición, igual que el «Μὴ μοιχεύσῃς» de la misma frase, que sí sale bien.
   - **Medido:** de 48 decisiones «no sea que» en el NT, 24 son 2.ª persona del aoristo. De las 12 primeras, 10 son prohibiciones mal clasificadas (Lc 18:20 ×4, Heb 3:8, 4:7, Lc 12:4, 17:23, Hch 18:9, Stg 2:11), 1 está bien (Hch 5:39 μήποτε) y 1 es discutible (Lc 21:8, tras βλέπετε).
   - **Causa probable (supuesto):** MACULA cuelga la cita o el discurso como cláusula dependiente, y la regla toma «μή en cláusula dependiente» como temor.
   - **Unidad:** U1-a.
2. **Rut 3:6 «objeto directo» contra el «adv» de MACULA** (ver H-9).
3. **La literal y la fluida se contradicen** (Rut 2:10, Stg 3:5). Ninguna regla compara una con otra ni con la traducción de cada palabra.
4. **El defecto de «nominal»** también afecta al hebreo: Rut 1:22 וְרוּת … עִמָּהּ no sale nominal por la relativa הַשָּׁבָה de debajo.

---

## 3b. Cotejo con los libros (2026-11-11)

Leído en el ejemplar de Wallace de la biblioteca (`432d8c6b…`, desfase −36) y en el PDF de Putnam del fundador. El texto de los libros no entra al repo: aquí van la sección, la página y lo que decide.

| Punto | Libro | Lo que dice (resumen) | Efecto en el plan |
|---|---|---|---|
| Stg 2:11 «Μὴ φονεύσῃς» | Wallace p. 469, «Prohibitive Subjunctive» | Lista Stg 2:11 y Heb 3:8 como subjuntivo **prohibitivo** | U1-a: confirma el defecto de «no sea que» |
| Stg 2:14, 2:17, 2:20 ἡ πίστις | Wallace p. 219, «Anaphoric» | Usa Stg 2:14 como ejemplo: el artículo **retoma** una clase de fe ya definida **y** particulariza un abstracto | U1-c: «con abstracto» no tapa la anáfora; se muestran los dos |
| Stg 2:10 γέγονεν | Wallace p. 581, «Proleptic (Futuristic) Perfect» | Cita Stg 2:10: perfecto en la **apódosis de una condición explícita o implícita**; admite también «gnómico» | U7: la regla **acota** a proléptico o gnómico, no decide |
| Stg 2:14 ἐάν | Wallace p. 696, «Third Class Condition › Clarification and Semantics» | Tres valores: presente general, hipotético y futuro más probable. Con presente indicativo en la apódosis, Wallace la llama «quinta clase» | U8: la ficha dice la clase y el valor; se conserva «3.ª clase», la etiqueta del curso |
| Stg 2:16 ἐξ ὑμῶν | Wallace p. 84–85, «Partitive Genitive» | Ejemplo «one of you»; ἐκ + genitivo «often has a partitive force» | U3 |
| Rut 1:22 | Putnam §2.2.3a | וַתָּשָׁב **resume** 1:6–21, no adelanta la narración | H-2: cierre de episodio, no contraste |
| Waw disyuntiva | Putnam §3.2.2 | Parentética (inicial: escenario; medial: explica; terminal: resume) y adversativa (Rut 1:14) | U2: lista cerrada con esas categorías + circunstancial y concesiva |
| Rut 2:1 לְאִישָׁהּ | Putnam §1.8.1 y §1.5.1b(5) | Para un poseído indefinido con poseedor definido se usa ל en lugar del constructo | U3: ל posesiva por regla |
| Rut 3:5 אֶעֱשֶׂה | Putnam §2.2.4a y §2.2.2b(1) | El cohortativo puede verse idéntico al yiqtol y se reconoce por el contexto (Gn 24:58 אֵלֵךְ «sí, iré») | U5 |
| Rut 3:6 הַגֹּרֶן | Putnam §2.4.2a | **Usa Rut 3:6 como ejemplo** de complemento adverbial de meta: «descendió a la era» | U4: confirma que «objeto directo» está mal |
| Rut 3:3 כַּלֹּתוֹ | Putnam §2.2.6a, §1.5.1b(3) y §2.2.1a(2) | El sufijo del infinitivo es su **sujeto** (Nm 16:31 כְּכַלֹּתוֹ); cita Rut 3:3: «hasta que **él** haya acabado» | U13 |
| Rut 3:6 artículo | Putnam §1.4.3 | Lista de usos del artículo (anafórico, contexto, conocido, demostrativo, distintivo, vocativo, relativo, genérico, superlativo) | U4: lista cerrada del hebreo |

## 4. El plan

Principios, los mismos de las fases anteriores: **dato → regla → asistente**; listas cerradas; reglas aplicadas al mostrar (llegan a lo guardado sin re-analizar); cada regla medida sobre el corpus y revisada a mano con una muestra antes de rotularse «Regla».

| Unidad | Qué | Cómo | Re-análisis | Riesgo principal |
|---|---|---|---|---|
| **U1-a** | «No sea que» solo con verbo de temor o advertencia, μήποτε o ἵνα μή. μή + aoristo subjuntivo 2.ª persona encabezando su cláusula = prohibición, también dentro de una cita | `VERB_RULES`; revisar a mano las 48 | No (al mostrar) | Perder los «lest» reales (Hch 5:39): prueba con cada uno |
| **U1-b** | «Nominal» mira las palabras propias de la fila, no el subárbol | `verseStructure.ts`; las filas de solo conector siguen sin ser nominales | No | La invariante del corpus y las 300 filas revisadas por muestra |
| **U1-c** | Anáfora. **Medido a mano (2026-11-11):** ampliar la ventana como regla da ~55 % de precisión (8, 9, 9 y 8 de 15 a 2, 3, 4 y 5 versículos). La regla actual daba 18 de 25 (mismo versículo 8/8; anterior ~62 %). **Hecho en la primera tanda:** mismo número, más monádicos (οὐρανός, κόσμος, γῆ, ἥλιος, σελήνη; Wallace p. 223), un ordinal descarta salvo que el antecedente lleve el mismo; «con abstracto» ya no tapa la anáfora (Wallace p. 219). Muestra nueva del versículo anterior: 25 de 25. **Segunda tanda:** los antecedentes del párrafo van al asistente como pista (Stg 2:17, 2:20) | `greekAnaphora` + `applyNominalRules`; la pista, en el prompt griego | No (regla); sí (pista, griego v15) | Se pierden algunas anáforas reales con otro número (Jn 19:24): se prefiere no rotular «Regla» algo falso |
| **U6** | Ketiv/qere visibles: marca ° sobre la palabra y, en la ficha, «Ketiv מידע · Qere מוֹדַע» | Dato ya generado | No | Ninguno: solo muestra |
| **U8** | La ficha de εἰ/ἐάν con su clase y su uso según Wallace (3.ª: futuro más probable o presente general, por el tiempo de la apódosis) | Regla desde MorphGNT | No | Subtipo mal decidido: medir sobre las 354 con ἐάN |
| **U2** | Waw disyuntiva: lista cerrada de valores (contraste, circunstancial, causal, concesiva, paréntesis o fondo, apertura o cierre de escena) y traducción según el valor. Se quita «disyuntiva → pero» | `OPCIONES.disjunctive` en `clauseReading.ts`; prompt hebreo v4; la ficha nombra la regla + el valor | **Sí** (hebreo v4: aviso «anterior»; la traducción del usuario se conserva) | Que Luna elija mal: banco de 20 casos (los 6 del profesor + ejemplos de A&C) corrido antes de entregar |
| **U3** | Función de la preposición, en los dos idiomas. Griego: sentido de Louw-Nida de MACULA + regla del partitivo (τις/εἷς/οὐδείς/numeral + ἐκ/ἀπό + genitivo) + lista de Wallace. Hebreo: lista de A&C cap. 4 por preposición + regla de ל posesiva en predicado nominal. Literal con sentido base | Regenerar datos con `ln` de las preposiciones (medir el peso); bloque «Función de la frase» | Griego sí (explicación); hebreo sí | El peso de los datos; la invariante de alineación; MACULA y el profesor pueden no coincidir (G-7) |
| **U4** | Hebreo: uso del artículo (anafórico por lema en el párrafo, como el griego) + contraste del rol de MACULA con lo que dice el asistente (adv ≠ «objeto directo») | Regla nueva; aviso en la ficha | No para la regla | Falsos anafóricos: misma muestra que U1-c |
| **U5** | Hebreo: función del verbo finito (lista cerrada de A&C cap. 3 para qatal, yiqtol, wayyiqtol, weqatal y volitivos), con «cohortativo por función» cuando la forma no puede mostrarlo (1.ª sg III-he en discurso volitivo) | Igual que G2 griego | Sí | La lista y la regla se cotejan con el libro antes (R0) |
| **U7** | Griego: relativa indefinida sin ἄν (ὅστις + subjuntivo) = indefinido; perfecto proléptico como regla o pista fuerte en la apódosis de una condición general; la ficha siempre muestra el bloque de función del verbo, aunque esté sin decidir | `VERB_RULES` | No (regla) / sí (pista) | Medir el proléptico en el NT; si la muestra no da precisión, queda como pista y no como regla |
| **U9** | Apertura de sección: vocativo + imperativo (o pregunta) al comienzo | Regla medida sobre las epístolas, con 3:10 y 3:12 como control | No | Falsos cortes dentro de una unidad |
| **U10** | Polisemia y coherencia de traducciones: el mismo lema dos veces en el versículo con distinta glosa de MACULA → nota «una palabra, dos sentidos»; aviso si la literal contradice la traducción de la palabra | Datos (`gloss`) + comparación | No | Ruido en los avisos: solo cuando la glosa de MACULA difiere |
| **U11** | «Estructura» por frases: fundir las filas de solo conector en su primera hija; un hijo discontinuo queda en línea; la prótasis compuesta se agrupa; nada sale «Principal» dentro de una prótasis; el discurso se rotula como tal; las coordinadas no se sangran bajo su hermana. Interruptor «Frases» que subraya las frases preposicionales de MACULA (`pp`) en griego y hebreo, y un modo de *phrasing* | Rediseño con el fundador primero; banco con los 5 diagramas del profesor | No | Es lo que más se ve: probar en local antes de entregar |
| **U12** | Tooltip hebreo: la raíz con su transliteración vuelve al resumen, junto a la función | `he.raiz` con `Corto`; regenerar `tablaDestino` | No | El alto del tooltip: probar con palabras largas |
| **U13** | El sufijo pronominal como dato de la forma: persona, género y número desde OSHB (`Sp3ms`), en nombres, preposiciones, verbos e infinitivos. En el infinitivo, «sujeto: él» | Lector del código OSHB (ya existe para el verbo, H1); celda «Sufijo» | No (dato) | Sufijos de objeto contra sujeto en el infinitivo: el rol lo da MACULA o queda «sufijo» sin rol |

**Entrega (decisión del fundador, 2026-11-11): un solo PR, un commit por unidad**, en una rama desde `origin/main`. Orden de los commits, de menor a mayor riesgo:

1. **Correcciones que no cuestan re-análisis:** U1-a, U1-b, U1-c, U6, U12, U13, U8, U7. Arreglan lo que hoy está mal rotulado como «Regla» o lo que el dato ya sabía y no se mostraba. Se aplican al mostrar y no gastan API.
2. **Función de las palabras:** U2, U3, U4, U5. Tocan los prompts: requieren el banco del asistente y una corrida pagada (pedir OK por el saldo antes de correrla).
3. **Estructura y discurso:** U11, U9, U10. Antes de U11, una sesión de diseño con el fundador sobre los diagramas del profesor.

Cada commit queda completo y probable en la interfaz. Push pocas veces, para ahorrar minutos de Actions.

**Estado (2026-11-11): primera tanda HECHA**, 8 commits en `feat/revision-profesor-rut-santiago`, sin push. Suite completa en verde (dominio 3.841, web 2.466) y chequeos de CI sin nada nuevo.

| Commit | Unidad | Medido |
|---|---|---|
| `48adfb74` | U1-a «no sea que» | 48 → 26 decisiones; las 21 citas pasan a prohibición (Wallace p. 469) |
| `0fe0aab2` | U1-b nominal | +1.215 filas nominales, 0 perdidas |
| `4922c451` | U1-c anáfora | 2.267 → 1.932; versículo anterior 25/25 en la muestra nueva |
| `131960de` | U12 raíz en el tooltip | — |
| `dde425ae` | U6 ketiv/qere | datos regenerados: sólo las marcas nuevas (1.278 qere, 6 ketiv sin qere) |
| `e6f880d8` | U13 sufijo | 45.974 sufijos del AT reconocidos |
| `b940e646` | U7 Stg 2:10 | +2 indefinidos (los de Stg 2:10); proléptico 5/5 |
| `826ad736` | U8 condicional | 3.ª clase: 74 presente general (11/11), 89 futuro más probable |

**Pasa a la segunda tanda** (necesita el prompt): la pista del antecedente en el párrafo (Stg 2:17, 2:20) y la del perfecto en la apódosis de 1.ª clase (Stg 2:11 γέγονας).

**Anotado, viene de antes:** «Ὅ τι ἐάν» (Mc 6:23) sale como condición en «Estructura».

**Segunda tanda, en curso (2026-11-11):**
- `38115abe` U2: waw disyuntiva con lista cerrada de valores; prompt hebreo v4.
- `d7b37bc8`: el parseo lee el primer objeto JSON completo.

**Banco del asistente para U2** (script fuera del repo, gpt-6-luna; 8 llamadas; no escribe en la caché):

| Rut | Profesor | Eligió | Resultado |
|---|---|---|---|
| 1:21 | causal/circunstancial | causal | ✓ |
| 1:22 | «y» | fondo + cierre | ✓ |
| 2:1 | fondo | fondo (2.ª fila sin valor) | ✓ a medias |
| 2:10 | circunstancial | circunstancial | ✓ |
| 2:13 | concesiva | contraste | ✗ |
| 1:14 | contraste | rechazado por OpenAI («flagged») | — |

**Límite de método:** 1:22, 2:1, 2:10 y 2:13 son ejemplos DENTRO del prompt; acertar ahí prueba poco. Falta un banco con versículos fuera del prompt.

**Banco fuera de muestra (2026-11-11, 22 llamadas + 9 pruebas de rechazo con tope 16).** El valor esperado sale del libro, no de criterio propio: Putnam §3.2.2 y A&C 4.3.3, 5.2.11 y 5.2.12; Mal 2:14 y Jue 16:15 por las traducciones (reserva para la concesiva). Ningún versículo está en el prompt (comprobado con grep). Script: `banco-waw2.ts` en el scratchpad de la sesión.

| Versículo | Fuente | Acepta | v4 | v4 + arreglo |
|---|---|---|---|---|
| Gn 6:8 | A&C 4.3.3a | contraste | ✓ | ✓ |
| Gn 17:21 | A&C 4.3.3a | contraste | ✓ (repitió hasta el tope) | — |
| 2 S 7:2 | A&C 4.3.3a | contraste | sin valor (plantilla) | JSON roto al repetir |
| 1 S 1:2 | Putnam 3.2.2b | contraste | ✓ | ✓ (repitió hasta el tope) |
| 1 S 20:39 | Putnam 3.2.2a(4) | contraste | ✓ | fondo ✗ |
| Jue 13:9 | A&C 4.3.3e | circunstancial | ✓ | — |
| Gn 18:1 | A&C 5.2.11 | circunstancial | rechazado por OpenAI | — |
| 2 R 8:7 | A&C 5.2.11 | circunstancial | ✓ (repitió hasta el tope) | — |
| Gn 24:56 | A&C 5.2.11 | circ./causal | rechazado por OpenAI | — |
| Gn 18:18 | A&C 5.2.11 | circ./causal | fondo ✗ (la causa está en 18:17) | — |
| Gn 18:27 | A&C 5.2.12 | concesiva | sin valor; traduce «aunque» | sin valor; traduce «aunque» |
| 1 S 3:1 | Putnam 3.2.2a(1) | apertura/fondo | ✓ | — |
| Gn 22:1 | Putnam 3.2.2a(1) | apertura/fondo | ✓ | — |
| 1 S 3:7 | Putnam 3.2.2a(2) | fondo/causal | ✓ | — |
| 1 S 3:19 | Putnam 3.2.2a(2) | fondo/circ. | ✓ | — |
| 2 S 6:23 | Putnam 3.2.2a(3) | cierre/fondo | contraste ✗ | — |
| Mal 2:14 | reserva | concesiva/circ. | — | ✓ concesiva |
| Jue 16:15 | reserva | concesiva/circ. | — | contraste ✗ (traduce «si no») |
| Rut 2:13 | profesor (en muestra) | concesiva | contraste ✗ | ✓ |

Lectura (medido):
- **Cuando elige, acierta 14 de 18** (78 %). Los cuatro fallos: dos piden el versículo vecino (Gn 18:18, 2 S 6:23) y dos son de criterio (1 S 20:39, Jue 16:15), y en esos la traducción quedó bien.
- **Plantilla:** decía `"resolved": "ground | content"` → arreglado (`890ea396`). Aun así Gn 18:27 omite el valor dos veces; el campo opcional se salta.
- **Repetición:** 7 de 22 respuestas repiten el JSON; 5 llegan a 32.768 fichas (`incomplete`) → producción paga y cae a Gemini; una salió rota. Es el 23 % de las llamadas.
- **Rechazo de OpenAI:** intermitente. Rechazó Rut 1:14 dos veces, Gn 18:1 y Gn 24:56 una vez; los tres pasaron 9 de 9 reintentos con el mismo texto, con el anterior y con los parámetros de producción. La moderación gratuita no marca el prompt entero. No lo causa el texto; producción lo cubre con Gemini.
- **Límite del prompt:** no trae los versículos vecinos; apertura, cierre y el contraste con lo anterior dependen de ellos.
- **«Estructura»:** en 2 S 6:23 corta el tema antepuesto (וּלְמִיכַל בַּת שָׁאוּל) en fila propia (anotado).

**G0 + vecinos (2026-11-12), decididos por el fundador («1 y luego 2»):**
- `aa029ac7` Esquema estricto. Con esquema: **19 de 19 respuestas completas**, cero repeticiones, cero valores omitidos, ningún rechazo de OpenAI (antes: 7 de 22 repetidas, 5 al tope). Acierto de la waw 15 de 19. El respaldo Gemini (2.5-flash) acepta el esquema y elige concesiva en Gn 18:27. Validado contra 21 respuestas reales: la forma es la de hoy salvo `null` en lugar de clave ausente (la web compara por verdadero o falso). Primera corrida: la raíz en `null` subió en nombres propios y en אִישׁ, אֱלֹהִים; con descripción en el esquema, todos los sustantivos y nombres propios la llevan y el `null` queda en partículas.
- `0641d6f8` Versículo anterior y siguiente como contexto. Waw: 14 de 19 con vecinos, 15 de 19 sin ellos; **sin mejora medible** (2 R 8:7, Jue 16:15 y Rut 2:13 cambian de una corrida a otra aun sin vecinos). Las explicaciones nombran el contexto (1 S 3:1 → «apertura de escena»). Costo: ~900 fichas de entrada. Commit aparte para poder quitarlo.
- Fallos que quedan, de criterio entre valores vecinos: fondo frente a circunstancial (2 R 8:7), contraste frente a cierre (2 S 6:23) o concesiva (Jue 16:15, Rut 2:13 según la corrida), fondo frente a causal (Gn 18:18).
- Despliegue: sólo web. El proxy y `esquemaEstricto` ya están en producción.

**U4 (2026-11-12), `5489fcf4`:** el artículo hebreo y el rol de MACULA, como DATOS de la ficha (al mostrar, sin re-análisis).
- Artículo: «X ya se nombró en el v. N; el artículo puede retomarlo» (Putnam §1.4.3a), hasta cinco versículos atrás. Medido a mano sobre el AT: 18/25 en el mismo versículo, 20/24 a uno, 22/24 a dos y 15/24 a tres. No llega al nivel de «Regla» (en griego se exigió 25/25): los fallos son de sentido. Se descarta por forma: arameo, únicos, tiempo, כֹּל, direcciones, ordinal detrás, distributivo y título tras nombre propio. Resultado: 7.901 sustantivos con antecedente.
- Rol: el bloque de función muestra el rol de MACULA y avisa si el asistente lo contradice (Rut 3:6: «objeto directo» contra adv). Con el prompt actual hubo 0 choques en 19 análisis; sirve para lo guardado antes.
- Putnam entra al registro de fuentes, citado por sección.

**U5 (2026-11-12), `2685e20c`:** la función del verbo finito hebreo (A&C cap. 3), con el cohortativo por función; prompt hebreo v5.
- Cada verbo finito lleva la lista de su forma; al yiqtol de 1.ª persona se le suman las funciones del cohortativo (Putnam §2.2.4a). אַל + yusivo da prohibición por regla (15/15). El asistente elige sólo de esa lista.
- Banco (valor tomado del libro): 7/14 con rótulos de una palabra; 24/30 con las definiciones de A&C y la lista cerrada (desarrollo 11/14, validación 13/16). Cohortativos y yiqtol de 1.ª persona: 9/9, con Éx 4:12 en «futuro» como control. Waw con la sección nueva: 5/6.
- Errores que quedan, de criterio entre categorías vecinas: proverbial o estado, obligación o habitual, mandato o futuro, y performativo, futuro retórico y progresivo, que cambian de una corrida a otra.
- La ficha sólo muestra el bloque si hay función elegida; un v4 avisa «anterior a la función de cada verbo».
- El rol de MACULA se rotula «Función en la oración (según el análisis sintáctico del texto)» y dice de dónde sale.

**Pistas del griego (2026-11-12), `03e30d67`, prompt griego v15:**
- Artículo que retoma algo del párrafo (2 a 5 versículos atrás): pista, no regla. Son 1.489 en el NT; una muestra dio 11 de 15 anáforas reales.
- Perfecto en la apódosis de 1.ª clase: pista. Hay 14 en el NT: 4 prolépticos o gnómicos y 10 intensivos o extensivos.
- La regla de anáfora mira también el ordinal detrás del sustantivo si concuerda con él (Ap 2:11 y 20:14 «la muerte segunda» ya no se toman como anáfora). Pasa de 1.932 a 1.930.
- Banco: 10 de 11 con pistas contra 5 de 10 sin ellas. Stg 2:17, 2:20 y 2:11 quedan como pidió el profesor; 1 Co 15:13 sigue intensivo. Ap 21:8 lo elige anafórico el asistente por su cuenta, sin pista: es variación del modelo.
- El griego no tiene el problema de repetición del hebreo: 3 caídas a Gemini en 30 días, ninguna por tope de fichas.

**Hallazgos de producción, anteriores a esta fase:**
- gpt-6-luna repite el JSON hasta el tope de tokens (1:21: 32.768 de salida; banco: 5 de 22); el servidor lo toma por «incompleta» y cae a Gemini en silencio, así que se paga dos veces. La raíz es el esquema estricto (pendiente G0): el proxy ya acepta `responseSchema` y `OpenAiLlmClient` lo manda como `json_schema` estricto.
- El rechazo de OpenAI es intermitente (ver arriba); producción cae a Gemini en silencio.

**Antes del PR:** recorrido en el navegador con los versículos del profesor (Rut 2:1, 3:3, 3:6; Stg 2:10, 2:11, 2:13, 2:14, 2:17) y la revisión adversarial.

**Lo que hay que cuidar para no romper.**
- Cachés globales. `greek_insight_cache` usa `promptVersion` y `hebrew_analysis_cache/<Ref>_v2` guarda las traducciones del usuario en `userTranslations`. Subir la versión muestra «anterior» a todos los usuarios; no se borra nada.
- Invariante del corpus en CI: cada palabra del versículo, exactamente una vez. Alineación por identificador y no por posición: la regeneración de datos (U3, U10, U11) pasa por `build.mjs`, que falla si algo no calza.
- Cada regla nueva o cambiada: prueba con el versículo del profesor, prueba que exige que la regla se cumpla en el corpus, y mutación (se rompe una vez a propósito).
- `bancoDelProfesor.test.ts` suma Stg 2:10–2:20, 3:1, 3:5 y Rut 1:21–3:6.
- Las fuentes nuevas (A&C cap. 3–4, Wallace del partitivo, del proléptico y de la 3.ª clase, Putnam) entran al registro `ruleSources` como «sin verificar» hasta cotejarlas con el ejemplar (R0).
- **Putnam** (la obra que usa el profesor): Putnam, Frederick C. *Clave Putnam: La Biblia hebrea*. Ridley Park, PA: Stylus Publishing, 1996. Es la fuente principal de U2 (valores de la cláusula disyuntiva) y se cita junto a A&C 4.3.3 y 5.2.11. Para pasar de «sin verificar» hace falta el ejemplar.

---

## 5. Respuestas del fundador (2026-11-11) y lo que queda abierto

**Respondido:**
1. **p. 6:** el tooltip debe mostrar, además, la raíz con su transliteración → U12.
2. **p. 7 abajo (Rut 3:3) y p. 19:** «no identificamos 3 masculino plural» → U13. En el texto no hay 3mp: falta confirmar la palabra (probablemente el sufijo 3ms de כַּלֹּתוֹ).
3. **Putnam:** *Clave Putnam: La Biblia hebrea* (1996).
4. **Entrega:** un solo PR con commits separados.

**Abierto:**
- **Putnam y Wallace:** ¿hay ejemplar para cotejar? En Wallace: las páginas del proléptico (Stg 2:10), del anafórico (Stg 2:14) y de la 3.ª clase.
- **Rut 2:7:** ¿literal «en» y una nota con las dos lecturas (recomendado), o adoptar la del profesor?
