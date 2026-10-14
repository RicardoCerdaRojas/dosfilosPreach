# Fase F: el visor de fuente · octubre 2026

> **Estado: EN CURSO desde el 2026-10-14.** El fundador la adelantó a la fase del TP #7 (`docs/FASE_EJERCICIO_TP7_2026-10.md`) y aprobó el diseño. La maqueta: https://claude.ai/artifact/H6y6H56BwzSprZKxrJnTWj

**Qué resuelve.** En el TP #7 el fundador tuvo que salir de la aplicación dos veces el mismo día para comprobar una cita. La segunda vez abrió el PDF de McCartney en otro programa y buscó «tautologous» a mano, entre 6 apariciones, para confirmar que las pp. 203 y 204 eran correctas. El sistema tenía las dos marcadas como dudosas. Pidió un visor con búsqueda dentro de la aplicación y que se pudiera citar desde él. Antes (#22-#25 del TP #6) ya había pedido algo parecido.

**Lo que ya existía** (revisado el 2026-10-14):

- **`CitationSourceModal` ya tiene casi todo:** pasar hojas, «ir a» por página impresa, zoom, y búsqueda en la hoja y en todo el libro (`BookSearchResults` → callable `searchDocumentText`).
  - Pero solo se abre desde las citas del análisis de un versículo y desde «Abrir en el PDF» de la revisión.
- **Lo demás abre el PDF suelto en otra pestaña:**
  - la flecha ↗ de las tarjetas del corpus;
  - «Ver» en la Biblioteca;
  - la lista «Corpus del trabajo» de la página del trabajo no hace nada al pulsarla.
- **El selector de hojas** no tiene búsqueda ni «ir a página impresa».
- **No se puede seleccionar texto:** `PdfPageViewer` dibuja la hoja en un canvas, sin capa de texto.
- **Buscar en un libro de 1.525 hojas** (Robertson) tarda entre 1,5 y 1,8 s según los registros de `searchDocumentText` del 2026-10-14. No hace falta optimizarla.

**Decisiones del fundador (2026-10-14):**

1. **Panel lateral junto al texto del trabajo,** con un botón «Ampliar» a pantalla completa. Es el mismo patrón que la ficha de palabra.
2. **«Citar» inserta donde está el cursor** si el editor está abierto; si no, copia al portapapeles.

**Cómo se entrega.** Un solo PR con un commit por unidad, en el orden de abajo. Antes de cada commit: pruebas locales, revisión adversarial (`docs/REVISION_ADVERSARIAL.md`) y cada prueba nueva rota una vez a propósito.

**Terminado** significa desplegado y probado por el fundador en producción con el TP #8.

---

## F1. Un solo visor, en panel o ampliado

- **`SourceViewer`** reemplaza el cuerpo de `CitationSourceModal`. Se abre de dos maneras:
  - por clave de cita dentro de un trabajo (como hoy);
  - por recurso de la biblioteca, sin trabajo.
- **Dos formas de mostrarlo:**
  - el **panel lateral**, que no bloquea: el texto del trabajo sigue editable a la izquierda;
  - el **ampliado**, a pantalla completa con la lista de resultados al lado.
- **`SourceViewerProvider`** en el layout del panel de control, con `useSourceViewer().open(destino)`. Cualquier pantalla lo abre sin montar su propio modal.
- **En el celular,** el panel ocupa la pantalla.
- **Las pantallas que ya lo usan** pasan al visor nuevo (la tarjeta del paso y la revisión), sin perder el panel de la revisión (`aside`).

## F2. Citar desde el visor

- **Capa de texto seleccionable** en `PdfPageViewer` (`TextLayer` de pdf.js), alineada con el dibujo.
- **Al seleccionar una frase:**
  - aparece «Citar» con la cita armada: «(Clave, p. N)» con la página impresa, o «(Clave, hoja N)» si el libro no tiene numeración, que es la misma regla de `citationAnchorFor`;
  - «Citar esta página» está siempre disponible en la barra, también en escaneos sin texto.
- **Destino de la cita:**
  - si hay un editor abierto (el lápiz de un paso o del ensamble), la cita se inserta donde está el cursor. El editor se registra como destino mientras está abierto;
  - si no lo hay, se copia y se avisa.
- **Fuera de esta unidad:** marcar la cita como verificada al insertarla. Persistir un veredicto exige tocar el modelo de verificación; la cita queda con el formato y la página exactos, y el verificador la confirma en su pasada.

## F3. Abrir el visor desde todos lados

- **Tarjeta de fuente en el corpus:** la ↗ abre el visor en lugar del PDF suelto. Abre en la primera hoja elegida para el trabajo o, si no hay ninguna, en la primera del libro.
- **«Corpus del trabajo»** en la página del trabajo: cada fuente abre el visor.
- **Las citas de la prosa y del ensamble** se vuelven pulsables, con `findInlineCitations` filtrado por las claves del trabajo. Abren en su página.
- **Biblioteca:** «Ver» abre el visor ampliado, sin trabajo; ahí «Citar» copia.

## F4. Revisión de citas: la página citada y la del verificador

- Cuando el verificador halló el apoyo en otra página, hay dos botones: «Ver p. 203 (citada)» y «Ver p. 202 (verificador)».
- Arreglo: `calibrationPath` de la revisión apuntaba a `/library/…` sin `/dashboard`.

## F5. Elegir hojas buscando

- El selector de hojas gana la barra del visor:
  - «Ir a» por página impresa;
  - búsqueda en todo el libro con resultados;
  - «Agregar esta página».

Así, ubicar el dativo de Robertson es buscar «dativus commodi», no calcular hoja = impresa + 79.

## Fuera de esta fase

- **Que todo lo fijado llegue al análisis** (#28 del TP #7): es la unidad B de la fase del TP #7.
- **«Agregar una idea»** a una sección sin regenerarla (#22 del TP #6).
- **Que el editor muestre la forma de cita que se entrega** (#25 del TP #6).
