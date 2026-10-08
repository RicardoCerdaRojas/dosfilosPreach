# Fase: mejoras de los módulos de idioma · octubre 2026

**Qué es.** Son los comentarios del fundador y de su profesor sobre los tutores de idioma. Primero llegó el de **hebreo** (Rut 1, 2026-10-07). Después viene el de **griego**, que se agrega a esta misma fase. La bitácora con cada hallazgo está en la memoria `project_modulo_hebreo_comentarios`.

**Cómo se entrega.**
- Un solo PR con un commit por unidad, en la rama `feat/mejoras-modulos-idioma`.
- Antes de cada commit:
  - pruebas en local;
  - pasos de «Lint and Type Check» de CI (`./scripts/check-web-types.sh` incluido);
  - cada prueba nueva se rompe una vez a propósito;
  - revisión adversarial antes del PR.

**Restricciones del tutor de hebreo (leídas en el código).**
- El análisis lo hace **Luna sin razonamiento** (`hebrewTutor.analyzeVerse`), con JSON libre: sin esquema estricto y sin validación más allá de `words`.
- La caché `hebrew_analysis_cache/<Ref>_v2` es **global** y guarda las traducciones que corrigen los usuarios. Por eso no se sube la versión de la clave (#726).
- Lo determinista (las letras, y ahora OSHB) se aplica **al leer**. Así corrige también lo ya guardado.
- «Re-analizar» reescribe el documento entero y se pierde la traducción corregida.

---

## Hebreo

### H1. Formas ambiguas: OSHB decide la morfología (#1, #3)

**Lo que se vio.**
- Rut 1:13 תֵּעָגֵנָה salió 3FP; correcto **2FP**. OSHB dice `HVNi2fp`.
- Rut 1:16 אַל־תִּפְגְּעִי salió «Imperfecto»; correcto **yusivo**. OSHB dice `HVqj2fs`.
- En los dos casos la forma no decide sola: decide el contexto o la partícula. OSHB ya lo había decidido, y el prompt le dice al asistente que OSHB «NO es autoridad».

**Arreglo.**
- **Dominio:**
  - un lector estructurado del código OSHB de verbo (tallo, forma, persona, género, número);
  - una comparación por palabra que llena `oshbReference` (`agreesWithAnalysis`);
  - donde difieren el P-G-N o la forma, corrige con OSHB y lo deja dicho.
- **Al leer:** el alineado de letras devuelve también el token de OSHB, y la comparación corre sobre la caché.
- **Prompt:**
  - OSHB pasa a ser autoridad para persona, género, número y forma (`i`/`j`/`h`/`w`/`q`);
  - regla de אַל + prefijo = yusivo y de לֹא + prefijo = imperfecto;
  - la traducción sigue a la persona.
- **Interfaz:** etiquetas «Yusivo», «Cohortativo» y «Weqatal»; la insignia OSHB por fin con datos.
- **Límite:** en lo ya guardado, la traducción del versículo no se rehace sola. La insignia avisa que la persona cambió.

### H2. Capa de cláusulas (#2, #4)

**Lo que se vio.**
- Rut 1:14 וְרוּת: waw + no verbo = cláusula **disyuntiva/contrastiva** («pero Rut»). El tutor la tomó como «y» copulativa.
- Rut 1:16 עַמֵּךְ עַמִּי: cláusula **asindética** sin identificar, y la ו de וֵאלֹהַיִךְ leída como coordinación del tópico.
- El análisis es sólo por palabra. Ninguna regla ni fragmento de Farfán trata la disyuntiva ni el asíndeton.

**Arreglo.**
- **Esquema:** una lista `clauses` en el versículo. Cada cláusula lleva:
  - qué palabras abarca;
  - tipo: verbal o nominal;
  - conexión: cadena de wayyiqtol, waw conjuntiva, waw disyuntiva, asíndeton o subordinada (כִּי, אֲשֶׁר…);
  - valor: contraste, circunstancia, causa, clímax…
- **Conocimiento:** regla y fragmento de Farfán sobre waw + no verbo y sobre el asíndeton.
- **Comprobación en el código:** una cláusula que no empieza con conjunción es asindética; una que empieza con waw + no verbo es disyuntiva.
- **Interfaz:** una sección «Cláusulas».
- **Lo ya guardado:** no trae cláusulas hasta que se re-analiza.

### H3. Valor volitivo y fórmulas de juramento (#5)

**Lo que se vio.** En Rut 1:17, כֹּה יַעֲשֶׂה יְהוָה לִי salió con valor «futuro, él hará». Correcto: valor **volitivo**, «así me haga YHWH».
- OSHB dice imperfecto (`HVqi3ms`), y es coherente: el yusivo III-he sería apocopado.
- Lo volitivo es la **función**, no la forma.

**Arreglo.**
- Regla de fórmulas de juramento (כֹּה יַעֲשֶׂה… וְכֹה יֹסִיף, חַי־יְהוָה, אִם / אִם־לֹא de juramento).
- El valor de un yiqtol puede ser volitivo aunque la forma sea imperfecto.
- La traducción sigue al valor.
- **A confirmar con el profesor:** si el curso etiqueta esto «yusivo» por función. Mientras tanto: forma «Imperfecto», valor «volitivo».

### Revisión adversarial del hebreo (2026-10-07)

Se corrigieron los hallazgos 1 a 7, 9 y 10:
- **Lo más serio:** la caché guardaba el análisis YA corregido, así que desde la segunda lectura la corrección de OSHB y el aviso de la traducción desaparecían. Ahora se guarda lo que dio el asistente y las reglas se aplican siempre al mostrar.
- Un weqatal ya no sale «cadena de wayyiqtol».
- וְלֹא + verbo ya no es disyuntiva.
- La fórmula de juramento no tapa el error del asistente cuando OSHB ya decía yusivo.
- La insignia OSHB aparece sólo en verbos.
- Cada fila de la tabla de verbos va con su palabra.
- El arameo no usa los tallos hebreos.
- La waw con ḥireq o segol se reconoce.
- Las cláusulas solapadas se descartan.
- Faltaban textos en inglés.

**Límite aceptado (#8):** cuando el asistente devuelve tantas palabras como tokens tiene OSHB, se alinean por posición sin comparar consonantes. Si el asistente juntó dos palabras y partió otra, OSHB corregiría la palabra equivocada. Viene de #726, donde la posición sana las letras; se revisa si aparece un caso real.

### Ajustes del hebreo para el próximo PR (prueba del fundador en producción, 2026-10-07)

- **H6, aviso de textos anteriores a la corrección.**
  - **Lo que se vio:** en Rut 1:13 תְּשַׂבֵּרְנָה, OSHB corrigió QAL → PIEL y 3 → 2. El tallo es correcto: la forma muestra preformativo con shewa, pataḥ en la 1.ª radical y dagesh en la 2.ª. Pero la traducción «esperarían», el valor y las pistas siguen siendo los del asistente.
  - **Arreglo:** el aviso nombra todos los textos anteriores a la corrección (traducción de la palabra, explicación, pistas y traducción LITERAL del versículo), no sólo «la traducción guardada». Y marca el bloque de la literal cuando el versículo tiene correcciones.
- **H7, la fórmula de juramento traducida en el código.**
  - **Lo que se vio:** en Rut 1:17 la etiqueta quedó «Yusivo, volitivo», pero la ficha dice «él hará» y la literal «así hará… y así él añadirá». La fluida ya decía bien «Que así me haga… y así me añada».
  - **Arreglo:** en la fórmula, el significado se sabe con certeza. יַעֲשֶׂה → «haga» e יֹסִיף → «añada», o «hagan / añadan» con sujeto plural (1 R 19:2). Se fija en el código la traducción de esas dos palabras.

### Pendientes de confirmar con el profesor (no se tocan todavía)
- Rut 1:14 וְרוּת: «Raíz: רות» para un nombre propio.
- La וּ descrita como «componente» del nombre cuando es mater lectionis (vocal *ū*).

---

## Principio de la fase (pedido del profesor, 2026-10-07)

Los análisis consideran **SIEMPRE la función** de los verbos, las partículas, los participios y toda palabra que ayude a entender la **intención del autor**, además de las cláusulas. Esto vale para el hebreo y para el griego.

**Cómo se aplica.**
- **Listas cerradas de funciones**, como la de caso, en lugar de texto libre.
- **Datos deterministas** (OSHB, MorphGNT, MACULA) antes que lo que decida el asistente.
- **Pendiente en hebreo (H4, segundo PR):** la función de participios (predicativo, atributivo, sustantivado), infinitivos (constructo de propósito o temporal con בְּ/כְּ; absoluto enfático o imperativo) y partículas discursivas (הִנֵּה, כִּי, אַךְ, רַק, גַּם, לָכֵן, עַתָּה). Hoy sólo hay texto libre en `syntacticFunction`.

## Griego (segundo PR de esta fase)

**El pedido.** El profesor del fundador quiere lo mismo que en hebreo: la función de los términos importantes y el análisis de cláusulas. La exégesis más útil es la que establece la función de palabras, verbos y cláusulas. **Taxonomía: Wallace**, *Greek Grammar Beyond the Basics*; decisión del fundador del 2026-10-07.

**Lo que ya hay (leído en el código).**
- La morfología sale de MorphGNT, sin pasar por el asistente.
- Función de caso cerrada según Wallace (`caseFunctionTaxonomy.ts`).
- Uso del artículo y función discursiva de partículas (Runge).
- Ruta `greekTutor.analyzeVerse` → Luna sin razonamiento.
- Caché global `greek_insight_cache`, con `promptVersion` (hoy 10). Una versión vieja ofrece «Ampliar análisis».

**Lo que falta.**
- Cláusulas: hoy sólo hay texto libre en `syntacticFunction`.
- Función de verbos: participios, infinitivos, usos de modo.
- Funciones de caso que faltan: dativo de agencia, genitivo absoluto, genitivo de contenido.
- La palabra «Clave» se elige comparando texto, no por índice.

**Fuente determinista: MACULA Greek** (Clear Bible, CC BY 4.0, edición SBLGNT; `cdn.jsdelivr.net/gh/Clear-Bible/macula-greek@main/SBLGNT/lowfat/`).
- Trae árboles sintácticos con la cláusula y su estructura (`class="cl"`, `rule="S-V-O"`, `Conj-CL`), el rol de cada palabra (`role` s/v/o/io/adv/p), roles semánticos (`frame`) y referentes.
- Medido en Santiago 2:6: δέ = conjunción; ὑμεῖς = s; ἠτιμάσατε = v; τὸν πτωχόν = o.
- Tamaño: cartas de 0,2 a 5,7 MB (Santiago 1,3); evangelios y Hechos de 9 a 17 MB, que habrá que preprocesar.
- Exige atribución, como MorphGNT.

**Orden de construcción (decisión del fundador, 2026-10-07):** G0 → G1 + G5 → G2 → G3 → G4, con H5, H6 y H7 del hebreo donde toquen.

**Por qué G0 primero (medido el 2026-10-07).**
- 8 de los 11 comentarios del profesor se podían decidir con datos (OSHB, MorphGNT, MACULA), y en ellos el asistente falló. Así que el enfoque dato → regla → asistente está respaldado.
- Lo que no escala hoy:
  - los datos se descargan en el navegador desde GitHub en `@master`, sin versión fijada, y MACULA pesa hasta 16,7 MB por libro;
  - la caché del hebreo mezcla las ediciones del usuario con lo generado;
  - la respuesta del asistente crece sin esquema estricto;
  - no hay un banco de verificación lingüística.
- MorphGNT ↔ MACULA en Santiago: 1.739 = 1.739 palabras, y **por identificador coinciden las 1.739**. MACULA ordena las palabras según el árbol, así que **por posición, 204 caen mal**. Se alinea siempre por identificador.

**Unidades.**
- **G0. Cimientos.**
  - **Preprocesamiento:** a partir de versiones fijadas (commit de MorphGNT, MACULA Greek/Hebrew y morphhb), generar archivos por capítulo, alineados por identificador y servidos por nosotros. Medido en Santiago: 10-15 KB por capítulo con palabra, rol y clase.
  - **Un solo modelo de cláusula** en el dominio, para hebreo y griego (reemplaza al `VerseClause` de H2 y al del tutor viejo).
  - **Banco de regresión** con los casos del profesor (Rut 1:13-17, Stg 2:6-9): las reglas se comprueban en CI y el asistente en una corrida periódica.
  - **Caché del hebreo:** las ediciones del usuario guardadas aparte, y el análisis versionado como en el griego. Así «Re-analizar» deja de borrar lo corregido.
  - **Esquema estricto** para la respuesta del asistente: se hace en G1/H5, cuando el esquema cambia (estructura desde MACULA; el asistente sólo interpreta).
  - **Licencias:** MorphGNT es CC BY-SA; revisar antes de redistribuir derivados. MACULA y OSHB son CC BY 4.0.
  - **Medido, MACULA Hebrew ↔ OSHB (Rut 1):**
    - MACULA viene por capítulo (932 archivos, 423 MB) y parte la palabra en morfemas, pero cada pieza trae `ref` (versículo + número de palabra) y el código de OSHB.
    - Agrupadas por `ref`, calzan **325 de 326** palabras en texto y en código. La que no calza es el *ketiv* de 1:8, que el lector ya descarta desde #726.
    - Se alinea por `ref`, nunca por posición.
  - **Hecho en G0 (2026-10-07):**
    - **`scripts/language-structure/build.mjs`:**
      - fija las cuatro fuentes por commit y guarda las descargas en una caché fuera del repo;
      - alinea el griego por identificador y el hebreo por versículo + número de palabra, contando el qere (MACULA numera ketiv y qere por separado; sin el qere, Rut 1:8 se corría una posición);
      - verifica y falla si algo no calza;
      - escribe `packages/web/public/language-data/v1/{gr,he}/<libro>/<cap>.json` y un `manifest.json` con licencias y atribución.
      - Medido: Santiago 1.739/1.739 y Rut 1.306/1.306 (11 ketiv marcados).
    - **Dominio `language-structure/`:** `ChapterStructure` (un solo modelo para los dos idiomas), `verseWords` y `clausesOfVerse` (profundidad y orden del texto).
    - **`HostedLanguageStructureProvider`:** lee del sitio, con caché y sin repetir pedidos en curso.
    - **Banco de regresión** (`bancoDelProfesor.test.ts`): los casos del profesor fijados sobre los datos generados (Stg 2:7-9, Rut 1:8-17).
    - **Caché del hebreo:** la traducción del usuario va en `userTranslations` y un análisis nuevo reemplaza sólo lo generado (`mergeFields`). Además, `promptVersion` (2).
    - **Licencias verificadas:** el texto SBLGNT es CC BY 4.0; la morfología de MorphGNT, CC BY-SA 3.0 (sólo afecta a los archivos `gr/`).
  - **Revisión adversarial de G0, corregido:**
    - **Juan, 1 y 2 Corintios no se escribían.**
      - MACULA trae la perícopa de la adúltera (Jn 7:53-8:11), que SBLGNT omite, y alinear el libro entero corría todo lo que sigue. Ahora se alinea versículo por versículo.
      - Las marcas del aparato de MorphGNT («⸀1ἄλλῳ») daban falsas diferencias. Ahora se quitan, también del texto que se guarda.
    - **Hebreo, palabras perdidas.** Se perdía toda palabra con letra grande o pequeña (`<seg>`), incluidas las dos palabras extremas del Shemá (Dt 6:4), y el resto del versículo quedaba corrido. Encima, se escribían libros con diferencias.
      - Ahora la palabra se lee entera.
      - Se comparan código Y consonantes, y toda palabra de MACULA tiene que quedar usada.
      - Un libro con diferencias no se escribe.
    - **El sitio devuelve HTML con 200 para lo que no existe.** El proveedor lo toma como «no existe», y el manifiesto lleva los capítulos por libro.
    - **Cláusulas:**
      - se conservan las coordinaciones sin palabras propias, para que sus hijas no pierdan el anidamiento;
      - las palabras van en el orden del texto, no del árbol;
      - una relativa dentro de una frase nominal no hereda su rol;
      - los roles de error de MACULA se descartan.
    - **«Re-analizar»** devolvía la traducción del asistente hasta recargar. Ahora relee lo guardado, con la del usuario encima.
    - Al regenerar, cada libro se limpia antes de escribirse, y una corrida parcial no reescribe el manifiesto.
    - El script se movió a `scripts/language-structure/` con sus pruebas, y corre en `test:unit`.
  - **Queda anotado (no se arregla en G0):** como la caché del hebreo es global, una vez que alguien corrige la traducción de un versículo, la que genere un re-análisis ya no se ve para nadie. Hace falta una forma de ver o quitar la corrección.
- **G1. Cláusulas desde MACULA.**
  - Del dato: límites, roles y conector.
  - Del asistente: tipo de dependiente (ἵνα, ὅτι, relativa, participial, genitivo absoluto, infinitival), conexión según Runge (καί, δέ, γάρ, οὖν, ἀλλά, asíndeton), valor y explicación.
  - Sección «Cláusulas» como en hebreo.
  - **Hecho en G1 + G5 (2026-10-07), la parte del dato y las reglas (sin asistente):**
    - **`verseStructure`** (dominio): las filas de la vista «Estructura» para griego y hebreo, cada una con su conector, su relación, la clase de la condicional, la apódosis, si es nominal y lo antepuesto al verbo.
    - **Envoltorios de MACULA.** MACULA envuelve muchas cláusulas en otra que sólo trae la partícula (οὐκ), el artículo (τὸ ἐπικληθέν), la conjunción (Εἰ, la καί entre dos coordinadas) o la waw separada de su verbo. Se funden en la hija donde sigue el texto. No se funden si madre e hija traen cada una su conector («Εἰ δέ…»: la fila de δέ queda arriba y la condicional debajo).
    - **Griego:**
      - la clase de la condicional se mira en todo el subárbol (en Stg 1:5 el verbo está en una cláusula hija de la de Εἰ);
      - las pospositivas (δέ, γάρ, οὖν) abren su fila antes de la palabra que las precede;
      - el καί adverbial («εἰ καὶ πάσχοιτε», «aun si») no es conector ni cuenta como antepuesto;
      - la negación tampoco cuenta como antepuesta.
    - **Hebreo:**
      - אִם, כִּי, לְמַעַן, פֶּן y לָכֵן se miran antes que la waw, porque OSHB los marca «C» igual que a ella (antes de esto, en todo el AT salían 2 condicionales; ahora salen 897);
      - כִּי אִם = «sino / excepto»;
      - la conjunción que no quedó en ninguna cláusula (כִּי en Rut 1:16) es el conector de la que sigue;
      - אֲשֶׁר en la madre marca como relativa a la hija, no a la madre;
      - una cláusula es infinitival sólo si su verbo es infinitivo, y el discurso directo pasa del envoltorio a su cláusula (Rut 2:8 הֲלוֹא).
    - **Apódosis:** la madre de la prótasis; si esa madre no tiene palabras propias (Rut 3:13), sus otras hijas. Sigue el árbol de MACULA: en Rut 3:13 «חַי יְהוָה» queda dentro de la apódosis porque MACULA la coordina ahí.
    - **Medido en todo el corpus:** 7.927 versículos griegos y 23.213 hebreos, sin errores, y cada palabra del versículo aparece exactamente una vez (prueba en CI sobre todo el corpus, ~7 s).
    - **Vista web compartida** (`components/language-structure/`): sangría por nivel, rol bajo cada palabra (S, V, O…), conector punteado, lo antepuesto resaltado, «Prótasis · 1.ª clase» y «Apódosis», y una nota de la regla. En griego, tocar una palabra la marca en las tarjetas. En hebreo, la sección va antes de «Cláusulas» (la lectura del asistente), con la referencia del versículo YA analizado.
    - **Pruebas:** 21 de dominio sobre datos reales (Stg 1:5, 2:7, 2:9; Jn 3:16, 11:21; 1 Jn 1:9, 3:22; 1 P 3:14; Mc 15:44; Mt 12:4; Ef 1:4, 1:7; Ro 8:28; 1 Co 11:19, 16:13; Rut 1:14-17, 2:8, 3:13, 3:18; Gn 1:2; Sal 1:2; 1 R 1:30, 14:10; Is 6:8), la invariante sobre todo el corpus, 13 de la vista (más una por cada relación con nombre en es/en) y 2 del hook del hebreo. Cada regla se rompió una vez y alguna prueba falló; sólo sobrevive una guarda defensiva (la palabra anterior tiene que ser del mismo versículo), que ningún caso del corpus activa.
    - **Revisión adversarial de G1 + G5, corregido:**
      - **Hebreo: la sección no salía nunca con un análisis de la caché** (el camino más común): la referencia venía de `hebrewVerse`, que ese camino no llena. Además, una respuesta tardía de una navegación anterior podía dejar la estructura de un versículo junto al análisis de otro. Ahora el hook guarda el versículo junto con el análisis y descarta lo que llega tarde.
      - **Hebreo: lo antepuesto se perdía cuando la waw va pegada** («וְהָאָרֶץ הָיְתָה», Gn 1:2): 3.497 de 6.001 cláusulas disyuntivas no lo mostraban.
      - **Griego: εἰ interrogativo como condición** (Mc 15:44, Hch 19:2; MACULA lo marca `PtclCL`): ahora es «Pregunta». «ὃ ἐάν» es relativo indefinido, y «εἰ μή» sin verbo es «Excepción».
      - **Griego: conector tomado de una palabra con rol** (1 Co 11:19 «ἵνα καὶ οἱ δόκιμοι» salía «Adición»): el conector va sin rol; el relativo puede ir tras una preposición (Ef 1:7 «ἐν ᾧ»).
      - **Participios e infinitivos copulativos** (Ro 8:28 «οὖσιν», Ef 1:4 «εἶναι») salían como principales.
      - **Palabras fuera de toda cláusula** (213 griegas, 740 hebreas; 1 Co 16:13 perdía 3 de sus 4 imperativos; לָכֵן, עַל כֵּן): un tramo sin verbo antes de una cláusula se le une como conector; si no, va en su propia fila, un verbo por fila.
      - **Hebreo: «inferencia» casi siempre mal** (140 de 142 eran כֵּן «así»): ahora sólo לָכֵן y עַל כֵּן.
      - **Palabras repetidas** (15 versículos, Is 6:8) y **del versículo anterior** (Esd 4:11): cada palabra se muestra una vez, en la cláusula más profunda.
      - Inglés «1 class» → «1st class»; la palabra marcada en griego se limpia al cambiar de versículo.
      - **Queda como está:** 2.820 filas griegas que son sólo el conector (δέ, γάρ, ὅτι con la cláusula debajo); es a propósito. En Gn 49:15 queda una fila con sólo «כִּי», por cómo agrupa MACULA.
    - **Lectura del asistente dentro de «Estructura»** (opción «b» del fundador, 2026-10-08; incluye H5):
      - el análisis de cada idioma (`greekTutor.analyzeVerse` v11, `hebrewTutor.analyzeVerse` v3) recibe las filas numeradas y devuelve, por fila, valor y explicación; la relación donde el dato la deja abierta (ἵνα: propósito/resultado; ὅτι/כִּי: causa/contenido) y foco/marco de lo antepuesto;
      - el código valida contra las filas: número inexistente o repetido, elección donde no hay ambigüedad o foco donde nada va antepuesto, se descartan; cada lectura queda anclada a la primera palabra de su fila;
      - en pantalla, lo del asistente va marcado «Asistente»; lo demás sale del texto. La ficha de la palabra dice foco o marco cuando el asistente lo leyó;
      - el hebreo deja de partir el versículo en «Cláusulas» (H2): con estructura, el prompt pide leer las filas. «Cláusulas» queda sólo en el modo descubrimiento;
      - un análisis anterior (griego v10, hebreo v2) avisa en «Estructura» y ofrece re-analizar; la traducción corregida por el usuario se conserva.
      - Sin función nueva ni despliegue del servidor: los prompts se arman en el cliente.
      - **Revisión adversarial de la lectura, corregido:**
        - en griego, un análisis generado antes de que llegaran las filas quedaba v11 sin lectura y sin aviso: ahora «Generar» espera las filas y un v11 sin lectura avisa y ofrece re-analizar;
        - en hebreo, un análisis sin filas (datos que no se pudieron leer) se marcaba v3 y el aviso decía «anterior a la lectura»: ahora se marca v2; y un v3 sin lectura tiene su propio aviso. Mientras no se re-analice, se muestran las cláusulas que el asistente sí partió;
        - al navegar en hebreo ya no parpadea el análisis anterior con la referencia nueva; un análisis griego que llega después de navegar se guarda pero no se pone en el versículo nuevo; el selector griego espera el índice del libro nuevo.
    - **Ajustes por la revisión del fundador en local (2026-10-08):** leyenda con las marcas reales; las palabras de «Estructura» con la capa de color y la ficha (tooltip) de la página; en hebreo tocar una palabra baja a su tarjeta; la sangría hebrea va a la derecha; sólo cuenta como antepuesto lo que va antes de un verbo FINITO (el saludo de Stg 1:1 no marca nada); el versículo fijo del hebreo queda apagado por defecto con un botón; selectores de libro/capítulo/versículo compartidos (`VersePicker`) en los dos módulos; y los componentes base (`ui/select`, `dropdown-menu`, `popover`, `tooltip`) usaban sintaxis de Tailwind 4 que el 3.4 ignora — ninguna lista tenía altura máxima.
    - **Pendiente:** el buscador «Ir a versículo…» en griego; el error intermitente `max_output_tokens` del análisis hebreo (Rut 3:13), en functions.
- **G2. Función de verbos (Wallace), lista cerrada como la de casos.**
  - Participio: adjetival, sustantival y adverbial (temporal, medio, manera, causa, condición, concesión, propósito, resultado, circunstancia concomitante); perifrástico, genitivo absoluto, redundante.
  - Infinitivo: propósito, resultado, tiempo, causa, medio, sujeto, objeto, discurso indirecto, epexegético.
  - Modos: subjuntivo hortativo, deliberativo, de prohibición, tras ἵνα/ὅπως; imperativo; optativo volitivo.
  - Uso del tiempo: aoristo constativo, ingresivo, culminativo, gnómico; presente progresivo, iterativo, gnómico.
- **#G5, tipo de agencia (profesor, Stg 2:9 ἐλεγχόμενοι ὑπὸ τοῦ νόμου).** El tutor dice «agente de la pasiva», bien, pero sin el tipo.
  - **Regla en el código (Wallace, excurso de la agencia):** con verbo PASIVO (voz `P` en MorphGNT; ἐλεγχόμενοι = `-PPPNPM-`):
    - ὑπό / ἀπό / παρά + genitivo = **agente último** («agencia final»);
    - διά + genitivo = **agente intermedio**;
    - ἐν + dativo o dativo solo = **medio** (impersonal).
  - **Del asistente:** la nota de **personificación** cuando el agente último es impersonal; aquí, la ley como quien acusa.
  - **Interfaz:** el bloque «Preposición y su caso» agrega el tipo de agencia y la comparación con los otros dos.
- **#G6, artículo anafórico (profesor, Stg 2:9 τοῦ νόμου → νόμον βασιλικόν de 2:8).**
  - **Lo que se vio:** el tutor eligió «de lo conocido», aunque la lista ya tiene «anafórico», el prompt manda «REVISA PRIMERO SI ES ANAFÓRICO contra el versículo anterior» y el versículo anterior se le pasa. Medido en MorphGNT: 2:8 trae νόμον, lema νόμος.
  - **Regla en el código:** para cada artículo, su sustantivo es el que concuerda en caso, número y género (MACULA lo agrupa). Si el lema aparece antes (versículo anterior o antes en el mismo) → anafórico, con `antecedent` «νόμον, v. 8».
  - Se respeta lo que eligió el asistente cuando es monádico, por antonomasia o con nombre propio (ὁ θεός, ὁ Χριστός). Se corrige si eligió «de lo conocido», «genérico» o lo dejó vacío.
  - **Interfaz:** «Anafórico — retoma νόμον (2:8)».
- **G3. Funciones de caso:** completar la lista (dativo de agencia, genitivo absoluto, de contenido…) y marcar la «Clave» por índice.
- **Hallazgos del profesor en griego (Santiago 2:6-7, 2026-10-07):**
  - **#G1, pronombre enfático.** En 2:7 οὐκ αὐτοὶ βλασφημοῦσιν, el verbo ya marca «ellos» en su terminación (-ουσιν). El pronombre explícito es **enfático o contrastivo**: «¿no son ELLOS los que blasfeman?». Lo mismo en 2:6 ὑμεῖς δὲ ἠτιμάσατε. El tutor dijo «enfatizando», pero no explicó por qué.
    - **Regla en el código (G4):** pronombre personal en nominativo + verbo finito de la misma persona y número en la cláusula = enfático, con la explicación de la terminación.
  - **#G2, uso del tiempo.** βλασφημοῦσιν es un **presente habitual** (Wallace, *customary present*): «suelen blasfemar». El tutor sólo da «Tiempo: Presente».
    - **G2 lo cubre:** uso del tiempo de cada verbo, en una lista cerrada que se ve en la ficha.
- **G4. Partículas y palabras de intención:** ampliar la función discursiva (Runge), que hoy se aplica a algunas partículas, a toda partícula y conector, y a los adverbios y pronombres que marcan énfasis o foco.

- **G5 / H5. Estructura y subordinación** (pedido del profesor, 2026-10-07): ver la subordinación de cláusulas, la identificación de prótasis y apódosis, y la función de cláusulas, palabras y conectores.
  - **Vista «Estructura»** en *sentence flow* (Fee): las subordinadas sangradas bajo la cláusula que modifican, con el conector resaltado y la **relación lógica** a la vista.
  - **Relaciones:** lista cerrada de *arcing* (Fuller y Schreiner): condición (prótasis/apódosis), fundamento, inferencia, propósito, resultado, concesión, contraste, tiempo, serie…
  - **Condicionales:** la pareja prótasis ↔ apódosis. En griego, la clase se decide en el código desde MorphGNT (εἰ + indicativo = 1.ª; ἐάν + subjuntivo = 3.ª; …).
  - **Quién decide qué:** la jerarquía (qué cláusula contiene a cuál) sale de **MACULA**, Greek y Hebrew (CC BY 4.0). El asistente sólo elige la relación de la lista y la explica.
  - **ETCBC/BHSA no se usa:** es CC BY-NC (no comercial).
  - **#G3, condicional de 1.ª clase (profesor, Santiago 2:9 εἰ δὲ προσωπολημπτεῖτε).**
    - **Regla en el código desde MorphGNT:** εἰ/ἐάν + modo y tiempo del primer verbo finito de la prótasis + ἄν en la apódosis.
      - 1.ª clase: εἰ + indicativo.
      - 2.ª clase: εἰ + indicativo pasado, con ἄν en la apódosis.
      - 3.ª clase: ἐάν + subjuntivo.
      - 4.ª clase: εἰ + optativo.
      - Medido: προσωπολημπτεῖτε = `2PAI-P--` (presente indicativo) y no hay ἄν → 1.ª clase.
    - **Explicación que se muestra:** la 1.ª clase asume la verdad **para el argumento** (indicativo = modo de la realidad), no siempre en los hechos. Ej.: Mt 12:27 εἰ ἐγὼ ἐν Βεελζεβοὺλ…, primera clase y falsa. No se traduce siempre «ya que».
    - **Del asistente:** si en el contexto la condición es también verdadera en los hechos, con su razón (Stg 2:1-6: el favoritismo era real).
    - **Interfaz:** en la ficha de εἰ, «Condicional de 1.ª clase · εἰ + indicativo (…)»; en «Estructura», la pareja prótasis ↔ apódosis.
  - **#G4, orden marcado (profesor, Stg 2:9 ἁμαρτίαν ἐργάζεσθε).**
    - **Lo que se vio:** el objeto antes del verbo marca énfasis. Hoy sólo lo dice el bloque «El orden de las palabras», que es texto libre del asistente; la ficha de la palabra no lo menciona.
    - **Medido en MACULA:** la cláusula trae los roles en orden: ἁμαρτίαν = o → ἐργάζεσθε = v. También marca «εἰ προσωπολημπτεῖτε» como `sub-CL` adverbial (la prótasis) y ἐλεγχόμενοι como cláusula adverbial.
    - **Regla:** el código detecta lo que va ANTES del verbo, desde los roles de MACULA. El asistente elige su función según Runge: **foco/énfasis** («pecado es lo que cometen») o **marco/punto de partida** (fija el tema, como el ὑμεῖς contrastivo de 2:6 o una frase de tiempo inicial). No todo lo antepuesto es énfasis.
    - **Interfaz:** en «Estructura», cada cláusula con sus constituyentes en orden (O · V) y el adelantado resaltado; en la ficha, «Antepuesto al verbo → foco/marco».
  - Ya existe un modelo de cláusulas del tutor viejo (`greekTutor.analyzeSyntax`, `domain/src/greek-tutor/syntax-analysis.ts`), no conectado al analizador: se puede reaprovechar.

**Literatura.** Wallace es la columna de las taxonomías (cláusula y condicionales incluidas); Runge, los conectores; Levinsohn y Porter, apoyo. Hebreo: Arnold y Choi, Joüon-Muraoka, Waltke-O'Connor. Diagramado: Fee (*phrasing*), Schreiner (*arcing*), Kaiser (*block diagram*). Se codifican categorías, no se copia texto de los libros.

**Reforzar el hebreo después.** MACULA Hebrew (sobre WLC, los mismos tokens que OSHB) trae cláusulas: podría dar los límites de H2 en vez del asistente.
