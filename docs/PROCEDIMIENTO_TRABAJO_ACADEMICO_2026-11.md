# Procedimiento para un trabajo académico de exégesis y sermón

> **Qué es.** El procedimiento con que se hizo el TI #3 de OT603 (Salmo 23:1–6,
> síntesis exegética de 6 páginas + sermón de 15), escrito para repetirlo en otro
> trabajo de seminario. Dice **qué se hace, en qué orden, con qué control y qué
> tiene que existir para pasar al paso siguiente.**
>
> **Documentos hermanos** (el caso concreto):
> - `BITACORA_TI3_SALMO23_2026-11.md`: qué se hizo y cuándo (pasos 1–41) y lo que
>   la plataforma no cubre (§6).
> - `METODO_TI3_SALMO23_2026-11.md`: por qué se hizo así, de dónde sale cada regla
>   y las decisiones de redacción R1–R50.
>
> **Para quién.** El fundador, cuando haga otro trabajo; un asistente que lo
> acompañe; y el equipo que lleve este flujo a la plataforma (la sección 9 dice qué
> pasos se pueden automatizar).
>
> Escrito el 2026-11-17, día de cierre del TI #3.

## 1. Principios

Estos principios gobiernan todos los pasos. Cada uno nació de un error real, que se
indica entre paréntesis.

1. **Una sola glosa de principio a fin.** La traducción aprobada es un contrato:
   el análisis, la conclusión y el sermón la usan sin variar. Si una glosa cambia,
   se declara y se justifica (el TI #2 perdió el punto de coherencia por
   «rebosante»).
2. **Lo que viene después descansa en lo anterior.** La Parte 2 no afirma nada que
   la Parte 1 no haya argumentado, ni contradice un matiz que la Parte 1 negó. Esto
   incluye los **tiempos verbales**, no solo las glosas (en el sermón, el v. 6 se
   deslizó al presente).
3. **Medir, no estimar.** El tope de páginas se mide en Word desde el primer
   borrador (un presupuesto en palabras subestimó la Parte 1 en 4 páginas).
4. **Toda afirmación con su rótulo: medido, leído o supuesto.** Toda regla de forma
   se cita de su fuente (la Guía TMS, el enunciado, la devolución), no se copia de
   un trabajo anterior.
5. **Un revisor que no vea las decisiones propias.** Cada revisión la hace un
   revisor independiente que recibe el texto y las reglas, no las notas de método.
   **Lo que encuentra se verifica en la fuente antes de aplicarlo.**
6. **El autor decide, viendo el texto.** Cada punto de aprobación se presenta como
   opciones con el texto de cada alternativa a la vista, nunca descritas en prosa
   (las decisiones descritas en prosa no se entendieron).
7. **La voz del autor manda; la glosa y la gramática son reglas.** Sus ediciones se
   respetan. Si una edición rompe la glosa o la gramática, se le propone el ajuste
   y se pide su OK.
8. **Nada se pierde ni se sobrescribe.** Antes de cada lote se guarda una copia, y
   cada parte aprobada se congela en solo lectura. Antes de tocar un archivo que el
   autor editó, se leen sus cambios.

## 2. Roles

| Rol | Hace | No hace |
|---|---|---|
| **Autor** (el estudiante) | Decide en cada punto de aprobación; lee en voz alta; edita en Word con control de cambios; entrega | — |
| **Asistente redactor** | Lee las entradas, propone, redacta, mide, verifica y aplica lo aprobado; lleva la bitácora y el método | Decidir por el autor; aplicar un hallazgo sin verificarlo; sobrescribir el texto del autor |
| **Revisores independientes** (subagentes) | Una revisión por paso, cada una con un foco: argumento, citas, coherencia, voz, documento final | Ver el contrato, el esquema o el método; cambiar archivos (solo proponen, con el texto antes y después) |

## 3. Carpetas y archivos

```
<Drive>/<curso>/Trabajo-Investigacion-N/
  00_LEEME.md
  01_Referencias_del_curso/   enunciado, plan de estudio, clases, lecturas
  02_Fuentes/                 Articulos/, Comentarios/, _descartadas/
  03_Borradores/              Markdown fuente + Word para comentar + copias por lote
     ParteN_APROBADA_<fecha>/ copia congelada, solo lectura (.md, .docx, vista .pdf)
  04_Entrega/                 Word final + PDF
  05_Respaldo_citas/          imagen de cada página citada + 00_INDICE*.md
repo/docs/                    BITACORA_<trabajo>.md, METODO_<trabajo>.md
repo/research_notes/<trabajo>/herramientas/   scripts (sección 8)
```

- **La fuente de verdad del texto es el Markdown** (`03_Borradores/…md`). El Word se
  genera desde él para medir y para que el autor comente. Los cambios del autor se
  leen del .docx y se llevan al Markdown.
- **Excepción:** cuando el autor edita el Word final sin control de cambios, ese
  Word pasa a ser la fuente. Desde ahí no se regenera: se corrige sobre una copia de
  su archivo.
- **El texto de los libros nunca va al repositorio.** Las imágenes de páginas, los
  extractos y los PDF descargados van a Drive o al scratchpad.

## 4. Las etapas

Cada etapa termina con una **condición de salida**: lo que tiene que existir para
pasar a la siguiente. Los puntos de aprobación del autor se marcan con ✋.

### Etapa 0. Entradas: leer todo antes de diseñar

Hay que leerlo **todo**, y registrar cada entrada en la bitácora §0 con su estado
(leído, pendiente o falta):

| Entrada | Por qué es obligatoria |
|---|---|
| Enunciado del profesor (Canvas) | Manda sobre el plan de estudio si se contradicen (fechas, topes) |
| Plan de estudio y **rúbrica** | La rúbrica dice qué se califica; en OT603 calificaba el orden de la metodología |
| **Transcripciones de las clases** | Traen el método del profesor, su definición del género y su criterio cristológico. En el TI #3 se leyeron el día 2: tienen que entrar el día 1 |
| Trabajos anteriores entregados (TI #1, TI #2) | Las glosas y los argumentos que hay que mantener |
| **Devolución anterior**: comentario general y cada anotación del PDF | Se clasifican por tipo (coherencia, evidencia, forma) y se convierten en reglas (`leer_anotaciones.mjs` extrae las anotaciones con pdf.js) |
| Guía de estilo de la institución (TMS 2024–2025) | Es la fuente de toda regla de forma. Estaba en la carpeta de otro curso |
| Lecturas asignadas (p. ej., Russell, cap. 14) | Ponen límites al género y a la aplicación |
| Inventario de fuentes: biblioteca de la plataforma, Drive y biblioteca institucional | Para cada necesidad de la devolución (léxico, crítica textual, comentario reciente, artículo) se registra qué hay y qué falta |
| Plazo y reglas de entrega | En el TI #2 se perdió un 10 % por atraso |

**Productos:**
- **reglas de coherencia** (bitácora §2), que salen de la devolución;
- **tabla de glosas** (bitácora §3), con el versículo, el hebreo, la glosa, el rasgo
  que la sostiene, el trabajo donde se defendió y la versión del oyente;
- **tope traducido** al formato real del trabajo (hay que medirlo; ver la etapa 3);
- **lista de criterios del profesor**, los patrones que ya penalizó.

**Condición de salida:** todas las entradas están leídas o tienen el rótulo «falta».

### Etapa 1. Contrato ✋ (punto de aprobación 1)

Documento `Etapa1_Contrato_glosas_traduccion_tesis.md` con:
- la traducción completa;
- la tesis en una oración, con la oración de pruebas en la siguiente;
- la estructura del texto con sus fuentes;
- cada decisión con esta plantilla: glosa, rasgo hebreo, fuente, lectura rival con
  su argumento principal, respuesta, y **matiz que pasa a la Parte 2**.

**Controles:**
- cada glosa cita su gramática o su léxico;
- **cada lectura rival se busca en la biblioteca**, para citar quién la sostiene (en
  el TI #2 se refutó la «meseta de pastoreo» sin fuente, y Ross 566 n. 32 estaba en
  la biblioteca);
- se lista lo que cambia respecto de los trabajos entregados, con su razón.

**Condición de salida:** el autor aprueba la tesis, la traducción y las decisiones.

### Etapa 2. Esquema ✋ (punto de aprobación 2)

- **Mapa tesis → cuerpo:** cada elemento de la tesis tiene su sección y su decisión.
  La conclusión solo puede retomar lo que está en el mapa.
- **Orden justificado** con el método del profesor (en OT603: forma → contenido →
  función). La justificación queda escrita en el método §3, porque la rúbrica la
  califica.
- **Presupuesto por sección**, y un **orden de recorte que protege los argumentos
  que el profesor elogió**.

**Condición de salida:** el autor aprueba el orden.

### Etapa 3. Redacción medida

- Se redacta en Markdown con notas `[^n]`.
- **Se mide en Word desde la primera versión:** `medir.sh <borrador.md>
  <nombre_único>` genera el Word con los estilos de la plantilla, lo exporta a PDF
  con Word y cuenta las páginas. Hay que dejar un margen de ¼ de página como mínimo.
- Si pasa del tope, se recorta en este orden:
  1. unir las notas que respaldan la misma afirmación (una nota por oración);
  2. sacar de las notas lo que el cuerpo ya dice;
  3. acortar las fuentes de apoyo secundarias.

  Los argumentos protegidos no se tocan.
- Cada versión que se descarta se guarda con un nombre que dice por qué
  (`…_v1_10pp.md`).

**Condición de salida:** la parte cabe en el tope, medida en Word.

### Etapas 4–7. Las cuatro revisiones independientes

Las cuatro revisiones siguen el mismo patrón:
1. El revisor recibe el texto y las reglas que le corresponden, **sin** el contrato,
   el esquema ni el método.
2. Entrega una tabla de hallazgos ordenada por gravedad, con el texto antes y
   después.
3. **Cada hallazgo se verifica en la fuente o en el texto antes de aplicarlo**, y
   se registra cuáles se aplicaron, cuáles no y por qué.
4. Después de aplicar, se vuelve a medir.

| # | Revisión | El revisor recibe | Busca | Qué encontró en el TI #3 |
|---|---|---|---|---|
| 4 | **Argumento y fidelidad** | Texto, enunciado, devolución, criterios del profesor, Guía, fuentes locales; en la Parte 2, también la Parte 1 aprobada | Criterios que no discriminan, respuestas débiles a las rivales, fuentes torcidas al resumir, argumentos elogiados que se perdieron, glosas o matices que la Parte 1 negó, aplicaciones que exceden el género, conexiones con Cristo sin anclaje textual | 27 hallazgos (P1) y 20 (P2). Entre ellos, el argumento «central» del TI #2 se había perdido en el recorte, y el sujeto de «volveré» estaba cambiado |
| 5 | **Citas comprobables** | Cada nota con su fuente | Que la página impresa diga lo citado, con el desfase hoja → página calibrado por libro y un extracto como evidencia | 71 citas en la P1: 0 falsas y 13 ajustes (página, alcance o atribución). P2: 32/32 citas bíblicas verificadas por script |
| 6 | **Coherencia del documento entero** | **Todo el documento de una vez** (P1 + P2) | Contradicciones entre partes; la proposición frente a la tesis; la misma glosa y **los mismos tiempos** en cada lectura; la conclusión frente al cuerpo | P1: los 3 hallazgos altos estaban en los tiempos verbales. P2: el v. 6 en presente y el Sal 27:4 usado al revés |
| 7 | **Español y voz del autor** | Texto, voz medida del autor, trabajos entregados, Guía, reglas de «escribir para el oído» (sermón) | Calcos, muletillas, coma Oxford, orden que confunde, oraciones que no se entienden en voz alta. **Solo propone; no toca el contenido ni alarga** | 20 propuestas en cada parte; el autor revisó la lista y eligió |

**El paso 5 en detalle:**
- **Biblioteca de la plataforma:** se lee solo con el OK del autor, con scripts de
  solo lectura (`.ti3-verificar.ts`, `.ti3-creditos.ts`). El desfase se calibra
  con una página de número conocido (índice, remisión interna o foto del libro).
- **PDF locales:** un revisor independiente, y verificación propia de las
  correcciones de mayor peso.
- **Respaldo:** cada página citada se guarda como imagen en `05_Respaldo_citas/`, con
  un índice nota → archivo generado por script (`indice_respaldo.py`). El índice
  también detecta «Ibid.» rotos después de renumerar.
- **Citas bíblicas:** `verificar_citas_biblicas.py` compara el pasaje con la
  traducción aprobada y los demás libros con la versión del oyente (RV1960 del
  repo). Se prueba con una mutación (por ejemplo, «nada me faltará» tiene que
  fallar).

### Etapa 8. Validación del autor ✋

- Se genera un Word para comentar (`…_vN_para_comentarios.docx`). El autor comenta
  y edita **con control de cambios**.
- Sus comentarios (`word/comments.xml`) y ediciones (las marcas de revisión) se
  leen del .docx; se hace un diff completo para confirmar que no hay cambios sin
  control.
- Si lo pide, una sección se explica **«en simple»**. Sirve como prueba de
  coherencia, porque aparecen las preguntas que el texto deja implícitas.
- Las preguntas del autor («¿qué significa?», «¿no es redundante?», «¿cómo se oye en
  mi iglesia?») se responden con la razón y, si corresponde, con opciones.
- **Lectura en voz alta**, con las notas incluidas, a cargo del autor.

### Etapa 9. Cada cambio

Se guarda una copia de la versión anterior; el cambio se aplica en el Markdown, se
mide y se genera un Word nuevo. Si cambian las notas, se regenera el índice de
respaldo y se vuelven a verificar las citas bíblicas. **No se restaura con `git
checkout`, sino con la copia.**

### Etapa 10. Cierre de la parte ✋

Con la aprobación del autor:
1. Se congela una copia en solo lectura en `ParteN_APROBADA_<fecha>/` (.md, .docx y
   vista), con el SHA-256 del .md anotado en el método.
2. Se registra la aprobación en la bitácora y en el método.

La parte siguiente no modifica la congelada. Si obliga a tocarla, se vuelve a pedir
aprobación.

### Etapa 11. Sermón (Parte 2): entradas y puntos de aprobación propios

Se repiten las etapas 2 a 10, con estas entradas y decisiones adicionales:
- **Proposición ✋:** se presentan 2 o 3 opciones con el texto a la vista; cada una
  muestra de qué parte de la tesis sale. Después, los títulos de los puntos, cortos
  y anclados en sus versículos.
- **Esquema ✋:** el título, la ilustración, el registro («nosotros» en la
  exposición y «tú» en las aplicaciones), y el **mapa Parte 1 → Parte 2** con su
  **lista de prohibiciones**, sacada de lo que la Parte 1 negó (en el Salmo 23: el
  v. 6 no es «el cielo», «nada me falta» no es una promesa, la copa no rebosa,
  etc.).
- **Skill `sermon-expositivo` con 6 adaptaciones** (bitácora §4d):
  - la traducción propia en lugar de la RV1960;
  - sin el campo «Palabras clave»;
  - la Parte 1 reemplaza la Fase 1;
  - formato académico con notas al pie;
  - la extensión del enunciado;
  - sin la Fase 0.
- **La Biblia del oyente:** se lee la traducción propia y se explica la RV1960 donde
  difiere. Es una decisión del autor que hay que plantear explícitamente.
- **Cristo sin cristocentrismo:** toda conexión con el Nuevo Testamento necesita una
  palabra o un motivo compartido que se pueda mostrar en los dos textos. Se revisa
  en particular al ampliar el texto, porque ahí aparece la tentación de alegorizar.

### Etapa 12. Documento de entrega

1. `armar_entrega.py` arma el Word: portada de la plantilla con los datos nuevos,
   CONTENIDO estático, Parte 1, Parte 2 en página nueva, notas de corrido y
   bibliografía con el formato de la Guía.
2. **CONTENIDO en dos pasadas:**
   - se genera el Word y se exporta a PDF;
   - `paginas_contenido.py` ubica cada título en el PDF;
   - se regenera con esas páginas;
   - se comprueba que los números no cambien entre pasadas.
3. **Cada parte se mide por separado** contra su tope.
4. Si el autor edita el Word final, ese Word es la fuente (sección 3). Hay que
   confirmar que los números del CONTENIDO sigan en su PDF.

### Etapa 13. Revisión final del documento entero ✋

**Va antes de que el autor dé el documento por cerrado** (en el TI #3 llegó
después, y sus hallazgos quedaron sin aplicar). Revisor independiente sobre el Word
y el PDF del autor, con tres focos:
- **coherencia:** entre las partes, y del CONTENIDO frente a los títulos y las
  páginas;
- **voz:** también los restos de edición;
- **forma:** contra la Guía y las marcas del profesor, **mirando el PDF**.

Restricciones del revisor: la portada no se toca, nada se alarga y no se reabren
decisiones aprobadas. Los hallazgos se verifican contra la Guía y el texto, y se
presentan al autor como tabla con el texto antes y después. **El autor decide si se
aplican.**

*En el TI #3:*
- 21 hallazgos, de los cuales 2 altos.
- Uno se corrigió al verificarlo: la Guía no pone coma Oxford en la nota completa
  de tres autores, pero sí en la abreviada y en la bibliografía.
- El autor decidió entregar sin más cambios.

### Etapa 14. Entrega y cierre

- El autor entrega en Canvas antes del plazo; se registra la fecha y la hora.
- La bitácora se cierra con el análisis de lo que la plataforma no cubrió.
- Cuando llegue la devolución, se clasifica (etapa 0 del trabajo siguiente) y se
  contrasta con lo que este procedimiento revisó y lo que no.

## 5. Controles transversales (antes de dar cualquier parte por terminada)

- [ ] Las reglas de coherencia de la bitácora §2, una por una.
- [ ] Los criterios del profesor (memoria `project_criterios_profesor_tp`).
- [ ] El mapa tesis → cuerpo: la conclusión no afirma nada que no esté en el mapa.
- [ ] Cada glosa, y cada tiempo verbal, sale de la traducción aprobada.
- [ ] La tesis se repite con las mismas palabras en la introducción y la conclusión;
      la proposición, con las mismas palabras en cada repaso.
- [ ] Forma de la Guía: SEÑOR en versalitas; raya corta en los rangos; comillas « »
      con “ ” dentro; coma Oxford; «5ta ed.»; país en las ciudades menos conocidas;
      cita completa antes que la abreviada; «en adelante» para BDB e IBHS; títulos
      en negrita.
- [ ] Páginas medidas en Word, cada parte contra su tope.
- [ ] Todas las notas que citan página tienen su imagen en el respaldo.
- [ ] Las citas bíblicas, verificadas por script.
- [ ] Lectura en voz alta del autor.

## 6. Reglas de interacción con el autor

- Las decisiones se presentan como **opciones con el texto de cada una a la vista**,
  con la recomendada primero y su razón.
- Las listas de cambios se muestran **antes** de aplicarlas, con el texto antes y
  después. El autor puede sacar ítems («no apliques la 17»).
- Si el autor pide algo que rompe la glosa o el argumento, se explica el costo con
  el texto y se le deja decidir (caso «nos perseguirán»: se explicó y lo mantuvo).
- Si una explicación técnica no se entiende, se explica en simple y, si hace falta,
  se ajusta la redacción del trabajo (caso «polel»).
- Antes de tocar un archivo que el autor tuvo abierto, se leen sus cambios; si sigue
  abierto en Word, se le pide cerrarlo o se trabaja sobre una copia.

## 7. Reglas de seguridad y de costo

- Leer la biblioteca de producción requiere el OK del autor, cada vez que sea una
  lectura nueva. Los scripts son de solo lectura.
- Las API de OpenAI y Gemini son prepagas y compartidas con producción: hay que
  avisar antes de cualquier llamada con costo.
- Los secretos solo van dentro de la orden; nunca se muestran ni se guardan.
- El texto de los libros no va al repositorio. Las bitácoras sí, porque registran
  el proceso, no el contenido.

## 8. Herramientas

Todas viven en `research_notes/ti3_salmo23_2026-11/herramientas/`. Son
reutilizables cambiando la plantilla y los datos.

| Herramienta | Qué hace |
|---|---|
| `plantilla_ti2/` (**solo local**, se recrea descomprimiendo el TI #2 de Drive) | Word entregado y descomprimido; aporta los estilos, la portada, el CONTENIDO y las secciones |
| `md2docx_tms.py` | Markdown → .docx con los estilos de la Guía. Maneja: hebreo RTL; SEÑOR en versalitas; cursiva y negrita; notas; citas en bloque; listas en párrafos separados (corregido el 17-nov: antes unía los ítems) |
| `medir.sh` | .md → .docx → PDF por Word (AppleScript) → páginas con `pdfinfo` |
| `armar_entrega.py` | Documento completo: portada, CONTENIDO, partes y bibliografía |
| `paginas_contenido.py` | Ubica los títulos en el PDF para el CONTENIDO (salta las líneas del bosquejo) |
| `renumerar.py` | Renumera las notas; se detiene si queda una definición sin uso |
| `indice_respaldo.py` | Índice nota → imagen de respaldo; detecta «Ibid.» rotos |
| `verificar_citas_biblicas.py`, `rvr.py` | Citas del pasaje contra la traducción aprobada; las demás, contra la RV1960 del repo |
| `scripts/rag-eval/.ti3-*.ts` (**solo locales**, no están en el repo) | Lectura de solo lectura en la biblioteca de producción: buscar, verificar, créditos, almacenamiento, descarga |
| `leer_anotaciones.mjs` | Extrae las anotaciones del PDF devuelto por el profesor |

**Trampas conocidas:**
- Word acepta `open file name` y `save as` por AppleScript, pero no `close`: hay que
  usar un nombre nuevo en cada exportación y trabajar en
  `~/Library/Containers/com.microsoft.Word/Data/`.
- El conjunto de datos de la RV1960 tiene ids engañosos: «jn» = Jonás, «jo» = Juan,
  «hb» = Hebreos, y aparece un «/n» literal dentro de los versículos.
- El CONTENIDO de Word es un campo que pide actualizarse con un diálogo; por eso se
  calcula aparte.
- Un EPUB puede venir sin paginación impresa (Goldingay): sin ella no se puede citar
  por página.
- Una descarga «PDF» puede ser una imagen de error: hay que validarla con `file`.

## 9. Qué se puede llevar a la plataforma

El detalle está en la bitácora §6 (17 carencias). En resumen, por etapa:

| Etapa | Automatizable | Necesita al autor |
|---|---|---|
| 0 | Leer las anotaciones de la devolución y clasificarlas; pedir las clases, la rúbrica y la Guía como entradas obligatorias | Subir el enunciado y las clases |
| 1 | Tabla de glosas del proyecto; buscar en la biblioteca quién sostiene cada rival | Aprobar el contrato |
| 2 | Mapa tesis → cuerpo y aviso si la conclusión nombra algo fuera del mapa | Aprobar el orden |
| 3 | Medir el documento exportado contra el tope | — |
| 4–7 | Revisores independientes con su foco; verificación de citas con extracto e imagen guardados junto a cada nota | Elegir qué se aplica |
| 8 | Word para comentar y lectura de vuelta de comentarios y ediciones; «explícame en simple» | Leer en voz alta y validar |
| 11 | Que el sermón herede las glosas **y los tiempos** de la Parte 1; el género como límite de la aplicación; la regla cristotélica | Decidir qué Biblia se lee |
| 12 | Armar el documento completo con portada, índice y bibliografía | — |

## 10. El caso del TI #3 en cifras

- **Duración:** del 14 al 17 de noviembre de 2026; 41 pasos registrados en la
  bitácora.
- **Extensión:**
  - Parte 1: 6 páginas (tope 6), 34 notas;
  - Parte 2: 12 páginas en el documento final (tope 15), 19 notas;
  - documento final: 21 hojas, con 13 obras en la bibliografía.
- **Revisiones:**
  - **Parte 1:** argumento (27 hallazgos), citas (71 comprobadas, 13 ajustes),
    coherencia (20) y voz (20).
  - **Parte 2:** argumento (20 hallazgos), coherencia (15), voz (20), validación
    del autor (25 ediciones y 1 comentario) y citas bíblicas (32/32).
  - **Documento final:** revisión de forma (21 hallazgos; no se aplicaron por
    decisión del autor).
- **Respaldo:** 68 imágenes de página y 8 páginas del NICOT en html, en 13
  carpetas por obra; cada nota que cita página tiene su archivo.
- **Puntos de aprobación del autor:** contrato, orden, Parte 1, proposición,
  esquema, Parte 2 y documento final.

## 11. Material del caso para futuras revisiones

Todo lo que produjo el TI #3 está inventariado en
[`research_notes/ti3_salmo23_2026-11/README.md`](../research_notes/ti3_salmo23_2026-11/README.md):
- **en el repositorio:** este procedimiento, la bitácora, el método y las
  herramientas;
- **en Drive:** cada versión del borrador con su motivo, los Word con los
  comentarios del autor, los informes de cada revisión, las partes congeladas, el
  documento entregado y las imágenes de respaldo de cada cita;
- **local, y por qué no se sube:** la plantilla de Word, los comentarios textuales
  del profesor y los scripts de lectura de producción.

Antes de implementar este flujo en la plataforma, o de cambiar una regla del
procedimiento, conviene leer ese inventario, la bitácora §5–§6 y el método §4.
