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

### Pendientes de confirmar con el profesor (no se tocan todavía)
- Rut 1:14 וְרוּת: «Raíz: רות» para un nombre propio.
- La וּ descrita como «componente» del nombre cuando es mater lectionis (vocal *ū*).

---

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

**Unidades.**
- **G1. Cláusulas desde MACULA.**
  - Del dato: límites, roles y conector.
  - Del asistente: tipo de dependiente (ἵνα, ὅτι, relativa, participial, genitivo absoluto, infinitival), conexión según Runge (καί, δέ, γάρ, οὖν, ἀλλά, asíndeton), valor y explicación.
  - Sección «Cláusulas» como en hebreo.
- **G2. Función de verbos (Wallace), lista cerrada como la de casos.**
  - Participio: adjetival, sustantival y adverbial (temporal, medio, manera, causa, condición, concesión, propósito, resultado, circunstancia concomitante); perifrástico, genitivo absoluto, redundante.
  - Infinitivo: propósito, resultado, tiempo, causa, medio, sujeto, objeto, discurso indirecto, epexegético.
  - Modos: subjuntivo hortativo, deliberativo, de prohibición, tras ἵνα/ὅπως; imperativo; optativo volitivo.
  - Uso del tiempo: aoristo constativo, ingresivo, culminativo, gnómico; presente progresivo, iterativo, gnómico.
- **G3. Funciones de caso:** completar la lista (dativo de agencia, genitivo absoluto, de contenido…) y marcar la «Clave» por índice.

**Literatura.** Wallace es la columna de las taxonomías; Runge, los conectores; Levinsohn y Porter, apoyo. Se codifican categorías, no se copia texto de los libros.

**Reforzar el hebreo después.** MACULA Hebrew (sobre WLC, los mismos tokens que OSHB) trae cláusulas: podría dar los límites de H2 en vez del asistente.
