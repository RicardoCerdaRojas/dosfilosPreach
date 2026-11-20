# Bitácora del TP #11 de NT785 (Santiago 5:7–11)

> Abierta el 2026-11-18. Es la primera prueba del
> [procedimiento v3](PROCEDIMIENTO_TRABAJO_ACADEMICO_2026-11.md) en un trabajo
> corto (TP semanal), a pedido del fundador. Rótulos: medido, leído y supuesto. La
> sección 5 registra qué cambia al aplicar el procedimiento a un TP.

## 0. Entradas y matriz de requisitos

**Plazo (leído):** el calendario del plan lo ponía para el 11 de noviembre; según el
fundador, vence hoy o mañana. Se trabaja con el plan comprimido.

**Las preguntas del profesor:**
1. ¿Qué significa τῆς παρουσίας τοῦ κυρίου (Stg. 5:7)?
2. ¿Cuál es el sujeto del verbo λάβῃ (Stg. 5:7)?
3. ¿Cómo se relacionan ὑπόδειγμα y προφήτας (Stg. 5:10)? ¿A qué «profetas» se refiere Jacobo?
4. ¿Cómo funciona el genitivo κυρίου (Stg. 5:11)?

**Fuentes prohibidas esta semana** (decisión del fundador: solo los comentarios del
TP #10): Adamson y Mayor. Se permiten las gramáticas y los léxicos (Wallace,
Robertson, Tuggy, Kittel-Friedrich) y NA28.

| # | Requisito | Origen | Dónde se cumple |
|---|---|---|---|
| R1 | 2–3 páginas, espacio simple, una línea entre párrafos | plan, p. 4 | medición |
| R2 | Cita «(Autor, N)», sin «p.»; bibliografía completa; portada TMS | plan y TP anteriores | notas y bibliografía |
| R3 | No repetir fuentes de la semana anterior (Adamson, Mayor) | plan; decisión N2 | bibliografía |
| R4 | «Jacobo» en la prosa; «Stg.» entre paréntesis | clase 1; Guía TMS | todo el texto |
| R5 | Forma completa de cada palabra analizada (morfología) y su función, no solo el caso | criterios 10 y anuncio | cada respuesta |
| R6 | La categoría, con su gramática; la traducción coincide con la categoría | criterios 2, 8 y 21 | cada respuesta |
| R7 | La lectura rival, presentada con su argumento principal, con más de una voz y respondida | criterios 3, 12, 14 y 15 | cada respuesta |
| R8 | El contexto inmediato y el del libro (versículo vecino) | criterios 11 y 16 | cada respuesta |
| R9 | Más de un diccionario para el sentido léxico | criterio 13 | preguntas 1 y 4 |
| R10 | Las variantes del aparato que afectan la pregunta, razonadas | anuncio; criterio 21 | preguntas 2 y 4 |
| R11 | Un cierre por respuesta con una sola afirmación y la traducción adoptada | criterio 1; formato del TP #10 | final de cada respuesta |
| R12 | Comillas « », raya corta, tildes y acentos griegos | criterio 9 | revisión de forma |
| R13 | **Coherencia entre respuestas:** el referente de κύριος en el v. 7 y en el v. 11; los profetas (v. 10) y Job (v. 11) | procedimiento v3, capa 2 | integración |

## 1. Decisiones del fundador

| # | Decisión |
|---|---|
| N1 | Plan comprimido: vence hoy o mañana |
| N2 | Solo se prohíben los comentarios del TP #10 (Adamson, Mayor) |
| N3 | Se hace en la conversación, con el procedimiento v3 y esta bitácora |
| N4 | Solo tres comentarios, elegidos por el asistente: **Allison** (ICC 2013, el más completo y reciente; recorre la historia de la interpretación, así que trae las lecturas rivales con su autor), **Varner** (la fuente del profesor; análisis del discurso) y **Ropes** (ICC 1916, la voz clásica sobre el griego). Así se combinan fuentes antiguas y actuales. Las lecturas rivales de otros autores se citan a través de Allison |

## 2. Registro del proceso

| Fecha | Paso | Qué se hizo | Herramienta | Nota para el flujo |
|---|---|---|---|---|
| 18-nov | 2. Lectura con extractos (principio 11) | Dos lectores con la regla «extracto textual + página o no se atribuye». Comentarios: Allison, Ropes, Varner (N4). Gramáticas y léxicos: Wallace (p. 187 cita 5:10 como doble acusativo), Porter 89, BDAG, Kittel, Louw-Nida, NA28 p. 694, Metzger p. 685 {B}. El lector dudó de una frase de Metzger (καρπόν → el agricultor como sujeto); la frase es correcta: si καρπόν es el objeto, recibe el agricultor | subagentes | El extracto obligatorio permite ver quién leyó mal, el lector o la fuente |
| 18-nov | 3. Redacción v1 | 4 respuestas en el formato del TP #10, con «Jacobo»; Robertson y Tuggy fuera por las páginas dudosas. Al releer, el redactor corrigió una atribución propia: Allison dice que «pesa poco» la diferencia entre el fruto y la tierra, no entre el fruto y el agricultor (principio 11, aplicado a sí mismo). **Medido: 2,5 páginas** (1.418 palabras) | `armar_trabajo.py` en modo TP (nuevo: `TP=1`, sin CONTENIDO, espacio simple + línea entre párrafos) | — |
| 18-nov | 4. Capa 1: cuatro pruebas unitarias en paralelo | Una por pregunta, con criterio para pasar y verificación de cada cita en la fuente (imagen o extracto en `05_Respaldo_citas/`). **Prueba de las pruebas:** en la copia de la pregunta 3 se sembró un error conocido (Wallace 187 → 179) sin avisar al revisor | subagentes | — |
| 18-nov | 5. Resultado de la capa 1 | **Las cuatro pruebas unitarias: NO PASA.** P1: el tercer argumento (el juez del v. 9) no discriminaba; Ropes citado sin su «probablemente»; BDAG con la acepción equivocada. P2: **los tres argumentos contra la rival servían igual a la rival**; la «imagen bíblica» era falsa (Jer 5:24, Jl 2:23 LXX); faltaban formas y la variante ἄν. P3: rivales sin su argumento; el aoristo no discriminaba; falta el contexto del libro; Ropes 297 → 298. P4: **la categoría era incorrecta**: τέλος no es un sustantivo verbal, así que no es genitivo subjetivo sino de producción (Wallace 104–105, 113); Varner citado de más; tres traducciones distintas. **Prueba de las pruebas: el error sembrado (Wallace 179) fue detectado.** El asistente verificó Kittel 770, 772 y 1143 con las marcas [p N], Allison 711 (Dt 18:19; Jer 23:25) y Varner 183 (1 Mac 2:59–64) | 4 subagentes; `.ti3-buscar.ts` | En el trabajo de Santiago 3 estos errores aparecieron al final o los encontró el autor; aquí aparecieron en la primera capa, con el texto todavía chico |
| 18-nov | 6. Decisión del autor (P2) | El sujeto de λάβῃ: **el fruto**, con la ambigüedad reconocida (Metzger), el referente más cercano (αὐτῷ) y 5:17–18; la rival (el agricultor: continuidad del sujeto, Jer 5:24 y Jl 2:23 LXX) presentada con su argumento. Opciones con el texto a la vista | conversación | — |
| 18-nov | 7. v2 y capa 2 | Correcciones de las cuatro pruebas aplicadas; **2,8 páginas** medidas. Capa 2 (integración) en curso | `armar_trabajo.py` (TP=1) | — |
| 18-nov | 8. Capa 2 (integración) y v3 | NO PASA, con 3 correcciones obligatorias: un **error de hecho propio** (decía «nuestro Señor» en 1:1, y 1:1 no tiene ἡμῶν; solo 2:1 lo tiene); una cita textual de BDAG sin referencia; una glosa distinta de la traducción adoptada. La coherencia de κύριος entre P1 (Cristo) y P4 (Dios) pasa, con la remisión cruzada. Se comprobó Allison 699: solo exceptúa 1:1; el texto no le atribuye nada sobre 2:1. v3: **3 páginas** (la tercera con 34 líneas); SHA `b2ffeb7266ee`. Word para comentar | subagente; `pdftotext` | La corrección de la capa 1 (cambiar el argumento del v. 9 por 1:1 y 2:1) introdujo un error nuevo que solo vio la capa 2: **cada corrección se vuelve a probar** |
| 18-nov | 9. Validación del autor (v3) | 8 comentarios y 3 ediciones. **Cinco citas en inglés** (Ropes, Louw-Nida, Wallace, BDAG, Ropes): la regla «todo en español» (R26 del TI #3) no estaba en el criterio de las pruebas unitarias, así que nadie la revisó. Además: una oración ambigua (P2), «le da relieve» → «lo destaca», «endíadis» sin explicar. Ediciones suyas: «La lectura rival…», «es coherente con…», «traducción literal». Todo aplicado en la v4; **3 páginas** (35 líneas en la tercera); SHA `52ea2f577d92`. **Procedimiento corregido:** el criterio de cada prueba incluye las reglas ya aprendidas del autor (§4c) | lectura del .docx | Las reglas del autor tienen que viajar con cada prueba, no solo vivir en la memoria |
| 18-nov | 10. Capa 5 (regresión) | Sobre el PDF exacto de `04_Entrega`, comparado con la v3 que ya había pasado las capas 1 y 2 | subagente | — |
| 18-nov | 11. Capa 5 y v5 | La regresión sobre la v4 NO PASA, con 2 bloqueantes: la traducción de Ropes 299 era infiel y ambigua («sus aflicciones» se leía como las del Señor, la lectura rival) y «doble acusativo» no estaba glosado. Además, se recomendó partir la oración que había editado el autor. Aplicado en la v5 (SHA `905dec955c81`). **Como el texto cambió, la regresión estaba vencida y se repitió sobre la v5: PASA** (diff palabra por palabra; 3 páginas, con unas 9 líneas libres) | subagente (reanudado) | La regla «un control vale para la versión que revisó» se aplicó aquí en tiempo real |
| 18-nov | 12. Entrega | `Trabajo-Practico-11/04_Entrega/Trabajo Practico 11 - Santiago 5_7-11.docx` (+ vista). Pendiente: la entrega del autor en Canvas | — | — |
| 18-nov | 1. Entradas | Plan (calendario: vencía el 11-nov), preguntas, texto SBLGNT con morfología, fuentes del TP #10. Riesgos que se ven desde el comienzo: λάβῃ tiene variante (+ ὑετόν); κύριος puede cambiar de referente entre el v. 7 y el v. 11 | `pdftotext`; MorphGNT | El sistema no avisa que un TP del calendario ya venció |

## 3. Registro de controles por versión (procedimiento §4b)

| Control | Versión | Resultado |
|---|---|---|
| Capa 1 (P1–P4) | v1 | No pasa → v2 |
| Prueba de las pruebas | v1, P3 sembrada | Detectó el error sembrado |
| Medición | v3 `b2ffeb7266ee` | 3 páginas ✔ |
| Capa 2 (integración) | v2 | No pasa → v3 (3 correcciones) |
| Validación del autor | v3 | 8 comentarios y 3 ediciones → v4 |
| Capa 5 (regresión) | v4 `52ea2f577d92` | No pasa → v5 |
| **Capa 5 (regresión)** | **v5 `905dec955c81` (lo entregado)** | **PASA** |

## 4. Lo que la plataforma no cubre

## 5. Qué cambia al aplicar el procedimiento v3 a un TP

| Elemento | Trabajo largo | TP semanal |
|---|---|---|
| Capas | 1 a 5 | 1 (una por pregunta), 2 y 5. **Las capas 3 y 4 no se aplican**, porque el TP no tiene introducción ni conclusión. El cierre de cada respuesta hace de conclusión local y se prueba en la capa 1 |
| Matriz de requisitos | rúbrica y enunciado | plan del curso (2–3 pp., citas «(Autor, N)», no repetir fuentes) + criterios del profesor + reglas de la clase |
| Fuentes | todas las que haya | pocas y elegidas (decisión N4: tres comentarios). Hay que excluir las de la semana anterior |
| Formato | notas al pie, CONTENIDO | citas entre paréntesis, sin CONTENIDO, espacio simple + línea entre párrafos (`armar_trabajo.py`, `TP=1`) |
| Tiempo | días | horas: las pruebas unitarias corren en paralelo, una por pregunta |

**Resultado de la prueba del procedimiento:**
- **La capa 1 encontró en la v1 lo que en el trabajo de Santiago 3 apareció al final:** argumentos que no distinguen entre las lecturas (P2), una categoría equivocada (P4: subjetivo en vez de producción), citas torcidas y páginas mal puestas.
- **La prueba de las pruebas funcionó:** detectó el error sembrado.
- **La capa 2 vio un error que introdujo la propia corrección de la capa 1** (1:1 sin ἡμῶν).
- **El autor encontró una omisión del procedimiento:** el criterio de las pruebas no incluía sus reglas de voz (todo en español). Se corrigió en §4c.
- **La regresión se repitió cuando el texto cambió después de ella.**
