# Phase 7 — Exégesis reform

## Estado

`active` desde **2026-09-17**. Se activa antes de lo previsto (el placeholder decía «6 meses
post-launch») porque el primer uso real del módulo de exégesis para un trabajo de seminario
(Salmo 23:1–3, investigación #1, OT603) dejó los huecos a la vista y con evidencia. Lo que
sigue es el plan de esa retrospectiva, en el orden acordado con el fundador.

## Objetivo

Que un pastor pueda entregar un trabajo exegético producido con el sistema **sabiendo por qué
confía en él**: qué fuentes usó y por qué, qué cita está verificada contra qué página, y que
el documento salga en el formato y la extensión que el seminario exige.

## Lo que el primer uso real dejó medido (Sal 23:1–3, 2026-09-16/17)

- 13 PRs de defectos mergeados durante el ejercicio (#616–#628); cinco afectaban qué texto
  leía el asistente.
- **El verificador de citas nunca corrió** sobre los cinco pasos del trabajo: lee `markdown`,
  y los pasos con análisis canónico lo tienen vacío. `lastRunAt: null` en todos.
- Revisión manual contra los PDF: **5 errores de cita por verso** en la primera versión de
  cada uno (página equivocada, referencia que el autor no hace, datos bibliográficos
  inventados, «piel/polel intensivo»). Dos vueltas de regeneración por verso.
- Composición final: 23:2 y 23:3 salieron como fichas mecánicas con 16 notas huérfanas;
  ~930 palabras de prosa útil frente a ~3.000 que exigen 12 páginas TMS.
- Ortiz (léxico, LlamaParse): definiciones legibles, formas hebreas invertidas; el sistema
  no lo dijo.

## Etapas (orden acordado)

| # | Etapa | Estado | Métrica de efectividad |
|---|---|---|---|
| 1 | **Verificación del análisis canónico + oración textual obligatoria** (P2.1, P2.2) | `in-progress` | Recall sobre errores conocidos ≥ 4/5; falsos «no encontrada» ≤ 10 % sobre citas correctas; `citationsWithoutVerbatim` → 0 |
| 2 | Word según la guía + extensión como contrato (P3.3, P3.2) | `planned` | El .docx generado abre en Word con 12 ± 1 páginas de cuerpo, notas al pie reales y bibliografía; 0 retoques manuales de formato |
| 3 | Recomposición dirigida, paso «Revisión», correcciones persistentes (P3.1, P4.1, P4.2) | `planned` | 0 versos publicados con render mecánico; una indicación marcada «para todo el trabajo» aparece en el prompt de cada paso siguiente |
| 4 | Salud del recurso y datos bibliográficos al ingerir (P1.3, P2.3) | `planned` | Ortiz muestra «formas hebreas ilegibles»; 0 datos bibliográficos inventados en la bibliografía |
| 5 | Bibliografía del curso, perfil de trabajo, páginas por lema (P1.1, P1.2, P1.4) | `planned` | Propuesta de páginas de un léxico acierta ≥ 10 de 12 entradas del pasaje |
| 6 | Perfil de voz y glosario terminológico (P3.4, P3.5) | `planned` | 0 términos del glosario en la salida («tronco», calcos del inglés) |

## Etapa 1 — Verificación del análisis canónico

### Qué cambia

- `collectAnalysisClaims` (domain): un solo recorrido de los seis sitios del análisis que
  devuelve cada afirmación con su cita y, si la hay, la oración textual. `collectAnalysisCitations`
  se deriva de aquí.
- `ICitationVerifier` acepta `citations` ya reconocidas y `language`; los adaptadores solo
  parsean el markdown cuando no las reciben.
- `VerbatimFirstCitationVerifier` (application, decorador): una cita con oración textual se
  coteja buscando la oración en las hojas de la fuente, sin modelo; lo que no aparece o no
  trae oración pasa al verificador LLM.
- `VerifyStepCitationsUseCase`: camino del análisis; la página de la cita se lleva a la unidad
  de la evidencia (`pageInEvidenceUnit`) para no cotejar impresa contra hoja.
- El resumen guarda `verifierVersion: 'analysis-v1'` y `citationsWithoutVerbatim`; la versión
  guarda `citationVerdicts` para que la interfaz señale cada cita sin volver a pagar.

### Cómo se mide

Verdad de referencia: la auditoría manual contra los PDF de las **versiones aceptadas** del
trabajo `exegeticalPapers/NjX4cEAkyuiAcimOqflW`. Errores conocidos que el verificador debe
atrapar:

| Verso | Cita | Qué está mal | Veredicto esperado |
|---|---|---|---|
| 23:1 | Andersen, p. 42 (Regla 1) | La regla está en p. 39 | page-mismatch |
| 23:2 | Ortiz, p. 438 (נחה) | Está en p. 437 | page-mismatch |
| 23:3 | Waltke-O'Connor, p. 440 (polel/hifil de שׁוב) | El contraste está en p. 436; la 440 trata el hifil interno | not-found o page-mismatch |
| 23:3 | Ross, p. 564 con Ez 20:9, 14; 36:22 | Ross no cita Ezequiel | not-found (la afirmación excede la página) |
| 23:3 | Ortiz, p. 438 (נחה, loading) | Está en p. 437 | page-mismatch |

Las ~40 citas restantes de los tres versos se verificaron a mano como correctas; sobre ellas se
mide la tasa de falsos negativos («no encontrada» o «página no coincide» sin razón).

Procedimiento: tras desplegar, pulsar «Verificar citas» en cada verso; leer `citationVerdicts`
de la versión aceptada con un script de administración; tabular. Registrar el resultado en la
bitácora de abajo.

## Decisiones tomadas

- [ADR-030](../decisions/ADR-030-fidelity-per-marker-belongs-to-paper-sermon-narrative.md) — la
  verificación claim↔fuente vive en el paper. Esta etapa es su implementación sobre el
  análisis canónico.
- «Bloquear lo que está mal, no lo que está incompleto» (gating aprobado para el Estudio Madre)
  se reutiliza para aceptar un paso: `not-found` bloquea sin revisión manual; `fuzzy-low` y
  `manual-pending` no. Se implementa en la etapa 3 (paso «Revisión»).

## Decisiones pendientes

- Testigo 4 (consenso académico) y six-step para el paper: siguen diferidos; no bloquean las
  etapas 1–6.
- Persistir veredictos por cita para pasos de prosa (hoy sí, acotados a 300 y notas de 400
  caracteres): revisar tamaño real del documento del trabajo tras un ciclo completo.

## Bitácora

- **2026-05-22** — Placeholder creado. Fase explícitamente diferida.
- **2026-09-17** — Activada tras la retrospectiva del trabajo de Sal 23:1–3. Etapa 1 en PR.
