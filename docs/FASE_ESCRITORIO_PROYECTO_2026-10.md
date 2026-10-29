# Fase «Escritorio del proyecto»: que el panel enseñe el método en el orden del trabajo

> Documento de fase, borrador 3. Incorpora la crítica adversarial (§8), las respuestas del fundador del 2026-10-26 (§7) y el diseño integral de Curso y de los otros tipos (§9). Leído en el código el 2026-10-26 sobre `origin/main` 848009b5 (#815). Nace del pedido del fundador: «que los usuarios vean el panel como su escritorio de trabajo ordenado, para seguir un flujo coherente que les enseñe la metodología. Si hay deuda técnica, es el momento de documentarla y resolverla».
>
> Hubo cuatro análisis independientes:
> 1. arquitectura de la información y flujo;
> 2. diseño instruccional y método;
> 3. diseño visual y sistema de diseño;
> 4. inventario de deuda técnica.
>
> Este documento los junta. Donde citan código, dice archivo:línea; donde algo es supuesto, lo dice.

## 1. Diagnóstico (lo que coincide en los cuatro)

**1. El panel muestra tareas, no el estado del pensamiento del pastor.**
La captura de Esdras tiene 18 controles: 5 fases, 2 botones principales llenos que compiten, 8 botones de herramientas, «Nuevo» en negro y 8 vacíos a la vez. Lo más formativo del sistema queda enterrado dentro de la tarjeta Encuadre (`ProjectFramingCard.tsx:153-176`): la idea central, el registro de la hipótesis y su revisión.

**2. Los estados de avance mienten (leído en `projectRoadmaps.ts`).**
- **Fase 1:** se completa con la nota de contexto vieja (`:307-308`). En la captura sale ✓ mientras la tarjeta dice «Todavía no hay encuadre».
- **Fase 2:** se completa con `sourceCount > 0` (`:325`). «Adjuntar fuentes» aprueba directo (`useSaveProjectSources.ts`), sin requisitos ni candidatas: la puerta lateral anula el método.
- **Fase 3:** se completa con dos estudios vacíos (`:336`).
- **Fase 4:** se completa con dos estudios empezados (`:346`). En una serie de 12 perícopas, eso manda a la síntesis con 10 pendientes.
- **Fase 5:** se completa con cualquier nota o conversación (`:366`). Una conversación del primer día deja la síntesis en verde.
- **Serie:** la tarjeta dice «12 de 12 perícopas con estudio» desde el minuto cero (`projectSeriesLink.ts:284`), porque los estudios nacen vacíos en lote.
- **Regla rota:** una sola acción completa fases que no tienen relación entre sí.

**3. El orden de la página no sigue el orden del método.**
- El orden actual es: Próximo paso (fase 2) → Encuadre (fase 1) → Opciones de curso → Series (fase 3) → Estudios (fase 4) → Fuentes (fase 2, metida entre las herramientas) → Material.
- La síntesis (fase 5) no tiene lugar propio.
- Ninguna sección dice a qué fase pertenece.

**4. Se pierde el camino de vuelta.**
- Crear la serie lleva a `/dashboard/plans/:id` (`ExpositoryAssistantPage.tsx:980`).
- SeriesDetail vuelve a `/dashboard/plans` (`:283`) aunque conoce `linkedProject` (`:117`).
- Los enlaces al estudio no pasan `from` (`ProjectStudiesSection.tsx:60`, `ProjectSeriesSection.tsx:159`), así que la flecha del estudio vuelve a `/dashboard/exegesis` (`ExegesisPaperPage.tsx:115`).

**5. Las fases disparan acciones, no navegan** (`ProjectRoadmap.tsx:81`). Pulsar la fase 3 ya cumplida abre el planificador para otra serie, y pulsar la fase 4 crea un estudio suelto.

**6. No enseña.** Cada fase dice *qué* hacer, no *para qué*, ni cómo se ve bien hecha, ni cuál es el error común. Además hay vocabulario sin glosa: «roadmap», «estado del arte», «perícopa», «panorama»; y «encuadre» frente a «pasaje y propósito».

**7. Accesibilidad AA rota (medido con la fórmula WCAG sobre los tokens).**
- `text-primary` en texto chico: 2,59:1 en verde, 2,85:1 en naranja, 3,96:1 en violeta, 2,90:1 en índigo oscuro. Son 25 usos en `components/project`.
- `muted-foreground` sobre fondos tintados: 4,30–4,42:1.
- El ✓ blanco sobre `success`: 2,30:1.
- La fase activa está teñida con `info`, que es un token de estado, en lugar de la marca.
- Áreas táctiles de unos 16 px («Vincular existente», «Estado del arte»).
- Acciones de Material visibles solo al pasar el mouse.
- En el teléfono, el recorrido tiene scroll horizontal (unos 830 px) y el margen es de 24 px en lugar de 16.

**8. Una sola disposición para todos los tipos.**
- Consejería muestra Estudios y Griego/Hebreo (`ProjectDashboard.tsx:311,320`).
- Un Exegético muestra «Opciones de curso».
- Esdras muestra Griego y no nombra el arameo.

**9. La página no está migrada a la Barra única.** Viola las cuatro reglas de `docs/FASE_BARRA_UNICA_2026-10.md:70-75`.

## 2. Principios del escritorio

1. **La página es el recorrido.** Cada zona corresponde a una fase, en el orden del trabajo. **Ninguna acción de una fase completa otra.**
2. **Tres estados honestos por fase:** *por empezar · en curso · lista para seguir*, cada uno con su evidencia a la vista (por ejemplo, «Lista · bibliografía aprobada el 12 oct · 9 obras»). La fase 4 se mide en proporción: «4 de 12 perícopas estudiadas · 2 dicen algo de tu lectura». El verde se reserva para «lista», nunca para «hiciste clic».
3. **Un solo botón principal por pantalla: «Ahora».** Es concreto, por ejemplo «Perícopa 4 · Esd 3:1-13 · en análisis → Continuar». El resto son contornos o enlaces.
4. **El pensamiento a la vista.** Hay un bloque fijo, «Tu lectura hoy», con:
   - la idea central vigente, original o revisada;
   - el registro («3 confirman · 1 matiza · 0 contradice»);
   - los estudios terminados que aún no dicen nada de tu lectura;
   - el aviso si la revisión quedó desactualizada.
5. **Enseñar sin examinar.** Cada fase dice **para qué · cómo se ve bien hecha · error común**. Ese andamiaje se va retirando con la experiencia del pastor: modelar → acompañar → retirar (aprendizaje cognitivo). El criterio es lo que el pastor hizo, por ejemplo proyectos con síntesis consolidada, y siempre puede volver a abrirlo. No hay puntaje, fracción «1/5» ni casillas para tildar.
6. **Fuentes por el método.** En Exegético y Curso no hay atajo que apruebe fuentes sin pasar por el estado del arte.
7. **Herramientas donde sirven.** Griego y hebreo/arameo se usan dentro del estudio, donde el pasaje ya está definido. En el escritorio quedan en un riel secundario, derivado de los libros del encuadre: para Esdras, hebreo y arameo, y no griego.
8. **Siempre hay vuelta.** Toda página hermana (estado del arte, planificador, serie, estudio) vuelve al proyecto.
9. **Zonas declaradas por tipo** en `projectRoadmaps.ts`, junto a su recorrido. Exegético, Curso, Investigación, Consejería y General comparten las primitivas, no la disposición.
10. **Dentro de la marca.** Se usan solo tokens, Inter y `font-reading`, y shadcn; no entran fuentes ni librerías nuevas. Contraste AA medido y probado, 44 px táctiles y foco visible.

## 3. Estructura objetivo (Exegético)

**La página es el recorrido.** Arriba va un recorrido compacto con «Ahora». Debajo, una sección por fase con su rótulo («Fase n») y en el orden del trabajo. Es la estructura más simple que enseña lo mismo: menos conceptos, y el orden de la página repite el orden del método.

1. **Recorrido + Ahora** (un solo componente):
   - **Fases:** compactas, de 44 px, con número, nombre y estado (*por empezar · en curso · lista*). Al tocar una fase, la página salta a su sección; nada se crea desde el recorrido. En el teléfono las fases van en vertical. El tinte es de la marca, no de `info`.
   - **«Ahora»:** el único botón lleno de la página. Sale de una función pura con tabla de pruebas: **la continuidad va antes que el método**.
     1. El estudio en curso tocado más recientemente, o la perícopa con fecha en los próximos 7 días: «Perícopa 4 · Esd 3:1-13 · en análisis → Continuar».
     2. Si no hay ninguno, la fase activa.

     Lo que falte del método (por ejemplo, fuentes sin aprobar) se muestra como nota secundaria, nunca como botón lleno.
   - **Andamiaje de la fase activa:** «para qué · cómo se ve bien hecha · error común», plegable, y el pliegue se recuerda por navegador.
2. **Fase 1 · Tu lectura del libro.**
   - La idea central vigente, original o revisada, y los movimientos en miniatura.
   - «Editar».
   - Si hay nota vieja: «Pasa tu nota al encuadre». Precarga el texto y el pastor confirma; no se resume.
3. **Fase 2 · Fuentes.** Sale de la grilla de herramientas.
   - Resumen: «9 aprobadas · 3 por conseguir · requisitos 3/4».
   - Entrada al estado del arte, que se conserva porque el fundador la pidió para NT785.
   - Se dice que una obra aprobada puede quedar «por conseguir».
4. **Fases 3 y 4 · La mesa de perícopas.**
   - Extiende `ProjectSeriesSection`, que ya arma una fila por perícopa. Se agrupa por serie si hay más de una.
   - Cuatro columnas: pasaje (fecha como subtítulo) · estudio (su avance real: sin empezar / k de n pasos / ensamblado) · tu lectura (anotada / por anotar → «Anotar») · sermón (sin sermón / borrador / publicado).
   - En el teléfono, una tarjeta por fila.
   - Filtro «pendientes».
   - Sin serie, la invitación de la fase 3 con «Planificar la serie».
   - Con serie, «Agregar un estudio fuera de la serie».
   - No supone que una fila sea un estudio y un sermón: viene la fase de la unidad en varios domingos.
5. **Fase 5 · Síntesis.**
   - Se abre desde la primera anotación.
   - Registro resumido: «3 confirman · 1 matiza · 0 contradice», las 3 últimas y «ver todas».
   - «Revisar tu idea central».
   - «Ver cómo cambió tu lectura»: original → registro → revisada. Son solo las entradas del pastor; no hay texto del asistente.
6. **Al final: herramientas y material.**
   - **Herramientas:** según los libros del encuadre (hebreo y arameo para Esdras; griego si hay NT), en una fila compacta de 44 px.
   - **Material:** sin los sermones de la serie, con acciones siempre visibles.

**Fuera de la Etapa 1** (crítica §8.7 y §8.13):
- el riel lateral: a 1440 px la mesa no entra junto a él;
- la migración a `BarraDePagina`: entra solo si cabe en un commit al final.

**Otros tipos (Etapa 2):** usan las mismas secciones con otra mesa. Curso agrupa tareas por tipo de trabajo; Investigación pone la pregunta al frente; Consejería muestra sesiones y notas, sin estudios ni idiomas; General muestra el material.

## 4. Estados del recorrido Exegético (reglas nuevas)

| Fase | Por empezar | En curso | Lista para seguir (evidencia) |
|---|---|---|---|
| 1 · Tu lectura del libro | sin encuadre ni nota | encuadre parcial, o **nota vieja** («Pasa tu nota al encuadre», que la precarga) | libro + idea central (`framingStatus === 'complete'`) |
| 2 · Fuentes | sin bibliografía | solo candidatas | ≥ 1 obra aprobada y requisitos medibles cumplidos o aceptados a propósito. Las agregadas desde el selector o las `sourceIds` viejas cuentan como «Lista · N agregadas a mano» (Jonás y NT785 no retroceden) |
| 3 · División en perícopas | sin serie | análisis del planificador en curso (borrador) | serie creada; con propósito «enseñar» o «personal», también dos estudios o «di por hecha la división» explícito |
| 4 · Estudios por perícopa | ningún estudio estudiado | k de N (estudiado = `assembled` o anotado en tu lectura) | todos estudiados; cerrar la serie a propósito queda para cuando exista ese dato |
| 5 · Síntesis | sin anotaciones | anotaciones, conversaciones o notas de síntesis | idea central revisada y vigente (`currentRevisedIdea`) |

La fase activa del recorrido es la primera que no está lista. «Ahora» sigue otra regla, la continuidad (§3.1): un pastor que trabaja fuera de orden ve su trabajo en curso como botón y lo que falta del método como nota. Antes de cambiar estados, un script de solo lectura en producción mide cuántos proyectos cambian y de qué tipo son.

## 5. Deuda técnica

**Resolver antes del rediseño (commit previo, barato y con riesgo de dejarlo):**
1. «Proyecto no encontrado» aparece un instante en la carga en frío (`ProjectDashboard.tsx:126`): mostrar un esqueleto mientras `isLoadingProjects`.
2. El toast de error usa el texto de éxito y el `err.message` crudo (`ProjectDashboard.tsx:210,220`).
3. `useProjectAttachedSources.ts:59-73`:
   - lee **toda** la biblioteca y no usa React Query;
   - tiene un rechazo sin manejar y una carrera en `setSources`;
   - relee la biblioteca con cada guardado del encuadre;
   - la fase 2 sale como «próximo paso» mientras carga.

   Arreglo: `getResourcesByIds` (`documentId in`, en lotes) y `useQuery`.
4. El script de compliance no revisa los `.ts`: hay firebase directo en `pages/faculty/hooks/useProjectAttachedSources.ts:2-3` y en `useLinkProjectSession.ts:2`. Hay que extenderlo y mover esas lecturas a infraestructura.

**Resolver con el rediseño (los mismos archivos):**
5. **`useProjectDesk(projectId)`.** Hoy el panel carga 9 fuentes de datos del **usuario entero** y filtra en el cliente; los sermones van con `useState` y sin caché, y no hay `staleTime` (`main.tsx:43`). El hook nuevo devuelve un modelo de vista con estado por bloque (cargando / error / listo), de modo que no haya vacíos falsos mientras carga. Las consultas por `projectId` van donde no requieran índices nuevos (supuesto: igualdades sin `orderBy`). De paso, las pruebas del panel bajan de unos 22 `vi.mock` a 1.
6. **`ProjectTypeMeta.capabilities`** reemplaza los `includes([...])` regados por el panel.
7. **Un solo tipo de recorrido**: se exporta el tipo de `computeRoadmapState` y se quita `as unknown as RoadmapState` (`ProjectDashboard.tsx:161`).
8. **i18n de todos los recorridos y tipos.** Hoy solo el Exegético tiene claves, y está escrito dos veces. Además hay que pasar a i18n la lista de proyectos (`ProjectsListPage`, que no tiene ni un `t()`), `ProjectCard` y `ProjectEditDialog`, que tiene jerga, índigo y rose fijos, y una paleta copiada en tres archivos.
9. **Recorridos muertos de Sermón y Serie.** No se crean, pero siguen ofreciendo «Generar sermón». Se marcan `legacy` y el botón se lleva al flujo estudio → sermón. Antes hay que medir cuántos proyectos de esos tipos hay en producción.
10. **Primitivas compartidas en `components/ui`:** `SectionCard`, `EmptyState`, `PhaseStep`, `StatusChip` y `Eyebrow`. Unifican dos dialectos de tarjeta y tres chips.
11. **Fábrica `queryKeys`, y `useSermons` con React Query.** Hoy `invalidateQueries(['sermons',uid])` no hace nada, y SeriesDetail y SeriesForm llaman a servicios sin invalidar.
12. **Token `--primary-text` por tema** y `success` con AA. `barraUnica.test.tsx` pasa a medir también el texto.
13. **«Volver» al cancelar el encuadre** abierto desde Requisitos o el planificador: el diálogo se abre ahí mismo, en vez de ir y volver por la URL.

**Documentar (para después):**
14. **Páginas grandes:**
    - `ExpositoryAssistantPage` (1295 líneas): `useExpositoryRun` como máquina de estados.
    - `SeriesDetail` (1022): extraer los 6 subcomponentes y `useSeriesDetail`.
    - `SeriesForm` (716): `as any`.
    - `ExegesisPaperPage` (1231).

    Solo se tocan en esta fase lo necesario para el camino de vuelta y la mesa.
15. **El registro de la hipótesis no se compacta** (unos 400 KB con 200 entradas largas, frente al límite de 1 MiB). Si C lo muestra como línea de tiempo, pasa a resolverse: recorte en una transacción, o subcolección.
16. `seriesPlacement` llega solo al prompt de pasos; los lemas arameos y hebreos se mezclan; `originalChapterCount` acepta MAL 4.
17. La unidad predicada en varios domingos va en su fase.
18. Faltan pruebas de `useProjectAttachedSources`, `useLinkProjectSession`, `ProjectMaterialList`, `ProjectResourceGrid` y la carga en frío. `recorridos.test.ts` no cubre Consejería.
19. `development_standards.md:259` cita un `ProjectDashboard` de más de 1300 líneas; hoy tiene 429.

## 6. Etapas

**Etapa 1 · El escritorio Exegético.** Un PR, unos 6 commits; supuesto: 1.200–1.800 líneas. **Solo se toca el Exegético**, porque el TP #9 está en curso en NT785, que es un Curso.

0. **Saneamiento** (deuda 1–4 y 12):
   - esqueleto en la carga en frío;
   - toast de error;
   - `useProjectAttachedSources` con `useQuery` y `getResourcesByIds`, probado en NT785;
   - el script de compliance extendido a los `.ts`;
   - token `--primary-text` y `success` con AA, con la prueba de contraste extendida a texto.
1. **Estados honestos del Exegético** (§4), como funciones puras con su evidencia en texto. Lleva un tipo único de recorrido (deuda 7), escenarios armados (Esdras, Jonás, un proyecto para enseñar) y el script de medición en producción antes de cambiar nada.
2. **«Ahora» y recorrido compacto.** Las fases saltan a su sección; la fase activa trae el andamiaje plegable; en el teléfono va vertical.
3. **La página en el orden 1→5** (§3), con `useProjectDesk` como **selector en el cliente** sobre las listas que ya están en caché: con `staleTime` y estado por bloque, sin consultas nuevas. Incluye `ProjectTypeMeta.capabilities` (deuda 6), `useSermons` con React Query (11), la mesa extendida y la síntesis.
4. **Camino de vuelta**: `from` en los enlaces al estudio, SeriesDetail que vuelve a `linkedProject`, el planificador que vuelve al proyecto al crear la serie, y el encuadre que se abre en el lugar (deuda 13).
5. **Textos y accesibilidad**: vocabulario (§7.6), 44 px táctiles, acciones visibles, y solo las primitivas que se usan (`PhaseStep`, `StatusChip`).

**Etapa 2**:
- los otros tipos y la lista de proyectos con i18n (deuda 8);
- los recorridos legacy, después de medir cuántos hay (9);
- `queryKeys` (11);
- el kit de primitivas (10);
- el riel;
- la Barra única;
- en Curso, «Adjuntar fuentes» por el método, después de entregar el TP #9.

**Etapa 3 (o con uso real)**: el andamiaje que se retira con la experiencia.

Antes de construir: **una maqueta** del escritorio de Esdras en tres momentos (recién creado, con serie a medias y en síntesis) para que el fundador decida viendo.

## 7. Decisiones del fundador

1. **La nota vieja deja de completar la fase 1** en Exegético y queda «en curso», con «Pasa tu nota al encuadre». Cambia lo que ven los proyectos existentes.
2. **«Adjuntar fuentes» en Exegético**: va al estado del arte. Lo que ya se agregó a mano cuenta como «agregadas a mano» y no retrocede. Curso queda igual hasta que se entregue el TP #9.
3. **La fase 4 se mide en proporción y cuenta SOLO estudios ensamblados** (respuesta del fundador del 2026-10-26: «que sea cuando el estudio está ensamblado, así ayudamos a que no quede trabajo a medias en el sistema»; la anotación no cuenta) **y la 5 se completa solo con la idea revisada**. La síntesis se abre desde la primera anotación, para que un libro largo no quede meses sin ella.
4. **El andamiaje** («para qué · bien hecho · error común») va abierto en la fase activa y se puede plegar. Retirarlo según la experiencia se decide con uso real (Etapa 3).
5. **Griego y hebreo/arameo**: salen del cuerpo del escritorio al riel y entran dentro del estudio.
6. **Vocabulario:**
   - «Recorrido» en lugar de «Roadmap».
   - «Elegir tus fuentes», con el estado del arte glosado una vez.
   - Un solo nombre para la fase 1: «Tu lectura del libro». El diálogo conserva «El encuadre: pasaje y propósito».
   - La perícopa se glosa la primera vez que aparece.

## 8. Crítica adversarial (2026-10-26) y qué cambió

- **`useProjectDesk` con consultas por `projectId` empeoraba la carga.** Los estudios llegan por un callable recortado; la pertenencia es `projectId` o `linkedProjectIds`; los sermones se deducen por estudio y serie. Ahora es un **selector en el cliente** sobre lo que ya está en caché.
- **La mesa ya existe en un 80 %** (`ProjectSeriesSection`): se extiende, no se crea de cero. Se agrupa por serie. No hay estado «predicado» en los datos, así que no se inventa.
- **Los estados no tenían datos detrás:**
  - la fase 4 «trabajado» era «abierto»; la crítica propuso «ensamblado o anotado» y el fundador decidió **solo ensamblado** (§7.3);
  - en la fase 3, «cobertura del alcance» era cara, y se reemplaza por la serie, o por una salida explícita para enseñar o estudio personal;
  - en la fase 2, las aprobaciones viejas y las del selector cuentan como «agregadas a mano».
- **«Ahora»**: la continuidad va antes que el método, y queda definido como una función pura con tabla de pruebas.
- **La Etapa 1 no era revisable**, porque reescribía unas 1.100 líneas de pruebas en 5 suites. Ahora es mínima: solo Exegético, sin riel, sin Barra, sin kit, sin `queryKeys`.
- **El TP #9 en NT785**: no se toca Curso.
- **Estructura**: una sección por fase reemplaza las zonas A–G.
- **El andamiaje que se retira** queda para cuando haya uso real.
- **«Escribe el pastor»**:
  - «Ver cómo cambió tu lectura» y el cierre muestran solo sus entradas;
  - «Pasa tu nota» precarga y el pastor confirma;
  - «2 anotadas en tu lectura», no «2 dicen algo».
- **Medir antes de cambiar estados**: un script de solo lectura en producción.
- **La entrada al estado del arte desde la fase 2** se conserva, porque el fundador la pidió para NT785.

## 9. Diseño integral: Curso y los otros tipos (2026-10-26)

El fundador pidió un diseño integral, con Curso incluido, antes de avanzar. El TP #9 es una prueba que se puede rehacer, así que no frena nada. Las piezas compartidas son las mismas en todos los tipos: recorrido con «Ahora», estados que son funciones puras, `PhaseStep`/`StatusChip`, andamiaje plegable, sección Fuentes, mesa con columnas declaradas por tipo, vuelta al proyecto, `useProjectDesk`, herramientas y Material.

### 9.1 Curso

**El hilo que forma no es una idea central.** Es lo que corrige el profesor y cómo cambia el trabajo siguiente. Así nacieron las 17 reglas de la guía «TP Semanal».

| Fase | Por empezar | En curso | Lista (evidencia) |
|---|---|---|---|
| **1 · Lo que pide el curso** | sin tipos de trabajo | hay tipos, pero alguno sin rúbrica resuelta | ≥ 1 tipo, cada uno con su rúbrica resuelta («3 tipos · TP Semanal: rúbrica · Mixto · guía de 17 reglas · no repetir activa») |
| **2 · Fuentes del curso** | sin bibliografía | solo candidatas, o una obligatoria por conseguir | lo mismo que la fase 2 del Exegético, y además **todas las obligatorias conseguidas**; la cobertura se muestra por tipo de trabajo |
| **3 · Calendario de entregas** | sin calendario | entregas sin tipo o sin fecha | cada entrega con su tipo y su fecha, o la salida explícita «trabajo semana a semana, sin calendario» |
| **4 · Trabajos** | ningún trabajo ensamblado | k de N ensamblados | todo lo esperado ensamblado; «entregado» se muestra aparte |
| **5 · Devolución y aprendizaje** | sin devoluciones | ≥ 1 devolución registrada | cada entrega tiene su devolución (o «sin devolución», marcado a propósito) y cada corrección que se repite está decidida: pasada a la guía o descartada |

**«Ahora» en Curso:**
1. Un trabajo que vence en las próximas 72 h y no está entregado («TP #9 · listo → Revisar antes de entregar», o «Continuar»).
2. La continuidad: el trabajo en curso tocado más recientemente.
3. Lo que sigue en el calendario: «Crear TP #10 · Stg 4:13–5:6 · vence vie 31», con el tipo de trabajo y el número ya puestos.
4. La fase activa.

Lo que falte del método va como nota secundaria («Moo, obligatoria, por conseguir»; «TP #8 sin devolución»). *Decisión del fundador: que el plazo gane sobre la continuidad.*

**Secciones, en orden:**
1. Recorrido y Ahora.
2. Lo que pide el curso: un resumen de solo lectura, con los tipos como chips (rúbrica · método · guía) y «Editar» en un diálogo que reemplaza los dos formularios abiertos.
3. Fuentes, con las obligatorias primero.
4. **La mesa**, agrupada por tipo de trabajo. Columnas: trabajo (fecha de entrega como subtítulo) · avance (sin empezar / k de n pasos / ensamblado) · fuentes («sin repetir de TP #8» o «repite Moo», sobre `citedSourceKeys`, que ya existe) · entrega (listo → entregado → devuelto). La lectura dirigida va como una fila sin estudio: «64 de 100 páginas reseñadas», de las fichas con `pageCount` y reseña.
5. **Registro de devoluciones**, la contraparte del registro de la hipótesis: los códigos del profesor (FDA, F/A, SPC…) con su conteo, y la decisión de cada corrección (pasada a la guía / descartada).
6. Herramientas (griego para Santiago) y Material.
7. Para un curso sobre un libro, «Tu lectura de Santiago» queda como bloque **opcional**, que no cuenta en el recorrido.

**Datos nuevos que el escritorio honesto de Curso necesita** (todos del cliente, sin functions):
- `courseSchedule[]` en el proyecto: tipo de trabajo, rótulo («TP #9»), pasaje opcional, fecha de entrega (`YYYY-MM-DD` local) y `paperId` cuando ya existe el trabajo. Lo arma el estudiante a mano; leerlo del sílabo es «el encargo del curso», una fase propia.
- `ExegeticalPaper.deliveredAt`: lo marca el estudiante con «Marcar como entregado». Es un campo nuevo; `deliveredCount` deja de contar ensamblados.
- `ExegeticalPaper.feedback`: la devolución del profesor (texto, códigos, nota opcional y fecha). Agregadas, forman el registro del proyecto. Cada código que se repite puede marcarse «pasado a la guía» o «descartado»; editar la guía sigue siendo manual en su editor.
- `?workTypeId` y el número del trabajo al crearlo desde el escritorio.

**Qué queda fuera de esta fase:**
- los contadores de revisión (avisos de prosa, citas con alarma) en el resumen, porque cambian el callable `getExegesisPapersSummary`;
- las reglas entre trabajos que no son «no repetir»;
- la clase de trabajo por tipo (estudio / lectura dirigida / ensayo).

**NT785:** «Traer los trabajos anteriores». Los TP #1 a #8 están sueltos y se vinculan con su tipo de trabajo, **sin volver a aplicarles el encargo**: un trabajo entregado no cambia de reglas. La memoria de «no repetir» sigue tomando el trabajo anterior por fecha de creación; una fecha de entrega no la reordena sin decisión del fundador.

### 9.2 Investigación
1 La pregunta (alcance y tesis provisoria) → 2 Fuentes → 3 Plan (subpreguntas, pasajes y términos) → 4 Estudios → 5 Síntesis y documento.
- La fase 1 reutiliza el encuadre, con la tesis en lugar de la idea central y el mismo registro (confirma / matiza / contradice). Se completa con la tesis revisada.
- La mesa tiene una fila por subpregunta.
- Falta un campo para la pregunta: hoy es una nota.

### 9.3 Consejería
Sin estudios, sin idiomas y sin estado del arte. 1 Situación → 2 Fundamento bíblico → 3 Plan de acción → 4 Sesiones y seguimiento → 5 Cierre.
- La mesa tiene una fila por sesión: fecha, tareas asignadas, cumplidas y la próxima.
- «Ahora» es la próxima sesión.
- Falta una entidad de sesión con fecha: hoy las sesiones son notas.
- Privacidad: ningún dato del aconsejado se ve en la lista de proyectos.

### 9.4 General y los tipos viejos
- General no tiene un flujo prescrito, así que no se le inventan fases. Su escritorio lleva «Ahora» (lo último que se tocó), Fuentes, Material y herramientas.
- Sermón y Serie se marcan `legacy` (deuda 9).

### 9.5 Etapas, revisadas
- **Etapa 0:** saneamiento (§6), en marcha.
- **Etapa 1:** el escritorio **Exegético y Curso**, en un PR. Primitivas compartidas, estados de los dos tipos, la mesa por tipo, Ahora, camino de vuelta, y los datos nuevos de Curso: calendario, entregado y devolución, con su registro.
- **Etapa 2:** Investigación (campo de la pregunta), Consejería (entidad de sesión), General, legacy, i18n de la lista de proyectos y `queryKeys`.
- **Revisión:** el fundador revisa en local (localhost:5173) antes del PR y del merge. El `.env.local` apunta a producción: lo que se pruebe en local escribe en los proyectos reales.
