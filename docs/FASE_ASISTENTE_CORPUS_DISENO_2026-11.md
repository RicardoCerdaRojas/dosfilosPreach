# Fase «Asistente del corpus y batería de controles» — Diseño (v2)

> Estado: **APROBADO por el fundador (2026-11-20)** con un cambio: la revisión del autor se hace en un editor del sistema, no en Word (§2.3).
> v2 incorpora la revisión adversarial (8 hallazgos altos, 8 medios, 1 bajo; §13).
> Base medida: `docs/FASE_ASISTENTE_CORPUS_ETAPA0_2026-11.md` (0a, 0b, 0c).
> Método: `docs/PROCEDIMIENTO_TRABAJO_ACADEMICO_2026-11.md` v4. Orden y puertas: byblos 01M7VFRHTB…; MCP: byblos
> 01M7WQ7N69… (lectura libre + escritura confirmada).
> Rótulos: **[M] medido · [L] leído · [S] supuesto**.

## 0. El problema

| El método exige | Hoy | Dato |
|---|---|---|
| Atribuir solo lo que dice un extracto con su página (pr. 11) | La posición guarda página, no extracto ni versión del texto leído | [L] 0c §1.4 |
| El autor decide lo discutible ✋ | El modelo decide; el autor acepta la versión entera | [L] 0c §1.1; [M] 8 de 22 lecturas sin fuente |
| Cada control anotado con la versión que revisó (§4b) | Solo citas; el entregado no tiene versiones y tiene tres escritores | [L][M] 0c §1.3, §3 |
| Cinco capas con criterio (§4c) | Capas 3–5 no existen; coherencia sin registro ni criterio | [L] 0c §1.3 |
| Perfil por tipo (§4d) | «Tipo» = etiqueta libre | [L] 0c §1.1 |
| Leer todas las entradas antes de diseñar (etapa 0 del método) y un contrato aprobado (etapa 1) | No hay requisitos, reglas del curso ni contrato de glosas como datos | [L] |
| El autor comenta y edita, y eso vuelve a la fuente (etapa 8) | No hay revisión del autor con registro: TP #7 y #10 se entregaron distintos de sus pasos | [M] 0c §3 |
| Corpus suficiente e identificado | 47 % de lo citado fuera del sistema; sílabo ES 0 de 21 | [M] 0a, 0b |
| Hojas útiles por pregunta | Recall 63 %; 73 % de lo propuesto sobra | [M] 0a |

**Tesis:** pasar de *generar y aceptar* a *respaldar, decidir y controlar*. Cimientos: **perfil y contrato del
trabajo, texto con versiones de un solo escritor garantizado por el servidor, afirmaciones con respaldo versionado**.
Encima, las cuatro etapas acordadas: corpus → ficha → redacción → batería.

## 1. Principios de diseño

| # | Principio | Sale de |
|---|---|---|
| D1 | **Un solo escritor, garantizado por el servidor** (no por convención): revisiones, controles, entregas y fichas aprobadas se escriben solo desde Functions | 0c; `firestore.rules:905-907` deja al dueño escribir todo el trabajo [L] |
| D2 | **Lo que no está guardado no está controlado** | §4b; pr. 14 |
| D3 | **El asistente propone; el autor decide** en cada punto ✋ del perfil | §2 roles; 0c |
| D4 | **Sin ficha aprobada no hay atribución** | pr. 11 |
| D5 | **El perfil decide el flujo** | §4d |
| D6 | **Herramientas definidas una vez, dos puertas** | 01M7VFRHTB… |
| D7 | **Medir con banco de verdad y conjunto de prueba aparte** | 0a |
| D8 | **Se aprueba la experiencia**: cada fase se recorre como estudiante con un trabajo real | memoria `feedback_verificar_experiencia` |
| D9 | **Medir, no estimar** donde el método mide (tope, forma sobre el PDF) | pr. 3, 18 |

## 2. Cimientos

### 2.1 Perfil, unidad y su vínculo con el estudio

```ts
type WorkProfileKind = 'tp-por-pregunta' | 'investigacion-tematica' | 'sintesis-sermon';
interface WorkProfile {
  kind; unitKind: 'pregunta'|'tema'|'parte';
  checkpoints: CheckpointKind[];        // ✋ del §4d, modelados (§2.5)
  layers: { unit; integration; conclusion: boolean; introThesis: boolean; regression };
  citationStyle: 'parentesis'|'nota-al-pie'; appendices: boolean;
  sourcePolicy: { excludePreviousWeek; commentaryCount? };
  formatProfileId;                      // plantilla Word + reglas de la Guía, versionada
}
```

- `ProjectWorkType.profileKind` obligatorio en tipos nuevos; los existentes se infieren y el autor confirma una vez.
- **`UnitStudyMap`**: unidad → versículos que cubre → propuestas del análisis por versículo. La decisión de una
  pregunta que cubre varios versículos se arma **fusionando** las propuestas de esos versículos (misma pregunta del
  encuadre = misma decisión; si dos versículos proponen opciones contradictorias, la decisión las muestra juntas).
- **Migración de decisiones** [L] 0c §3: los `TranslationCrux` (TP #7–#8) y `QuestionAnswer` (#9–#10) se convierten
  en `Decision` con `choice` vacío y la marca «heredada: decidida por el sistema»; no se reescriben los trabajos
  entregados.

### 2.2 Contrato del trabajo (etapas 0 y 1 del método)

Hoy no existen como datos [L]; la capa 1 y 2 los necesitan como dependencias.

```
exegeticalPapers/{id}/inputs/{inputId}       Entrada: enunciado | rubrica | clase (transcripción) | devolucion |
                                             guia | trabajo-anterior-entregado | plazo | gramatica-del-curso |
                                             lectura-asignada ; estado leído | pendiente | falta
exegeticalPapers/{id}/requirements/{reqId}   Requirement { texto, origen: inputId, dondeSeCumple?: unitId,
                                             enCuerpo: boolean, version }
users/{uid}/courseRules/{ruleId}             CourseRule { texto, origen: devolucion|comentario-autor|clase,
                                             kind: forma|voz|criterio-profesor|IGNORA, version }
                                             (pr. 19: un comentario del autor se vuelve regla de todo el texto)
exegeticalPapers/{id}/glossContract/{v}      GlossContract { traducción aprobada, por término: glosa, rasgo,
                                             tiempo verbal, fuente(cardId@v), matiz que pasa a la Parte 2 } — versionado
```

- Las **entradas** se piden al crear el trabajo, con el **plazo primero** (procedimiento etapa 0). Las que faltan
  quedan rotuladas «falta» y la puerta las muestra.
- La **devolución** del profesor (PDF anotado) se convierte en reglas con su origen (`leer_anotaciones`), y los
  «IGNORA» de la gramática del curso entran como reglas que la capa 1 comprueba.

### 2.3 Texto con versiones y un solo escritor (garantizado)

```
exegeticalPapers/{id}/revisions/{revId}   — inmutable; solo lo crea Functions
  n, parentRevId, sections: [{ unitId, kind, markdown, sha }], sha,
  cause: 'redaccion'|'edicion-autor'|'hallazgo-aplicado'|'recorte'|'importada',
  causeRef?, author, frozen?: boolean (etapa 10: parte congelada), createdAt
exegeticalPapers/{id}/stepVersions/{vId}  — las versiones de los pasos salen del documento (sin tope de 5)
exegeticalPapers/{id}/decisions/{dId}     — decisiones versionadas
exegeticalPapers/{id}/deliveries/{dId}    — revisión exacta entregada + SHA del .docx y del PDF
```

- **`commitRevision`** (callable): transacción con *compare-and-swap* `currentRevisionId == parentRevId`; si otra
  pestaña, el chat o el MCP escribió antes, falla y el cliente rebasa. `r1` de la migración usa id determinista
  (`r1-importada`), así dos pestañas no crean dos.
- **Reglas de Firestore**: `create/update/delete` denegados al cliente en `revisions`, `controls`, `deliveries` y en
  el campo `currentRevisionId`; las revisiones son inmutables. Así un `verdict:'pasa'` no se puede escribir desde el
  navegador [L] 0c: hoy los casos de uso corren en el navegador.
- Editar en la vista de documento edita *la sección* → nueva revisión. Se retiran `spliceVerseIntoAssembly`, la
  sobrescritura de prosa dentro de la versión y el guardado paralelo de `ComposeAcademicPaper`.
- **Revisión del autor dentro del sistema** (decisión del fundador, 2026-11-20: reemplaza el Word de ida y vuelta).
  El autor lee la versión rN en un **editor de revisión** de la app (Tiptap, que ya usa el editor de sermones [L]
  `components/sermons/rich-text-editor.tsx`):
  1. **Comentarios** anclados a un fragmento de rN (`sectionId`, cita textual, desplazamiento; como rN es inmutable,
     el ancla es estable; en rN+1 se reubica por la cita) → hallazgos con `origin:'autor'`. Un comentario puede
     marcarse «aplicar a todo el texto» y se vuelve regla del curso (pr. 19).
  2. **Ediciones en modo sugerencia**: el autor escribe sobre el texto; al guardar, el servidor calcula la diferencia
     por oración contra rN y la muestra como cambios marcados (sin depender de la extensión paga de control de
     cambios de Tiptap). Aceptarlas crea rN+1 con `cause:'edicion-autor'`.
  3. **Lectura en voz alta** como checkpoint del perfil, marcada sobre la versión que se leyó.
  4. El **Word** queda como formato de **entrega** (y de medición con el PDF del servidor). La importación de un Word
     editado fuera se pospone; si hiciera falta, entra como revisión adoptada (procedimiento §3, excepción).
  - Ventajas frente al Word [S]: sin parseo de .docx ni marcas de revisión; los comentarios nacen anclados a una
    versión y van directo al registro de hallazgos; nada se desincroniza fuera del sistema.
- `assembledMarkdown` queda como campo derivado durante la migración y luego se retira.

### 2.4 Registro de controles

```
exegeticalPapers/{id}/controls/{runId}   — solo Functions
  controlId, layer, scope: { unitId } | 'documento', revisionId,
  dependsOn: {                       // TODO lo que el resultado da por bueno, con versión
    sections: { [unitId]: sha }, cards: { [cardId]: version }, decisions: { [id]: version },
    glossContract: v, requirements: v, courseRules: v, criterion: { id, version }, formatProfile: v
  },
  reviewer: { kind: 'determinista'|'revisor'|'autor', modelId? },
  verdict: 'pasa'|'no-pasa'|'en-curso',
  findings: [{ id, severity, where, before, after,
               verification?: { kind: 'fuente'|'texto'|'guia'|'regla', ref },   // pr. 5: verificado antes de aplicar
               authorChoice?: 'aplicar'|'no-aplicar', reason?, status }],
  costUsd, startedAt, endedAt
```

- **Vigencia**: `isControlCurrent(run, estadoActual)` compara **todo** `dependsOn` (no solo el texto). Cambiar una
  ficha en otro trabajo vence los controles que la usaban; cambiar una regla del curso vence las capas que la aplican.
- **Hallazgos los elige el autor** (procedimiento §6): pantalla con antes/después; aplicar crea una revisión
  `hallazgo-aplicado`, que vence lo que toca (pr. 17).
- **Puertas** calculadas desde el perfil: «Listo para comentar» y «Listo para entregar». Exportar con algo pendiente
  está bloqueado por defecto y se puede forzar con motivo, que queda en la entrega.

### 2.5 Puntos de aprobación (`Checkpoint`)

Control de tipo `autor` en el mismo registro, con la revisión y lo que aprobó:

| Perfil | Checkpoints |
|---|---|
| TP | entradas leídas; cada decisión discutible; lectura en voz alta; entrega |
| Investigación | entradas; **contrato** (traducción, tesis provisional, decisiones); **esquema** (mapa tesis → cuerpo, presupuesto, orden de recorte que protege argumentos); tesis definitiva (3b); lectura en voz alta; entrega |
| Síntesis + sermón | entradas; contrato; orden; **Parte 1 congelada**; proposición; prohibiciones Parte 1 → Parte 2; qué Biblia se lee; esquema y Parte 2; lectura en voz alta; entrega |

La **lista de la bitácora** (pr. 16) es la vista de estos checkpoints y controles, cada casilla con la revisión en
que se cumplió.

### 2.6 Capa de herramientas del corpus

`packages/functions/src/corpusTools/`: `{ name, schemas, mode: 'lee'|'escribe', scope: 'usuario'|'admin', handler }`.
Escrituras con `ensayo` → `aplicar`; auditoría en **`corpus_audit_log`** (nuevo; `admin_audit_log` existe y queda
para impersonación [L] `functions/src/admin/auditLog.ts:75`).

| Herramienta | Modo | Base actual |
|---|---|---|
| `buscar_biblioteca`, `leer_hoja`, `leer_trabajo`, `leer_requisitos` | lee | `consultarBiblioteca`, `getDocumentChunks`, `pageNumbering` |
| `consultar_catalogo`, `verificar_titulo` | lee | `recommendations/` + consulta pública |
| `revisar_pdf` (identidad, edición, paginación, desfase) | lee (cobra) | extracción por muestras |
| `proponer_hojas` | lee | `proposeSheetRanges` + rutas §4 |
| `fijar_hoja`, `quitar_hoja`, `marcar_por_conseguir`, `descartar_obra`, `proponer_ficha` | escribe (usuario) | nuevo |
| `editar_regla_guia`, `actualizar_bibliografia`, `renombrar_patron`, `devolver_creditos`, `diagnosticar_indice`, `correr_banco_corpus` | admin | los 6+1 scripts que escriben y los de diagnóstico [M] |

**Nunca por herramienta:** aprobar una ficha, elegir una decisión, aplicar un hallazgo o entregar. Eso lo hace el
autor en la web (D3).

## 3. Etapa 1a — Qué conseguir

**Medida:** cobertura de `CorpusNeed` **antes de redactar** (cuántas necesidades tienen una obra «tengo» con la edición
correcta). La cifra «47 % fuera del sistema» [M] 0a se vuelve a medir después, como resultado.

1. **Necesidades** desde la rúbrica, el perfil y el sílabo (requisitos de §2.2 marcados como de corpus).
2. **Candidatas**: sílabo → catálogo → sugerencia verificada contra catálogo público (decisión 2).
3. **Edición fijada** (`editionId`: año, editorial, ISBN, edición); `libraryMatch` compara el año.
4. **Estados**: tengo · por conseguir · en revisión · descartada (razón) · sin paginación (se cita por sección/lema).
5. **Bandeja de revisión** como **pantalla propia** de la fase A (y después, también desde el chat): página de
   derechos, índice y 3 muestras → identidad, edición, paginación, desfase propuesto a `pageNumbering`, copia no
   oficial (decisión 4). Casos que debe atrapar: Gardner por ZECNT, EPUB sin páginas, desfases de −7 a −111 [M] 0b.
6. **Biblioteca compartida**: `__system__` entra en la búsqueda devolviendo **metadatos y referencia de página**; el
   texto solo si la obra es de dominio público (§8.1).
7. Correcciones de datos: vínculos del sílabo a otro libro (Burt, Kistemaker) y `pageNumbering` de Kittel [M] 0a, 0b.

## 4. Etapa 1b — Qué usar (hojas por unidad)

**Medida:** banco de desarrollo (TP #11, TP #12, TI Stg 3) y **conjunto de prueba aparte** (TI #3 Salmo 23 — hebreo,
AT, síntesis + sermón — y TP #7–#10). Meta de recall ≥ 85 % y precisión ≥ 50 % [S]: la verdad son las hojas
**citadas**, así que una hoja útil no citada cuenta como error; la precisión medida es una **cota inferior**. Se
informa también «hojas por cita» para leer el costo de lectura del estudiante.

| Tipo | Ruta | Falla que corrige [M] 0a |
|---|---|---|
| Comentario | sección del esquema + introducción + vecinas, recortadas a lo que nombra la unidad | introducciones perdidas; secciones enteras |
| Gramática | **por categoría** desde la decisión en curso, sobre el índice de la gramática | Wallace 10/37; gramáticas 39 % |
| Léxico/diccionario | **entrada del lema** robusta (encabezado normalizado; artículo largo como rango) | Kittel sin σῴζω, κάμνω, τέλος, καλύπτω, κρίμα |
| Aparato | NA28 por encabezado corrido; Metzger por su forma «5.12» | la tarjeta no veía NA28 ni Metzger |

Reemplaza «¿Qué responde cada pregunta?» por **Hojas por unidad**, que funciona sin preguntas (temas).

## 5. Etapa 2 — Ficha y decisión

### 5.1 Ficha de lectura

```
users/{uid}/readingCards/{cardId}/versions/{v}     — inmutables; aprobar = Functions
  resourceId, editionId, fileSha, extractionVersion, sheet, printedPage, pageMethod
  excerpt (original, textual), excerptSha, translation (español, obligatoria si no es español)
  pageImageRef (respaldo), claimKind, supports?: { decisionId, optionId, stance }
  status: propuesta|aprobada|rechazada
users/{uid}/cardUsage/{cardId_paperId}             — índice aparte de dónde se usa (no array en la ficha)
```

- **Ancla `cardId@version`** en la redacción: editar la ficha para el trabajo B crea v2 y **no cambia** el respaldo del
  trabajo A; A ve «hay una versión nueva» y decide.
- **Identidad de edición y archivo**: si el usuario reemplaza el PDF (otro `fileSha` o `editionId`), las fichas de ese
  recurso quedan «a recalibrar» y los controles que dependen de ellas vencen.
- **Reanclaje** por `excerptSha` tras reindexar; si no aparece, «extracto no encontrado».
- **Aprobación por lote**: por unidad, con el extracto y la traducción a la vista; aprobar la unidad = aprobar sus
  fichas (cada una sigue siendo rechazable).

### 5.2 Decisión (plantilla del contrato, procedimiento etapa 1)

```
Decision { id, unitId, version, question,
  options: [{ id, reading, rasgo /* rasgo gramatical o textual */, argument,
              cardsFor[], cardsAgainst[], paragraph /* el texto de la alternativa, a la vista (pr. 6) */ }],
  criterion, proposal: { optionId, rationale },
  choice?: { optionId, respuestaALaRival, glosaResultante, matizParte2?, by, at },
  ownReading?: boolean }
```

- El analizador escribe `proposal`; **la redacción de la unidad no arranca sin `choice`** (decisión 5).
- La glosa resultante actualiza el `GlossContract` (nueva versión) → vence lo que dependía de la anterior.
- Opción sin fichas: «sin respaldo en tu corpus» → buscar (chat/herramienta) o **lectura propia**, nunca atribuida.

## 6. Etapa 3 — Redacción por tipo

| Perfil | Unidad | Orden | Cita | Propio |
|---|---|---|---|---|
| TP | pregunta | por pregunta | paréntesis | cierre de cada respuesta probado en capa 1 |
| Investigación | tema | cuerpo → conclusión → tesis definitiva → introducción ✋ | nota al pie | apéndices fuera del tope; CONTENIDO en dos pasadas |
| Síntesis + sermón | parte | Parte 1 congelada → proposición ✋ → Parte 2 | nota al pie | la Parte 2 hereda glosas **y tiempos** del `GlossContract` |

- El redactor lee solo **fichas aprobadas, decisiones elegidas, contrato de glosas y reglas del curso**. Cada oración
  atribuida lleva `⟦c:cardId@v⟧`; el Word la convierte en la cita del perfil.
- **Medir, no estimar**: el servidor genera el Word con la plantilla del perfil y lo **renderiza a PDF** (Cloud Run con
  LibreOffice) para contar páginas y para la forma de la capa 5. El estimador actual (renglones × 11) se valida contra
  las páginas medidas en Word de TP #11, TP #12 y NT785 y queda solo como vista previa [S] hasta validarlo.
- **Medir y recortar antes de cada ronda de pruebas** (pr. 18), en el orden del procedimiento, protegiendo los
  argumentos marcados en el esquema.
- Un compositor por perfil; se retira la vía paralela.

## 7. Etapa 4 — Batería

| Capa | Determinista (gratis, siempre) | Revisor independiente | Criterio para pasar |
|---|---|---|---|
| 1 Unidad | anclas a fichas aprobadas; glosas = contrato; forma verbal completa (MorphGNT/OSHB); citas en inglés traducidas; palabras vetadas; reglas de **forma** del curso (« », raya corta, «IGNORA») | argumento: rival respondida, **criterio que discrimina, cierre doble**, voz del autor | 0 contradicciones; citas 100 % verificadas; 0 atribuciones sin ficha |
| 2 Integración | cada decisión con un sentido; glosas y tiempos idénticos en cuerpo y apéndices; requisitos con `dondeSeCumple` en el cuerpo | coherencia 4 niveles con tesis, matriz y criterio | decisiones con un sentido; matriz completa en el cuerpo |
| 3 Conclusión | cada oración con su unidad de origen | ¿dice lo mismo que su origen? | todas con origen |
| 4 Intro y tesis | tesis = oración final de la conclusión, palabra por palabra | criterios del profesor sobre la tesis | coincidencia exacta; ninguna pregunta sin respuesta |
| 5 Regresión | vencimientos; forma **sobre el PDF** de la revisión exacta | coherencia 4 niveles + forma | registro sin pendientes |

- **Prueba de las pruebas**: corre sobre una **copia sombra** que el estudiante no ve; su resultado (sensibilidad de
  cada control) se muestra al estudiante solo como «las revisiones están funcionando», y en detalle en la vista
  avanzada y en el MCP.
- `RunCoherencePassUseCase` pasa a ser el revisor de la capa 2, con tesis, matriz, criterio y registro.
- **Costo** [S]: TP de 4 preguntas ≈ 4 revisores capa 1 + 1 capa 2 + 1 regresión por ronda. Se mide en la fase D,
  se publica por plan en `catalogoDeCobro` y se revisa el saldo prepago (Gemini y OpenAI) antes de activar.

## 8. Las dos puertas

### 8.1 Puerta 1 — MCP del sistema (seguridad)

- **Autorización**: servidor de autorización OAuth 2.1 (PKCE, registro dinámico de clientes) delante de Firebase Auth
  como proveedor de identidad; Firebase Auth solo no lo es. Tokens **revocables**, con **alcances por herramienta**
  (`corpus:read`, `corpus:write`, `admin:*`).
- **Confirmación del lado del servidor**: `ensayo` devuelve un id de un solo uso que **vence en 5 minutos**, atado al
  usuario y al contenido exacto; `aplicar` con otro contenido falla. Para escrituras de usuario basta la confirmación
  del cliente porque son reversibles y de bajo riesgo (fijar una hoja, marcar por conseguir, proponer una ficha que
  igual se aprueba en la web).
- **Servidor de administración separado** (`admin:*`): otra URL, reautenticación, y cada `aplicar` exige un **código
  que se confirma en la web** por un super_admin. Así una instrucción escondida en el texto de un PDF que lee el
  cliente no puede encadenar una escritura de administrador.
- **Texto de libros** (decisión 3): solo de los libros del propio usuario, por hoja o extracto, con **cupo diario de
  hojas por obra** registrado en la auditoría; `__system__` devuelve metadatos y referencia, salvo dominio público.

### 8.2 Puerta 2 — Chat del corpus

- Base «Consultar biblioteca» (fragmentos `[Fn]`) + alcance del trabajo + herramientas §2.6.
- **Toda conversación termina en tarjetas de cambio de estado** que el autor confirma.
- Soltar un PDF abre la bandeja (§3.5).
- Copy sin «modelo», «IA» ni nombres de motor; se corrige el del Plan de uso [M].

## 9. Experiencia del estudiante

- **Modo guiado por defecto**: una sola línea de estado en lenguaje llano — «Listo para comentar», «Listo para
  entregar», «Falta: revisar la pregunta 3 después de tu cambio». Capas, revisiones y huellas viven en la **vista
  avanzada** (fundador, usuarios avanzados, MCP).
- Vocabulario de pantalla: «revisión» → «versión»; «vencido» → «hay que volver a revisar»; «desfase» → «la página
  impresa no coincide con la hoja»; nada de «capa», «regresión», «ensayo» ni «sensibilidad» en el modo guiado.
- Carga del autor en un TP de 4 preguntas: 4 elecciones, 4 aprobaciones por lote de fichas, 1 revisión de hallazgos,
  1 lectura en voz alta [S]; se mide en el recorrido de cada fase.

## 10. Pantallas (documento visual)

1. Trabajo con su línea de estado. 2. Entradas y requisitos. 3. Conseguir + bandeja. 4. Usar. 5. Fichas por lote.
6. Decisión. 7. Hallazgos y controles (guiado y avanzado). 8. Chat. 9. MCP.

## 11. Plan de construcción (una fase = un PR)

| Fase | Contenido | Sale cuando |
|---|---|---|
| **A. Entradas y corpus** | perfil tipado; entradas y requisitos; reglas del curso desde la devolución; necesidades; candidatas con edición; **bandeja como pantalla**; rutas de hojas; banco + conjunto de prueba; `__system__` en la búsqueda; capa de herramientas; MCP de lectura con OAuth | cobertura de necesidades antes de redactar ≥ 90 % en un TP real; banco y prueba cumplen la meta |
| **B. Ficha, decisión y texto con versiones** | fichas versionadas y por lote; decisiones con plantilla completa; contrato de glosas; checkpoints; **revisiones de un solo escritor con reglas y CAS**; versiones de pasos fuera del documento; **anclas y comprobación determinista de la capa 1**; escritura confirmada en MCP; chat | un TP con todas sus decisiones elegidas por el autor y 0 atribuciones sin ficha (medido por las anclas) |
| **C. Redacción y revisión del autor** | compositores por perfil; **editor de revisión con comentarios y sugerencias**; render a PDF y medición real; recorte antes de cada ronda; retiro de la vía paralela | un TP y una investigación de punta a punta, con una ronda de comentarios y sugerencias del autor en el editor |
| **D. Batería** | capas 1–5 con criterio; hallazgos elegidos por el autor; puertas; prueba de las pruebas en copia sombra; entrega atada a su revisión; servidor MCP de administración | un TP entregado sin pendientes y un error sembrado detectado por ronda; costo por plan publicado |

Migración: 33 trabajos; `r1-importada` al abrir; los entregados no se tocan.

### 11.A Unidades de la fase A (un commit cada una, en este orden)

| # | Unidad | Comprobable en | Estado |
|---|---|---|---|
| A1 | Banco del corpus: 8 casos (3 desarrollo, 5 prueba) y línea base | `scripts/bench/corpus` | ✅ 11fc3811 |
| A2a | Rutas de hojas: Kittel por firma, léxicos por la pregunta, regiones de gramática por la ruta de secciones, contorno del comentario, extracto corto; banco con propuesta y navegación | banco (`fase-a.json`) | ✅ |
| A2b | De las categorías del análisis (opciones, puntos discutibles, función sintáctica) a la subsección exacta de la gramática (paso 2), medido sobre TP #7–#10: 64,9 % → 73,0 % | banco (`fase-b-gramatica.json`) | ✅ |
| A3 | Hojas por unidad: reemplaza «¿Qué responde cada pregunta?», funciona sin preguntas; copy sin «modelo» | navegador, TP real | — |
| A4 | Perfil tipado y unidades (`profileKind`, `UnitStudyMap`) | crear un trabajo de cada tipo | — |
| A5 | Entradas, requisitos y reglas del curso (incl. devolución → reglas) | pantalla de entradas | — |
| A6 | Necesidades del corpus, candidatas con edición fijada, `libraryMatch` por año, sílabo como origen | pantalla «Conseguir» | — |
| A7 | Bandeja de revisión de PDF (identidad, edición, paginación, desfase, copia no oficial) | subir Martin WBC 48 | — |
| A8 | Biblioteca compartida en la búsqueda (solo referencias salvo dominio público); correcciones de datos (Kittel, vínculos del sílabo, ruta de secciones de Robertson) | banco + búsqueda | — |
| A9 | Capa de herramientas del corpus y MCP de lectura con OAuth 2.1 | Claude Desktop | — |

## 12. Decisiones del fundador

| # | Decisión | Recomendación |
|---|---|---|
| 1 | MCP | **Decidido**: lectura libre + escritura confirmada |
| 2 | Títulos fuera del catálogo con verificación pública | **Sí** (12 de 26 usados estaban fuera; sílabo ES 0 de 21 [M]) |
| 3 | Texto de libros hacia el cliente MCP | **Sí, libros propios, por hoja, con cupo diario y auditoría**; `__system__` solo dominio público |
| 4 | Bandeja lee solo muestras | **Sí** (derechos, índice, 3 páginas) |
| 5 | Redacción bloqueada sin elección del autor | **Sí**, en perfiles con decisión ✋ |
| 6 | Exportar con pendientes | **Bloqueado por defecto, forzable con motivo** |
| 7 | Render a PDF en el servidor (Cloud Run + LibreOffice) | **Sí**: es la única forma de medir el tope y la forma como pide el método |
| 8 | Revisión del autor: Word o editor en el sistema | **Decidido (fundador, 2026-11-20): editor en el sistema**; Word solo para entregar |

## 13. Revisión adversarial (2026-11-20) y cómo se resolvió

| # | Hallazgo | Severidad | Resolución |
|---|---|---|---|
| 1 | Sin revisión del autor de ida y vuelta: recrea lo que encontró la 0c | alta | §2.3 editor de revisión en el sistema (el fundador prefirió esto al Word); fase C |
| 2 | Etapa 0 y contrato sin modelo de datos | alta | §2.2 entradas, requisitos, reglas del curso, contrato de glosas; fases A–B |
| 3 | Un solo escritor era convención | alta | §2.3 Functions + reglas + CAS + id determinista |
| 4 | Seguridad del MCP sin diseñar | alta | §8.1 OAuth 2.1, alcances, confirmación en servidor, admin separado |
| 5 | Exposición de texto de libros | alta | §3.6 y §8.1 cupo, `__system__` solo metadatos |
| 6 | Fichas reutilizadas sin versión en el ancla | alta | §5.1 `cardId@version`, `editionId`, `fileSha`; §2.4 `dependsOn` completo |
| 7 | Salida de la fase B dependía de la C; bandeja en el chat | alta | §11 anclas a B; bandeja como pantalla en A |
| 8 | Unidad sin vínculo con el estudio | alta | §2.1 `UnitStudyMap` y migración |
| 9 | 1 MB frente a versiones de pasos | media | §2.3 subcolecciones |
| 10 | Metas sin justificar; banco = desarrollo | media | §4 conjunto de prueba aparte; cota inferior; §3 medida antes de redactar |
| 11 | Estimar en vez de medir | media | §6 render a PDF; validar estimador |
| 12 | Faltan ✋ y controles del método | media | §2.5 checkpoints |
| 13 | Los hallazgos no los elige el autor | media | §2.4 `authorChoice`, verificación tipada |
| 14 | Plantilla de decisión incompleta | media | §5.2 |
| 15 | Criterios del profesor no todos deterministas | media | §7 reparto corregido |
| 16 | Costo por plan y saldo prepago | baja | §7 |
| UX | Demasiadas compuertas y jerga | media | §9 modo guiado, lote, vocabulario; prueba sembrada en copia sombra |
