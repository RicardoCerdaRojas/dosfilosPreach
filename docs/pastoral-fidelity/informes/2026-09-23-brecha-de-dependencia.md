# De la exégesis al trabajo entregado — informe de campo y cierre de la brecha

> Caso: trabajo práctico sobre Santiago 2:1–13, ejecutado el 2026-09-23 de punta a punta.
> Propósito: dejar por escrito el camino real, y convertir cada punto donde el fundador
> necesitó al asistente en una de tres cosas — una función, un proceso que se aprende, o un
> juicio humano que no se delega.

## 1. El camino, como ocurrió

| # | Etapa | Quién la hizo | Salida |
|---|---|---|---|
| 1 | Encuadre: pasaje, preguntas, rúbrica, portada | fundador, en la UI | `assignmentBrief`, `PaperRubric`, `PaperCover` |
| 2 | Corpus: elegir fuentes y anclarlas | fundador + asistente | 5 recursos con tramos de hojas |
| 3 | Plan estructural por paso | sistema, revisado a mano | `StepSourcePlan` |
| 4 | Análisis canónico por versículo | sistema | 6 `CanonicalVerseAnalysis` aceptados |
| 5 | Verificación de citas | sistema + fundador en el visor | 36 verificadas, 2 revisadas a mano |
| 6 | Redacción del documento | **asistente, fuera del sistema** | `.docx` |
| 7 | Revisión de voz | fundador | — |

Las etapas 1 a 5 viven dentro del producto. La 6 no existe. Ese es el corte.

## 2. Inventario de dependencia

Cada línea es un momento real de esta semana en que el trabajo se detuvo hasta que el
asistente intervino. La columna **Cierre** dice con qué se elimina la dependencia:
**S** = software, **P** = proceso que el fundador aprende y ejecuta solo, **H** = juicio humano
que no se delega.

| # | Momento | Qué hizo falta | Cierre |
|---|---|---|---|
| 1 | Saber qué fuentes estaban vedadas por la regla de no repetir | memoria de la entrega anterior | **S** |
| 2 | Saber que la regla no alcanza a gramáticas ni léxicos | lectura del programa del curso | **H** (el fundador corrigió al asistente) |
| 3 | Ubicar en Porter los tramos por tema (genitivos, participios, partículas, condicionales) | consulta a `document_chunks.metadata.section` | **S** |
| 4 | Ubicar `μέντοι` en el léxico | búsqueda por lema | **S** |
| 5 | Entender que «Porter: 0 fragmentos» era falso | leer `excerptRecipe.sheetRanges` | **S** |
| 6 | Leer los contadores de verificación | traducir el vocabulario de la UI | **S** |
| 7 | Elegir los tramos de hojas en el selector | criterio de cobertura | **P** |
| 8 | Redactar los hints de regeneración | plantilla + criterio | **S + P** |
| 9 | Corregir una página citada durante la verificación | abrir el visor y comparar | **P** (ya lo hizo solo) |
| 10 | Decidir entre nota manual y quitar la marca | saber qué hace cada botón | **S + P** |
| 11 | Armar el documento entregable | redacción completa | **S** (fase 10) |
| 12 | Descubrir que «Wallace, 87» no existía en el libro | auditoría manual página por página | **S** (ver §3) |
| 13 | Descubrir que Wallace comenta Stg. 2:9 por nombre | búsqueda de la gramática por versículo | **S** (fase 8) |
| 14 | Contar bien los subjuntivos de la prótasis | cotejar el análisis contra el texto griego | **S** |
| 15 | Escribir la bibliografía | reunir fichas y ordenarlas | **S** (fase 10, brecha 4) |
| 16 | Conseguir la ficha de Adamson | leerla de su hoja 8 | **S** (reejecutar el lector sobre lo ya cargado) |
| 17 | Que la voz configurada llegara al documento | ninguna: el documento se escribió fuera | **S** |
| 18 | Saber que la prótasis se extiende al v. 3 | leer la oración completa, no el versículo | **S** (fase 9) |

**Quince de dieciocho se cierran con software.** Dos con proceso. Uno —la lectura del programa
del curso— se queda donde debe quedarse.

## 3. El defecto más grave: una cita se da por verificada sin comprobar la página

Medido en el trabajo de Santiago 2:1–13. Los veredictos del v. 1:

```
Mayor,   p. 77  → verified, matchedPage "77"
Porter,  p. 94  → verified, matchedPage "94"
Adamson, p. 104 → verified, matchedPage "104"
Adamson, p. 104 → page-mismatch, matchedPage "108"   ← el sistema SÍ sabe detectarlo
Wallace, p. 87  → verified, matchedPage null
Wallace, p. 87  → verified, matchedPage null
Wallace, p. 87  → verified, matchedPage null
```

La página 87 de la *Gramática Griega* es una hoja de ejercicios sobre Juan 1:14. El tratamiento
de Stg. 2:1 está en la 54. El «87» es la referencia cruzada a *ExSyn* 86–88 —paginación de la
edición inglesa— que el modelo tomó por número de página.

La causa está en el código:

```ts
// GeminiLlmCitationVerifier.ts:212  (y FuzzyCitationVerifier.ts:127)
if (status === 'verified' && parsed.pages && matchedPage) {
    if (!pagesOverlap(parsed.pages, matchedPage)) {
        status = 'page-mismatch';
```

El cotejo de páginas está **guardado por `&& matchedPage`**. Cuando el recurso no tiene resuelto
su desfase de página impresa —`pageNumbering.segments[0].offset === null`, que es el caso de la
*Gramática Griega*— `matchedPage` queda en `null`, el cotejo se salta entero, y `verified` queda
en pie. El verificador comprobó que **el contenido** está en el libro; nunca comprobó **la
página**, y no lo dijo.

Consecuencia práctica: el semáforo mostró verde a tres citas cuya página era incomprobable, y el
trabajo salió con una referencia inexistente. Es el único lugar del producto donde un fallo
silencioso produce una falta académica.

**Arreglo:** cuando `matchedPage` sea `null` porque el recurso no tiene numeración resuelta, el
veredicto no puede ser `verified`. Necesita un estado propio —`page-unverifiable`— que el
semáforo muestre en ámbar y que la puerta de aceptación trate como pendiente de revisión, igual
que hoy trata `not-found`.

## 4. Backlog, en orden de ejecución

### Tanda 1 — integridad de la cita (bloquea entregar con errores)

1. **`page-unverifiable`**: estado nuevo cuando no hay numeración resuelta. Semáforo ámbar,
   cuenta como no revisada. (§3)
2. **Aviso de libro sin numeración** al agregarlo al corpus: «de este libro no se puede
   comprobar el número de página impresa; resuélvelo en el ajustador antes de citarlo».
3. **Reejecutar el lector de fichas** sobre los libros ya cargados. Adamson tiene su ficha
   completa en la hoja 8 y `bibliography` en `null`.

### Tanda 2 — el documento entregable (fase 10)

4. Suprimir la cabecera de trabajo cuando hay portada.
5. Maquetación (interlineado, sangría) tomada de la rúbrica, no cableada.
6. **Generar la bibliografía** desde las fuentes efectivamente citadas, con aviso previo si a
   alguna le falta ficha.
7. Formato de cita —nota al pie o parentética— declarado en la rúbrica; que el patrón acepte
   `(Apellido, página)` sin título.
8. **La voz configurada aplicada al documento**, no solo a los pasos.

### Tanda 3 — la unidad de trabajo (fases 9 y 10)

9. La unidad de análisis deja de ser el versículo suelto (fase 9).
10. La unidad de entrega la fija el encuadre: una sección por pregunta, aunque cruce versículos
    (fase 10, brecha 1).

### Tanda 4 — buscar según la forma del libro (fase 8)

11. Consultar cada fuente según su tipo: comentario por versículo, gramática por categoría
    **y por versículo indexado**, léxico por lema. El caso testigo: Wallace comenta Stg. 2:9 por
    nombre y el sistema nunca lo trajo, lo que dejó pasar un argumento invertido sobre el
    participio de resultado.

### Tanda 5 — lo que queda

12. Memoria de fuentes entre entregas, para la regla de no repetir.
13. Cotejo de forma: que las formas griegas enumeradas en el análisis se cuenten contra el texto
    del pasaje. El análisis dijo cuatro subjuntivos donde hay cinco.
14. Defectos de UI ya registrados: el aviso de «no contribuirá a la generación» que miente
    cuando hay tramos; los contadores que dicen «Con observaciones» con todo revisado; la nota
    del plan estructural que no llega al prompt; el encuadre truncado a 1.000 caracteres para el
    planificador; el tramo etiquetado con la sección de su primera hoja; el griego de Mayor
    corrupto sin aviso.

## 5. Lo que seguirá siendo del fundador

No se automatiza y no conviene intentarlo:

- Leer el programa del curso y saber qué pide.
- Decidir qué posición se adopta cuando las fuentes discrepan.
- La voz.

El objetivo de este backlog es que la próxima entrega necesite conversación sobre **esas tres
cosas** y sobre nada más.
