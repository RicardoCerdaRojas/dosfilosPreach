# Fase: la biblioteca consultable · octubre 2026

> **Estado: APROBADA (2026-10-15).** El fundador hizo dos comentarios: la mejora de Facultad queda documentada para una fase posterior (al final), y los resúmenes son breves y leen poco (U7).

**Qué resuelve.** Hoy el pastor puede abrir un libro de su biblioteca en el visor y buscar una palabra, pero no puede preguntarle nada a sus libros desde la Biblioteca. Pidió (2026-10-15) dos cosas:

1. Buscar hebreo y griego sin tener que escribir vocales, acentos ni espíritus. Probando con la BHS del Salmo 23 vimos que «Buscar en el libro» exige la palabra con todos sus puntos.
2. «Si ya tenemos la capacidad de preguntar a un PDF, deberíamos tener esa funcionalidad en la biblioteca para que yo como pastor pueda buscar información, encontrar temas, resúmenes».

**Lo que ya existe** (revisado en el código el 2026-10-15):

- **Búsqueda en el libro:** el callable `searchDocumentText` tiene cuatro modos.
  - **`texto`:** es el único que usa el visor. Pliega mayúsculas y comillas, pero no quita el niqud ni los acentos griegos.
  - **`lema`:** compara por consonantes hebreas o por griego plegado (sin acentos, ς→σ). Desde la web no lo usa nadie.
  - **`lemas` y `referencia`:** sirven para léxicos y para buscar un versículo citado en todo el libro, en las formas «Stg 3:13», «James 3.13» y otras.
- **El chat de Facultad ya consulta la biblioteca personal.** Usa `retrieveChunks` con `userId`, o con `resourceIds` si la sesión es de un trabajo. Tiene cuatro problemas:
  - cita la **hoja del archivo**, no la página impresa;
  - la cita no abre el visor;
  - no se pueden elegir los libros;
  - no pasa por `config/llmRouting`.
- **`document_chunks`** guarda `metadata.page` (la hoja), `section` y `sectionPath`, y un embedding de 768 dimensiones. Tiene índices vectoriales por `userId`, por `resourceId`+`userId` y por `stores`. `retrieveChunks` acepta como máximo 30 `resourceIds`; con más libros hay que buscar por `userId`.
- **De hoja a página impresa:** `printedOfSheet` / `PageNumbering`, la misma regla que usa el visor para «(Varner, p. 188)».
- **En la página de la Biblioteca** no hay nada para preguntar, resumir ni buscar temas.

**Decisiones del fundador (2026-10-15):**

1. **Dónde:** una pestaña **«Consultar»** en la Biblioteca, que busca en toda la biblioteca o en los libros elegidos, y **«Preguntar a este libro»** dentro del visor.
2. **Qué hace:** las cuatro cosas. Preguntar con citas, qué dicen mis libros sobre un pasaje, resumir un libro o un capítulo, y buscar temas.
3. **Historial:** las consultas se guardan, se puede volver a ellas, y una respuesta se puede llevar a un trabajo o a las ideas de un sermón.

**Reglas para toda la fase:**

- **Toda cita lleva la página impresa** («Autor, p. N»), o la hoja si el libro no tiene numeración, igual que en el visor. Cada cita es pulsable y abre el visor en esa página.
- **Se responde sólo con lo que hay en los libros.** Si los fragmentos no alcanzan, la respuesta lo dice y no completa con lo que el asistente «sabe». Es la regla de fidelidad de las citas (`docs/pastoral-fidelity/07-citation-policy`).
- **En la interfaz no aparecen «IA», «modelo» ni nombres de proveedores.** El que responde es «el asistente».
- **Cada función nueva tiene su ruta en `config/llmRouting`**, con Luna por defecto, para poder cambiar de modelo sin desplegar.
- **Facultad no se toca en esta fase.** Si el motor nuevo resulta mejor, Facultad pasa a usarlo en otra fase.

**Cómo se entrega.** Dos PRs, uno por etapa, con un commit por unidad. Antes de cada PR: pruebas locales, mutaciones y revisión adversarial.

---

## Etapa 1: buscar y preguntar (un PR)

### U1. Búsqueda que ignora vocales y acentos

- **El modo `texto` pliega además:**
  - el niqud y la cantilación hebrea (U+0591–U+05C7, sin tocar las letras), y quita el maqaf;
  - los acentos y espíritus griegos (NFD sin las marcas combinantes), la iota suscrita y la sigma final (ς→σ);
  - los acentos latinos, para que «exegesis» encuentre «exégesis».
- **El plegado sigue conservando las posiciones del texto original** (`sourceIndex`), para que el fragmento mostrado y el resaltado caigan sobre la palabra con sus puntos.
- **El resaltado en la hoja** (`normalizeForSearch` en domain) se pliega igual. Hay una prueba de paridad entre servidor y domain; ya existe una para `lemmaKey`.
- **Prueba de aceptación:**
  - en la BHS del Salmo 23, «גיא» encuentra «בְּגֵ֪יא» en 23:4 y lo resalta;
  - en Varner, «προ παντων» encuentra «πρὸ πάντων» en las hojas 189–190 (pp. 185–186).
- **Costo:** nada nuevo. Es la misma lectura del libro (1,5–1,8 s en Robertson, medido el 2026-10-14).

### U2. El motor de consulta (servidor)

- **Callable `consultarBiblioteca`.** Recibe la pregunta, el alcance (toda la biblioteca, una lista de libros, o un libro) y el id de la consulta si continúa una anterior.
  - **Recuperación:** `retrieveChunks`. Con un libro o una lista corta, usa `perResourceTopK` para que ningún libro se coma el contexto. Con toda la biblioteca, o con más de 30 libros, usa `userId`.
  - **Cada fragmento se pasa a página impresa en el servidor** antes de mandarlo al modelo, y el modelo cita por clave y página. Las citas que devuelve se comprueban contra los fragmentos recuperados: una cita que no está en ellos se quita.
  - **Ruta `library.consult`**, con Luna por defecto.
- **Historial:** colección `library_consultations/{id}`, con `userId`, título, alcance, `createdAt` y los turnos (pregunta, respuesta y citas resueltas: recurso, hoja, página impresa y extracto). Las reglas de Firestore restringen todo al dueño.
- **Saldo:** cada respuesta descuenta del saldo de procesamiento como el resto de las funciones con el asistente. *Antes de U2 hay que revisar cuánto cobra hoy Facultad, para no cobrar distinto la misma cosa.*

### U3. La pestaña «Consultar» en la Biblioteca

- **A la izquierda, el historial**, con las consultas guardadas y el botón «Nueva consulta».
- **En el centro, la conversación:**
  - un selector de alcance: «Toda mi biblioteca», «Estos libros…» (eligiendo de la lista) o un libro;
  - cada respuesta trae citas pulsables que abren el visor ampliado en esa página. Es el mismo visor de la fase F, y ahí «Copiar la cita» funciona igual;
  - debajo de cada respuesta, «Fuentes»: la lista de libros y páginas que se usaron.
- **Acciones sobre una respuesta:**
  - «Copiar» (con las citas);
  - «Llevar a un trabajo», que la agrega como nota del trabajo que se elija;
  - «Llevar a las ideas de un sermón», usando el mismo camino de «Agregar una idea» (#767).
- **Celular:** el historial pasa a un menú.

### U4. «Preguntar a este libro» en el visor

- **En el visor ampliado,** junto a «Buscar en el libro», hay un cajón «Preguntar» que usa el mismo motor con alcance de un libro. Las citas mueven el visor a esa página sin cerrarlo.
- **La conversación se guarda en el historial** de la Biblioteca, con el libro como alcance.

### U5. Buscar temas

- **«¿Dónde se habla de la oración en mis libros?»** Es una búsqueda por significado (los embeddings que ya existen), **sin respuesta redactada**.
- **Devuelve libros y páginas impresas**, agrupados por libro, con el extracto y la sección (`sectionPath`). Se ordenan por relevancia, y cada resultado abre el visor.
- **Es rápida y barata:** sólo hace el embedding de la consulta, sin generación. Se ofrece como un modo de la misma pestaña («Buscar temas» / «Preguntar»).

---

## Etapa 2: pasajes y resúmenes (otro PR)

### U6. «¿Qué dicen mis libros sobre Santiago 3:13?»

- **Si la consulta es una referencia bíblica,** se busca el pasaje con el modo `referencia`, que ya existe, en cada libro del alcance (con concurrencia limitada).
- **Para cada libro con apariciones,** se toman las páginas y se arma una respuesta **por autor**: «Varner (p. 120) entiende… McCartney (pp. 203–204) …». Cada autor lleva sus citas.
- **Riesgo medido:** buscar en un libro tarda 1,5–1,8 s. Con 60 libros en paralelo de a 8, serían unos 12–15 s (es una *suposición, a medir en U6*). Si es mucho, se precalcula un índice de referencias por libro al indexar, que es el camino que ya usa `documentPageIndex`.

### U7. Resúmenes breves que leen poco

**Decisión del fundador (2026-10-15):** los resúmenes tienen que ser breves, para no comprometer el costo. El costo lo pone sobre todo lo que se **lee** (los tokens de entrada), no el largo del resumen. Por eso hay dos reglas: un resumen corto, y un tope a lo que se lee.

- **Capítulo o tramo de páginas:** se leen sólo los fragmentos de ese tramo (`metadata.page`), con un tope de **60 páginas**. Si el tramo es más largo, se pide uno más corto. El resultado tiene a lo sumo **250 palabras**, más 3 a 5 ideas principales, cada una con su página impresa.
- **Libro entero, como «mapa del libro»:** no se lee el libro. Se arma con el índice de secciones (`sectionPath`, que ya está en los fragmentos) y con el **primer fragmento de cada sección**. El resultado tiene a lo sumo **300 palabras**, más la lista de temas, cada uno con sus páginas. Para entrar en detalle, se pide el resumen de un capítulo.
- **Caché:** `library_summaries/{resourceId}_{tramo}`. Pedirlo otra vez no cuesta. Se invalida cuando el libro se reextrae (`extractedAt`).
- **Costo:**
  - *supuesto, a medir en U7:* un capítulo de 60 páginas son unos 45.000 tokens de entrada, del orden de centavos. El mapa de un libro de 800 páginas, con unas 150 secciones, son unos 50.000 tokens, también centavos;
  - leer el libro entero rondaría los 600.000 tokens, y eso es lo que se evita.
- **Ruta en el ruteo:** `library.summarize`.

---

## Fuera de esta fase

- Pasar Facultad al motor nuevo. Es una fase posterior, descrita abajo.
- Consultar la biblioteca común del sistema (`__system__`), que hoy está vacía.
- Comparar dos autores lado a lado como función propia. La U6 ya lo cubre en parte, agrupando por autor.

## Terminado

Desplegado y probado por el fundador en producción con su biblioteca:

- buscar «גיא» en el Salmo 23 y «προ παντων» en Varner;
- preguntar algo de Santiago a «toda mi biblioteca» y abrir una cita;
- preguntar a un libro desde el visor;
- buscar un tema;
- (etapa 2) «¿Qué dicen mis libros sobre Santiago 3:13?»;
- (etapa 2) resumir un capítulo de un comentario.

---

## Fase posterior: el chat de Facultad sobre el motor nuevo

**Decisión del fundador (2026-10-15):** queda documentada para después de esta fase.

**Qué le falta hoy a Facultad** (revisado en el código el 2026-10-15):

- **Cita la hoja del archivo** («p.» en `CoreLibraryRAGService.formatContextForPrompt` es `metadata.page`), no la página impresa. Una cita de Facultad no coincide con la del libro impreso.
- **Las citas no son pulsables** y no abren el visor.
- **No se pueden elegir los libros.** Busca en toda la biblioteca personal (`userId`) o en las fuentes del trabajo si la sesión es de uno.
- **No pasa por `config/llmRouting`:** usa Gemini directo (`body.model` o `MODEL_FAST`) en `facultyChatStream.ts`.
- **Un PDF adjunto** se manda entero al modelo de visión, sin páginas ni anclas.

**Qué se haría:**

1. **Facultad recupera y cita con el motor de `consultarBiblioteca`:** página impresa y comprobación de que cada cita está en los fragmentos.
2. **Citas pulsables** que abren el visor, con el mismo componente de la pestaña «Consultar».
3. **Selector de alcance** en la sesión: toda la biblioteca, estos libros, o el trabajo.
4. **Su ruta en `config/llmRouting`**, para que Facultad también pueda cambiar de modelo sin desplegar.
5. **El PDF adjunto,** si ya está en la biblioteca, se consulta por sus fragmentos con página y no se manda entero.

**Depende de:** las U2 y U3 de esta fase, desplegadas y probadas.

