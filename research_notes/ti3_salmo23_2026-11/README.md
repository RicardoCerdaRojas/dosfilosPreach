# Material del TI #3 (Salmo 23:1–6, OT603): inventario para futuras revisiones

Este es el caso de referencia del procedimiento
[`docs/PROCEDIMIENTO_TRABAJO_ACADEMICO_2026-11.md`](../../docs/PROCEDIMIENTO_TRABAJO_ACADEMICO_2026-11.md):
una síntesis exegética de 6 páginas más un sermón de 15, hecha entre el 14 y el
17 de noviembre de 2026 **fuera de la plataforma**, con el proceso documentado
para llevarlo después al flujo de Dos Filos Preach.

Sirve para:
- implementar el flujo en la plataforma;
- revisar el procedimiento cuando llegue la devolución del profesor;
- repetirlo en otro trabajo.

El material está en tres lugares: este repositorio, Google Drive del fundador y
archivos locales que no se suben.

## 1. En el repositorio

| Archivo | Qué es | Cuándo leerlo |
|---|---|---|
| `docs/PROCEDIMIENTO_TRABAJO_ACADEMICO_2026-11.md` | El procedimiento replicable: etapas 0–14, controles, roles, reglas de interacción y qué se puede automatizar | Primero |
| `docs/BITACORA_TI3_SALMO23_2026-11.md` | Qué se hizo y cuándo. Tiene: las entradas (§0); la devolución del TI #2 clasificada (§1); las reglas de coherencia (§2); la tabla de glosas (§3); el inventario de fuentes (§4c); el análisis del skill de sermón (§4d); los 41 pasos, cada uno con su «nota para el flujo» (§5); y **17 carencias de la plataforma** (§6) | Para diseñar la implementación: §5 y §6 son los requisitos |
| `docs/METODO_TI3_SALMO23_2026-11.md` | Por qué se hizo así. Tiene: el origen de cada regla, con rótulos; el método del profesor según sus clases; el porqué del orden de la Parte 1; las **decisiones de redacción R1–R50**, cada una con la alternativa descartada; y el procedimiento de 10 pasos de revisión (§5b) | Antes de quitar o cambiar una regla del procedimiento |
| `docs/BITACORA_TI2_SALMO23_2026-10.md`, `docs/FASE_LECCIONES_TI2_2026-11.md` | El trabajo anterior y sus lecciones, de donde salen las reglas de coherencia | Contexto |
| `research_notes/ti3_salmo23_2026-11/herramientas/` | Los scripts del prototipo (sección 4) | Para ver qué hace cada paso automatizable |
| `research_notes/ti3_salmo23_2026-11/leer_anotaciones.mjs` | Extrae las anotaciones del PDF devuelto por el profesor (pdf.js) | Etapa 0 |

## 2. En Google Drive (fuera del repo)

Ruta: `My Drive/Documentos/The Master Seminary/MDiv/19_OT603 - EXÉGESIS DE HEBREO/Trabajo-Investigacion-3/`.

| Carpeta | Contenido |
|---|---|
| `00_LEEME.md` | Guía de la carpeta |
| `01_Referencias_del_curso/` | Russell, *CAT*, cap. 14; PDF anotado de la devolución del TI #2 |
| `02_Fuentes/` | Artículos (Barrick, Botha, Mtshiselwa, Vos), comentarios en EPUB (NICOT con páginas; Goldingay sin páginas) y descartadas, con la razón en el nombre |
| `03_Borradores/` | **La historia completa del texto:** contrato (`Etapa1_…`), esquemas (`Etapa3a_…`, `Etapa4a_…`), borradores Markdown con cada versión guardada y su motivo en el nombre (`…_v1_10pp.md`, `…_antes_revisor.md`), Word para comentar (v1–v9 de la Parte 1 y v1–v6 de la Parte 2, con los comentarios y ediciones del fundador) e informes de revisión (`Verificacion_citas_Parte1.md`, `Revision_estilo_Parte1.md`, `Revision_estilo_Parte2.md`, `Revision_final_documento_2026-11-17.md`) |
| `03_Borradores/Parte1_APROBADA_2026-11-16/`, `Parte2_APROBADA_2026-11-17/` | Copias congeladas en solo lectura (.md, .docx y vista). SHA-256 de los .md: `912b95ab1b98241f…` y `72e699af989d90ce…` |
| `04_Entrega/` | El Word final editado por el fundador (la fuente de verdad de lo entregado), su PDF y la vista armada por script |
| `05_Respaldo_citas/` | Una carpeta por obra (13), con 68 imágenes de página y 8 páginas del NICOT en html. Índices nota → archivo: `00_INDICE.md` (Parte 1) y `00_INDICE_Parte2.md` |

Fuera de esta carpeta, pero entradas del trabajo:
- **Guía de estilo TMS 2024–2025:** `MDiv/16_NT602 …/Guía de estilo TMS 2024–2025 (8-8-25).pdf`.
- **Transcripciones de las clases 1 y 2 de OT603:** en la carpeta del curso, en UTF-16.
- **TI #1 y TI #2 entregados.**

## 3. Local, no se sube (y por qué)

| Material | Dónde | Por qué no está en el repo |
|---|---|---|
| Plantilla de Word (`herramientas/plantilla_ti2/`) | Máquina del fundador | Es el TI #2 entregado, descomprimido: texto calificado del fundador con citas de libros. Para recrearla, descomprimir en esa carpeta el Word del TI #2 que está en Drive (`unzip "Trabajo Investigación 2 - Salmo 23.4-6 (final).docx" -d plantilla_ti2`). Los scripts toman de ahí los estilos, la portada, el CONTENIDO y las secciones |
| Comentarios textuales del profesor (`devolucion_ti2_comentarios_crudos.txt`) | Máquina del fundador | Son textos de un tercero. La versión clasificada está en la bitácora §1, y el PDF anotado en Drive (`01_Referencias_del_curso/`) |
| Scripts de lectura de la biblioteca de producción (`scripts/rag-eval/.ti3-{buscar,verificar,creditos,storage,descargar,lib-ids}.ts`) | Máquina del fundador | Son scripts de uso puntual (convención de los scripts con punto). Leen producción en modo solo lectura, y cada uso nuevo requirió el OK del fundador. Hacen esto: buscar en `document_chunks` por libro; verificar una cita en la hoja = página impresa + desfase; leer créditos; y descargar el PDF original del almacenamiento para sacar la imagen de la página |
| Informe de la revisión final, PDF de la biblioteca descargados, borradores de auditoría | Scratchpad de la sesión (efímero) | El informe se copió a Drive; los PDF de la biblioteca no se guardan |

## 4. Las herramientas

Todas son Python sin dependencias externas. `medir.sh` necesita además Word para
Mac y `pdfinfo`, y `paginas_contenido.py` necesita `pdftotext` (los dos son de
poppler). Se corren con `python3 -I`.

| Script | Uso |
|---|---|
| `md2docx_tms.py <plantilla> <borrador.md> <salida.docx>` | Markdown → Word con los estilos de la Guía TMS. Maneja: hebreo RTL; SEÑOR en versalitas; *cursiva* y **negrita**; notas `[^n]`; citas en bloque `>`; listas `- ` y `1. ` en párrafos separados |
| `medir.sh <borrador.md> <nombre_único>` | Genera el Word, lo exporta a PDF con Word por AppleScript e imprime las páginas |
| `armar_entrega.py <plantilla> <p1.md> <p2.md> <salida.docx> [paginas.json]` | Arma el documento completo: portada, CONTENIDO, Parte 1, Parte 2 y bibliografía (la lista de 13 obras está en el script) |
| `paginas_contenido.py <pdf> <titulos.json> <paginas.json>` | Segunda pasada del CONTENIDO: ubica cada título en el PDF |
| `renumerar.py <borrador.md>` | Renumera las notas en orden de aparición; se detiene si queda una definición sin uso |
| `indice_respaldo.py <borrador.md> <carpeta 05_Respaldo_citas>` | Genera el índice nota → imagen de respaldo; detecta «Ibid.» que apuntan a otra obra |
| `verificar_citas_biblicas.py <borrador.md> <parte1_aprobada.md> <rvr1960.json>` | Compara las citas del pasaje con la traducción aprobada y las de otros libros con la RV1960 |
| `rvr.py <rvr1960.json> "jo 10:11" …` | Imprime versículos de la RV1960. Ids engañosos: «jn» = Jonás, «jo» = Juan, «hb» = Hebreos |
| `armar_trabajo.py <plantilla> <trabajo.md> <salida.docx> <portada.json> [paginas.json]` | Generalización para cualquier trabajo: portada por JSON, CONTENIDO de dos niveles, apéndices y bibliografía. Con `TP=1`: modo TP, sin CONTENIDO y espacio simple + línea entre párrafos (NT785, TP #11 y TP #12) |
| `indice_respaldo_tp.py <borrador.md> <carpeta 05_Respaldo_citas>` | Índice de respaldo para citas entre paréntesis («(Autor, N)», «(BDAG, s.v. …)»); sale con 1 si una cita no tiene respaldo (TP #12) |
| `verificar_citas_tp.py <borrador.md> <morphgnt-carta.txt> <rvr1960.json> [--mutar]` | Cadenas griegas de la prosa contra MorphGNT y referencias a otros libros contra la RV1960; `--mutar` prueba la prueba (TP #12) |

La RV1960 del repo está en `packages/infrastructure/src/bible/data/rvr1960.json`.

## 5. Estado al cerrar (2026-11-17)

- **Documento final:** Parte 1 en 6 páginas (tope 6), Parte 2 en 12 páginas
  (tope 15) y 53 notas. Se entrega el miércoles 18 de noviembre.
- **Revisión final de forma:** encontró 21 hallazgos (2 altos), que quedaron **sin
  aplicar por decisión del fundador** (bitácora, paso 41). Si la devolución marca
  alguno de ellos, sirve como prueba de que esa etapa tiene que ir antes del cierre
  del autor.
- **Pendiente:** cuando llegue la devolución del profesor, clasificarla y
  contrastarla con lo que el procedimiento revisó y lo que no.

## 6. Los trabajos que siguieron (2026-11-18/19)

Con este mismo material se hicieron tres trabajos más. Sus bitácoras están en `docs/`:
- **NT785, trabajo de investigación (Santiago 3:1–5a):** `BITACORA_TI_SANTIAGO3_2026-11.md`;
- **TP #11 (Santiago 5:7–11):** `BITACORA_TP11_SANTIAGO5_7_2026-11.md`, la primera prueba de las pruebas por capas;
- **TP #12 (Santiago 5:12–20):** `BITACORA_TP12_SANTIAGO5_12_2026-11.md`.

La evaluación de todo el proceso frente a la plataforma está en `docs/EVALUACION_PROCESO_ACADEMICO_2026-11.md`. En Drive, cada trabajo tiene ahora una carpeta `06_Pruebas_e_informes/` con el criterio y los resultados de cada prueba. Los del TP #11 se perdieron: estaban en una carpeta temporal.

