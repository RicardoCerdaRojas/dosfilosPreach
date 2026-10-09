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
| **R1. Herramienta de extracción** | Los scripts de la prueba de concepto pasan al repo: capa de texto, secciones, ejemplos, comparación con OSHB y MorphGNT, conjunto de control. Sin texto de los libros en el repo. | No. |
| **R2. Ingesta medida** | Niccacci completo; Sandy y Giese; Farfán revisado (hebreo vocalizado, § y derechos). Medición de cada uno con R1. | Sí: carga en la biblioteca (gasta cuota, pide OK). |
| **R3. Anclar las reglas existentes** | Las reglas de G2–G4 y H1–H3 pasan a «ancladas» con sección y página verificadas. | Sí: mejora las citas. |
| **R4. Hebreo H4 con el proceso completo** | Infinitivo (esta prueba), participio, partículas, cadena de constructo; Niccacci para la sintaxis del verbo en el texto. | Sí. |
| **R5. Validación docente y ciclo de vuelta** | Pantalla de muestra para el profesor; casos desde la app. | Sí. |

**Una fase = un PR por etapa**, con un commit por unidad, como hasta ahora.

### Resultado de R0 (PR #759, desplegado 2026-10-09)
- Las secciones estaban de memoria: sólo 21 de 90 de Wallace coincidían con un encabezado del libro, y la «waw disjunctive» de Arnold y Choi apuntaba a «5.2.14 Disjunctive Clause» («o… o»).
- Cotejadas con los ejemplares de la biblioteca: Wallace 1996 (91) y Arnold y Choi 2003 (6), los 97 encabezados en su página impresa (`scripts/language-rules/cotejar-citas.py`, lista aprobada en `cotejo-aprobado.json`, exigida por CI).
- Runge (13): sólo el tema. El PDF disponible es una versión previa (Logos) sin créditos y con paginación propia (hoja − 7): sirve para el contenido de las reglas, no para citar páginas del impreso de 2010. El profesor no usa la gramática de Runge; sí su *Santiago: Comentario de alta definición* (Lexham, 2016), que sirve como conjunto de prueba de G4 sobre Santiago.
- ἐν τῷ y πρὸς τό + infinitivo dejaron de decidir solos (Wallace les da varios usos, p. 611).
- Falta: revisión a mano de `docs/CITAS_REGLAS_IDIOMA.md` (que la categoría del libro sea la de la regla).

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
