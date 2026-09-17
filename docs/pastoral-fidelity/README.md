# Pastoral Fidelity Initiative

Reforma del módulo de generación de sermones (y artefactos derivados) para alinearlo con un único propósito: **formar predicadores fieles, no producir sermones sintéticos**.

> "Esdras dispuso su corazón para inquirir la ley de Yahweh, y para hacerla, y para enseñarla." — Esdras 7:10

## Por qué existe esta iniciativa

El motor de generación de sermones actual produce contenido de alta calidad superficial (con motor de citas verificadas, exégesis estructurada y export profesional), pero el aporte real del pastor al output final es típicamente 10–30%. El producto opera como fábrica de sermones, no como plataforma de formación.

Esta iniciativa invierte ese flujo: **el pastor estudia primero, el sistema desarrolla bajo su dirección, y la fidelidad bíblica se valida por tres testigos antes de permitir publicar**.

Análisis fundacional: ver [00-vision.md](./00-vision.md).

## Estado actual

| Fase | Nombre | Estado | Doc |
|------|--------|--------|-----|
| 0 | Foundations (onboarding confesional + arquitectura) | `completed` | [phase-0-foundations.md](./phases/phase-0-foundations.md) |
| 1 | Six-step spine como Step 1 del wizard | `completed` | [phase-1-six-step-spine.md](./phases/phase-1-six-step-spine.md) |
| 1.5 | Pastoral Word Study (módulo separado de language tutors) | `completed` | [phase-1-5-pastoral-word-study.md](./phases/phase-1-5-pastoral-word-study.md) |
| 1.6 | Contexto/Género + Principio atemporal + verificación proactiva (8-step spine) | `completed` | [phase-1-6-context-genre-principle.md](./phases/phase-1-6-context-genre-principle.md) |
| 2 | Tres testigos para validar semilla pastoral | `completed` | [phase-2-three-witnesses.md](./phases/phase-2-three-witnesses.md) |
| 2.5 | Study Depth Copilot — Acompañante de Estudio (un motor, 3 momentos) | `completed` | [phase-2-5-study-depth-copilot.md](./phases/phase-2-5-study-depth-copilot.md) |
| 3 | Pass de fidelidad claim↔source en borrador | `completed` | [phase-3-claim-source-fidelity.md](./phases/phase-3-claim-source-fidelity.md) |
| 4 | Indicador de autoría + contra-scan + voice fingerprint | `in-progress` | [phase-4-authorship-contrascan-voice.md](./phases/phase-4-authorship-contrascan-voice.md) |
| 5 | Proyecto como contenedor + artefactos derivados | `planning` | [phase-5-project-as-container.md](./phases/phase-5-project-as-container.md) |
| 6 | Planner como runway de formación | `planning` | [phase-6-planner-runway.md](./phases/phase-6-planner-runway.md) |
| 7 | Exégesis reform (mismo marco aplicado al paper académico) | `active` | [phase-7-exegesis-reform.md](./phases/phase-7-exegesis-reform.md) |

**Última actualización**: 2026-06-04 — **Fase 4 PR 1 (contra-scan) CERRADO + MERGED + DEPLOYED + SMOKE OK** (Fase 4 sigue `in-progress`; faltan sub-features autoría-verbatim + voice). 3 PRs en main + deploy prod verde: **#315** (contra-scan core: domain `ContraScanReport` + `evaluateContraScanGate` puro + callable `findDissentingChunks` + modal/hook/flag en sermón detail), **#316** (gap del wizard: gate en `StepDraft` + `enforceContraScanGate` en `publishSermonAsCopy`), **#317** (claridad del modal: idea central visible + labels "tu biblioteca"/"en qué tensiona" + cita apartada). **ADR-033** (única ADR del PR): contra-scan = paso de confrontación P3 (Hch 20:27) INDEPENDIENTE del fidelity gate dormido (ADR-032) — reusa el patrón (gate puro + override audit) + la infra de recuperación de ADR-031 (personal→CORE), no la instancia. Decisiones del fundador: step propio vivo siempre · soft + nota obligatoria ≥100 chars + override audit-logged (no hard-block) · biblioteca sin disenso pasa + invita (no cae a CORE). Sub-flag `contra_scan` default off, on en cuenta del fundador. **Smoke prod confirmado**: "Anclados en la Verdad" (2 Pedro 1:16-21) → contra-scan surface 2 fragmentos reales de Kistemaker p.224 (tensión βεβαιότερον + dirección AT↔apostólico). Tests verde: domain 430 + app 77 + infra 55 + web 96, tsc limpio. Bloqueador launch (App Check/CAPTCHA/rate-limit) re-auditado 2026-06-04 → CERRADO (ver `security_auth_hardening`). Anterior — 2026-06-03 — **Fase 3 (Claim↔Source Fidelity) CERRADA + MERGED**. Los 5 PRs en main (#287 fidelity core, #289 publish gate, #290 plurality, #298 authority, #300 attribution footer). CI verde. Sub-flag `fidelity_pass` default off (Q10, flip post-smoke con 1-2 usuarios reales). Fidelity pass per-marker (Flash batched + Sonnet escalation para `partial`/`contradicts`, ADR-029 Q1) + publish gate (hard-block >20% `unrelated|contradicts` sin override, soft-block >10% `partial` con justificación ≥100 chars audit-logged) + plurality (no-proof-texting: `core`/`distinctive` con <2 pasajes distintos → soft-block) + authority subordination (prompt clause + detector con reformulación sugerida) + attribution footer (CC BY/BY-SA en PDF+Docx+web, split SBLGNT BY 4.0 texto / BY-SA 4.0 morfología latente vía `morphologyRendered`). Deuda registrada: `tech_debt_sblgnt_hardcoded` (SBLGNT hardcoded, no catálogo CORE — Q8). Desviaciones de plan: PR 2 NO usó callable `publishSermonWithFidelity.ts` (gate client-side en `SermonService`, coherente ADR-029 §D8); PR 3 "mismo batch" = 2ª llamada Flash en `evaluateClaimSourceFidelity`. **Handoff a Fase 4** (autoría + contra-scan + voice fingerprint): fidelity pass establece quality floor; ver phase-4 doc prereqs actualizados. Histórico Fase 3: **PR 3 (plurality)** merged #290; tagger doctrinal como 2ª Flash (Q4), `computePluralityCheck` puro, reusa `DoctrineLevel` de Confession, CTA cross-ref read-only. **PR 1** (#287) fidelity core + per-marker verdicts panel. **PR 2** (#289) gate `evaluatePublishGate` puro + `PrePublishFidelityModal` + `useSermonPublishGate`. **PR 4** (#298) authority. Plan locked en `/iniciar-fase 3`: 5 PRs secuenciales, decisiones Q1-Q10 en ADR-029. **PR 3** (plurality validator / no-proof-texting) code-complete (branch `feat/pastoral-fidelity-phase-3-pr-3-plurality`, PR por abrir): tagger de afirmaciones doctrinales como 2ª llamada Flash en `evaluateClaimSourceFidelity` (Q4), `computePluralityCheck` puro (core/distinctive con <2 pasajes distintos → soft-block), reusa `DoctrineLevel` de Confession, sección "Pluralidad" en panel + CTA "Añadir paralelo canónico" read-only vía cross-ref engine Fase 0; 522 tests verde. **PR 4/5 pendientes**. Histórico: **PR 1** (fidelity pass core + per-marker verdicts panel) mergeado #287 (2026-05-30). **PR 2** (publish gate + thresholds + override + audit) code-complete (2026-05-31, branch `feat/pastoral-fidelity-phase-3-pr-2-publish-gate`, PR por abrir): gate `evaluatePublishGate` puro (hard-block nunca overridable, soft-block exige justificación ≥100 chars audit-logged como `GateOverride`), enforcement client-side en `SermonService.publishSermon` + `publishSermonAsCopy` (bite solo si hay `fidelityReport` ⇒ blast radius 0), `PrePublishFidelityModal` + `useSermonPublishGate` en detail page; Q-A=ambos paths (UI full solo en editor; wizard cubierto server-side), Q-B=solo client-side (NO callable `publishSermonWithFidelity.ts`, coherente con ADR-029); 510 tests verde + tsc limpio. **PR 3/4/5 pendientes**. Plan locked en sesión `/iniciar-fase 3`: 5 PRs secuenciales (fidelity core → publish gate → plurality → authority → attribution footer), ~3-4 sem, decisiones Q1-Q10 formalizadas en ADR-029. **Prereqs Fase 3 ok**: citation engine Fases B+C en main (commits `a174ac05`, `b15dfcf5`, `248c40d6`, `2b74237a`, `21ba44c9`); `aggregateRequiredAttributions` ya existe wired (footer NO renderizado todavía — PR 5); `validateCitations` es función pura domain (no Firebase trigger); gate vive en `SermonService.publishSermon` línea 126. Anterior — **Fase 2.5 (Study Depth Copilot — Acompañante de Estudio) CERRADA + MERGED + DEPLOYED + SMOKE OK** 2026-05-29. 19 PRs en main (#267–#285) + Deploy Production verde + smoke end-to-end confirmado por fundador en prod. Tests verde 499/499 (web 62 + domain 325 + application 61 + infra 51). Feature flag `study_depth` (sub-flag de `pastoral_fidelity_flow`) default off; dogfooders on. **Pivot Option B respecto al plan original** (ADR-025 kickoff): NO passive tracker en Faculty ni classifier batch every-3-messages; el Acompañante se unificó como UN motor con 3 momentos (orientación per-paso pull-first + confrontación inline + gate pre-publish), 7 dimensiones re-derivadas de los 8 pasos canónicos via spine determinista (`computeStudyDepthFromSeed`), Faculty quedó como surface de exploración con su propio agente socrático (PR #268 / ADR-028) que tras decisión "Componer sermón" rerouted al pipeline único del wizard. **PRs principales**: #267 (PR A Study Companion en wizard, ADR-025/026/027), #268 (PR B Faculty Socratic Sermon Agent, ADR-028), #269 (PR C Pre-gen gate + snapshot + modo experto), #270 (Tier 3 puzzle estructural — scaffolding by struggle), #271 (Faculty reroute under flag), #272 (Boy-Scout chat.tsx refactor), #273 (8-step copy migration 6→8 pasos), #276 (restore "Sermón en blanco" entry como tertiary). **PRs smoke-derived bug**: #274 (3 bugs first impression), #275 (Tier 3 UX pass 1: linked hint + progress + dynamic CTA + length guard), #277 (Tier 3 copy clarity), #279 (Tier 3 guard tibio chapter:verse + whitelist libros cortos), #280 (parser flexible refs — wrong file dead code), #281 (parser REAL fix infraestructura), #282 (doc warnings duplicación parser), #283 (Bible panel Filemón empty + canonical book order), #284 (SBLGNT verseStart=0 sentinel), #285 (wizard exit nav `/dashboard/sermons` + Step 0 "Volver a Sermones"). **Tech debt acumulada explícita**: cleanup duplicación Bible parser (`tech_debt_bible_parser_duplication`), abstracción LLM provider (`tech_debt_llm_provider_abstraction`), chat persistence Step 1 (`tech_debt_wizard_step1_chat_persistence`). **Deferred intencional**: DnD nativo HTML5 (fold-in a Tier 3 v2), cache `orientStudy`+`buildStructuralPuzzle` (PR próximo), PD content ingest (fundador en paralelo). **Propuesta Sprint 2** abierta: [tier3-v2-dependency-diagram.md](./proposals/tier3-v2-dependency-diagram.md) (PR #278) — esqueleto de dependencias per-pasaje en lugar de 3 buckets abstractos; 4 decisiones abiertas para fundador antes de codear. ADRs 025-028 `accepted`. Anterior — **Fase 1.6 (8-step spine) CERRADA + MERGED + DEPLOYED + SMOKE OK** 2026-05-27. PR #265 (`b0fbcbd5`) merged a main (el PR #264 había subido solo docs; #265 trajo el código). Six-step→**8-step**: insertados `contextGenre` (pos 2) + `timelessPrinciple` (pos 7); rename `syntax`→`structuralAnalysis` y `morphology`→`wordStudies` (keys+labels, array interno `studies`). Migración idempotente `migratePastoralSeedsEightStep` corrida en prod (**23/23 seeds, 0 errores**; legacy quedan `completed:false` hasta llenar los 2 pasos nuevos). **Verificación 2 niveles** (ADR-023): `useInlineCoreTripwire` (Tier 1, `core`-only, no-bloqueante) en idea central + principio; gate completo (Tier 2) reusa WitnessOrchestrator; `validateSeedWitnesses` parametrizado `inline-core`|`full-gate` (cache key con modo). `verifyTimelessPrinciple` callable (verificador, no generador). `AiAssistLog` audit de primera clase (subcolección `pastoralSeeds/{id}/aiAssistLogs/`, guard pasos prohibidos reading/insight). ADRs 022/023/024 `accepted`. **Desviaciones (deuda visible)**: género vía mapa determinista `inferGenreFromBook` (outline LLM de `BookPanorama` diferido); trasfondo histórico RAG con degradación elegante (sin contenido PD ingestado aún — tarea del fundador); `AiAssistLog` cableado en assists nuevos (genre/historical/eisegesis), no en structural/wordStudies/crossRef. Fix de smoke: `BibleReaderPanel` resolvía libro solo por id → caía a libro arbitrario; ahora resuelve por id **o** nombre. Tests: 289 domain + 38 infra + 61 app + 42 web. Tripwire/visor/chip/mismatch-género validados en vivo. **Directiva del fundador → Fase 2.5**: Faculty como tutor socrático contextual por paso (datos+preguntas, nunca escribe la respuesta) — reabre la política de silencio de ADR-023; ADR nuevo al arrancar 2.5. Anterior — **Phase 2 (Tres Testigos) CERRADA + MERGED + DEPLOYED + SMOKE OK**. PR #262 (`cde288db`) squash-merged a main. `WitnessOrchestrator` aterrizado: callable `validateSeedWitnesses` thin (3 llamadas gemini-2.5-flash, verdicts crudos, cache `witnessResults/`) + escalado puro client-side (domain `WitnessValidation.ts`, ADR-011). Gate = 7º paso "Validación" en `PastoralSeedWizard` bajo sub-flag `three_witnesses` (default off, requiere `pastoral_fidelity_flow`). Escalado nivel×conteo (supersede tabla por-conteo de ADR-001): core+disenso→absolute-block sin override; distinctive/null→pass/note/soft/hard; open-evangelical cap nota. T3 multi-witness (ADR-010): core siempre, distinctive/open si `useConfessionalWitnesses` on. Respuestas del pastor → `pastoralSeed.witnessReview` (audit P3). Smoke prod: core(niega Trinidad)→absolute-block, distinctive 2/3→soft-block, observación→pass. Deuda explícita: D1 (T3 distinctive delgado, solo 4 credos con sections), D3 (Faculty launcher fold-simple sin pre-seed). Tests 11 domain + 3 web gate. ADR-011 emitido. Gotcha: `setUserFeatureFlags` tiene su propia allowlist server-side (no importa domain). Anterior — **Phase 1.5 CERRADA + MERGED + SMOKE CONFIRMADO**. 6 PRs (PR0 docs + PR1 modal/identify + PR5 curated dataset + PR2 analysis/cache + PR3 persist/Hebrew + PR4 naming/attribution) → **PR #258** squash-merged a `main` + deployado a prod. Follow-ups: **#259** (realtime `useUserProfile` — flag toggles sin reload) + **#260** (gate render test). Smoke end-to-end confirmado por el usuario (Juan 1:1, modal "Análisis Pastoral del Texto" funcional). `PastoralWordStudyModal` reemplaza `GreekTutorOverlay` embed cuando sub-flag `pastoral_word_study` on (requiere también `pastoral_fidelity_flow`). ADRs 017-021 accepted. `aggregateLexiconAttributions` + 50-entry curated lexicon v1 (30 griego + 20 hebreo). Tests: 269 domain + 38 infra + 61 app + 2 web gate. Follow-ups abiertos: LSJ/BDB dataset wire-up (stubs), smoke manual hebreo/save/cache-hit (opcional). Phase 1 CERRADA con deuda interim explícita previamente: Single PR `feat(pastoral-fidelity): Phase 1 — six-step spine` (#257). Entrega: schema top-level `pastoralSeeds/{seedId}` (ADR-015) + `PastoralSeedWizard` orquestador + 6 step components (Lectura/Sintaxis/Morfología/Reconocimiento/Función/Insight) + Greek tutor embed (interim) + Hebrew link-out + cross-ref engine integration + Faculty histórico link + AI-forbidden Step 6 con paste audit + gate hard en SermonWizard + `PRIMARY VOICE` prompt block + verbatim post-gen check + `PastoralSeedAuditPanel` inline en sermón detail + admin `PastoralSeedInspector` + UI audit kill-list Cat 1+4. Feature-flagged (`pastoral_fidelity_flow` off por default). 363 tests passing total (264+38+61). **Nueva Fase 1.5 Pastoral Word Study** insertada (ADR-016) — MorphologyStep actualmente embed `GreekTutorOverlay` (módulo académico) viola manifesto "sin convertir la clase en lección de idiomas"; Fase 1.5 reemplazará con `PastoralWordStudyModal` enfocado en uso pastoral. Anterior (Phase 0 recierre, 2026-05-25): cerrada con deuda 0 — PRs #252 + #253 + #254 + #255 — seed CORE ingest + backfill heurístico + UI badges + `useUserProfile.refetch()`; Smoke 1-8 + Deuda 1-4 validated end-to-end via MCP; `confessionChangeAudit/` populated; callables `ingestLibrarySeedSources` + `changePlanForUser` deployed. Propuestas tracked: [faculty-sermon-rag-enrichment.md](./proposals/faculty-sermon-rag-enrichment.md) (techo citacional Faculty) + [pdf-export-rewrite.md](./proposals/pdf-export-rewrite.md) (Puppeteer migration).

## Protocolo de sesión

**Una conversación por fase** es la unidad recomendada. Sub-tareas (PRs) de la misma fase comparten conversación.

### Apertura

**Modo rápido**: en nueva conversación escribir `/iniciar-fase N` (donde N es el número de fase). Ejemplo: `/iniciar-fase 0`. El slash command vive en `.claude/commands/iniciar-fase.md` y ejecuta el protocolo completo.

Alternativa (si slash command no disponible): copia-pega manual de la plantilla en [SESSION_KICKOFF.md](./SESSION_KICKOFF.md).

Ambos modos producen lo mismo:
- Lista ordenada de docs a leer (README + phase doc + ADRs + manifesto + bridges)
- Output esperado del agente antes de escribir código (resumen + plan PRs + preguntas + discrepancias)
- Adaptaciones por fase

### Durante

- Decisión técnica significativa → ADR inmediato (no esperar al cierre)
- Cambio al plan → update del phase doc en tiempo real (sección `Bitácora`)
- Sub-tareas con TodoWrite intra-sesión

### Cierre de fase

**Modo rápido**: en la conversación de la fase escribir `/cerrar-fase N`. Ejemplo: `/cerrar-fase 0`. El slash command vive en `.claude/commands/cerrar-fase.md`.

Alternativa: ejecutar manualmente el protocolo de [PHASE_CLOSEOUT.md](./PHASE_CLOSEOUT.md). 5 bloques en orden:

1. **Verificación de cierre real** (tests, criterios de aceptación, no deferrals encubiertos)
2. **Actualización de documentación** (phase doc + README + memoria + ADRs + session log)
3. **Handoff a siguiente fase** (prereqs satisfechos/no, update del próximo phase doc, riesgos cross-fase)
4. **Retrospective** (qué mejor/peor de lo estimado, qué cambió, aprendizajes)
5. **Sanity check final** (git limpio, CI verde, onboarding test mental)

Sin closeout disciplinado, la siguiente fase onboarda con contexto incompleto y deuda invisible.

## Mapa del folder

```
docs/pastoral-fidelity/
├── README.md                  ← este archivo (índice + estado)
├── SESSION_KICKOFF.md         ← plantilla para abrir nueva conversación de fase
├── PHASE_CLOSEOUT.md          ← protocolo para cerrar fase + handoff a siguiente
├── 00-vision.md               ← marco bíblico fundacional
├── 01-architecture.md         ← proyecto→artefactos + 6 pasos + tres testigos
├── 02-glossary.md             ← términos del proyecto
├── 03-reuse-map.md            ← infra existente → nuevo rol
├── 04-kill-list.md            ← qué deprecar y cuándo
├── 05-pedagogy-manifesto.md   ← manifiesto pedagógico del fundador (canónico)
├── 06-pedagogy-applied.md     ← bridge: manifiesto → componentes Preach (spec)
├── 07-citation-policy.md      ← política rights-aware del citation engine (spec)
├── data/
│   └── core-library-seed.json ← catálogo CORE Library (22 fuentes, semilla)
├── decisions/                 ← ADRs append-only (nunca editar pasado)
│   ├── ADR-template.md
│   ├── ADR-001-confession-anchored-correction.md
│   ├── ADR-002-six-step-as-step1-spine.md
│   ├── ADR-003-project-as-root-unit.md
│   ├── ADR-004-defer-exegesis-reform-decouple-sermon-from-paper.md
│   ├── ADR-005-exegetical-confessional-pedagogy.md
│   ├── ADR-006-rights-aware-citation-system.md
│   ├── ADR-007-phase-0-policy-resolutions.md
│   └── ADR-008-cross-reference-engine-tsk-based.md
├── phases/
│   ├── phase-0-foundations.md            ← DETALLE
│   ├── phase-1-six-step-spine.md         ← DETALLE
│   ├── phase-2-three-witnesses.md        ← placeholder
│   ├── phase-3-claim-source-fidelity.md  ← placeholder
│   ├── phase-4-authorship-contrascan-voice.md ← placeholder
│   ├── phase-5-project-as-container.md   ← placeholder
│   ├── phase-6-planner-runway.md         ← placeholder
│   └── phase-7-exegesis-reform.md        ← placeholder
└── sessions/                  ← logs de cierre (opcional, append-only)
    └── 2026-05-22-strategy.md ← kickoff
```

## Decisiones de diseño centrales

1. **Inversión del flujo** — pastor produce semilla antes que sistema genere. Wizard se bloquea hasta cumplir.
2. **Socratismo bíblico anclado en tres testigos** — contexto inmediato, paralelos canónicos, confesión declarada del propio pastor.
3. **Proyecto como unidad raíz** — sermón, estudio, newsletter, post, lección son artefactos derivados de un proyecto.
4. **Pedagogía exegético-confesional** — modelo operacional adoptado del manifiesto del fundador. 9 pasos del patrón exegético + 4 patrones por tipo de contenido + 3 niveles de doctrina (core/distinctive/open). Ver [05-pedagogy-manifesto.md](./05-pedagogy-manifesto.md) y [06-pedagogy-applied.md](./06-pedagogy-applied.md).
5. **Citation engine rights-aware** — dos ejes (`ingestion_status` × `license`) + display contextual + JSON canónico CORE Library con 22 fuentes (subset 14 v1). Ver [07-citation-policy.md](./07-citation-policy.md) y [ADR-006](./decisions/ADR-006-rights-aware-citation-system.md).
6. **Reuso, no rebuild** — ~70% de la infraestructura existente se reorquesta; lo nuevo es coordinación pastoral.

Detalle en [01-architecture.md](./01-architecture.md).

## Lo que NO entra aquí

- Código (va en `src/`)
- Schemas canónicos de Firestore (van en código + sus propios docs)
- Tareas operativas intra-sesión (TodoWrite)
- Marketing copy / pricing final (vive en su propio dominio)

## Memorias relacionadas

- `feature_pastoral_fidelity_roadmap.md` — pointer maestro
- `priorities_repositioning.md` — sermón como output derivado, no producto principal
- `feature_greek_tutor_methodology_narrative.md` — 6 pasos preservados para reuso (ahora se reusan aquí)
- `feature_exegesis_paper_artifacts_convergence.md` — patrón paper→artefactos (escalado a proyecto→artefactos)
- `feature_sermon_pipeline_convergence.md` — PR #213, base del wizard convergente
- `feature_faculty_sermon_wizard_convergence.md` — PR #214, derivedContext discriminated union
