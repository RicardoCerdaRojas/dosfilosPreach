# Fase: reglas extraídas de las gramáticas · octubre 2026

**Qué es.** Un proceso para que las reglas de los tutores de griego y hebreo salgan de los libros del curso, queden **citadas con precisión** y lleguen a ser **decisiones validadas**:
- la regla tiene su fuente localizada (obra, edición, sección o §, página);
- está probada contra los ejemplos del propio autor y contra un conjunto de control;
- su precisión está medida sobre el corpus y aprobada por el profesor.

**Por qué.**
- **Lo construido hasta ahora** (G0–G4 en griego, H1–H3 en hebreo) decide en el código desde los datos (MorphGNT, MACULA, OSHB), y eso funciona.
- **El problema son las citas:** se escribieron de memoria. El nombre de sección que muestra la ficha («Wallace, «Ultimate Agent»») no está verificado contra el libro, y un alumno puede copiarlo en un trabajo.
- **Las reglas tampoco tienen una validación explícita:** se midieron sobre el corpus, pero nadie con autoridad las aprobó.

**El pedido del fundador (2026-10-09).** Incorporar los libros del curso al sistema de reglas, progresivamente, usando la biblioteca. Que las decisiones del sistema y del asistente pasen a ser decisiones validadas. Ser honestos con lo que todavía no lo es.

---

## 1. Principios

1. **El código decide desde los datos; el libro da el criterio.** El libro dice qué categorías existen y cómo se reconocen. Los datos (OSHB, MorphGNT, MACULA) dicen qué hay en el versículo. El asistente explica, o elige de una lista cerrada cuando el código no alcanza.
2. **Sólo decide lo validado.** Una regla que no pasó el control y la muestra del profesor puede acotar las opciones, pero no marca «Regla».
3. **Sólo se cita lo verificado.** Una sección o página sin verificar contra el ejemplar no se muestra como cita.
4. **El asistente nunca cita.** Las citas salen del registro del código, nunca del texto que genera el modelo.
5. **No se reproduce el texto de los libros.** Se codifican categorías y criterios con palabras propias. Las frases de anclaje sirven para verificar la ubicación y no se muestran a nadie.
6. **Lo medido se rotula como medido.** Toda afirmación de efecto lleva su número y de dónde salió.

---

## 2. Estados de una regla

| Estado | Qué significa | Qué hace en la app |
|---|---|---|
| **Propuesta** | Salió de leer una sección. Tiene criterio y ejemplos, sin comprobar. | Sólo informa al asistente (conocimiento). |
| **Anclada** | Su fuente está localizada: obra, edición, sección o §, página impresa, y una frase del libro encontrada automáticamente en esa página. | Se puede citar con página. |
| **Medida** | Está programada y corre sobre todo el AT o NT. Pasa los ejemplos del autor y el conjunto de control. | Acota las opciones del asistente. |
| **Validada** | El profesor revisó una muestra al azar de sus aciertos en el corpus y la aprobó. Se registra quién, cuándo y con qué precisión. | **Decide**: marca «Regla». |

**Umbral para decidir:** al menos 95 % en el conjunto de control y en la muestra del profesor. Si no lo alcanza, la regla acota y no decide (ver §6: בְּ + infinitivo).

**Hay que distinguir dos cosas que se validan:**
- la **cita** respalda el criterio («עַד + infinitivo constructo = "hasta"», Arnold y Choi, §3.4.1 b.3, p. 70);
- la **validación** dice que nuestro código aplica bien ese criterio a los versículos. Eso se mide, no se supone.

---

## 3. El proceso, del libro a la regla

### 3.1 Ingesta medida
- **Dónde:** los libros quedan en la biblioteca, marcados como citables con restricción. Su texto nunca se muestra.
- **Antes de construir encima, se mide cada libro:**
  - si el índice trae las secciones numeradas;
  - si cada página sabe su número impreso;
  - si el texto está completo, página por página;
  - cómo sale el hebreo o el griego de los ejemplos.
- **Si el PDF es digital,** la **capa de texto** (`pdftotext`) es la fuente para el texto en inglés o español: es exacta y gratis.
- **La extracción por visión** queda para lo que la capa de texto no da: el hebreo de los ejemplos y los libros escaneados.

### 3.2 El hebreo o el griego del ejemplo viene de nuestros datos, no del libro
Para la regla no hace falta el hebreo del libro. Del ejemplo basta con:
- la **categoría**;
- el **criterio**;
- la **referencia bíblica**.

El texto del versículo sale de OSHB o MorphGNT por esa referencia, y es más fiable que cualquier extracción.

El hebreo extraído sólo sirve para dos cosas:
- elegir la palabra cuando el versículo tiene varias candidatas;
- comprobar que el ejemplo cita esa palabra y no otra del mismo versículo.

### 3.3 Ficha de la regla
El asistente lee la sección exacta (por el índice del libro) y propone una ficha. La ficha la revisa y la programa una persona, como hasta ahora; el modelo no genera reglas solo.

```
id:            heb.inf.adInf
categoría:     temporal «hasta» (Arnold y Choi 3.4.1 b.3)
criterio:      עַד + infinitivo constructo: la acción del verbo dura hasta la del infinitivo
condición:     palabra anterior = עַד (OSHB 5704) y forma Vqc
fuentes:       [{obra: arnoldChoi, edición: 2003, sección: "3.4.1 (b.3)", página: 70,
                 ancla: "<frase corta del libro>", verificada: <quién, fecha>}]
ejemplos:      Gn 19:22, Gn 3:19, Gn 32:25 (los del autor)
control:       ejemplos de otra sección del mismo libro (4.1.15 b)
estado:        medida → validada
medición:      161 en el AT; muestra del profesor 20/20
```

### 3.4 Anclaje automático
El código busca la frase de anclaje en la página indicada (hay una función que ya lo hace, `findQuoteInPageText`). Si no la encuentra, la ficha no avanza. Es la defensa contra las citas inventadas: ya vimos que el modelo de extracción las produce.

### 3.5 Los ejemplos del autor se vuelven pruebas
Si el libro dice que Gn 19:22 es temporal «hasta», la regla tiene que dar eso en Gn 19:22. Es un conjunto de prueba hecho por los autores, no por nosotros.

### 3.6 Conjunto de control
- **Qué es:** ejemplos que la regla **no vio** al ajustarse, y que el propio libro trae en otra sección.
- **Ejemplo:** el capítulo de preposiciones de Arnold y Choi tiene ejemplos con infinitivo que no están en la sección del infinitivo.
- **Por qué hace falta:** sin control, una regla ajustada a sus ejemplos se autoevalúa sin errores. Pasó en la prueba de concepto (§6).

### 3.7 Validación docente
- **Qué se le muestra al profesor:** unas 20 apariciones al azar de cada regla en el corpus. Marca ✓ o ✗ sin escribir.
- **Cuánto tiempo:** unos 10 a 15 minutos por regla.
- **Qué deja:** una precisión medida, con su autor y su fecha.

### 3.8 El ciclo de vuelta
Cada corrección del profesor o del fundador desde la app (como las capturas de esta fase) se guarda como caso: versículo, palabra, lo esperado, por qué. El caso termina en una de dos:
- corrige una regla existente, y queda como prueba;
- abre una propuesta nueva.

El «banco del profesor» de G0 es el embrión de esto.

---

## 4. Qué se muestra en la app

- **Ficha de una palabra, con una regla validada:** «Regla» + la cita verificada (obra, sección, página). «Copiar cita» copia sólo lo verificado.
- **Regla medida pero sin validar:** el asistente elige entre las opciones que dejó la regla. Se ve «Asistente» y la definición de la categoría con su fuente, si está verificada.
- **Fuente sin verificar:** sólo la obra y el tema general («Arnold y Choi, sobre el infinitivo constructo»). Nada que parezca una cita textual.
- **Una prueba en CI** falla si alguna cita muestra página o § sin estar marcada verificada.

---

## 5. Fuentes y papeles

| Obra | Papel | Estado en la biblioteca (2026-10-09) |
|---|---|---|
| **Farfán**, *Gramática elemental del hebreo bíblico* (Verbo Divino) | Libro del curso. Terminología y morfología; primera cita donde cubre. | Biblioteca core (`hebreo`), 151 págs.; extracción por capa de texto. Clasificada «Public Domain» por error: tiene derechos vigentes. |
| **Niccacci**, *Sintaxis del hebreo bíblico* (Verbo Divino, 1998) | Sintaxis del verbo en el texto: narración y discurso, primer plano y fondo, wayyiqtol y waw + x + qatal. | Biblioteca personal, **sólo 78 págs.** («Test»): parece una parte. Hay que subirlo completo. |
| **Arnold y Choi**, *A Guide to Biblical Hebrew Syntax* (Cambridge, **1.ª ed. 2003**) | Taxonomía de funciones: infinitivo, participio, partículas, constructo, cláusulas. | Biblioteca personal, 242 págs., medido (§6). |
| **Sandy y Giese**, *Compendio para entender el AT* (B&H, 2007) | Género del pasaje y poesía (paralelismo). Nivel de pasaje, no de palabra. | No está. |
| **Wallace**, *Greek Grammar Beyond the Basics* | Taxonomía griega (G2–G4). | Inglés (872 págs.) en la biblioteca personal; español (711 págs.) en core. |
| **Runge**, *Discourse Grammar of the Greek NT* | Conectores griegos (G4). | No verificado. |
| Waltke-O'Connor, Joüon-Muraoka | Referencia profunda en hebreo. | Waltke-O'Connor en la biblioteca personal (792 págs.). |

**La edición importa:** la numeración de secciones y las páginas cambian entre ediciones. Cada cita registra la suya.

---

## 6. Evidencia: prueba de concepto con Arnold y Choi (2026-10-09)

Todo hecho en local, sólo con lecturas; sin tocar producción ni gastar cuota.

### 6.1 Medición de la extracción
- **Página impresa = hoja − 14:** se cumple en 146 hojas, con un solo desajuste.
- **Índice:** 98 secciones numeradas; 84 aparecen como encabezado en el texto extraído.
- **La extracción por visión perdió contenido en 29 páginas,** agrupadas en dos tramos: p. 70–81 (infinitivos, participio) y p. 166–188 (cláusulas subordinadas). El indicador de cobertura de la biblioteca no lo detecta, porque cuenta hojas y no contenido. **Es un defecto a corregir aparte.**
- **Hebreo de la visión, comparado con OSHB por referencia:** consonantes 94 %, palabras con vocales exactas 86 %.
- **La capa de texto del PDF trae el inglés completo:**
  - 1.253 referencias bíblicas contra 1.160 de la visión;
  - en p. 70–81, 86 contra 31.

  El hebreo de la capa sale ilegible (fuente antigua con codificación propia), y no hace falta (§3.2).

### 6.2 Infinitivo constructo y absoluto (secciones 3.4.1 y 3.4.2, p. 67–77)
- **26 subcategorías y 75 ejemplos con referencia** en la capa de texto.
- **Reglas de prueba sobre OSHB, contra esos 75 ejemplos:**
  - decide y coincide: 27;
  - acota, con la categoría del libro entre las opciones: 46;
  - contradice: 0;
  - OSHB no ve un infinitivo donde el libro sí: 2 (Anexo A.2).
- **Sobre todo el AT** (6.638 constructos y 888 absolutos), la regla decide en estos casos:
  - לֵאמֹר = especificación: 938;
  - בְּ + infinitivo: 726 (pero ver abajo);
  - verbo que pide complemento + לְ: 280;
  - כְּ: 250;
  - tras un sustantivo en constructo = genitivo: 185;
  - עַד: 161;
  - אַחֲרֵי: 66;
  - infinitivo absoluto con verbo de la misma raíz = enfático: 480.

### 6.3 El control encontró un error
- **Las reglas se ajustaron mirando los mismos 75 ejemplos:** los «0 errores» eran autoevaluación.
- **Se corrieron contra los ejemplos del capítulo de preposiciones (4.1),** contando sólo los casos en que el infinitivo es la palabra citada:

| Regla | Resultado en el control |
|---|---|
| אַחֲרֵי + infinitivo = «después de» | 2/2 |
| כְּ + infinitivo = «en cuanto» | 2/2 |
| **בְּ + infinitivo = temporal** | **6/8**. Falla en dos que el libro clasifica como **causales** (4.1.5 f): Éx 16:7 «בְּשָׁמְעוֹ», «because he has heard»; 1 R 18:18 «בַּעֲזָבְכֶם», «because you have forsaken». |
| verbo de capacidad + לְ = complemento | 0/1, en 1 R 5:17 (Anexo A.1) |
| לְמַעַן + infinitivo | sin regla (2 R 10:19, propósito) |

**Consecuencias:**
- **בְּ + infinitivo no puede decidir.** Pasa a acotar entre temporal, causal e instrumental (las categorías de 4.1.5). Sin el control, 726 casos del AT habrían salido marcados «Regla», con un error de cerca de uno de cada cuatro.
- **La lista de verbos que piden complemento tiene que ser la del libro** (p. 69): יָדַע, חָלַל Hifil, יָסַף Hifil, בָּקַשׁ Piel, חָדַל, יָכֹל, מָאֵן, נָתַן, אָבָה. La regla de prueba no tenía בָּקַשׁ ni נָתַן, y agregaba כָּלָה, que el libro no menciona.
- **Tamaño:** el control es chico (17 casos). Detecta errores gruesos, pero no mide precisión. La precisión sale de la muestra del profesor.

---

## 7. Orden de construcción

| Etapa | Qué | Toca producción |
|---|---|---|
| **R0. Honestidad de las citas** | Estado de verificación en el registro de fuentes (obra, edición, sección, página, quién verificó). La ficha muestra sólo lo verificado; lo demás, obra + tema. Prueba en CI. Lista de verificación de las citas actuales (Wallace, Runge, Arnold y Choi) para contrastar con el ejemplar. | Sí: las secciones de Wallace y Runge pasan a mostrarse como tema general hasta verificarlas. |
| **R1. Herramienta de extracción** ✓ | Los scripts de la prueba de concepto pasan al repo: capa de texto, secciones, ejemplos, comparación con OSHB y MorphGNT, conjunto de control. Sin texto de los libros en el repo. | No. |
| **R2. Ingesta medida** | Niccacci completo; Sandy y Giese; Farfán revisado (hebreo vocalizado, § y derechos). Medición de cada uno con R1. | Sí: carga en la biblioteca (gasta cuota, pide OK). |
| **R3. Anclar las reglas existentes** | Las reglas de G2–G4 y H1–H3 pasan a «ancladas» con sección y página verificadas. | Sí: mejora las citas. |
| **R4. Hebreo H4 con el proceso completo** (infinitivo ✓, participio ✓) | Infinitivo (esta prueba), participio, partículas, cadena de constructo; Niccacci para la sintaxis del verbo en el texto. | Sí. |
| **R5. Validación docente y ciclo de vuelta** | Pantalla de muestra para el profesor; casos desde la app. | Sí. |

**Una fase = un PR por etapa**, con un commit por unidad, como hasta ahora.

### Resultado de R0 (PR #759, desplegado 2026-10-09)
- Las secciones estaban de memoria: sólo 21 de 90 de Wallace coincidían con un encabezado del libro, y la «waw disjunctive» de Arnold y Choi apuntaba a «5.2.14 Disjunctive Clause» («o… o»).
- Cotejadas con los ejemplares de la biblioteca: Wallace 1996 (91) y Arnold y Choi 2003 (6), los 97 encabezados en su página impresa (`scripts/language-rules/cotejar-citas.py`, lista aprobada en `cotejo-aprobado.json`, exigida por CI).
- Runge (13): sólo el tema. El PDF disponible es una versión previa (Logos) sin créditos y con paginación propia (hoja − 7): sirve para el contenido de las reglas, no para citar páginas del impreso de 2010. El profesor no usa la gramática de Runge; sí su *Santiago: Comentario de alta definición* (Lexham, 2016), que sirve como conjunto de prueba de G4 sobre Santiago.
- ἐν τῷ y πρὸς τό + infinitivo dejaron de decidir solos (Wallace les da varios usos, p. 611).
- Falta: revisión a mano de `docs/CITAS_REGLAS_IDIOMA.md` (que la categoría del libro sea la de la regla).

### Resultado de R1 (2026-10-09)
- `scripts/language-rules/` (ver su README):
  - **`bajar-recurso.cjs`:** sólo lectura. Se niega a escribir dentro del repo (ruta real, sin distinguir mayúsculas) y vacía la carpeta antes de bajar.
  - **`medir-extraccion.py`:** página impresa, referencias (también las del otro Testamento), hojas con contenido perdido (contando caracteres que no son espacio) y escritura legible. Infiere el desfase si falta.
  - **`ejemplos-del-libro.py`:** lee por bloques, para recuperar las referencias partidas entre líneas. Corta el tramo en la primera sección fuera de rango y marca los títulos ilegibles.
  - **`libros.py`:** abreviaturas y nombres completos, con o sin paréntesis, «1Cor» y libros de un solo capítulo («Jude 3»).
  - **`test_herramientas.py`:** casos sintéticos. Corren con `python3 -m unittest`, no en CI.
- **Medido con los tres libros de la biblioteca:**
  - **Arnold y Choi:** página impresa en 227 hojas; 1.486 referencias en la capa contra 1.204 en la extracción; contenido perdido en p. 28, 70–80 y 166–188; capa sin hebreo legible.
  - **Runge (versión previa):** desfase inferido −7, apoyado en 322 hojas; 583 referencias.
  - **Wallace:** 747 hojas coinciden; 5.293 referencias; griego ilegible en la capa.
- **Archivos de prueba para R4:**
  - Arnold y Choi 3.4.1–3.4.2 (infinitivo, **76** ejemplos);
  - 4.1 (preposiciones, control: 18 secciones, **326** ejemplos).

  Una prueba exige que cada referencia exista en nuestros datos, que ninguna página esté vacía y que cada ejemplo caiga entre la página de su subcategoría y la siguiente.
- **Revisión adversarial:**
  - **Referencias partidas entre líneas:** se perdían 12, alrededor del 3 %, con sesgo hacia 1–2 Samuel y 1–2 Reyes.
  - **El candado del repo** se saltaba con otras mayúsculas.
  - **Runge:** su numeración se reinicia por capítulo.
  - **Falsos positivos de páginas perdidas** en índices y tablas, y títulos ilegibles que pasaban.

  Todo corregido. La muestra de 16 atribuciones al azar estaba bien, y los archivos no traen texto del libro.

### R4, primer tema: la función del infinitivo hebreo (2026-10-10)
- `hebrewInfinitiveCandidates` (dominio). Las categorías son las de Arnold y Choi §3.4.1–3.4.2, más §4.1.5 (בְּ) y §4.1.11 (לְמַעַן). Cada regla mira la forma de OSHB, la preposición pegada o la anterior y el verbo de la cláusula (con el participio contando como predicado), y deja las categorías posibles.
- **Estado de todas las reglas: «medida».** Con una sola opción se muestran «Regla · medida», con la explicación de que falta la validación del profesor; si el asistente lee otra función, la ficha muestra las dos. Con varias, elige el asistente («Asistente»); en un análisis anterior se muestran las opciones. Cada función cita su sección y su página, cotejadas con el ejemplar (25 citas de Arnold y Choi verificadas).
- **Medido:**
  - **Los 76 ejemplos del libro, cada uno contra SU palabra** (no contra el versículo: `arnoldChoi-infinitivo-anclas.json`): 24 deciden bien, 50 acotan bien y 0 contradicen. 2 no tienen infinitivo en OSHB (Gn 40:10, 1 S 5:9; Anexo A.2). Atención: las reglas se ajustaron mirando estos mismos ejemplos.
  - **El control (§4.1, no usado para ajustar):** 0 contradicciones (2 deciden, 11 acotan).
  - **Todo el AT:** 7.088 infinitivos con regla (sin el arameo de Daniel y Esdras), 26 % con una sola opción.
  - **Muestras de 20 al azar de las reglas que deciden** (leídas por nosotros, no por el profesor): genitivo tras constructo 20/20, enfático 20/20, «hasta» 19/20 (Jue 11:33 «עַד בּוֹאֲךָ מִנִּית» es espacial).
- **Revisión adversarial (corregido antes del PR):**
  - «לְ + infinitivo sin verbo → obligación o inminencia» erraba 19 de 20; tras subir por las cláusulas hasta el verbo, todavía 18 de 20 (la cláusula sin verbo suele seguir al versículo anterior). **Se retiró:** obligación e inminencia sólo se ofrecen al asistente.
  - כְּ + infinitivo no decide «en cuanto» (erraba 16–24 %): también puede ser «mientras» o comparar (§4.1.9 a, Sal 68:3).
  - «עַד» y «אַחֲרֵי» no deciden si el infinitivo trae su propia preposición (2 Cr 32:24, 1 R 15:4); לְמַעַן admite resultado (§3.4.1 d, 2 R 22:17); tras לִפְנֵי / מִפְּנֵי no se dice nada (Mal 3:23).
  - La prueba medía por versículo: cualquier infinitivo del versículo hacía pasar el ejemplo. Ahora se mide la palabra citada.
- **Segunda revisión (corregido):**
  - Los verbos que piden complemento sólo se buscaban 2 palabras atrás y se perdía el orden verbo-sujeto-infinitivo («וְלֹא אָבוּ עַבְדֵי הַמֶּלֶךְ לִשְׁלֹחַ», 1 S 22:17). Ahora se busca el verbo finito más cercano, hasta 6 palabras atrás, sin otro verbo en medio: 121 casos nuevos ofrecen complemento o propósito. En una muestra de 20, los 20 contienen la lectura correcta.
  - Si el asistente leía una función fuera de la lista, se descartaba en silencio. Ahora se muestra al lado, como en las reglas de una opción.
  - La «n.ª aparición» del prompt cuenta todas las palabras iguales del versículo (Ez 33:22: el «בּוֹא» con regla es el 2.º); el prompt da la lista de funciones válidas.
  - La prueba fija cuántos ejemplos deciden y cuántos acotan (24 y 50), no sólo la suma.
  - Límite conocido (supuesto, no medible con los datos fijados, que no traen el maqaf): si el asistente une dos infinitivos en una palabra, la ficha muestra sólo el último.
- **Decisiones que vienen del libro:** בְּ + infinitivo acota (temporal, causal, instrumental). Los verbos que piden complemento acotan entre complemento y propósito (1 R 5:17, Anexo A.1). El infinitivo absoluto tras un sustantivo en constructo es genitivo (Is 4:4). ילך y הלך cuentan como la misma raíz para el enfático (2 S 3:16).
- **Falta:**
  - la muestra del profesor para pasar a «validada» (R5);
  - מִן + infinitivo (§4.1.13), que queda sin regla.

### R4, segundo tema: la función del participio hebreo (2026-10-10)
- `hebrewParticipleCandidates` (dominio). Categorías de Arnold y Choi §3.4.3: atributivo (a), predicado en presente, pasado o futuro (b.1–b.3) y sustantivo (c). Cada regla mira artículo, preposición (pegada o suelta), estado, sufijo, la palabra anterior, הָיָה o הִנֵּה cerca y el rol que MACULA le da a la palabra. Todas «medidas», como el infinitivo; la ficha, el prompt y la elección del asistente usan el mismo camino (`hebrewRuleChoice.ts`).
- **Lo que enseñaron los ejemplos del libro:** la morfología sola no alcanza. Un participio en constructo puede ser atributivo («אֹזֶן שֹׁמַעַת», Pr 15:31) y uno con sufijo, predicado («הִנְנִי נֹתְנוֹ», 1 R 20:13). «Nombre + participio» es atributo («לֵב שֹׁמֵעַ», 1 R 3:9) o sujeto + predicado («וְנָהָר יֹצֵא», Gn 2:10): lo separa el rol de MACULA.
- **Medido:**
  - **Los 48 ejemplos del libro, cada palabra citada** (`arnoldChoi-participio-anclas.json`: 28 con un solo participio en el versículo, 19 elegidos por la glosa inglesa del libro, y Sal 19:1, que es la numeración inglesa de 19:2): 11 deciden bien, 40 acotan bien, 0 contradicen.
  - **El control (§4.5, הִנֵּה, no usado para ajustar):** los 9 participios sin artículo que siguen a הִנֵּה admiten predicado; 0 contradicciones.
  - **Todo el AT:** 9.395 participios con regla (sin el arameo), 27 % con una sola opción.
  - **Muestras de 20 al azar de las reglas que deciden** (leídas por nosotros, no por el profesor; la segunda muestra se tomó después de corregir lo que mostró la primera):
    - preposición pegada 20/20; preposición suelta 19/20 (2 R 9:25 «אֵת רֹכְבִים» es predicado);
    - הוֹי / אַשְׁרֵי + participio 20/20;
    - con artículo y sin nombre antes: 18/20 en la primera muestra («חֲמֵשֶׁת אֲלָפִים הַנּוֹתָר», Ez 48:15, y «כְּמִתְלַהְלֵהַּ הַיֹּרֶה», Pr 26:18, eran atributivos: ahora tras cualquier nombre acota), 20/20 en la segunda;
    - con sufijo: unas 18/20 en la primera («אַתָּה בוֹדָאם», Neh 6:8, es predicado: si MACULA lo trata como verbo, acota), 20/20 en la segunda;
    - tras un nombre en constructo: 19/20 en las dos (OSHB pone אִישׁ en constructo en «אִישׁ צָרוּעַ», Lv 13:44, y «אִישׁ מֵבִין», 1 Cr 27:32: tras אִישׁ / אִשָּׁה acota);
    - atributivo: 2 errores en la segunda muestra, los dos coordinados con «וְ» («שַׂר וְשֹׁפֵט», Éx 2:14; «וְאַלְמָנָה וּגְרוּשָׁה», Ez 44:22). Ahora decide sólo si concuerdan género, número y definitud, sin «וְ» y si no es un participio que funciona como nombre (אֹיֵב, רֹעֶה, שׂנא, שֹׁפֵט); en la tercera muestra, 5/5.
  - **הָיָה + participio (perifrástico) NO decide:** erraba 6–8 de 20 («וְלֹא הָיָה מַצִּיל», Dn 8:7, «no había quien librara»; «וַיְהִי כָּל יוֹדְעוֹ», 1 S 10:11; «עֵד מְמַהֵר», Mal 3:5). Pone primero el tiempo de הָיָה y acota con sustantivo y atributivo. Un «וְ + qatal» de הָיָה que OSHB no marca como weqatal (76 en el AT; Zac 10:5) ofrece pasado y futuro.
  - **Tras הִנֵּה, predicado, y el tiempo lo elige el asistente:** en narración suele ser pasado (Gn 37:25), en discurso presente o futuro (1 S 23:1, Gn 6:17). Queda para medir si el discurso basta para acotar.
- **Revisión adversarial (corregido antes del PR):**
  - OSHB marca «Tm» también יֵשׁ y כֵּן: la regla de הִנֵּה los tomaba (60 de 474) y quitaba sustantivo a «יֵשׁ גֹּאֵל» (Rut 3:12) o «עַל כֵּן רֹדְפַי» (Jer 20:11). Ahora exige el lema de הִנֵּה / הֵן, corta en otro participio predicado (Zac 11:16) y, si MACULA lo pone de sujeto, objeto o predicado nominal, también ofrece nombre o atributo (Sal 92:10, Zac 5:1). Muestra con otra semilla: 19/20 («הִנֵּה יוֹצֵר הָרִים», Am 4:13, es sustantivo).
  - הָיָה se perdía en «יְהִי שֵׁם יְהוָה מְבֹרָךְ» (Job 1:21, Sal 113:2) y en «גַּם בָּרוּךְ יִהְיֶה» (Gn 27:33, un `return` que saltaba la palabra siguiente), y tomaba como tiempo un «וְהָיָה» que abre otra cláusula (Ez 47:12). Ahora mira hasta 4 palabras atrás saltando nombres (más allá de 2, sólo en la misma cláusula de MACULA: «יִהְיֶה עֶלְיוֹן כָּל עֹבֵר», 1 R 9:8, no) y la siguiente sólo sin «וְ» y en la misma cláusula.
  - Una preposición suelta que MACULA no trata como tal también admite predicado («אֵת רֹכְבִים», 2 R 9:25; «לְמַעַן שָׂכוּר הוּא», Neh 6:13).
  - Al comienzo del versículo, la palabra anterior es la última del versículo anterior: «הַמּוֹצִיא» (Lv 22:33) sigue a «מְקַדִּשְׁכֶם» (22:32) y acota (125 casos).
  - El control de §4.5 pasaba aun sin la regla de הִנֵּה (los participios caían en otra que también admite predicado): ahora exige esa regla.
  - Pendiente menor: OSHB pone en constructo «עִיר פְּרוּצָה» (Pr 25:28), atributivo; el genitivo queda 19/20.
  - Sin cambios de comportamiento en el infinitivo por la refactorización: 0 diferencias en todo el AT (candidatos, prompt y elección).
- **De paso:** la prueba de CI que exige el cotejo de las citas no miraba las tablas del hebreo (el infinitivo de R4 había quedado fuera). Ahora recorre todas las tablas `*_SOURCES`; las 5 citas nuevas del participio están cotejadas (121 de 121).
- **Límite conocido (supuesto):** OSHB a veces da הִנְנִי con el lema 2005 (הֵן); se usa su código de partícula («Tm»), no el lema.

---

## 8. Riesgos

- **Extracción incompleta que no se ve:** lo de las p. 70–81 puede pasar en cualquier libro. Cada ingesta se mide página por página (R1/R2).
- **Los autores no coinciden:** Niccacci (texto-lingüístico) y Arnold y Choi (tradicional) a veces clasifican distinto. El registro acepta varias fuentes y la ficha dice «según Niccacci… / según Arnold y Choi…», en vez de elegir en silencio. Un mismo libro puede no ser uniforme (Anexo A.1).
- **Los datos no coinciden con el libro:** OSHB puede leer la forma de otra manera (Anexo A.2). Se registra y se consulta, no se fuerza.
- **El tiempo del profesor es el recurso escaso:** la validación es por muestra y con un clic.
- **Derechos de autor:** sólo categorías y criterios con palabras propias; frases de anclaje cortas y nunca visibles; los libros en la biblioteca, citables con restricción.

---

## 9. Preguntas abiertas para el fundador

1. ¿El profesor puede validar muestras (10–15 min por regla)? ¿Con qué frecuencia?
2. ¿Cómo se lo nombra en las citas de sus indicaciones? Hoy: «Revisión docente de Dos Filos Preach».
3. ¿Qué edición de cada libro tiene el curso? La de Arnold y Choi en la biblioteca es la 1.ª (2003).

---

## Anexo A · Para conversar con el profesor

### A.1 Una misma construcción, dos clasificaciones en Arnold y Choi

**Lo que encontramos.** El libro clasifica «no poder + לְ + infinitivo» de dos maneras según la sección:

- **§3.4.1 (a), p. 69: infinitivo constructo como acusativo, «complemento verbal».** El ejemplo es Gn 48:10, «לֹא יוּכַל לִרְאוֹת», «he is not able to see». Agrega que los verbos que más piden este complemento son יָדַע, חָלַל (Hifil, «comenzar»), יָסַף (Hifil, «continuar»), בָּקַשׁ (Piel, «buscar»), חָדַל («dejar de»), **יָכֹל («poder»)**, מָאֵן («rehusar»), נָתַן («permitir») y אָבָה («querer»).
- **§4.1.10 (d), p. 111: la preposición לְ de propósito,** «para mostrar el fin o la meta de otro verbo». Uno de sus ejemplos es 1 R 5:17 [5:3], «לֹא יָכֹל לִבְנוֹת בַּיִת לְשֵׁם יְהוָה», «David my father was unable to build a house for the name of Yhwh».

Es la misma construcción: יָכֹל negado + לְ + infinitivo constructo. En un lugar es complemento y en el otro, propósito.

**Por qué importa.** Si el sistema decide por regla, tiene que elegir una. Con la de §3.4.1, 1 R 5:17 sale «complemento». Con la de §4.1.10, «propósito». Un alumno que consulte las dos secciones verá que la app contradice una de ellas.

**Una lectura posible, para discutir.** §4.1.10 clasifica **la preposición** לְ, y §3.4.1 clasifica **el infinitivo**. Quizá en 1 R 5:17 el ejemplo de §4.1.10 apunta a otra cosa: el propósito de la frase entera, «construir casa *para* el nombre de YHWH», más que la relación entre יָכֹל y el infinitivo. Pero el libro lo pone bajo propósito sin aclararlo.

**Preguntas para el profesor.**
1. En 1 R 5:17, ¿לִבְנוֹת es complemento de יָכֹל o expresa propósito?
2. ¿El curso sigue el criterio de §3.4.1 (los verbos de esa lista llevan complemento), y entonces la regla puede decidir «complemento» para esos verbos?
3. ¿Cómo lo presenta Farfán, si lo trata?

**Qué proponemos mientras tanto.** La regla de los verbos que piden complemento **no decide** hasta que el profesor responda. Acota entre complemento y propósito, y la ficha cita las dos secciones.

### A.2 Dos ejemplos donde OSHB no ve un infinitivo

| Ejemplo del libro | Lo que dice Arnold y Choi | Lo que dice OSHB |
|---|---|---|
| Gn 40:10 «כְפֹרַחַת» | §3.4.1 (b.2): כְּ + infinitivo constructo, «as it was budding» | participio femenino singular (`Vqrfsa`) |
| 1 S 5:9 «אַחֲרֵי הֵסַבּוּ» | §3.4.1 (b.4): אַחֲרֵי + infinitivo, «after they brought it around» | perfecto Hifil 3.ª plural (`Vhp3cp`) |

**Preguntas para el profesor.**
1. ¿Cuál lectura sigue el curso en cada caso?
2. ¿El sistema debe seguir a OSHB (los datos) y anotar la lectura de la gramática, o al revés?

### A.3 בְּ + infinitivo: ¿cuándo es temporal y cuándo causal?

El libro clasifica בְּ + infinitivo como temporal en §3.4.1 (b.1), pero en §4.1.5 (f) trae ejemplos causales: Éx 16:7 «בְּשָׁמְעוֹ», «because he has heard»; 1 R 18:18 «בַּעֲזָבְכֶם», «because you have forsaken». Por eso proponemos que la regla acote entre temporal, causal e instrumental, y que la elección la haga el asistente con el contexto.

**Pregunta para el profesor.** ¿Hay algún indicio formal que el curso enseñe para distinguirlos (el verbo principal, el orden, «וַיְהִי» delante)? Si lo hay, se puede codificar.
