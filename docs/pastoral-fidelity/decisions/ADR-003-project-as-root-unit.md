# ADR-003 — Proyecto pastoral como unidad raíz; sermón/estudio/newsletter como artefactos derivados

## Estado

`accepted` — **su definición de proyecto la reemplaza el [ADR-046](ADR-046-project-is-a-container-of-studies.md)** (2026-10-22): el proyecto es un contenedor de muchos estudios, no la unidad de un pasaje. Sigue vigente su principio central: un estudio alimenta muchos productos derivados.

## Fecha

2026-05-22

## Contexto

Arquitectura actual: sermón, exégesis (paper), faculty chat existen como colecciones top-level en Firestore. Cada una con su propio flow, su propio prompt, su propio storage. PR #211 (`feature_exegesis_paper_artifacts_convergence`) introdujo el patrón paper→artifacts donde un paper puede derivar sermones y otros artefactos. PR #213 (`feature_sermon_pipeline_convergence`) y PR #214 (`feature_faculty_sermon_wizard_convergence`) consolidaron el wizard con `derivedContext` discriminated union.

Problemas del estado actual:

1. **Sin coherencia entre artefactos del mismo pastor sobre el mismo pasaje**. Pastor que predica + escribe blog + manda newsletter sobre Rom 8 hace tres estudios separados o copy-pastea.
2. **Voice fragmentation**. Cada artefacto se genera con LLM independiente — voces inconsistentes.
3. **Métricas dispersas**. Imposible medir "trabajo pastoral completo del mes" — solo se cuentan artefactos.
4. **Pricing confuso**. Cobrar por sermón vs. cobrar por proyecto pastoral son modelos distintos. El primero refuerza fábrica de output.

Paralelamente, la convergencia paper→artifacts ya estableció el patrón arquitectónico de "una entidad raíz con muchos artefactos derivados con `derivedContext` rastreable". Falta escalar un nivel más arriba.

## Decisión

Introducir **`Project`** como unidad raíz de trabajo pastoral. Un proyecto contiene:

```typescript
interface Project {
  id: string;
  ownerUid: string;
  passage: PassageRef;              // pericope, libro, tema
  title: string;
  declaredConfession: ConfessionId; // copia snapshot del user al crear
  study: {
    pastoralSeed: PastoralSeed;     // six-step output
    witnessesValidation: WitnessResult;
    audit: ProjectAudit;
  };
  artifacts: ArtifactRef[];         // sermon, study, newsletter, post, lesson, letter, devotional
  series?: SeriesRef;
  status: 'study' | 'witnesses' | 'drafting' | 'review' | 'published' | 'archived';
  createdAt, updatedAt;
}
```

Cada artefacto derivado apunta al proyecto raíz vía `derivedContext: { kind: 'project', projectId: string, sectionId?: string }`. Extensión del discriminated union existente de PR #214.

Sermón deja de ser entidad top-level con su propio study. Pasa a ser artefacto del proyecto. Mismo para estudio bíblico, newsletter, blog post, lección dominical.

## Alternativas consideradas

| Alternativa | Por qué descartada |
|---|---|
| **Mantener silos actuales (sermón, paper, etc. independientes)** | No resuelve fragmentación de voz. Refuerza fábrica de output. Bloquea métricas coherentes. |
| **Unificar todo en una sola entidad "Artifact" polimórfica** | Sobre-abstracción. Cada tipo de artefacto tiene editor, export, render específicos. Polimorfismo prematuro. |
| **Project como concepto de UI sin colección Firestore** | Cosmético — no resuelve nada arquitectónicamente. Métricas y queries siguen rotas. |
| **Series como unidad raíz** (en vez de Project) | Series es opcional. Pastor puede tener proyectos sueltos. Series es un atributo del proyecto, no su nivel raíz. |
| **Conservar Paper como raíz, expandir su scope** | Paper carga semántica académica. Confuso para pastor que no escribe paper formal — solo predica. Crear `Project` neutro es más limpio. |

## Consecuencias

### Positivas

- **Coherencia de voz**: un solo `pastoralSeed` alimenta N artefactos. Brooks satisfied.
- **Métricas honestas**: proyectos completados, no piezas producidas.
- **Pricing escalable**: cobrar por proyecto justifica premium para "ministerio completo del pasaje". Modelo "$ por sermón" se vuelve obsoleto.
- **Reuso del patrón ya probado** (PR #211 escalado un nivel).
- **Coherencia con `priorities_repositioning`**: sermón como output derivado, no producto principal — naturalmente expresado en arquitectura.
- **Audit unificado**: un solo lugar para auditoría pastoral (qué estudió, qué consultó, cuántos artefactos derivó).

### Negativas

- **Refactor significativo**: migrar sermones, papers, faculty chats existentes a proyectos requiere data migration + dual-write durante transición.
- **UI rediseño**: dashboard, navigation, filters cambian.
- **Curva de aprendizaje**: pastores existentes deben entender el cambio de modelo mental. Onboarding migratorio necesario.
- **Riesgo de over-engineering**: si pastor solo quiere un sermón rápido (legacy), forzarlo a "crear proyecto" puede percibirse como ceremonia.

### Neutrales

- Pricing model debe revisarse junto al cambio (no parte de esta ADR — decisión de negocio paralela).
- Analytics y funnels existentes requieren actualización para reflejar proyectos.

## Impacto

- **Código afectado**:
  - Nueva colección `projects/` en Firestore
  - Refactor de `sermons/`, `papers/`, `extractions/` para incluir `projectId` opcional inicialmente, mandatorio post-migración
  - `derivedContext` discriminated union extendido con `kind: 'project'`
  - Dashboard rediseño
  - Wizard refactor: entrada por proyecto, no por sermón
  - Pricing surfaces (`processingBalance` cuotas por proyecto vs. por output)
- **Fases impactadas**: 5 (implementación), pero schema definido en Fase 0 para que fases 1-4 ya escriban contra `Project` desde el inicio
- **Migraciones requeridas**:
  - Dual-write fase de transición
  - Backfill: cada sermón huérfano → proyecto auto-creado con seed legacy minimal
  - Series existentes → proyectos hijos
- **Reversibilidad**: baja — una vez migrado, revertir requiere reconstruir flujos siloed. **No revertible sin pérdida**.

## Referencias

- Phase doc: [phase-5-project-as-container.md](../phases/phase-5-project-as-container.md)
- Architecture: [01-architecture.md § Proyecto como unidad raíz](../01-architecture.md#componente-1-proyecto-como-unidad-raíz)
- Memorias: `feature_exegesis_paper_artifacts_convergence` (patrón base), `feature_sermon_pipeline_convergence` (paperContext), `feature_faculty_sermon_wizard_convergence` (derivedContext), `priorities_repositioning`
- PRs base: #211, #213, #214
