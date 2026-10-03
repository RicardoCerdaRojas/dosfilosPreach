# Fase «Redacción»: lo que destapó la redacción del sermón 6 de Jonás

Rama `feat/redaccion-consulta-y-exportar`. Un PR para la fase y un commit por unidad. Hallazgos 32–34 de la bitácora del ejercicio.

## R1 · Las citas de la biblioteca no se marcan como inventadas (#33)

**Lo que se vio.** Al publicar, el verificador marcó tres citas como «probable cita inventada»: Burt p. 89 (dos veces) y Calvino p. 66. La de Calvino se había elegido con «Buscar citas en mi biblioteca».

**Lo que se midió (2026-10-03, sólo lectura).** Las tres citas están literales en los fragmentos indexados de los libros del pastor. La de Calvino está en la hoja 66. El buscador no inventó nada: el error era del verificador, por tres causas.

1. **Material de cotejo incompleto.** El verificador cotejaba sólo contra el texto armado del paper, los fragmentos guardados de sus fuentes (las fuentes por páginas no guardan fragmentos) y el manifiesto de citas del sermón (vacío en este sermón).
2. **Atribución cortada.** El parser cortaba la atribución en el primer punto: «David F. Burt» quedaba en «David F», y la obra y la página se perdían.
3. **Cita recortada.** La cita de Calvino trae `\[…]`. Una cita recortada nunca puede coincidir entera con el libro.

**Arreglo.**
- El verificador agrega el texto del libro citado. Lo busca por el título exacto de la atribución, que pone nuestro motor, y por el autor.
- Las citas recortadas se cotejan trozo por trozo, como ya lo hacía el buscador.
- El parser lee entera una atribución que cierra la línea.

Medido con el sermón real: las tres citas quedan verificadas de forma literal.

## R2 · Exportar a Word y PDF, prolijo (#34)

**Lo que se vio**, generando los dos archivos con el contenido publicado real:

- **Word:** `<br />`, `>` y `*` aparecen literales, y los títulos quedan pegados al texto.
- **PDF:**
  - Imprime el markdown crudo (`**Puntos:**`, `* I.`, `<br />`).
  - Adivina los títulos por el largo de la línea.
  - Usa fuentes estándar sin hebreo: las etiquetas salen como «™,¾ê°ä…».
  - El sermón ocupa 14 páginas con huecos.

**Arreglo** (decisión del fundador: archivo con fuentes incrustadas):
- Un solo modelo del documento, sacado del markdown del sermón: títulos, párrafos, listas, citas en bloque, negrita y cursiva, sin HTML.
- El Word y el PDF se dibujan desde ese modelo.
- El PDF lleva fuentes con tildes, griego y hebreo.

## R3 · Chat de consulta en el Taller (#32)

**Pedido.** Preguntas rápidas mientras se arma un punto, como «¿qué pasajes o personajes ilustran la actitud de Jonás y la de Dios?» o «versículos sobre la misericordia de Dios».

**Decisión del fundador.**
- Panel lateral que se abre desde la barra superior.
- Cada respuesta tiene «Llevar a mis ideas», que la deja en la caja de la idea de la sección para editarla. Entra como propuesta, no como idea del pastor.
- Los versículos citados se muestran con el texto real de la Biblia. Los que no existen se marcan.
