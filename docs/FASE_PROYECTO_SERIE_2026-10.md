# Fase «Proyecto → Serie» (opción B): predicar Nehemías desde un proyecto

> Documento de fase para `docs/FASE_PROYECTO_SERIE_2026-10.md`. Desarrolla la etapa 3 de ADR-046 (`docs/FASE_PROYECTOS_2026-10.md`, líneas ~150-159). Lo leí en el código el 2026-10-24 sobre `origin/main` 2ab39442 (#813, «un proyecto sin estudios elige sus libros bíblicos»).

## 1. Qué y por qué

Un pastor quiere predicar Nehemías entero. Hoy ya puede crear el proyecto Exegético «Nehemías» y armar el estado del arte. El problema empieza cuando planifica la serie: el planificador expositivo crea una serie suelta, los estudios por perícopa nacen fuera del proyecto y sin la bibliografía aprobada, y el sermón que sale de cada estudio no aparece en el proyecto.

Con esta fase, el proyecto **planifica la serie con el mismo planificador de siempre**: los mismos 5 pases, la misma caché y el mismo modo estricto. El proyecto solo pone tres cosas: el libro, la bibliografía y el vínculo. El resultado:
- la serie queda ligada al proyecto;
- cada estudio por perícopa nace **dentro** del proyecto, con la bibliografía aprobada filtrada por libro y con la rúbrica de predicación;
- el sermón que nace de un estudio aparece en el proyecto, en su fila de la serie y en el calendario;
- una serie que ya existe, como la de Jonás, se puede **ligar** a un proyecto: sus estudios pasan al proyecto y reciben las obras que les faltan. Así se cumple la medida de la etapa 3.

El plan parte del diseño «de dominio», que fue el mejor puntuado. Del diseño «mínimo» toma la clave de borrador por proyecto, las casillas para elegir obras y los spreads condicionales. Además corrige todos los defectos altos y medios que señalaron las dos críticas (sección 9).

### Principios fijos
- **El vínculo va en una sola dirección:** `series.projectId`. AIProject no gana `seriesIds`, porque dos documentos sin transacción se desincronizan.
- **El proyecto es opcional:** sin `?projectId`, el planificador, `createSeriesFromPlan`, SeriesForm, usePlannerWizard y la app mobile se comportan exactamente como hoy.
- **Las fuentes vienen del proyecto, no de una copia:** con el vínculo, cada estudio toma la bibliografía del proyecto en el momento de nacer (etapa 3: «con el vínculo, las fuentes de la serie son las del proyecto»). La serie solo guarda qué obras desmarcó el pastor.
- **Un estudio tiene un solo proyecto de origen** (`projectId`) más sus vínculos (`linkedProjectIds`). Los estudios de la serie nacen con `projectId`.
- **El cobro sigue siendo por estudio:** crear estudios no cobra. Las fuentes entran como documento entero, sin extracción ni propuesta de hojas. Llevar un estudio al sermón no llama al asistente.
- **Sin functions, sin reglas y sin índices nuevos:** solo hosting.

## 2. El recorrido del pastor

1. Crea el proyecto Exegético «Nehemías», elige el libro en los criterios (`bibliographyCriteria.bibleBooks = ['NEH']`, ya construido en #813) y aprueba obras en el estado del arte.
2. En el panel del proyecto, el recorrido Exegético muestra una fase nueva, **«División en perícopas»**, entre «Fuentes» y «Estudios por perícopa», con el botón **«Planificar la serie»**. La sección nueva «Series de predicación» ofrece el mismo botón.
3. El botón lleva a `/dashboard/plans/pericope?projectId=<id>&book=NEH`. El libro va en la URL solo si el proyecto tiene exactamente un libro. Si tiene cero, o dos o más, va solo `projectId` y el asistente **obliga a elegir el libro**: no abre en 2 Pedro.
4. El asistente arranca en Nehemías y muestra arriba «Serie del proyecto «Nehemías»», con «Volver al proyecto» y una línea de ayuda. Si existe un borrador de menos de 24 h **de este proyecto y de este libro**, se restaura. Un análisis suelto de 2 Pedro no se toca ni se restaura, porque cada uno tiene su propia clave.
5. Corre los 5 pases como siempre, sobre el hebreo morphhb, y ajusta las fronteras. Si cambia el libro en el selector después de analizar, la bibliografía sigue filtrándose por el **libro analizado** y aparece un aviso.
6. En el paso de crear la serie ve las obras del proyecto que heredarán los estudios. Son las aprobadas que están en la biblioteca, sin comentarios de otro libro. Todas vienen marcadas y puede desmarcar. Si el proyecto ya tiene estudios que se solapan con alguna perícopa, aparece un aviso con la lista. Mientras la biblioteca carga, «Crear serie» queda deshabilitado.
7. Al crear la serie:
   - nace la serie con `projectId`;
   - nace un estudio por perícopa con `projectId`, `seriesId`, `pericopeId`, la rúbrica de predicación y las obras marcadas;
   - se invalida la caché de series;
   - el pastor llega a `/dashboard/plans/:id`.
8. En SeriesDetail ve el chip «Proyecto: Nehemías» (enlace al proyecto) y la línea «Los estudios nuevos toman la bibliografía del proyecto». «Crear estudio» en una perícopa sin estudio también hereda del proyecto, resuelto en ese momento y sin las obras desmarcadas.
9. De vuelta en el proyecto, la tarjeta de la serie muestra «N de M perícopas con estudio · K con sermón», la próxima fecha y una fila por perícopa con el estudio y el estado del sermón (sin sermón, borrador o publicado). La lista de estudios pasa a llamarse «Otros estudios» y deja fuera los que ya se ven en la serie.
10. «Comenzar el sermón» (antes «Llevar al estudio») crea el sermón con `projectId` del estudio. La fila de la perícopa recibe `draftId`, la serie conserva su `projectId` y su fecha de creación, y el sermón aparece en «Material producido» una sola vez aunque después se publique como copia.
11. Serie existente (Jonás): en SeriesDetail elige «Ligar a un proyecto», con dos casillas: «Llevar también sus N estudios» y «Agregarles las obras del proyecto que les faltan». Los estudios sin proyecto pasan a tener origen; los que tienen otro origen pasan a vínculo. «Desligar» solo quita `series.projectId`.
12. Una segunda corrida desde el proyecto muestra el botón «Planificar otra serie» y una tarjeta por serie. No se impide.

## 3. Modelo de datos

| Dónde | Cambio | Nota |
|---|---|---|
| `SermonSeries` (domain) | `projectId?: string \| null` | Única fuente de verdad del vínculo. Ausente o null quiere decir serie suelta. Va como **último** parámetro del constructor posicional. `update` usa `'projectId' in data`, así que `{projectId:null}` desliga. |
| `SermonSeriesEntity.create` | acepta `createdAt?` y `updatedAt?` | Corrige un defecto que ya existe: `firestoreToSeries` usaba `create()`, que fija `createdAt = new Date()` al leer, y cada update reordenaba los planes. |
| `SeriesMetadata` | `projectSourceExclusions?: string[]` | resourceIds de las obras del proyecto que el pastor desmarcó al crear. Se escribe solo si la lista no está vacía. `metadataToFirestore` y `metadataFromFirestore` ya pasan `...metadata`. |
| Firestore `/series/{id}` | `projectId: string \| null` de primer nivel | Se escribe `series.projectId ?? null` y se lee `data.projectId ?? undefined`. |
| `AIProject` | sin cambios | Las series del proyecto se deducen con `projectSeriesOf(getUserSeries(uid), projectId)`. |
| `ExegeticalPaper` | sin cambios | Los estudios del lote nacen con `projectId` de origen, `seriesId` y `pericopeId`, sin `projectWorkTypeId`. |
| `Sermon` | sin cambios | StartStudyFromPaper escribe `projectId = paper.projectId`. El resto se **deduce**: un `projectId` explícito, si no el proyecto de origen de su `sourcePaperId`, si no el `projectId` de su serie. |
| Borrador local del asistente | clave `dosfilos.expositoryAssistant.draft` + `:<projectId>`; campo `projectId?` | La entrada genérica conserva la clave de hoy. El `bookId` del borrador es el **libro analizado**. |

Reglas de Firestore: `/series` (firestore.rules:572-580), `/ai_projects` (862-868), `/exegeticalPapers` (894-901) e `isValidSermon` (25-35) solo validan el dueño, así que no cambian. Índices: no cambian, porque se filtra en el cliente sobre `findByUserId` (userId + orderBy createdAt).

## 4. Unidades y olas

Un PR con un commit por unidad, en este orden: U0, U1, U2, U3, U4, U5, U6, U7, U8. La rama sale de `origin/main` fresco (`git fetch origin && git checkout -b feat/proyecto-serie origin/main`). Ninguna unidad comparte archivos con otra de su misma ola.

- **Ola 1 (en paralelo):** U0 textos · U1 serie con proyecto (entidad y repositorio) · U2 reglas puras del vínculo y bibliografía heredable.
- **Ola 2 (en paralelo):** U3 SeriesService · U4 del estudio al sermón · U5 el proyecto planifica y muestra su serie.
- **Ola 3 (en paralelo):** U6 asistente expositivo desde el proyecto · U7 SeriesDetail conoce su proyecto.
- **Cierre:** U8 revisión adversarial, recorrido de punta a punta y documento de fase.

| Unidad | Qué | Archivos principales | Depende de |
|---|---|---|---|
| U0 | Todas las claves i18n es/en; términos de SeriesDetail unificados («paper» pasa a «estudio», «Llevar al estudio» pasa a «Comenzar el sermón»); fases del recorrido Exegético | `i18n/locales/{es,en}/{projects,series}.json`, prueba de paridad nueva | — |
| U1 | `projectId` y `createdAt` real en la serie; `projectSourceExclusions` | `SermonSeries.ts`, `FirebaseSeriesRepository.ts` y sus pruebas | — |
| U2 | `projectSeriesLink.ts` (funciones puras de tipo estructural) + hook `useProjectSourcesForBook` + ProjectBibliographyOffer pasa a la composición del dominio | domain `exegesis/services`, `hooks/exegesis`, `ProjectBibliographyOffer.tsx` | — |
| U3 | `createSeriesFromPlan` con proyecto, reversión si falla el guardado, `setSeriesProject`, `linkSeriesToProject` | `SeriesService.ts` + prueba | U1, U2 |
| U4 | El sermón nace con `projectId`; el parche de la fila usa `series.update()` | `StartStudyFromPaperUseCase.ts` + prueba | U1 |
| U5 | Fase «División en perícopas», sección «Series de predicación», pertenencia de los sermones, «Otros estudios» | `projectRoadmaps.ts`, `ProjectRoadmap.tsx`, `ProjectDashboard.tsx`, `useProjectSlices.ts`, `ProjectSeriesSection.tsx`, `ProjectStudiesSection.tsx` y pruebas | U0, U1, U2 |
| U6 | Asistente con `?projectId&book`, borrador por proyecto, libro analizado, casillas de obras, aviso de solapamiento, bloqueo mientras carga la biblioteca | `ExpositoryAssistantPage.tsx`, `expositoryDraftStorage.ts`, `SetupCard.tsx`, `ProjectSeriesBanner.tsx`, `serieDesdeProyecto.ts` y pruebas | U0, U2, U3 |
| U7 | Chip, ligar y desligar (mover estudios y agregar obras), «Crear estudio» que hereda en vivo | `SeriesDetail.tsx`, `SeriesProjectLink.tsx` + prueba | U0, U2, U3 |
| U8 | Revisión, recorrido de punta a punta, documento de fase | `docs/FASE_PROYECTOS_2026-10.md` | todas |

Cada unidad trae instrucciones autosuficientes, con archivos y pruebas, en la salida estructurada del plan.

### Pruebas comunes a todas las unidades
- vitest de cada paquete tocado.
- Las líneas de base de tipos no suben: web 521 (`./scripts/check-web-types.sh`), domain 2, application 25, infrastructure 16, functions 0.
- Los pasos «Lint and Type Check» de `.github/workflows/ci.yml`.
- Cada prueba nueva se rompe a propósito una vez (mutación) para confirmar que de verdad falla.
- Antes de codificar, leer `.agent/instructions/development_standards.md` y `.agent/rules/compliance_gate.md`.

## 5. Despliegue

Solo hosting, que el CI despliega al mergear con `--project dosfilosapp`.
- **Functions:** no cambian. `getSermonsListSummary` ya devuelve `projectId`, `sourcePaperId`, `sourceSermonId` y `seriesId`.
- **Reglas e índices:** no cambian.
- **Migración o relleno:** no hace falta. Los sermones viejos se deducen al leer, y las series viejas quedan sueltas hasta que se liguen a mano.
- **Mobile:** sin build, porque solo lee `/series` e ignora el campo nuevo.
- **Revertir:** basta con revertir el PR. Los `projectId` ya escritos quedan inertes, porque ninguna versión vieja los lee.

## 6. Retrocompatibilidad

- **Series sin `projectId`** (Jonás y todas las demás): se leen como sueltas. No muestran chip y ningún proyecto las lista. El primer update escribe `projectId: null`, que significa lo mismo que ausente.
- **`createdAt`:** desde U1 se conserva el real. Las fechas que ya se reescribieron antes no se pueden recuperar.
- **Planificador sin parámetros:** arranca en `'2PE'` y `'whole-book'`, con la misma clave de borrador. `createSeriesFromPlan` sin `project` da los mismos argumentos que hoy, y una prueba de snapshot lo fija.
- **Papers existentes:** no se tocan. Solo cambian si el pastor liga su serie y marca «Llevar también sus estudios», y eso pasa por `SetPaperProjectUseCase`, que valida el proyecto.
- **Sermones existentes:** no se escriben. Entran al proyecto solo por deducción y solo si no tienen un `projectId` explícito. Los de «Material previo» se quedan donde están.
- **Rúbrica:** los estudios de serie siguen naciendo con la de predicación (`CreateExegeticalPaperUseCase.ts:160` no cambia).
- **ProjectBibliographyOffer y ExegesisCreatePage:** heredan exactamente lo mismo que hoy. La composición solo se mueve al dominio.
- **Recorridos de Sermón, Serie, Curso, Investigación y General:** no cambian. El de Serie sigue contando todos los sermones del proyecto sin agrupar.
- **Recorrido Exegético:** gana una fase. «Estudios por perícopa» pasa a pedir dos estudios **trabajados** (fase distinta de `configuring`). Algunos proyectos que hoy marcan esa fase como hecha pueden volver a verla pendiente. Es intencional (decisión del fundador n.º 5).

## 7. Riesgos que quedan (medidos, leídos o supuestos)

- **Ráfaga de escrituras (supuesto, sin medir):** Nehemías tiene unas 13-20 perícopas y unas 10-15 obras, lo que da 150-300 transacciones `addSource` más un `ownProject` por estudio, en paralelo. Se mide en U8 con una serie corta (tiempo hasta navegar). Si tarda, en otra fase se escriben las fuentes en el documento inicial.
- **Proyecto archivado en otra pestaña (leído):** si se archiva justo al crear, la serie guarda `projectId` y los estudios nacen sueltos, porque `ownProject` falla sin error. Se repara con desligar y volver a ligar.
- **Pertenencia deducida (leído):** un sermón sin `projectId`, pero nacido de un estudio de origen del proyecto, aparece en el proyecto aunque el pastor nunca lo haya puesto ahí. Decisión del fundador n.º 1.
- **«Publicado» en el proyecto y «terminado» en el plan (leído):** el resumen no trae `markedCompleteAt` ni `currentStep`. Por eso el proyecto dice «publicado» (status o copia publicada) y no «terminado». La vista exacta sigue siendo SeriesDetail.
- **Series duplicadas:** «Planificar otra serie» crea otro juego completo de estudios. La interfaz lo deja a la vista, pero no lo impide.
- **Recuento del panel:** ProjectDashboard usa `useSermons` con useState. Un sermón creado sin salir del panel no se refresca. Hoy siempre se sale hacia el asistente, así que no afecta.
- **Prueba contra producción:** `.env.local` apunta a producción. Los pases 4-5 gastan Gemini prepago. Hay que usar alcance pasaje con 2-3 perícopas y avisar antes.

## 8. Fuera de alcance

- Guardar la división en perícopas en el propio proyecto (`AIProject.pericopeDivision`).
- **Reutilizar** los estudios que el proyecto ya tiene para una perícopa: escribir `seriesId` y `pericopeId` en ese estudio en lugar de crear otro. En esta fase solo se **avisa** del solapamiento (decisión del fundador n.º 3).
- Aplicar a los estudios de la serie el tipo de trabajo o el encargo del proyecto (rúbrica del curso, encuadre, estrategia, método, portada) y cambiar la precedencia de rúbricas.
- Desligar las series en `DeleteProjectUseCase`. Mientras tanto, los lectores toleran un `projectId` colgante y ofrecen desligar.
- Rehacer AddToProjectDialog con el filtro por libro.
- Volver a sincronizar las fuentes de los estudios ya creados cuando cambia el estado del arte.
- Ligar una serie desde el panel del proyecto. En esta fase se liga desde SeriesDetail.
- Escribir `projectId` en los sermones de `handleStartDraft`, `handleLinkExisting` y los marcadores: entran por deducción desde `seriesId`.
- Arreglar el desvínculo roto de un sermón con su proyecto (`SermonService.linkSermonToProject(null)` combinado con `??`).
- Marcar solas las confirmaciones del modo estricto.
- Mostrar el proyecto en la app mobile.
- Pasar a i18n los demás recorridos: solo pasa el Exegético.

## 9. Crítica de este diseño

**Lo que resiste:**
- El vínculo vive en un solo lugar y en una sola dirección.
- El planificador no se toca por dentro.
- Las fuentes se resuelven en vivo, respetando lo que el pastor desmarcó, así que lo que apruebe después llega a los estudios que se creen después.
- La serie de Jonás tiene camino propio, con estudios y obras.
- Se corrigen de paso dos defectos que romperían el vínculo: el `createdAt` reescrito al leer y el parche de la fila que reconstruía la serie campo por campo y, con merge, borraría `projectId`.
- No cambian functions, reglas ni índices.

**Correcciones que vienen de las críticas:**
- Fase «División en perícopas» con salida para los proyectos que no predican: se completa con `seriesCount > 0 || studyCount >= 2`.
- «Estudios por perícopa» se completa con estudios **trabajados**, no con estudios recién creados en lote.
- Clave de borrador por proyecto, con libro analizado separado del selector.
- Casillas para elegir obras y bloqueo de «Crear serie» y «Crear estudio» mientras carga la biblioteca.
- Elegir el libro es obligatorio cuando el proyecto no tiene uno.
- Al ligar Jonás también se agregan las obras que faltan.
- Términos unificados en SeriesDetail.
- Si falla el guardado de la serie, se revierte el vínculo de los estudios ya creados.
- U2 usa tipos estructurales para no depender de U1 dentro de la ola 1.
- En SeriesDetail la herencia se calcula en el manejador con una función pura, no con un hook.
- Se quitó el respaldo `pericopeId` por `paperId` (código muerto).
- Los spreads condicionales evitan pasar `null` donde se espera `string`.
- Las funciones del dominio se exportan con el barrel `export *` que ya existe.

**Lo que queda corto:**
- No reutiliza los estudios existentes del proyecto (solo avisa).
- La herencia es una foto por estudio: los estudios ya creados no se resincronizan.
- La pertenencia deducida de los sermones puede sorprender.
- Solo el recorrido Exegético pasa a i18n.
- La carga de escrituras en lote no está medida.
- Un proyecto archivado justo al crear deja estudios sueltos sin aviso.

## 10. Decisiones del fundador

Se listan en la salida estructurada (`decisiones_para_el_fundador`). Cada una trae un valor por defecto, para no bloquear la implementación.


## Decisiones del fundador (2026-10-24)

El fundador eligió la opción B y pidió organizar el diseño, la implementación y la revisión con un equipo de agentes. Las decisiones 1 a 8 del diseño se toman con su propuesta:

- 1. Sermones que aparecen en el proyecto sin que el pastor los ponga ahí. Un sermón sin proyecto propio aparece en el proyecto si nació de un estudio de origen del proyecto o si pertenece a una serie del proyecto. Si el sermón ya tiene un proyecto explícito, como «Material previo», se queda solo en ese. Los estudios que solo están vinculados al proyecto no traen sus sermones. Propuesta: aceptarlo así.
- 2. Rúbrica de los estudios de la serie. Nacen con la rúbrica de predicación, sin el tipo de trabajo ni el encargo del proyecto. Propuesta: sí. Un proyecto Exegético con serie es para predicar; el encargo de un curso queda para otra fase.
- 3. Estudios que el proyecto ya tiene en una perícopa. Esta fase solo avisa antes de crear la serie, y la serie crea estudios nuevos. Reutilizar el estudio existente pide un método nuevo en el repositorio de estudios. Propuesta: aviso ahora y reutilización en la fase siguiente, si la prueba con Nehemías muestra que hace falta.
- 4. Palabras en SeriesDetail. «Paper» pasa a «estudio», y «Llevar al estudio» pasa a «Comenzar el sermón», igual que en la página del estudio. Solo cambia series.json; el resto de la app sigue llamando «estudio pastoral de 8 pasos» al asistente del sermón. Propuesta: aprobar estos textos.
- 5. Cuándo se completa «Estudios por perícopa» en el recorrido Exegético. Pasa a pedir dos estudios trabajados, ya no en configuración. Algunos proyectos que hoy marcan esa fase como hecha pueden volver a verla pendiente. La fase nueva «División en perícopas» también se completa con dos estudios, para no bloquear a los proyectos que no predican. Propuesta: aceptar.
- 6. Segunda serie del mismo libro. «Planificar otra serie» crea otro juego completo de estudios y no se impide. Propuesta: no impedirlo en esta fase.
- 7. Ligar la serie de Jonás. El diálogo trae marcadas por defecto «Llevar también sus estudios» y «Agregarles las obras que les faltan» (documento entero, sin extracción ni cobro). Propuesta: dejarlas marcadas por defecto.
- 8. Las fuentes de cada estudio son una foto. Cada estudio toma la bibliografía del proyecto al nacer. Lo que apruebes después llega a los estudios que se creen después, pero no a los que ya existen. Propuesta: aceptar; resincronizar queda para otra fase.

La 9 (prueba de punta a punta contra producción, que gasta saldo de Gemini) espera su OK.
