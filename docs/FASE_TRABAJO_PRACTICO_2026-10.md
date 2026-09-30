# Fase — Lo que el trabajo práctico destapó · octubre 2026

**Qué es.** Arreglos surgidos de un ejercicio de punta a punta hecho el
2026-09-30 con un trabajo práctico real: el TP #5, Santiago 2:14-26, cuatro
preguntas de gramática griega, 2-3 páginas, con la guía de TMS. Se recorrió el
flujo completo, desde el estudio hasta el `.docx` exportado. Todas las citas se
verificaron a mano contra `document_chunks`. El trabajo quedó bien, pero para
lograrlo hubo que esquivar a mano cada falla de esta lista.

**Cómo se entrega.** **Un solo PR**, con **un commit por unidad**, en el orden
de abajo. Así CI corre pocas veces. Cada commit queda completo y se puede probar
en la interfaz. Los tests se corren en local en cada commit, y se hace push al
final o en uno o dos hitos.

**Terminado** significa desplegado y probado en producción con un TP nuevo, de
modo que el próximo trabajo práctico salga sin workarounds.

---

## 0 · Urgente, antes de la fase: el tutor de hebreo corre letras entre palabras

`reconcileGlobalWords` (`infrastructure/src/hebrew-tutor/gemini-hebrew-service.ts:214`)
reparte las consonantes de TODO el versículo según cuántas escribió el modelo
en cada morfema, sin anclar cada palabra. Un error de conteo corre todas las
palabras siguientes:

- **Rut 1:7:** en שָׁמָּה el modelo contó 4 consonantes y son 3 (la ה direccional, contada dos veces). Todo lo que sigue se corre +1.
- **Rut 1:8:** en וַתֹּאמֶר el modelo contó 8 y son 5 (se tragó נָעֳמִ). Todo se corre +3 desde la primera palabra.

Corrompe la línea del versículo **y las tarjetas de análisis**. El caché
`hebrew_analysis_cache` es **global**: de 135 versículos, ~11 están corruptos,
varios de Rut, que es el libro que el fundador estudia con su profesor.

**Arreglo:** reconciliar palabra por palabra. Si el conteo del modelo no calza
con la palabra real, mostrar el token masorético entero como un solo morfema:
se pierde el color, nunca las letras. Después del arreglo, invalidar el caché
subiendo la clave a `_v3`. Regresión: Rut 1:7 y 1:8.

*Por decidir con el fundador:* un PR aparte, como hotfix, o el primer commit de esta fase.

## A · La extensión que pide la entrega manda

- El presupuesto se reparte entre **todos** los versículos del pasaje (13), no entre los que responden preguntas (3). Resultado: 50 palabras por respuesta. (`sectionBudgets`, `documentSections`)
- La cifra que el usuario escribe en «Recomponer» pierde contra el presupuesto: el bloque de sistema dice «50, es un presupuesto», el mensaje dice «unas 300», y gana el de sistema. (`verseProsePrompt.ts`)
- La lista del Ensamble no muestra los pasos sin generar, así que no se pueden excluir, pero el presupuesto sí los cuenta. (`assemblyContents.ts:77`)
- El reparto debe hacerse **por pregunta**: 2:21 respondía dos preguntas y quedó con el mismo presupuesto que las demás.
- Si el encuadre trae preguntas numeradas, los versículos sin pregunta, la introducción y la conclusión nacen excluidos del documento.
- Los títulos del documento deben ser las preguntas, no «Santiago 2:14». Si un versículo responde dos preguntas, van dos subsecciones.

## B · Rúbrica = qué pide esta entrega

- En «Formato», la forma de cita queda deshabilitada mientras el interlineado diga «Por defecto», y al guardar la elección se descarta. El default es doble espacio con nota al pie.
- El rótulo de página debe ser configurable: el sílabo pide «(Carballosa, 208)» y el prompt obliga «p. 208». Se mantiene «hoja N» cuando el libro no tiene folio.
- El resumen de la rúbrica muestra «—» cuando el estándar se hereda de la guía, y no muestra la maquetación guardada.
- El nivel «Pastoral / homilético» mide cantidad de fuentes, no rigor, así que un TP corto nunca llega a «seminario».
- Voseo: «Aceptás o regenerás», «Podés avanzar» y el propio prompt de extensión.

## C · Portada

- Los renglones en blanco no coinciden con el modelo TMS: debería ser 3·6·6·3 y hoy sale 4·6·7·4. (`coverSection`)
- Sin datos de portada, el Word sale sin portada y sin avisar.
- Hay que reescribirla en cada trabajo. Propuesta: prellenar con la del trabajo anterior (sumando 1 al «#N»), un botón «Usar portada de…» y ofrecer guardarla en el perfil.
- El formato de la portada debería vivir en la guía de estilo, junto al de la bibliografía.

## D · Verificador de citas

- Una nota que sintetiza dos fuentes («McCartney y Ropes ambos prefieren la pasiva»), citada a una sola página, da **no encontrada** y **bloquea** la aceptación.
- Verifica las citas del análisis, no las de la prosa que se entrega.
- Muestra rótulos internos en inglés («lexical-loading · footnote»).
- Editar el contenido aceptado deja `currentId` apuntando a la versión vieja.

## E · Corpus y datos de las fuentes

- Las recomendaciones no filtran por libro: para Santiago sugirió Bauckham, *Jude, 2 Peter*.
- El planificador inventa el autor cuando falta (llamó «Blass-Debrunner-Funk» a Robertson).
- Una fuente sin clave de cita queda fuera de las citas sin aviso. Corregir el autor no recalcula la clave.
- En el diálogo de extraer fragmentos no se elige el rol, y no se ve qué está seleccionado.
- Metadatos pobres producen títulos rotos en la cita («James — Baker Exegetical Commentary…»).
- `library_resources.textContent` es una copia con huecos (tope de 1 MB). La fuente confiable es `document_chunks`.

## F · Limpieza del setup

La rúbrica ocupa demasiado. «Perfil de trabajo» está pegado a las pestañas. La
guía muestra «Modelo: gemini-2.5-pro». El aviso «la guía cambió» es un falso
positivo (`JSON.stringify` con claves en otro orden). El aviso del informe
previo contradice a «Por imágenes». `modelId` de los pasos no dice qué modelo
corrió de verdad.

---

## Referencia: el TP semanal de griego NT (TMS)

- 2-3 páginas a espacio simple, con espacio adicional entre párrafos.
- Cita «(Carballosa, 208)», sin notas al pie, con bibliografía completa al final.
- No se puede usar la misma fuente dos semanas consecutivas.
- Portada según el modelo TMS.

Con esta configuración se arma la plantilla «TP semanal».
