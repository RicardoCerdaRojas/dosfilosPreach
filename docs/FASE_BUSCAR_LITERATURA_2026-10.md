# Fase · Buscar en la literatura (estado del arte, etapa 2c)

> Estado: **versión 1 decidida y en construcción** (2026-10-23): guía de búsqueda y catálogo curado, sin integraciones. Las integraciones quedan para una versión 2 (más abajo). Sigue a la etapa 2b (PR #807). Es el paso 3 del camino de la etapa 2b («De la lista al plan de investigación», en `FASE_ESTADO_DEL_ARTE_2026-10.md`).
>
> Rótulos: **medido** (lo corrí y vi el resultado), **leído** (lo vi en código, documentación o producción), **supuesto** (no lo comprobé).

## Qué es

Hoy el estado del arte solo conoce lo que ya está en la cuenta: la biblioteca, los estudios, el sílabo importado y el catálogo interno. Un investigador necesita además **lo que existe en el campo**: lo que se publicó sobre su pasaje o su pregunta, para buscarlo, comprarlo o pedirlo y sumarlo al proyecto. Así lo planteó el fundador: la búsqueda tiene que existir, y tiene que complementar a todo tipo de proyecto, no reemplazar nada.

El objetivo no cambia: una **metodología de investigación** que un académico reconozca. No se trata de una lista que el asistente rellena. Eso define el diseño desde la raíz.

## La pregunta de fondo: ¿quién nombra las obras?

Hay dos maneras de «buscar con el asistente»:

1. **El asistente nombra obras** («para Santiago 4:5 lee a Laws 1974, Johnson 1983…»). Es rápido y parece experto. Pero es justo lo que un académico no acepta:
   - las referencias pueden ser inventadas;
   - la selección reproduce el sesgo de lo que el asistente vio;
   - no se puede repetir ni explicar.

   Hay un antecedente medido en este mismo sistema: Gemini 3.8 Flash inventa citas, y por eso quedó solo para leer libros (memoria del ruteo por función).
2. **El asistente arma la estrategia y las bases dan las obras.** El asistente propone **consultas**: palabras clave en varios idiomas, las formas de citar el pasaje y los temas que faltan según los requisitos. Esas consultas se ejecutan en bases reales, y cada resultado trae un identificador (DOI, ISBN, registro de catálogo). Así trabaja una búsqueda bibliográfica sistemática: la estrategia se declara, cada consulta se registra y el resultado se puede reproducir.

**Decisión propuesta:** la 2 es el motor. La 1 entra solo como complemento: «obras que un especialista nombraría y que las bases no devolvieron». Cada una se verifica contra las bases antes de mostrarse como real, y si no se verifica queda **aparte**, con su estado a la vista.

## Lo medido (2026-10-23)

Lo probé con preguntas reales de NT785: Santiago 4:5 y las obras del sílabo.

| Base | Acceso desde el servidor | Resultado |
|---|---|---|
| **Crossref** (artículos y capítulos, DOI) | Abierta, sin clave. Con `mailto` entra al grupo de cortesía (3 búsquedas por segundo). | La búsqueda «James 4:5 spirit envy…» trae primero a **Laws 1974, NTS**, el artículo del sílabo. Moo, *The Letter of James*, aparece. **El puntaje de Crossref no distingue lo real de lo inventado:** una obra inventada sacó 31,0 y Moo, que es real, 31,2. |
| **Open Library** (libros, ISBN, páginas) | Abierta, sin clave. | Moo 1985 y 2000 con ISBN. En español encuentra el **Davids de Kregel 2019** («Epístola de Santiago»), pero **no** con el título del sílabo («La epístola de Santiago: un comentario sobre el texto griego», Fundación Hurtado): es otra edición. Kistemaker en español: 0. |
| **BNE** (Biblioteca Nacional de España, SRU) | Abierta, sin clave, responde MARCXML. | Encuentra registros de «epístola de Santiago». Cubre la edición en español que falta en las otras. |
| **OpenAlex** (citas y grafo de referencias) | Desde febrero de 2026 **pide clave** (gratis, con US$ 1 por día de uso: una búsqueda vale US$ 0,001 y la consulta por DOI es gratis). Sin clave, US$ 0,10 por día compartido por IP. | Respondió sin clave (19 097 resultados en texto completo, sin filtrar). Hace falta la clave para producción. |
| **Google Books** | Pide clave (cupo gratis por día, supuesto: ~1000). | Sin clave: «Quota exceeded» (cupo compartido agotado). Sin medir con clave. |
| **Semantic Scholar** | Pide clave para no recibir 429. | 429. |
| **IxTheo** (Index Theologicus, la base abierta de la disciplina) | **No:** un muro de verificación de navegador («Verifying your browser») bloquea las llamadas del servidor. | No se puede consultar desde el servidor. Con un enlace se abre en el navegador del usuario (supuesto: la URL de búsqueda de VuFind, `/Search/Results?lookfor=`). |
| **ATLA y NTA** (EBSCO) | Por suscripción institucional. | Fuera de alcance para el servidor. El usuario busca en su biblioteca y exporta RIS, y eso ya se importa desde la 2b. |
| **Dialnet** (español) | OAI-PMH para recolectar; el API de búsqueda pide gestión (leído). | Sin medir. |

**Lo que se concluye:**

- **Lo inventado no se encuentra (medido, con 2 casos), pero tampoco se encuentran obras reales en español** de editoriales evangélicas (Davids en Fundación Hurtado, Kistemaker en español). Entonces **«no encontrado» no quiere decir «inventado»**. La verificación tiene tres estados, nunca dos.
- **El puntaje de la base no sirve para verificar** (medido). Hay que comparar los campos: título, autor y año.
- **Las bases centrales de la disciplina (IxTheo, ATLA, NTA) no se pueden consultar desde el servidor.** El sistema no debe aparentar que las cubre. Debe preparar la búsqueda, abrirla allí y traer el resultado por RIS.

## Versión 1 · Decidida con el fundador (2026-10-23)

El fundador propuso no lidiar todavía con integraciones y darle al usuario **una guía de qué buscar y dónde**, más **una lista de títulos realmente reconocidos**. La crítica confirma la idea con tres ajustes: la guía tiene que ser específica de cada proyecto, la lista no la genera el asistente, y la búsqueda se tiene que registrar. Así resiste:

- **Es como trabaja un investigador.** Busca en las bases de su disciplina (IxTheo, ATLA, NTA, Dialnet) con una estrategia, anota lo que buscó y trae el resultado. Las integraciones resolvían el acceso (claves, topes, muros contra bots), no el método.
- **No aparenta cobertura.** Medido: las bases centrales no se pueden consultar desde el servidor.
- **No inventa:** la guía sale de reglas fijas y la lista de un catálogo verificado.

### A · La guía de búsqueda (reglas fijas, sin el asistente, sin costo)

Se arma con lo que el proyecto ya sabe:

- los pasajes de los estudios y los libros del proyecto;
- los requisitos que no se cumplen y los tipos de fuente que faltan en la cobertura;
- el tipo de proyecto;
- el idioma del usuario.

Cada paso de la guía dice:

- **qué buscar:** la consulta lista para copiar, con las formas del pasaje en inglés, español y la abreviatura (James 4:5, Jas 4:5, Santiago 4:5, Stg 4:5) y el libro en los dos idiomas;
- **dónde:** la base, con un enlace que abre la búsqueda cuando la base lo permite (un enlace no es una integración);
- **para qué:** el requisito o el hueco que cubre;
- **cómo traer el resultado:** exportar RIS o BibTeX y soltarlo en «Importar», que ya existe;
- **anotar la búsqueda:** base, consulta, cuántas encontró y cuántas sumó. Va al registro de búsquedas, para que se pueda explicar y repetir. Importar el RIS de esa base completa la anotación.

Bases y cuándo aparecen:

| Hueco | Bases |
|---|---|
| Artículos de revista (o requisito en páginas de artículos) | IxTheo (abierta; busca por pasaje bíblico), ATLA/NTA (por la biblioteca del usuario), Google Académico |
| Obras en español | Dialnet, BNE, Google Libros |
| Obras antiguas (requisito de épocas) | Internet Archive y HathiTrust: lo anterior a 1929 suele ser de dominio público y gratis |
| Comentarios y monografías | El catálogo curado (B), WorldCat (dónde hay un ejemplar), Google Libros |
| Enfoques opuestos | Una consulta por enfoque, y el catálogo marcado por tradición |
| Tesis (investigación, publicable) | Repositorios de tesis (ProQuest por la biblioteca, TDX, Dialnet tesis) |

Siempre aparece IxTheo con el pasaje: es la base abierta de la disciplina.

### B · Títulos reconocidos: el catálogo curado, verificado al escribirlo

- **Ya existe** (leído): `domain/src/exegesis/recommendations`, con unos 114 títulos con nivel, idiomas e ISBN, que alimenta el origen «Catálogo» de las candidatas. En profundidad solo cubre Hebreos, Romanos y Génesis.
- **Se amplía con Santiago, Jonás, Rut, 2 Pedro y Nehemías.** Nehemías es el próximo proyecto exegético del fundador, para una serie expositiva. La base son las guías que un académico reconoce: Carson (*NT Commentary Survey*), Glynn (*Commentary and Reference Survey*) y Longman (*OT Commentary Survey*).
- **Cada obra se verifica una vez, al escribirla,** con un script contra Open Library, Crossref y la BNE (abiertas y sin clave). Lo que no se verifica no entra. La evidencia queda en la ficha (base y registro), y una prueba exige que toda obra de estos libros la tenga. El ISBN se toma del registro, nunca de memoria.
- **Tradición y enfoque en cada obra,** para que la lista no sea de una sola escuela y para que cuente en el requisito de enfoques opuestos. Pasan a la ficha de la candidata como evaluación propuesta.
- **Edición en español marcada** cuando existe y se verificó.
- **Lo que no cubre, dicho en la pantalla:** el catálogo cubre comentarios, monografías y algunos artículos clave. No cubre todo el campo: para eso está la guía.

### Cómo se entrega (versión 1)

Es un PR apilado sobre el #807, con un commit por unidad:

1. Este plan.
2. El catálogo: tradición, enfoque y evidencia en el tipo; el script de verificación; los cinco libros; la prueba de evidencia; y la tradición y el enfoque que pasan a la candidata.
3. La guía: las reglas en domain, el panel en el paso Requisitos, «anotar búsqueda» en el registro, y sus pruebas.

Solo hosting: no cambia functions.

## Versión 2 (después) · Integraciones con las bases

Lo que sigue fue el primer diseño. Queda para cuando la versión 1 muestre dónde duele la falta de integración.

### 1 · La estrategia de búsqueda (el asistente propone consultas, no obras)

Parte de lo que ya sabe el proyecto:

- la pregunta o el tema, si es una investigación;
- los pasajes de los estudios y sus capítulos;
- los requisitos que no se cumplen. Ejemplos: «faltan 100 páginas de artículos», «falta una fuente anterior a 1950», «faltan enfoques opuestos»;
- los tipos de fuente que faltan en la cobertura.

Lo que propone es una **estrategia declarada**, editable antes de ejecutarla:

- **Conceptos**, con sus formas en inglés, español y alemán. Ejemplo: «envidia / envy / Neid», «espíritu que hizo morar / spirit he caused to dwell».
- **Formas del pasaje:** James 4:5, Jas 4.5, Stg 4,5, Jak 4,5.
- **Consultas por base**, con la sintaxis de cada una.
- **Para qué requisito sirve cada consulta.** Ejemplo: «artículos de revista → Crossref, IxTheo».
- **Límites:** años y tipos.

Es una sola llamada, cobrada como la lectura del sílabo. Tiene su propia ruta en `config/llmRouting` y **no usa** el modelo que inventa citas.

### 2 · Ejecutar en las bases abiertas (desde el servidor)

- Crossref para artículos y capítulos, Open Library para libros y la BNE para el español.
- OpenAlex y Google Books, cuando estén sus claves (ver decisiones).

Cada resultado se normaliza a una candidata con:

- un identificador (DOI, ISBN o registro);
- la base y la consulta que la trajo;
- las páginas, cuando las hay, porque un requisito puede medirse en páginas.

Los resultados pasan por la **misma revisión de la 2b**: el grupo «llena un requisito», el grupo «nombra tus pasajes», «ya en tu lista» desmarcado, y nada se guarda hasta confirmar. Cada consulta queda en el **registro de búsquedas** con la base, la consulta, la fecha, cuántas obras trajo y cuántas se agregaron. Así la búsqueda se puede explicar y repetir.

### 3 · Las bases de la disciplina que no se pueden consultar (IxTheo, ATLA, NTA, Dialnet)

El sistema **prepara la búsqueda y la delega**:

- arma la consulta para esa base, con sus campos y sus formas del pasaje;
- abre IxTheo con la búsqueda cargada, o la deja para copiar en ATLA o NTA desde la biblioteca del usuario;
- explica cómo exportar el RIS;
- al importar el RIS (ya existe), el registro anota de qué base vino y con qué consulta.

Así trabaja de verdad quien hace una revisión bibliográfica, y el sistema no aparenta cubrir lo que no cubre.

### 4 · Obras que nombra el asistente: siempre verificadas

Es opcional y queda como complemento: «obras que un especialista nombraría y que las bases no trajeron». Cada sugerencia se busca en las bases y queda en uno de tres estados:

- **Verificada:** coincide con un registro (título parecido, mismo apellido de autor y año compatible) y se toman los datos **del registro**, no los del asistente. Si el asistente dio mal el año o la editorial, se corrige con el registro y se avisa.
- **No encontrada:** puede existir (hay poca cobertura en español y en editoriales confesionales) o puede ser inventada. Queda aparte, **nunca marcada de antemano** y con la nota «búscala antes de usarla». No cuenta para ningún requisito hasta que se ligue a un libro o se le cargue un identificador.
- **Contradicha:** existe una obra con ese título, pero de otro autor u otra época. Se muestra el registro real y la sugerencia se descarta.

**Regla de coincidencia** (en domain, probada):

- palabras del título en común ≥ 0,8 sobre el título más corto;
- el apellido del primer autor coincide;
- el año coincide con ±2 de margen, o está fuera de margen pero el registro es una edición de esa misma obra.

El puntaje de la base no se usa (medido).

### Qué cubre en cada tipo de proyecto

- **Curso:** los requisitos sin cumplir guían la estrategia (faltan artículos, faltan obras antiguas).
- **Investigación sin sílabo:** la guía es la pregunta, con los requisitos del nivel.
- **Exegético de pasaje largo:** la guían las formas del pasaje, una consulta por perícopa.

En los tres casos se complementa con lo que ya hay: la biblioteca, el sílabo y los estudios.

## Medida antes de construir (puerta)

Hay que medir antes de escribir código de producto. Los scripts van en `scripts/rag-eval/`, como los de las etapas anteriores.

1. **M1 · Cuánto inventa el asistente, por modelo.**
   - Pedirle 30 obras para 3 preguntas: Santiago 4:5, Santiago 3:13-18 (la sabiduría) y Rut 1 (חֶסֶד, la lealtad).
   - Verificar **a mano** cada referencia contra las bases y la web.
   - Resultado: la tasa de invención, la de datos errados y la de obras reales, por modelo y por idioma.
   - Con eso se decide si el punto 4 entra, y con qué modelo.
2. **M2 · Cobertura de las bases.** Buscar las ~90 obras del sílabo de NT785 (unas 22 en español y unas 68 en inglés) en Crossref, Open Library y la BNE. Resultado: el porcentaje encontrado por base y por idioma. Eso dice qué significa «no encontrado» en cada caso, y es el texto que verá el usuario.
3. **M3 · La regla de coincidencia.** Sobre el conjunto real de M2, más las inventadas de M1:
   - lo **inventado marcado como verificado** tiene que ser 0 (es la condición para salir);
   - lo real no verificado se mide y se reporta.
4. **M4 · La estrategia contra lo que pide el curso.** Con NT785: ¿las consultas que propone traen el artículo de Laws, los artículos de NTS y obras anteriores a 1950?

Costo estimado (supuesto): M1 son unas 9 llamadas al asistente (3 preguntas por 3 modelos), menos de US$ 0,30. M2 a M4 consultan bases gratuitas. Las claves necesarias se leen dentro de la orden, con el OK de cada lectura.

## Cómo se entrega

Es una fase y un PR, con un commit por unidad:

1. **Medición** (M1 a M4) y su informe en este documento. Es una puerta: si M3 da algún «inventado verificado», no se sigue.
2. **domain:**
   - la estrategia (`LiteratureSearchStrategy`);
   - la referencia verificada (`VerifiedReference`, con `status: 'verified' | 'not-found' | 'contradicted'`, la base, el identificador y los campos que coincidieron);
   - la regla de coincidencia;
   - el origen nuevo de la ficha: `search`, con la base y la consulta.
3. **infrastructure:**
   - adaptadores para Crossref, Open Library y la BNE (SRU y MARC);
   - OpenAlex y Google Books, que se activan solo si está la clave;
   - un tope de velocidad por base y caché por consulta.
4. **functions:**
   - la llamada `searchLiterature`, que hace la estrategia, las consultas y la verificación del lado del servidor (las claves no viajan al navegador);
   - cobro solo por la estrategia y las sugerencias (las bases son gratis);
   - un tope de consultas por usuario.
5. **web:** «Buscar en la literatura» en el paso Requisitos y en Candidatas:
   - la estrategia, editable;
   - ejecutar;
   - la revisión de la 2b;
   - los enlaces a IxTheo y la consulta para ATLA o NTA, con la guía para exportar el RIS;
   - el registro.

Se despliegan functions y hosting, más la ruta nueva en `config/llmRouting`.

## Crítica de este diseño (antes de construirlo)

**Lo que resiste a un académico:**

- El asistente propone **cómo buscar**, no **qué existe**. Las obras salen de registros con identificador.
- La búsqueda es **reproducible**: la estrategia es explícita y cada consulta queda en el registro con la base, la fecha y el resultado.
- **No aparenta cobertura:** las bases que no se pueden consultar se delegan con honestidad y vuelven por RIS.
- **Tres estados de verificación,** por lo medido: lo no encontrado no se da por falso ni por verdadero.

**Lo que falla o queda corto:**

1. **Sesgo de cobertura.**
   - Crossref y Open Library sobrerrepresentan lo académico en inglés.
   - Las editoriales evangélicas en español aparecen poco: está medido con Davids y con Kistemaker.
   - El riesgo es que el estudiante termine leyendo lo que está indexado y no lo que importa. Mitigaciones:
     - la BNE;
     - decir la cobertura de cada base en la pantalla (con el número de M2);
     - que lo «no encontrado» siga a la vista.
2. **El orden de la base no es la importancia académica.** Que Crossref ponga algo primero no lo vuelve central. Esta fase no lo resuelve. Lo resuelven el **rastreo de citas** (paso 5: quién cita a quién, hasta saturar, con OpenAlex) y el **mapa de posiciones** (paso 6). Hay que decirlo en la pantalla: «estos son resultados de búsqueda, no las obras clave».
3. **El sesgo del asistente en la estrategia.** Sus términos y temas pueden traer una sola tradición. Mitigaciones:
   - la estrategia se ve y se edita antes de ejecutarla;
   - si existe el requisito «enfoques opuestos», la estrategia tiene que incluir al menos una consulta por un enfoque distinto, y se revisa al medir.
4. **Lo que no cubre:** tesis (ProQuest es de pago), literatura gris, capítulos de Festschrift mal indexados, e idiomas fuera del inglés, español y alemán. Se declara.
5. **Términos de uso.**
   - Los metadatos de Crossref y OpenAlex son CC0 (supuesto para los dos, por su documentación pública; hay que confirmarlo leyendo la licencia).
   - Google Books pide atribución al mostrar.
   - En la BNE hay que leer los términos de reutilización antes de construir.
6. **Dependencia de terceros:** topes de velocidad, cambios de precio (OpenAlex ya pasó a cobrar en febrero de 2026) y muros contra bots (IxTheo). Mitigaciones: adaptadores aislados, caché y, si una base falla, el resto sigue y se avisa cuál faltó.

**Mejoras, por valor y costo:**

| Mejora | Valor | Costo | Cuándo |
|---|---|---|---|
| Estrategia declarada más bases abiertas más registro | Alto | Medio | Esta fase |
| Delegar en IxTheo, ATLA y NTA, y volver por RIS | Alto | Bajo (el RIS ya está) | Esta fase |
| Verificar las sugerencias del asistente | Medio (depende de M1) | Medio | Esta fase, si M1 y M3 lo permiten |
| Rastreo de citas con saturación (OpenAlex) | Alto | Medio | Paso 5, la fase siguiente |
| Mapa de posiciones por pregunta | Alto | Alto | Paso 6 |
| Dialnet por OAI-PMH | Medio (español) | Alto (es un recolector, no una búsqueda) | Más adelante, si M2 muestra el hueco |

## Decisiones del fundador (2026-10-23)

1. **Versión 1 sin integraciones:** guía de qué buscar y dónde, más títulos reconocidos.
2. **La lista sale del catálogo curado y verificado,** no del asistente al momento.
3. **Libros primero:** Santiago, Jonás, Rut, 2 Pedro y **Nehemías** (el próximo proyecto, para una serie expositiva).
4. **La guía va con reglas fijas:** sin costo y sin el asistente.
5. **Las claves de OpenAlex y Google Books** quedan para la versión 2.

## Fuentes de lo leído

- OpenAlex: claves y precios desde 2026 ([autenticación](https://developers.openalex.org/api-reference/authentication), [límites](https://docs.openalex.org/how-to-use-the-api/rate-limits-and-authentication)); confirmado por el aviso que la propia API devolvió sin clave.
- Crossref: límites del grupo de cortesía ([anuncio](https://crossref.org/blog/announcing-changes-to-rest-api-rate-limits/)).
- IxTheo: VuFind, 4 millones de registros, búsqueda por pasaje bíblico ([Wikipedia](https://en.wikipedia.org/wiki/Index_Theologicus)); el muro anti-bots, medido.
- Dialnet: OAI-PMH en `https://dialnet.unirioja.es/oai/OAIHandler` ([política de interoperabilidad de una revista](https://revistas.um.es/red/metadatos)).
