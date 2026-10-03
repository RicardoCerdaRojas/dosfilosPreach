import { CitationManifest, GenerationRules, ExegeticalStudy, HomileticalAnalysis, WorkflowPhase, PhaseConfiguration, DEFAULT_LANGUAGE, formatSermonPersonalizationBlock, opensBook, splitApplication, buildVoiceBlock } from '@dosfilos/domain';
import type { SupportedLanguage } from '@dosfilos/domain';
// Guía de ilustraciones extraída de 90 ilustraciones REALES del fundador. Vive
// en un .md editable, como las guías de homilética, para que se pueda afinar sin
// tocar código. Hasta 2026-08-22 la instrucción sobre ilustraciones eran cuatro
// líneas dispersas ("relevante", "memorable", "no repitas categoría") y ninguna
// describía la forma que el pastor de verdad usa.
import illustrationGuidelinesMD from '../../config/prompts/homiletics/illustration-guidelines.md?raw';
import { SERMON_INTRO_HEADINGS, manuscriptStyleFor } from '@dosfilos/domain';

const JSON_INSTRUCTION = `IMPORTANTE: Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido. No incluyas NADA de texto antes ni después del JSON (ni "Aquí está el JSON", ni bloques de código markdown como \`\`\`json). Solo el objeto JSON crudo.`;

/**
 * Defense-in-depth language directive prepended to every sermon-generator
 * prompt. Authoring of the underlying prompts is in Spanish (the launch
 * language); this directive keeps Gemini emitting in the user's locale until
 * a content authoring pass produces fully-translated EN variants.
 *
 * Why prepend (not append): models attend more strongly to leading tokens, and
 * the JSON instruction sits at the bottom of many prompts — keeping the
 * language directive at the top avoids it getting shadowed.
 */
function languageDirective(language: SupportedLanguage): string {
    if (language === 'en') {
        return 'IMPORTANT: Respond entirely in English. Field values inside any JSON output must also be in English. The instructions below are authored in Spanish — translate them mentally and respond in English.';
    }
    return 'IMPORTANTE: Responde completamente en español. Los valores dentro de cualquier JSON también deben ir en español.';
}

/**
 * Wraps any prompt body with the language directive on top.
 */
function withLanguage(language: SupportedLanguage | undefined, body: string): string {
    return `${languageDirective(language ?? DEFAULT_LANGUAGE)}\n\n${body}`;
}

const DEFAULT_BASE_PROMPT = `Actúa como un experto teólogo, exégeta bíblico y predicador evangélico con décadas de experiencia.

**MÉTODO HERMENÉUTICO DE DOS FILOS**:
Utiliza un enfoque histórico-gramatical-literal, priorizando:
1. La intención del autor original en su contexto histórico
2. El significado literal del texto en sus idiomas originales (griego/hebreo)
3. La gramática y estructura del texto como guía interpretativa
4. El testimonio coherente de toda la Escritura

Tu objetivo es ayudar a pastores a crear sermones bíblicamente fieles, teológicamente sólidos y culturalmente relevantes.`;

const BASE_SYSTEM_PROMPT = `${DEFAULT_BASE_PROMPT}\n${JSON_INSTRUCTION}`;

export function buildExegesisPrompt(passage: string, rules: GenerationRules, config?: PhaseConfiguration, language?: SupportedLanguage): string {
  return withLanguage(language, buildExegesisPromptBody(passage, rules, config));
}

function buildExegesisPromptBody(passage: string, rules: GenerationRules, config?: PhaseConfiguration): string {
  const basePersona = config?.basePrompt || DEFAULT_BASE_PROMPT;
  const userPrompts = config?.userPrompts?.map(p => `- ${p}`).join('\n') || 'Ninguna';

  let knowledgeBase = config?.documents?.map(doc =>
    `--- DOCUMENTO: ${doc.name} ---\n${doc.content?.substring(0, 10000) || ''}\n--- FIN DOCUMENTO ---`
  ).join('\n\n') || '';

  if (config?.cachedResources && config.cachedResources.length > 0) {
    const cachedList = config.cachedResources.map(r => `- ${r.title} (Autor: ${r.author})`).join('\n');
    knowledgeBase += `\n\nADEMÁS, TIENES ACCESO A LOS SIGUIENTES LIBROS COMPLETOS EN TU CONTEXTO (CACHE):\n${cachedList}\n\nINSTRUCCIÓN: Usa estos libros para tu análisis y cítalos en "ragSources" cuando extraigas información de ellos.`;
  }

  // If no library resources available, provide recommended sources
  const hasLibraryResources = (config?.documents && config.documents.length > 0) ||
    (config?.cachedResources && config.cachedResources.length > 0);

  if (!hasLibraryResources) {
    knowledgeBase = `
## 📚 FUENTES TEOLÓGICAS RECOMENDADAS (Conocimiento General)

Como no tienes acceso a la biblioteca personal del pastor, basa tu análisis en fuentes evangélicas reconocidas:

**Comentarios Bíblicos Estándar**:
- Nuevo Comentario Bíblico Siglo XXI
- Comentario Bíblico Mundo Hispano
- Comentario del Contexto Cultural de la Biblia (Craig Keener)
- Comentarios de la serie "Andamios" (Editorial Vida)

**Léxicos y Recursos Lingüísticos**:
- Léxico Griego-Español del Nuevo Testamento (Tuggy)
- Diccionario Expositivo de Palabras del AT y NT (Vine)
- Concordancia Strong

**Teología Sistemática Evangélica**:
- Teología Sistemática (Wayne Grudem)
- Teología Bíblica del Antiguo y Nuevo Testamento (Paul House)

**INSTRUCCIONES**:
1. Declara explícitamente: "Basado en conocimiento general de fuentes evangélicas estándar..."
2. Cuando cites, usa formato: "Como señalan comentaristas evangélicos..." o "Según el consenso exegético..."
3. NO inventes citas específicas de autores si no estás seguro
4. Mantén fidelidad al método histórico-gramatical-literal
`;
  }

  return `
${basePersona}
${JSON_INSTRUCTION}

FASE 1: ESTUDIO EXEGÉTICO - RESUMEN EJECUTIVO

Objetivo: Proporcionar un resumen ejecutivo conciso del estudio exegético que permita al pastor comenzar a trabajar inmediatamente.

Pasaje: "${passage}"

BASE DE CONOCIMIENTO (Usa esta información para enriquecer tu análisis):
${knowledgeBase}

## Estructura del Resumen Ejecutivo

Genera un análisis exegético que contenga:

### 1. Contexto General (2-3 párrafos máximo)
- Contexto histórico-cultural relevante
- Contexto literario (género, ubicación en el libro, flujo del argumento)
- Audiencia original y situación

### 2. Palabras Clave (3-5 términos máximo)
Para cada palabra clave:
- Término original (griego/hebreo con transliteración)
- Lema (Raíz Lexical) - ¡IMPORTANTE!
- Traducción Literal (Significado básico)
- Morfología básica (parte del discurso, tiempo verbal si aplica)
- Función sintáctica en el pasaje
- Significado teológico/exegético relevante

### 3. Proposición Exegética Tentativa
Una declaración clara y concisa (1-2 oraciones) que responda:
"¿Qué significó este texto para los oyentes originales?"

### 4. Consideraciones Pastorales (3-4 puntos clave)
Insights que el pastor debe tener en cuenta:
- Posibles malinterpretaciones comunes
- Tensiones teológicas o hermenéuticas
- Conexiones con otros pasajes bíblicos
- Aplicaciones contemporáneas potenciales (sin desarrollar aún)

Reglas Personalizadas del Usuario:
${rules.customInstructions || 'Ninguna'}
${rules.theologicalBias ? `Sesgo Teológico: ${rules.theologicalBias}` : ''}

Instrucciones Específicas del Usuario (Globales):
${userPrompts}

Formato de Salida (JSON):
{
  "passage": "${passage}",
  "context": {
    "historical": "Contexto histórico-cultural...",
    "literary": "Contexto literario y flujo del argumento...",
    "audience": "Audiencia original y situación..."
  },
  "keyWords": [
    {
      "original": "ἀποθέμενοι",
      "transliteration": "apothemenoi",
      "lemma": "ἀποτίθημι",
      "literalTranslation": "poner a un lado / desechar",
      "morphology": "Participio aoristo medio, nominativo plural masculino",
      "syntacticFunction": "Participio circunstancial de modo/manera",
      "significance": "Indica una acción decisiva y completa de 'despojarse' o 'desechar', enfatizando la totalidad del acto."
    }
  ],
  "exegeticalProposition": "Pedro exhorta a los creyentes recién nacidos espiritualmente a descartar radicalmente toda forma de maldad y engaño, para que puedan crecer en su salvación mediante el deseo puro de la Palabra de Dios.",
  "pastoralInsights": [
    "El lenguaje de 'recién nacidos' (1:23) conecta con la metáfora de crecimiento espiritual. No confundir inmadurez con incapacidad.",
    "La lista de vicios (v.1) es exhaustiva e intencional. Pedro enfatiza la incompatibilidad radical entre la nueva identidad en Cristo y estos comportamientos.",
    "El 'deseo' (ἐπιποθέω) de la leche espiritual no es pasivo sino activo y apasionado. Contrasta con la apatía espiritual."
  ],
  "ragSources": [
    {
      "title": "Nombre del documento usado",
      "author": "Autor si está disponible",
      "page": "Página o sección",
      "usedFor": "Breve descripción de cómo se usó este documento en el análisis"
    }
  ]
}

REGLAS DE GENERACIÓN:
1. Concisión: Prioriza claridad sobre exhaustividad. El pastor puede profundizar después vía chat.
2. Accesibilidad: Usa lenguaje técnico solo cuando sea necesario, y explícalo brevemente.
3. Relevancia Pastoral: Enfócate en lo que realmente impacta la predicación, no en detalles académicos oscuros.
4. Fidelidad al Texto: Toda interpretación debe estar anclada en el análisis del texto original.
5. Formato Estricto: Respeta exactamente la estructura JSON especificada.
6. Citas de Fuentes: Si usas información de los DOCUMENTOs proporcionados en la BASE DE CONOCIMIENTO, incluye en "ragSources" una entrada por cada documento que hayas consultado, indicando cómo lo usaste.
`;
}

export function buildHomileticsPrompt(exegesis: ExegeticalStudy, rules: GenerationRules, language?: SupportedLanguage): string {
  return withLanguage(language, buildHomileticsPromptBody(exegesis, rules));
}

function buildHomileticsPromptBody(exegesis: ExegeticalStudy, rules: GenerationRules): string {
  return `
${BASE_SYSTEM_PROMPT}

FASE 2: ANÁLISIS HOMILÉTICO
Objetivo: Construir un puente entre el mundo bíblico y el mundo contemporáneo.

Estudio Exegético Previo:
- Pasaje: ${exegesis.passage}
- Proposición Exegética: ${exegesis.exegeticalProposition}
- Palabras Clave: ${exegesis.keyWords.join(', ')}

Instrucciones:
1. Determina el mejor enfoque homilético (Expositivo, Temático, Narrativo, etc.) para este pasaje.
2. Genera aplicaciones contemporáneas relevantes para una audiencia: ${rules.targetAudience || 'General'}.
3. Define la Proposición Homilética: ¿Qué dice Dios hoy a través de este texto?
4. Crea un bosquejo estructurado.

Reglas Personalizadas del Usuario:
${rules.customInstructions || 'Ninguna'}
${rules.tone ? `Tono sugerido: ${rules.tone}` : ''}

Formato de Salida (JSON):
{
  "homileticalApproach": "temático",
  "contemporaryApplication": ["aplicación 1", "aplicación 2"],
  "homileticalProposition": "La proposición homilética...",
  "outline": {
    "mainPoints": [
      { "title": "Punto 1", "description": "Descripción...", "scriptureReferences": ["Ref 1"] }
    ]
  }
}
`;
}

export function buildSermonDraftPrompt(
  analysis: HomileticalAnalysis,
  rules: GenerationRules,
  language?: SupportedLanguage,
  manifest?: CitationManifest,
): string {
  return withLanguage(language, buildSermonDraftPromptBody(analysis, rules, manifest, language));
}

/**
 * Citation contract block for the sermon draft. Tells the LLM the EXACT set
 * of source IDs it may use and that it must attribute them NARRATIVELY in
 * the prose (07-citation-policy §4 / ADR-030) — sermons cite pastorally
 * ("Como resume la Confesión…"), NOT with `[Sn]` footnote markers (those
 * are paper-only). The S-IDs live solely in the `ragSources` JSON field,
 * which feeds the bibliography + legal attributions; `validateCitations`
 * still drops any `ragSources` entry whose `sourceId` is off-contract.
 *
 * Per ADR-030 the per-marker claim↔source fidelity pass is a paper/study
 * feature, not a sermon feature, so the sermon prose deliberately carries
 * no inline citation markers.
 *
 * Returns '' when the manifest is empty so the prompt stays clean for
 * sermons generated without retrieval context (manual flow, no library).
 */
function buildCitationContractBlock(manifest?: CitationManifest): string {
  if (!manifest || manifest.entries.length === 0) return '';
  // IMPORTANT: we deliberately DO NOT include the verbatim source excerpt
  // here. Feeding long copyrighted passages into the prompt makes Gemini
  // reproduce them and trips its RECITATION safety filter (blocks the whole
  // sermon). The model only needs the source identity to attribute it
  // narratively; the exact quote + page live in the citation manifest (popover)
  // and the post-generation anchor injector grounds the attribution.
  const sourceList = manifest.entries
    .map((e) => {
      const author = e.author?.trim() ? ` — ${e.author}` : '';
      const page = e.page?.trim() ? ` (p. ${e.page})` : '';
      return `  [${e.sourceId}] ${e.title}${author}${page}`;
    })
    .join('\n');
  return `
═══ FUENTES DISPONIBLES PARA CITAR (CONTRATO DE CITACIÓN) ═══
A continuación va la lista CERRADA de fuentes en las que puedes apoyarte en
este sermón. Cada fuente tiene un ID estable (S1, S2, …) con su autor y obra.

${sourceList}

REGLAS DE CITACIÓN (OBLIGATORIAS — el servidor valida y descarta lo que no cumpla):

1. **Atribución NARRATIVA (estilo sermón, NO académico)**: cuando te apoyes
   en una de estas fuentes, atribúyela TEJIDA EN LA PROSA, nombrando la
   fuente con naturalidad pastoral. Debe sonar natural dicha desde el púlpito:
   - "Como resume la Confesión de Westminster, Dios quiso dejar su
     revelación por escrito…"
   - "Como observa Schreiner en su comentario sobre este pasaje, el verbo
     aquí denota una acción decisiva…"

2. **Ancla verificable \`[Sn]\` al final de la oración atribuida**: después de
   atribuir narrativamente, coloca el ID de la fuente entre corchetes al final
   de esa oración (o cláusula). Ejemplo:
   "Como observa Schreiner, el verbo denota una acción decisiva [S2]."
   Este ancla NO es un footnote académico: la app lo convierte en un enlace
   sutil que abre la cita textual + libro + página para que el oyente la
   compruebe. Multi-fuente en una oración: \`[S1, S3]\` (un solo par de
   corchetes), nunca \`[S1][S3]\`.

3. **Una cita por punto (mínimo)**: CADA punto del sermón debe apoyarse en al
   menos UNA de estas fuentes (atribución narrativa + ancla). ÚNICA excepción:
   si ninguna fuente de la lista respalda genuinamente ese punto, déjalo SIN
   cita — jamás fuerces una cita irrelevante.

4. **NUNCA inventes una cita**: solo puedes usar los IDs listados arriba.
   PROHIBIDO inventar \`S99\`/\`Otro\`/\`Wallace\` o citar un autor/obra que no
   esté en la lista. Una cita inventada en el púlpito destruye la credibilidad.
   Ante la duda, no cites.

5. **Parafrasea SIEMPRE con tus propias palabras — PROHIBIDO reproducir texto
   verbatim de las fuentes (grounding)**: atribuye la IDEA de la fuente
   redactada por ti ("Como enseña MacArthur, el contentamiento nace de Cristo"),
   NUNCA copies frases textuales de la obra. Reproducir prosa con copyright
   palabra-por-palabra hace que el sistema bloquee el sermón. Sé fiel a la idea
   sin transcribir.

6. **\`ragSources\` debe reflejar lo que anclaste**: por cada \`[Sn]\` que uses
   en la prosa, incluye una entrada en \`ragSources\` con \`"sourceId": "Sn"\`
   EXACTO. El servidor descarta entradas con \`sourceId\` faltante o desconocido.

7. **Citas bíblicas NO usan este contrato**: las referencias bíblicas siguen su
   formato propio \`[📖 Juan 1:1](#bible-juan-1-1)\`, nunca \`[Sn]\`.

═══════════════════════════════════════════════════════════════════

`;
}

function buildFacultyContextBlock(facultyContext?: GenerationRules['facultyContext']): string {
  if (!facultyContext) return '';
  const { sessionTitle, outline } = facultyContext;
  const pointsList = outline.points
    .map((p, i) => `  ${['I', 'II', 'III', 'IV', 'V'][i] ?? i + 1}. ${p.title} (${p.verses})`)
    .join('\n');
  return `
═══ CONTEXTO DE ORIGEN — FACULTAD ═══
**Sesión de origen:** ${sessionTitle}
**Bosquejo aprobado en la facultad (OBLIGATORIO respetar):**
- Título: ${outline.title}
- Pasaje: ${outline.passage}
- Proposición: ${outline.proposition}
- Puntos:
${pointsList}

Este sermón fue iniciado desde una conversación de la Facultad. El
usuario revisó y aprobó el bosquejo de arriba antes de pedir el sermón
completo. NO cambies el título, pasaje, proposición ni los puntos del
bosquejo. Si necesitas reorganizar internamente un punto, hazlo dentro
del título del punto aprobado.

═════════════════════════════════════

`;
}

function buildProjectContextBlock(projectContext?: GenerationRules['projectContext']): string {
  if (!projectContext?.contextNote?.trim()) return '';
  return `
═══ CONTEXTO DEL PROYECTO ═══
**Proyecto:** ${projectContext.name}
${projectContext.contextNote.trim()}

Considera este contexto al generar el sermón. Adapta el tono, la
profundidad y las aplicaciones a la descripción de la congregación y
serie de predicación de arriba.

═════════════════════════════

`;
}

function buildPaperContextBlock(paperContext?: GenerationRules['paperContext']): string {
  if (!paperContext?.assembledMarkdown?.trim()) return '';
  const briefLine = paperContext.assignmentBrief?.trim()
    ? `\n**Brief del trabajo:** ${paperContext.assignmentBrief.trim()}`
    : '';
  const titleLine = paperContext.title?.trim() ? ` — *${paperContext.title.trim()}*` : '';
  return `
═══ CONTEXTO DE ORIGEN — PAPER EXEGÉTICO ═══
**Pasaje del paper:** ${paperContext.passage}${titleLine}${briefLine}

A continuación va el paper exegético completo del cual este sermón
deriva. Usa su análisis exegético, sus citas reales de autoridad y su
desarrollo teológico como FUENTE PRIMARIA para el sermón. NO inventes
citas atribuidas — solo usa las que aparecen aquí.

--- BEGIN PAPER ---
${paperContext.assembledMarkdown}
--- END PAPER ---

═════════════════════════════════════════════

`;
}

/**
 * Pastoral Fidelity Phase 1 — PRIMARY VOICE block.
 *
 * Prepended ahead of every other context block so the LLM treats the
 * pastor's seed as the authoritative spine. `centralIdea` is required
 * verbatim in the final draft (post-gen check enforces it). Word
 * studies, parallels, anecdote, and doxological application are inputs
 * the LLM develops on top of — never replaces.
 *
 * Returns '' when no seed is supplied so legacy flows stay clean.
 */
function buildPastoralSeedBlock(seed?: GenerationRules['pastoralSeed']): string {
  if (!seed) return '';
  const observations = seed.observations.map((o, i) => `${i + 1}. "${o}"`).join('\n');
  // EL DATO LÉXICO Y EL DESCUBRIMIENTO DEL PASTOR VAN SEPARADOS, ETIQUETADOS.
  // Cuando viajaban juntos en una línea, el borrador imprimía el comentario del
  // pastor bajo el rótulo "Palabras Clave", como si fuera la glosa: una
  // asociación forzada que le atribuye al léxico lo que dijo él.
  const wordStudies = seed.wordStudies
    .map((w) => {
      const partes = [`  - ${w.word} (${w.reference})`];
      if (w.semanticRange?.length) {
        partes.push(`      Rango semántico: ${w.semanticRange.join(' · ')}`);
      }
      if (w.useInVerse?.trim()) {
        partes.push(`      Uso en este versículo: ${w.useInVerse.trim()}`);
      }
      if (w.theologicalWeight?.trim()) {
        partes.push(`      Peso teológico: ${w.theologicalWeight.trim()}`);
      }
      partes.push(`      Lo que descubrió EL PASTOR (es suyo, no es la glosa): ${w.discovery}`);
      return partes.join('\n');
    })
    .join('\n');
  const parallels = seed.parallels
    .map((p) => `  - ${p.reference} — ${p.relevance}`)
    .join('\n');
  const genreBlock = seed.genre
    ? `## Género literario (gobierna las reglas de lectura):
${seed.genre}${seed.genreImplication ? ` — ${seed.genreImplication}` : ''}
${seed.bookLocationNote ? `Ubicación en el libro: ${seed.bookLocationNote}\n` : ''}`
    : '';
  const principleBlock = seed.timelessPrinciple
    ? `## Principio teológico atemporal (la verdad transcultural — el puente exégesis→homilética):
"${seed.timelessPrinciple}"
El sermón debe permanecer fiel a este principio. La idea central de abajo es la
voz homilética del pastor para SU congregación; el principio es la verdad que la
sostiene. No los confundas ni reemplaces el principio por una generalización propia.
`
    : '';
  return `
═══ PRIMARY VOICE (LA VOZ DEL PASTOR — NO ANULAR) ═══

El pastor ha producido la siguiente semilla a través de 8 pasos de estudio
personal. Esta semilla ES la voz pastoral del sermón. Tu rol es DESARROLLAR,
no ORIGINAR. El asistente desarrolla, el asistente no origina.

${genreBlock}${principleBlock}## Idea central (palabras EXACTAS del pastor):
"${seed.centralIdea}"

## Observaciones del pastor (desarrolla cada una, no las reemplaces):
${observations}

## Pregunta abierta que el sermón debe responder:
"${seed.openQuestion}"

## Anécdota pastoral que el pastor quiere integrar:
"${seed.pastoralAnecdote}"

## Aplicación doxológica (manifiesto Paso 8 — lleva el sermón aquí):
"${seed.doxologicalApplication}"

## Hallazgos exegéticos del pastor (úsalos como fundamento):
- Cláusula principal: ${seed.mainClauseReference} — ${seed.mainClauseNote}
- Estudios de palabras:
${wordStudies}
- Paralelos canónicos marcados como relevantes (PRIMARIOS — puedes agregar otros, pero estos llevan precedencia):
${parallels}
- Función para la audiencia original: ${seed.originalAudienceFunction}

═══ INSTRUCCIONES DE DESARROLLO (OBLIGATORIAS) ═══

1. **No eres el autor**. Eres un asistente que desarrolla la semilla del pastor en un sermón estructurado.
2. **La idea central de arriba es el espine del sermón**. No introduzcas otra idea central.
3. **Cada sección mayor** del sermón debe conectar explícitamente con UNA de las observaciones del pastor o con la pregunta abierta.
4. **La frase exacta de la idea central debe aparecer VERBATIM al menos una vez** en el cuerpo del sermón. El servidor verifica esto y advierte al pastor si la omites.
5. **La anécdota pastoral debe integrarse** donde la lógica del pastor lo sostenga, no inventes una nueva.
6. **Paralelos del pastor son PRIMARIOS**. Puedes agregar otros, pero los del pastor van citados primero.
7. **La aplicación doxológica del pastor cierra el sermón**. No la sustituyas por aplicaciones generales.

═══════════════════════════════════════════════════════════════════

`;
}

/**
 * Renderiza el bosquejo COMO BLOQUE ETIQUETADO, no como `JSON.stringify`.
 *
 * El JSON crudo llegaba entero al prompt —descripciones incluidas— pero sin una
 * sola instrucción que lo atara: las ~200 líneas siguientes le piden al modelo
 * redactar la exposición de cada punto desde cero. El resultado era que el
 * trabajo del pastor sobre el bosquejo se respetaba de forma probabilística.
 *
 * Etiquetar cada campo es la mitad del arreglo; la otra mitad es el CONTRATO
 * que emite `buildPastorDirectiveContract` cuando hay directivas.
 */
function buildOutlineBlock(outline: HomileticalAnalysis['outline']): string {
  const points = outline?.mainPoints ?? [];
  if (points.length === 0) return '- Bosquejo: (sin puntos definidos)';

  const rendered = points.map((p, i) => {
    const n = i + 1;
    const refs = p.scriptureReferences?.length ? p.scriptureReferences.join(', ') : '(sin referencias)';
    const lines = [
      `▸ PUNTO ${n}: ${p.title}`,
      `   Descripción: ${p.description || '(pendiente)'}`,
      `   Referencias: ${refs}`,
    ];
    // El pastor decide CUÁNTAS implicaciones separando con líneas en blanco.
    // Se parten acá, en dominio, y llegan numeradas: pedirle al modelo que
    // "respete los saltos de línea" es pedirle que haga algo calculable.
    const aplicaciones = splitApplication(p.application);
    if (aplicaciones.length === 1) {
      lines.push(`   Aplicación aprobada por el pastor: ${aplicaciones[0]}`);
    } else if (aplicaciones.length > 1) {
      lines.push(`   Aplicaciones aprobadas por el pastor (${aplicaciones.length} — una implicación por cada una):`);
      aplicaciones.forEach((a, k) => lines.push(`      ${k + 1}. ${a}`));
    }
    const emphasis = p.pastorDirective?.emphasis?.trim();
    if (emphasis) {
      lines.push(`   ⚑ ÉNFASIS DEL PASTOR (vinculante): ${emphasis}`);
    }
    const notes = (p.pastorDirective?.exegeticalNotes ?? []).filter((nt) => nt.trim());
    if (notes.length > 0) {
      lines.push('   ⚑ DEBE APARECER EN LA EXPOSICIÓN DE ESTE PUNTO (vinculante):');
      notes.forEach((nt, k) => lines.push(`      ${k + 1}. ${nt.trim()}`));
    }
    return lines.join('\n');
  });

  return `Bosquejo (${points.length} punto${points.length === 1 ? '' : 's'}):\n\n${rendered.join('\n\n')}`;
}

/**
 * El contrato que hace vinculante la voz del pastor.
 *
 * Sólo se emite si HAY directivas: un bloque que dice "respeta las directivas"
 * cuando no hay ninguna es ruido que compite con el resto del prompt.
 *
 * Distingue las dos formas porque no son lo mismo y fallan distinto: el énfasis
 * MODULA (gobierna el ángulo de toda la exposición) y las notas OBLIGAN (son
 * datos que deben aparecer). Una nota tratada como sugerencia desaparece; un
 * énfasis tratado como dato se convierte en una frase pegada al final.
 */
function buildPastorDirectiveContract(outline: HomileticalAnalysis['outline']): string {
  const points = outline?.mainPoints ?? [];
  const conEnfasis: number[] = [];
  const conNotas: number[] = [];
  points.forEach((p, i) => {
    if (p.pastorDirective?.emphasis?.trim()) conEnfasis.push(i + 1);
    if ((p.pastorDirective?.exegeticalNotes ?? []).some((n) => n.trim())) conNotas.push(i + 1);
  });
  if (conEnfasis.length === 0 && conNotas.length === 0) return '';

  return `
═══════════════════════════════════════════════════════════════════
⚑ DIRECTIVAS DEL PASTOR — MÁXIMA PRECEDENCIA
═══════════════════════════════════════════════════════════════════

Las líneas marcadas con ⚑ en el bosquejo las escribió EL PASTOR, no el sistema.
Son lo único del bosquejo que no generaste tú. Tienen precedencia sobre tus
propias decisiones de contenido y sobre el resto de estas instrucciones.

${conEnfasis.length > 0 ? `**ÉNFASIS (puntos ${conEnfasis.join(', ')})** — MODULA la exposición.
Es el ángulo desde el cual se predica ese punto: gobierna la exposición COMPLETA
del punto, no es una frase que se agrega al final. Si tu desarrollo natural del
texto apunta a otro lado, cede: el pastor ya decidió el ángulo.
` : ''}${conNotas.length > 0 ? `**DEBE APARECER (puntos ${conNotas.join(', ')})** — OBLIGA.
Son datos del texto que el pastor quiere expuestos. Cada uno DEBE aparecer
desarrollado en el "content" de su punto —normalmente bajo "Palabras Clave" o
"Nota Exegética"—, no mencionado de pasada. Si compite con una palabra clave que
elegiste tú, gana la del pastor.
` : ''}
LÍMITE: la directiva dirige cómo se EXPONE el texto. No autoriza a afirmar lo que
el texto no dice. Si una directiva contradice el pasaje, exponla como el pastor
la formuló y NO la refuerces con datos inventados.
═══════════════════════════════════════════════════════════════════
`;
}


/**
 * El ORDEN de las secciones de la introducción.
 *
 * La anécdota del Paso 8 abre el sermón cuando existe: el pastor la escribe
 * ANTES de tener puntos homiléticos —está pensando en la congregación, no en el
 * bosquejo— así que su lugar natural es la puerta de entrada, no el interior de
 * un punto.
 */
function introSections(
  analysis: HomileticalAnalysis,
  rules: GenerationRules,
  h: (typeof SERMON_INTRO_HEADINGS)[keyof typeof SERMON_INTRO_HEADINGS],
): string {
  const anecdota = rules.pastoralSeed?.pastoralAnecdote?.trim();
  const orientacion = opensBook(analysis.exegeticalStudy?.passage ?? '');
  return [
    anecdota ? `### ${h.openingIllustration}` : null,
    orientacion ? `### ${h.bookOverview}` : null,
    `### ${h.historicalContext}`,
    `### ${h.currentConnection}`,
    `### ${h.sermonProposition}`,
  ]
    .filter(Boolean)
    .join(' → ');
}

/**
 * Dónde va la anécdota del pastor, y —tan importante— dónde NO va.
 *
 * El problema real: la anécdota llegaba al prompt por DOS caminos. El bloque de
 * la semilla la anunciaba como "anécdota que el pastor quiere integrar", y el
 * bloque de personalización la repetía bajo "ILUSTRACIONES DEL PREDICADOR
 * (incorporar literalmente en el CUERPO del sermón)" —porque el wizard copia
 * `insight.pastoralAnecdote` a `personalization.illustrations` al cargar la
 * semilla—. Ninguno de los dos decía DÓNDE, y el segundo empujaba activamente
 * hacia adentro de un punto. Resultado: la ilustración de apertura terminaba
 * enterrada en el punto I.
 *
 * Y la segunda mitad de la regla importa igual: las ilustraciones de cada punto
 * se generan DESDE ese punto. Reciclar la de apertura adentro de un movimiento
 * gasta dos veces la misma imagen y deja al punto sin la suya.
 */
function openingIllustrationRule(rules: GenerationRules): string {
  const anecdota = rules.pastoralSeed?.pastoralAnecdote?.trim();
  if (!anecdota) return '';
  return `     - **ILUSTRACIÓN DE APERTURA (del pastor)**: el sermón ABRE con la anécdota
       que el pastor escribió en su estudio. Va PRIMERO, antes del contexto
       histórico, bajo "### Ilustración de Apertura". Úsala tal como la escribió
       —puedes pulir la redacción, no cambiar la historia— y cierra con un puente
       de una o dos frases hacia el texto.
     - **NO la repitas en ningún punto del cuerpo.** Si aparece también en
       "ILUSTRACIONES DEL PREDICADOR", es la misma y ya está usada acá. La
       ilustración de cada punto se genera DESDE ese punto.
`;
}

/**
 * La orientación al libro, SÓLO cuando el sermón lo abre.
 *
 * `opensBook` lo decide en dominio y no el modelo: es calculable, y preguntarle
 * al modelo "¿esto es la introducción del libro?" invita a decidirlo por
 * parecido. En medio de una serie este material es relleno que le roba minutos
 * a la exposición.
 *
 * EL LÍMITE ES LA PARTE IMPORTANTE. Las fechas de composición, la autoría y los
 * libros contemporáneos son terreno DISPUTADO —Jonás es el caso de manual: hay
 * quien lo fecha en el siglo VIII y quien lo hace postexílico—. Pedir un dato
 * verificable como obligatorio es el mecanismo por el que se fabrica uno falso;
 * es la misma lección que la cita de autoridad. Por eso acá se pide el rango y
 * el nombre del debate, nunca una fecha única presentada como hecho.
 */
function bookOrientationRule(analysis: HomileticalAnalysis): string {
  if (!opensBook(analysis.exegeticalStudy?.passage ?? '')) return '';
  return `     - **EL LIBRO DE UN VISTAZO**: este sermón ABRE el libro, así que la
       introducción tiene que ubicar a la congregación en el libro ENTERO antes
       de entrar al texto. En 2 o 3 párrafos cortos, bajo "### El Libro de un
       Vistazo":
       · quién lo escribe y en tiempo de qué rey o período;
       · **qué OTRO pasaje de la Biblia habla de este libro o de su autor**, con
         la referencia (por ejemplo, para Jonás: 2 Reyes 14:25, que lo nombra
         hijo de Amitai bajo Jeroboam II);
       · sus divisiones más reconocidas;
       · **quién más profetiza o escribe en el mismo escenario**, y si algún
         otro libro trata el mismo asunto (para Jonás: Nahúm también profetiza
         sobre Nínive; Amós y Oseas son contemporáneos);
       · cómo se integra en lo que Dios está haciendo con Israel y en la
         historia de la redención completa.
     - **ANCLA EN EL CANON, NO EN LA ERUDICIÓN.** Lo anterior es casi todo dato
       BÍBLICO: sale de la Escritura y de los reinados que ella misma fecha, no
       de reconstrucciones académicas. Prefiérelo siempre, y da la referencia.
     - **NO ABRAS DEBATES QUE NO VAS A CERRAR (obligatorio).** PROHIBIDO escribir
       "algunos estudiosos debaten", "hay discusión sobre la fecha" o
       equivalentes. Esto se predica de pie ante una congregación: una duda
       planteada y no resuelta se queda con ellos el resto del sermón y le roba
       atención al texto. La crítica de fechas y autoría pertenece al paper
       exegético, no al púlpito.
       Da el dato como lo ubica la tradición, en UNA cláusula y sin matizar. Si
       no tienes una respuesta simple y defendible, **OMITE ese punto**: un
       párrafo más corto es mejor que una duda abierta — y mucho mejor que un
       dato inventado que el pastor va a repetir desde el púlpito.
`;
}

function buildSermonDraftPromptBody(
    analysis: HomileticalAnalysis,
    rules: GenerationRules,
    manifest?: CitationManifest,
    language: SupportedLanguage = DEFAULT_LANGUAGE,
): string {
  // Los MISMOS encabezados que el taller pinta vía i18n (constante de dominio
  // con test de paridad en web): dos caminos, una sola introducción.
  const H = SERMON_INTRO_HEADINGS[language] ?? SERMON_INTRO_HEADINGS.es;
  // Format exegetical study for context
  const exegesisContext = analysis.exegeticalStudy ? `

CONTEXTO EXEGÉTICO (úsalo para enriquecer el sermón):
- Pasaje: ${analysis.exegeticalStudy.passage}
- Proposición Exegética: ${analysis.exegeticalStudy.exegeticalProposition}

Contexto del Pasaje:
  * Histórico: ${analysis.exegeticalStudy.context.historical}
  * Literario: ${analysis.exegeticalStudy.context.literary}
  * Audiencia Original: ${analysis.exegeticalStudy.context.audience}

Palabras Clave (úsalas para notas exegéticas):
${analysis.exegeticalStudy.keyWords.map(kw => `  - ${kw.original} (${kw.transliteration}): ${kw.significance}`).join('\n')}

Insights Pastorales:
${analysis.exegeticalStudy.pastoralInsights.map(insight => `  • ${insight}`).join('\n')}${
    (analysis.exegeticalStudy.canonicalParallels?.length ?? 0) > 0
        ? `

Paralelos canónicos marcados por el pastor (CÍTALOS en el cuerpo donde correspondan; son PRIMARIOS, no los reemplaces por otros):
${analysis.exegeticalStudy.canonicalParallels!.map(p => `  • ${p.reference}${p.relevanceNote ? `: ${p.relevanceNote}` : ''}`).join('\n')}`
        : ''
}
` : '';

  const personalizationBlock = formatSermonPersonalizationBlock(rules.personalization);
  const paperContextBlock = buildPaperContextBlock(rules.paperContext);
  const facultyContextBlock = buildFacultyContextBlock(rules.facultyContext);
  const projectContextBlock = buildProjectContextBlock(rules.projectContext);
  const citationContractBlock = buildCitationContractBlock(manifest);
  // Pastoral Fidelity Phase 1: PRIMARY VOICE is the highest-priority
  // context. It precedes every other block (including base system
  // prompt instructions about tone/length) so the LLM's anchor is
  // the pastor's seed, not the homiletical analysis derived later.
  const pastoralSeedBlock = buildPastoralSeedBlock(rules.pastoralSeed);
  // Fase 4 — cómo escribe ESTE pastor. Va DESPUÉS de la voz primaria y del
  // prompt base, y es deliberado: la voz primaria dice QUÉ tiene que decir el
  // sermón (su idea, sus observaciones) y esto dice CÓMO suena cuando lo dice
  // él. Ponerlo antes lo dejaría compitiendo con el contenido que debe servir.
  const voiceBlock = buildVoiceBlock(rules.voiceSamples ?? []);

  return `
${pastoralSeedBlock}${BASE_SYSTEM_PROMPT}${voiceBlock}
${projectContextBlock}${paperContextBlock}${facultyContextBlock}${personalizationBlock}${citationContractBlock}
FASE 3: REDACCIÓN DEL SERMÓN
Objetivo: Redactar el contenido completo del sermón basado en el análisis previo.
${exegesisContext}

Datos del Análisis Homilético:
- Proposición Homilética: ${analysis.homileticalProposition}
- Enfoque: ${analysis.homileticalApproach || 'No especificado'}
${buildOutlineBlock(analysis.outline)}
${buildPastorDirectiveContract(analysis.outline)}

═══════════════════════════════════════════════════════════════════
🎯 INSTRUCCIONES CRÍTICAS DE FORMATO PARA PREDICACIÓN
═══════════════════════════════════════════════════════════════════

**OBJETIVO PRINCIPAL**: El borrador DEBE ser FÁCIL DE SEGUIR AL PREDICAR.
Usa formato MARKDOWN con JERARQUIZACIÓN VISUAL CLARA en todos los campos de texto.

📋 REGLAS DE FORMATO OBLIGATORIAS:

1. **JERARQUIZACIÓN CON ENCABEZADOS**:
   - Usa ### SOLO para las secciones de la INTRODUCCIÓN (el orden de abajo).
   - El "content" de cada punto y la conclusión van SIN encabezados internos:
     son prosa corrida en párrafos cortos. El sistema ya rotula cada bloque
     (versículo, palabras clave, referencias, cita, ilustración, implicaciones,
     transición) — un encabezado tuyo dentro del texto duplicaría el rótulo.
   - Cada encabezado en su propia línea, con espacio antes y después.

2. **SEPARACIÓN VISUAL — ESTE TEXTO SE LEE DE PIE, EN VOZ ALTA**:
   No se lee en una pantalla ni en un sillón: se lee desde el púlpito, mirando
   a la gente y volviendo a la hoja. El predicador levanta la vista y tiene que
   REENCONTRAR el punto exacto donde iba. En un párrafo largo eso es imposible:
   pierde el renglón, repite una frase o se salta media idea delante de todos.
   Por eso el formato no es estética, es legibilidad bajo presión:
   - **PÁRRAFOS CORTOS: máximo 3 oraciones, idealmente 2.** Un párrafo de seis
     líneas es una trampa. Si una idea necesita más, pártela en dos párrafos.
   - **UNA IDEA POR PÁRRAFO.** El regreso de la mirada tiene que caer en un
     bloque que se entienda solo.
   - **ANCLA AL INICIO DE CADA PÁRRAFO**: empieza con 2-4 palabras en negrita
     que digan de qué trata ese bloque. Es el asidero visual para reencontrar
     el lugar de un vistazo.
   - **ORACIONES CORTAS.** Evita las cadenas de subordinadas: una oración con
     tres comas y dos "que" no se puede decir de memoria ni retomar a la mitad.
   - SEPARA PÁRRAFOS con líneas en blanco (doble salto de línea)
   - NUNCA escribas párrafos continuos sin separación
   - Usa líneas horizontales (---) para separar secciones mayores

3. **ÉNFASIS Y DESTACADOS**:
   - Usa **negritas** para conceptos clave, términos teológicos y puntos principales
   - Usa *cursivas* para palabras en hebreo/griego y énfasis secundario
   - Usa > para bloques de citas bíblicas o citas de autoridad

4. **LISTAS Y ENUMERACIONES — LA VIÑETA TIENE QUE SIGNIFICAR ALGO**:
   La viñeta le da forma visual a la lectura en voz alta: el ojo la reencuentra
   más rápido que un renglón de prosa. Pero si TODO se vuelve lista se pierde el
   contraste y vuelve el problema de origen — nada destaca porque todo se lee
   igual.
   - **VA EN VIÑETAS lo que es una ENUMERACIÓN**: dos o más elementos paralelos.
     Razones, contrastes, pasos, palabras clave, implicaciones.
   - **VA EN PÁRRAFO la exposición continua**, que es prosa y se lee como prosa,
     con su ancla en negrita al inicio.
   - **Máximo UNA lista por punto del sermón.** Si te salen dos, una de las dos
     no era una lista: reescríbela como párrafo.
   - Cada ítem en su propia línea y de UNA sola línea: un ítem de cuatro
     renglones es un párrafo disfrazado y se pierde igual al levantar la vista.
   - Usa numeradas (1., 2.) sólo cuando el ORDEN importe — pasos o secuencia.

5. **ESTRUCTURA DEL CONTENIDO DE CADA PUNTO**:
   El campo "content" tiene DOS partes, en este orden y sin encabezados:

   [PRIMER PÁRRAFO — LA PROPOSICIÓN DEL PUNTO: UNA frase que resume lo que
   este punto afirma del pasaje. Es al punto lo que la proposición homilética
   es al sermón: los conceptos que contenga son los que después desarrollas.]

   [Después: la EXPOSICIÓN — UN MOVIMIENTO POR CADA CONCEPTO que la
   proposición nombra, en el orden en que ella los nombra, CADA UNO COMO SU
   PROPIA VIÑETA (guion al inicio de línea). La viñeta no es decoración:
   separa los conceptos para que el predicador vea de un vistazo en cuántas
   partes se abre su proposición. Ancla cada movimiento en las palabras del
   texto. NO transcribas el pasaje completo al abrir: el sermón ya lo muestra
   antes de esta sección, con la Biblia real. Cita FRAGMENTOS cuando estés
   comentando esas palabras.]

   IMPORTANTE: Las siguientes secciones NO van en "content", sino en campos JSON separados:
   - Palabras Clave → campo "keyWords" (array)
   - Referencias Cruzadas → campo "scriptureReferences" (array)
   - Cita de Autoridad → campo "authorityQuote" (string)  
   - Ilustración → campo "illustration" (string)
   - Implicaciones → campo "implications" (array)
   - Transición → campo "transition" (string)

═══════════════════════════════════════════════════════════════════

Instrucciones de Contenido:
  1. **INTRODUCCIÓN**:
     - Orden de las secciones: ${introSections(analysis, rules, H)}
     - Separa párrafos visualmente
     - Usa negritas para conceptos clave
     - Explica el trasfondo del pasaje (quién, cuándo, dónde, por qué)
     - Conecta la situación de la audiencia original con el presente
     - INCLUYE al final la Proposición Homilética seguida de la lista de puntos del sermón como referencia
${openingIllustrationRule(rules)}${bookOrientationRule(analysis)}
     
  2. **DESARROLLO DE CADA PUNTO** del bosquejo:
     En el campo "content", DOS partes sin encabezados:

     [Primer párrafo: LA PROPOSICIÓN DEL PUNTO — una frase que resume lo que
     este punto afirma del pasaje.]

     [Después: la exposición que la desarrolla — un movimiento por concepto de
     la proposición, CADA UNO COMO VIÑETA (guion al inicio de línea), anclado
     en las palabras del texto. Concisa: 150 a 300 palabras en total.]

     En el campo "keyWords" (array, puede ser vacío): las palabras clave DEL
     ESTUDIO DEL PASTOR (listadas en el contexto exegético) que pertenezcan a
     ESTE punto — la palabra aparece o pesa en los versículos que este punto
     expone. NO agregues palabras que el estudio no trae; NO repitas la misma
     palabra en dos puntos. Para cada una, DOS COSAS y en este orden:
     1. su **RANGO SEMÁNTICO**: los sentidos que la palabra puede tener, no uno
        solo. Si el estudio del pastor trae el rango, úsalo TAL CUAL; no lo
        sustituyas por tu propia glosa.
     2. **QUÉ SENTIDO LE DIO EL AUTOR AQUÍ**, y por qué se sabe: qué quiso
        expresar en ESTE versículo, dentro de ESE rango. Es la pregunta que
        justifica traer la palabra al púlpito; sin ella el dato es trivia.
     PROHIBIDO presentar el comentario del pastor como si fuera el significado
     de la palabra. Lo que él descubrió es SUYO y va como su lectura del texto,
     no como glosa léxica — atribuirle al diccionario lo que dijo él es una
     asociación forzada, y el pastor la nota.
     Formato de cada entrada del array: "*original* (transliteración) —
     **rango**: sentido A / sentido B. **Aquí**: [qué sentido usa el autor y
     por qué]"

     Luego, en campos separados:
     - **scriptureReferences** (array): de 2 a 3 referencias que CRUCEN a OTROS
       LIBROS de la Biblia. **SOLO LA REFERENCIA, SIN el texto del versículo**:
       el sistema lo muestra desde la Biblia real — si lo escribes tú, lo
       escribes de memoria y un versículo mal citado en el púlpito es peor que
       ninguno.
       **PROHIBIDO usar el pasaje que se está predicando.** Volver a citar el
       texto expuesto no es una referencia cruzada: es repetir el texto, y no
       argumenta nada. Tampoco cuenta otro capítulo del MISMO libro.
       Su trabajo es MOSTRAR QUE LA AFIRMACIÓN DEL PUNTO ES CONSISTENTE CON EL
       RESTO DE LA ESCRITURA: cada una debe sostener exegéticamente lo que el
       punto afirma, no ilustrarlo ni adornarlo.
       Formato de cada entrada: "Libro Capítulo:Versículos" y nada más.
       Ejemplo: "Juan 1:1"
     
     - **authorityQuote** (string): la cita en blockquote con su atribución. NO
       escribas "Cita de Autoridad:" adelante — la tarjeta ya rotula el campo, y
       pedir una etiqueta que la UI después borra deja marcadores de negrita
       huérfanos en pantalla.
       Formato: "> \\"[Cita]\\"\\n> — *[Autor], [Fuente]*"
     
     - **illustration** (string): la ilustración, empezando por su TÍTULO en
       negritas y solo — sin la palabra "Ilustración:" delante, por la misma
       razón.
       Formato: "**[Título]**\\n\\n[Desarrollo]"
     
     - **implications** (array): UNA ENTRADA POR CADA APLICACIÓN APROBADA que el
       punto trae en el bosquejo. El pastor separa sus aplicaciones con líneas en
       blanco y llegan ya numeradas: si trae dos, van DOS implicaciones, una por
       cada una, en su orden. No las fusiones en un párrafo ni agregues de más.
       Cada una DESARROLLA la suya; no la reemplaces por otra tuya. SIN
       prefijos y SIN anclas en negrita: nada de "**Implicación:**" ni de abrir
       con la aplicación en negritas — la tarjeta ya rotula el bloque y la
       lista ya separa. Texto corrido simple en cada entrada. Si
       el punto no trae aplicación aprobada, deriva UNA del propio punto — pero
       NUNCA inventes una que el punto no sostenga.
     
     - **transition** (string): SÓLO la frase de transición al punto siguiente —
       el puente retórico, una o dos oraciones. Nada más.
       NO escribas la proposición ni la lista de puntos: el sistema las agrega
       después, copiadas palabra por palabra del bosquejo que el pastor aprobó.
       Tampoco escribas rótulos ("Transición:", "Recordatorio:"): la tarjeta ya
       rotula el bloque.
     
  3. **CONCLUSIÓN — PUNTOS PRECISOS, NO PROSA**: 
     - Una frase que reafirme la proposición, y luego UNA VIÑETA POR CADA
       verdad que se predicó (guion al inicio de línea): el cierre de esa
       idea en una o dos frases. Termina con UNA frase de cierre del arco.
     - SIN encabezados internos y sin párrafos largos: el manuscrito cierra
       la idea; el tono y el calor los pone el predicador en vivo.
     - Concisa: 80 a 150 palabras.
  
  4. **LLAMADO A LA ACCIÓN**: 
     - 1 a 3 acciones concretas, en párrafos o lista corta — sin plantillas
       tipo "Pasos de Acción".
  
  5. **TONO**: ${rules.tone || 'Inspirador'}
  
  6. **AUDIENCIA**: ${rules.targetAudience || 'General'}

  7. ${manuscriptStyleFor(rules.manuscriptStyle)}

  Reglas Personalizadas del Usuario:
  ${rules.customInstructions || 'Ninguna'}

  Formato de Salida (JSON):
  {
    "title": "Título Creativo",
    "introduction": "### ${H.historicalContext} — usa el ORDEN DE SECCIONES indicado arriba\\n\\n[Párrafo 1]\\n\\n[Párrafo 2]\\n\\n### ${H.currentConnection}\\n\\n[Conexión con audiencia]\\n\\n### ${H.sermonProposition}\\n\\n[Proposición VERBATIM]\\n\\n**Puntos:**\\n- [Título del punto 1, VERBATIM — CADA punto es una VIÑETA con guion, en su propia línea. Si el título ya trae número o romano, NO le antepongas otro.]\\n- [Título del punto 2, VERBATIM]",
    "body": [
      { 
        "point": "Título del Punto 1", 
        "content": "[La proposición del punto: una frase.]\\n\\n- [Movimiento 1: desarrolla el primer concepto de la proposición.]\\n- [Movimiento 2: el segundo.]", 
        "keyWords": [
          "*original* (transliteración) — **rango**: sentido A / sentido B. **Aquí**: [uso en este pasaje]"
        ],
        "scriptureReferences": ["Juan 3:16", "Romanos 8:28"],
        "authorityQuote": null,
        "illustration": "**[Título]**\\n\\n[Desarrollo de la ilustración]",
        "implications": [
          "[Desarrollo de la primera aplicación aprobada, sin prefijo]", 
          "[Desarrollo de la segunda, sin prefijo]"
        ],
        "transition": "[Sólo la frase de transición al siguiente punto]"
      }
    ],
  "conclusion": "[Frase que reafirma la proposición.]\\n\\n- [Cierre de la primera verdad predicada.]\\n- [Cierre de la segunda.]\\n\\n[UNA frase final que cierra el arco.]",
  "callToAction": "[1 a 3 acciones concretas, en párrafos o lista corta con guiones. Sin plantillas.]",
  "ragSources": [
    {
      "sourceId": "S1",
      "title": "Nombre del documento usado",
      "author": "Autor si está disponible",
      "page": "Página o sección",
      "usedFor": "Breve descripción de cómo se usó este documento"
    }
  ]
}

═══════════════════════════════════════════════════════════════════
⚠️ RECORDATORIOS FINALES DE FORMATO:
═══════════════════════════════════════════════════════════════════
✓ SIEMPRE separa párrafos con líneas en blanco (\\n\\n)
✓ SIEMPRE usa encabezados (###, ####) para subsecciones
✓ SIEMPRE usa **negritas** para conceptos clave
✓ SIEMPRE usa listas (-, 1.) para enumeraciones
✓ SIEMPRE usa > para citas y referencias bíblicas
✓ NUNCA escribas bloques de texto continuo sin jerarquización
✓ RECUERDA: El pastor debe poder seguir el borrador FÁCILMENTE al predicar

REGLAS DE GENERACIÓN:
1. Si usas información de documentos proporcionados, incluye en "ragSources" una entrada por cada documento consultado — con el campo \`sourceId\` igual al ID del CONTRATO DE CITACIÓN (\`S1\`, \`S2\`, …) cuando el contrato esté presente. Si no hay contrato (sermón sin biblioteca), omite \`sourceId\`.
2. **APLICACIÓN — el orden es TEXTO → PUNTO → APLICACIÓN.** Cada punto del bosquejo trae su \`application\`: la que el pastor YA APROBÓ para ese punto. UNA por punto. Desarróllala; no la reemplaces por otra tuya.
   ⚠️ PERO NO ESCRIBAS EL PUNTO "HACIA" SU APLICACIÓN. La explicación sigue el TEXTO —su gramática, su movimiento, su argumento—; la aplicación es donde ese punto ATERRIZA, no la meta a la que la exposición se dirige. Organizar la exposición en función de la aplicación es moralismo con pasos previos, y es exactamente lo que el descalificador global G3 nombra: el predicador impuso su idea y usó el texto de excusa.
   El componente OBLIGATORIO de cada punto es la EXPLICACIÓN EXEGÉTICA del propio pasaje. Sin ella es paráfrasis; con ella es exposición.
3. **Ilustraciones**: sigue la GUÍA DE ILUSTRACIONES incluida más abajo. No es una preferencia de estilo: describe la forma que este pastor usa, medida sobre sus sermones reales.
4. **Diversidad de ilustraciones**: NO uses la misma categoría (viaje/deporte/familia/cocina/transporte) en dos puntos consecutivos. Si Punto I usa transporte (avión, tren), Punto II DEBE usar otra categoría.
5. **authorityQuote es OPCIONAL** (null por defecto). Solo inclúyelo cuando uses una cita REAL y verificable de un autor cuyo texto esté presente en los documentos proporcionados o en la conversación. PROHIBIDO inventar citas atribuidas a Owen, Spurgeon, Calvino, Van Til, Edwards, MacArthur u otros autores. Si no hay una cita verificable disponible, deja authorityQuote en null. Una cita inventada en el pulpito destruye credibilidad.
6. **callToAction es OBLIGATORIO y no puede ser vacío**. Debe contener 1-3 acciones concretas y específicas (no genéricas) que el oyente pueda comenzar esta semana. Sin callToAction, el sermón no se considera completo.
7. **Balance de longitud OBLIGATORIO — el manuscrito es CONCISO**: introduction 150-300 palabras, cada punto del body 150-300 palabras en "content" (proposición + exposición), conclusion 100-200 palabras. La conclusion NUNCA puede ser menor a un cuarto de la introduction. Si un punto pide más, es señal de que estás adornando: corta.
8. TODO el texto usa markdown (negritas, cursivas, párrafos separados); los encabezados ### SOLO en la introducción.
9. **LENTE TEOLÓGICA — FCF Y CRISTOCENTRISMO (OBLIGATORIO)**:
   Todo sermón expositivo cristiano debe predicar a Cristo desde el texto, no usar el texto como pretexto para moralismo. Sigue el marco de Bryan Chapell (Christ-Centered Preaching):

   a. **FCF (Fallen Condition Focus)** — En la introducción Y al menos en el primer punto del cuerpo, identifica EXPLÍCITAMENTE la "condición caída" que el pasaje aborda: ¿qué quebrantamiento, necesidad, o incapacidad humana hace que necesitemos lo que este texto enseña? El FCF NO es "lo que el texto manda hacer" sino "por qué necesitamos esta enseñanza dada nuestra condición caída".
       Ejemplo: en Mateo 5:1-12, el FCF no es "imitar las Bienaventuranzas" sino "somos espiritualmente pobres, hambrientos, y perseguidos — incapaces por nosotros mismos de la rectitud que Cristo declara bendita."

   b. **Cristocentrismo** — La conclusión (o un punto del cuerpo cuando el texto lo demande) DEBE trazar cómo el pasaje encuentra resolución en la obra redentora de Cristo (encarnación, vida obediente, cruz, resurrección, ascensión, intercesión, o segunda venida). NO basta con "y por eso Jesús nos ayuda" — muestra cómo el evangelio cumple, completa, o restaura lo que el FCF expuso como roto.
       Pasajes del AT: traza la conexión via tipología, promesa-cumplimiento, o trayectoria redentora. Pasajes del NT: ancla la enseñanza en la persona y obra consumada de Cristo, no solo en mandamientos.

   PROHIBIDO: sermón puramente moralista ("haz X, evita Y") sin FCF explícito y sin centralidad cristológica. Eso convierte el púlpito en consejería moral, no en proclamación del evangelio.

10. **LENGUAJE DEL SERMÓN**: ${audienceRigorBlock(rules.audienceRigor)}

---

${illustrationGuidelinesMD}
`;
}

/**
 * El REGISTRO del sermón, no el rigor del estudio.
 *
 * El encabezado decía "NIVEL DE RIGOR SEGÚN AUDIENCIA" y el cuerpo describía al
 * PREDICADOR ("Predicador con formación seminarista"). Dos ejes distintos en la
 * misma regla: al modelo se le anunciaba que decidiera por quien escucha y se le
 * daba la ficha de quien habla.
 *
 * Y "rigor" era la palabra equivocada: el rigor exegético ya ocurrió río arriba,
 * en el estudio, y este bloque no lo toca. Lo único que modula es cuánto
 * vocabulario técnico aflora en el púlpito. Un sermón para una congregación
 * general es igual de riguroso; sólo no dice "participio circunstancial" en voz
 * alta.
 *
 * Los identificadores (`beginner` / `seminary`) se conservan: están persistidos
 * en `wizardProgress.audienceRigor` de los sermones ya guardados.
 */
function audienceRigorBlock(tier?: 'beginner' | 'seminary'): string {
  if (tier === 'seminary') {
    return `Registro TÉCNICO — congregación con formación teológica.
   - Profundiza en morfología y sintaxis del griego/hebreo cuando el texto lo amerite (aoristos, participios circunstanciales, géneros de la literatura, paralelismo hebreo, quiasmos).
   - Cita autores reformados / evangélicos consolidados cuando aporten (Calvino, Owen, Edwards, Spurgeon, Berkhof, Frame, Carson, Beale, Schreiner, Vanhoozer, Keller) — solo si están en las fuentes proporcionadas o son citas verificables; NUNCA inventes.
   - Asume conocimiento de categorías sistemáticas (justificación forense, unión con Cristo, pacto de gracia/obras, eclesiología reformada).
   - Permite densidad técnica mayor: notas exegéticas extensas, distinciones precisas, advertencias contra herejías históricas cuando relevante.`;
  }
  return `Registro COTIDIANO — congregación general (default).
   - Mantén el lenguaje accesible. Cuando uses un término técnico (justificación, propiciación, pacto), defínelo en una línea.
   - Limita las menciones de griego/hebreo a 1-2 palabras clave por punto, con transliteración + significado simple. Evita morfología densa.
   - Prefiere ilustraciones cotidianas (familia, trabajo, comunidad) sobre referencias académicas.
   - No asumas conocimiento previo de categorías sistemáticas reformadas; explica brevemente cuando uses una.
   - Las citas de autoridad son opcionales y deben venir solo de las fuentes proporcionadas.`;
}

/**
 * El prompt para REGENERAR UN PUNTO SUELTO.
 *
 * POR QUÉ SE MUDÓ ACÁ: vivía embebido en `GeminiSermonGenerator` y había
 * divergido del prompt del borrador completo. El punto regenerado salía sin la
 * voz del predicador, sin el nivel de rigor, sin el bosquejo y sin las
 * directivas del pastor — o sea, desentonando con los demás puntos del mismo
 * sermón. Es la misma clase de deriva que ya nos costó dos veces: dos caminos
 * para lo mismo, y sólo uno se mantiene al día.
 *
 * DOS DIVERGENCIAS QUE ERAN DAÑINAS, no sólo inconsistentes:
 *
 * 1. Pedía "una cita de autoridad" como si fuera obligatoria. El prompt del
 *    borrador la declara OPCIONAL y PROHÍBE inventarla, porque una cita falsa
 *    atribuida a Owen o a Calvino destruye credibilidad en el púlpito. Exigirla
 *    es exactamente cómo se fabrica una.
 *
 * 2. Pedía "al menos 2 implicaciones prácticas". La regla vigente es UNA
 *    aplicación por punto, la que el pastor YA APROBÓ, desarrollada — no dos
 *    inventadas de nuevo.
 */
export function buildRegeneratePointPrompt(
  point: any,
  rules: GenerationRules,
  context: any,
  language: SupportedLanguage = DEFAULT_LANGUAGE,
): string {
  return withLanguage(language, buildRegeneratePointPromptBody(point, rules, context));
}

function buildRegeneratePointPromptBody(point: any, rules: GenerationRules, context: any): string {
  const personalizationBlock = formatSermonPersonalizationBlock(rules.personalization);

  // La directiva del pastor sobre ESTE punto. Se busca por título porque el
  // índice del cuerpo del borrador y el del bosquejo pueden no coincidir si el
  // pastor reordenó puntos después de generar.
  const titulo = String(point?.point ?? point?.title ?? '');
  const puntos: NonNullable<HomileticalAnalysis['outline']>['mainPoints'] =
    context?.homileticsResult?.outline?.mainPoints ?? [];
  const delBosquejo = puntos.find((p) => (p.title ?? '').trim() === titulo.trim());

  const emphasis = delBosquejo?.pastorDirective?.emphasis?.trim();
  const notas = (delBosquejo?.pastorDirective?.exegeticalNotes ?? []).filter((n: string) => n?.trim());
  const aplicacion = delBosquejo?.application?.trim();

  const directivaBlock =
    emphasis || notas.length > 0
      ? `
⚑ DIRECTIVAS DEL PASTOR PARA ESTE PUNTO — MÁXIMA PRECEDENCIA
${emphasis ? `\n**ÉNFASIS (modula toda la exposición del punto)**: ${emphasis}` : ''}
${notas.length > 0 ? `\n**DEBE APARECER (obliga)**:\n${notas.map((n: string, i: number) => `${i + 1}. ${n.trim()}`).join('\n')}` : ''}

Estas líneas las escribió el pastor, no el sistema. Tienen precedencia sobre tus
propias decisiones de contenido. LÍMITE: dirigen cómo se EXPONE el texto; no
autorizan a afirmar lo que el texto no dice ni a inventar datos que las apoyen.
`
      : '';

  return `
${personalizationBlock}${buildChatSystemPromptBody(WorkflowPhase.DRAFTING, context)}

TAREA: REGENERAR UN PUNTO ESPECÍFICO DEL SERMÓN

El resto del sermón YA está escrito. Este punto tiene que sonar como los demás:
mismo tono, mismo nivel de rigor, misma voz. Un punto regenerado que desentona
es peor que el que estabas reemplazando.

Contexto del Sermón:
- Título: ${context.sermonTitle || 'Sin título'}
- Proposición Homilética: ${context.homileticalProposition || 'No especificada'}

Punto a Regenerar:
- Título: ${titulo || 'Sin título'}
- Referencias Base: ${point.scriptureReferences ? point.scriptureReferences.join(', ') : 'Ninguna'}
${directivaBlock}
INSTRUCCIONES:
1. **content**: DOS partes sin encabezados — primer párrafo, la proposición
   del punto (una frase que resume lo que este punto afirma); después, la
   exposición que la desarrolla en párrafos cortos (150-300 palabras en
   total), con **negritas** en los conceptos clave y palabras originales en
   *cursiva*.
2. **scriptureReferences**: referencias cruzadas relevantes de OTROS libros.
   SOLO la referencia ("Juan 1:1"), SIN el texto del versículo: el sistema lo
   muestra desde la Biblia real.
3. **illustration**: sigue la GUÍA DE ILUSTRACIONES de más abajo.
4. **implications**: UNA sola, que DESARROLLA la aplicación ya aprobada para
   este punto${aplicacion ? `: "${aplicacion}"` : ''}. El orden es TEXTO → PUNTO →
   APLICACIÓN: la aplicación se DERIVA del punto, no dirige la exposición.
   ${aplicacion ? 'Desarróllala; no la reemplaces por otra tuya.' : 'Deriva una del propio punto — nunca una que el punto no sostenga.'}
5. **authorityQuote**: OPCIONAL, null por defecto. Sólo si usas una cita REAL y
   verificable de un autor presente en las fuentes proporcionadas. PROHIBIDO
   inventar citas atribuidas a Owen, Spurgeon, Calvino, Edwards, MacArthur u
   otros. Si no hay una verificable, deja null. Una cita inventada en el púlpito
   destruye credibilidad.
6. **transition**: transición natural al siguiente punto.

LENGUAJE DEL SERMÓN: ${audienceRigorBlock(rules.audienceRigor)}

Reglas Personalizadas:
${rules.customInstructions || 'Ninguna'}
Tono: ${rules.tone || 'Inspirador'}

FORMATO JSON REQUERIDO:
{
  "point": "${titulo}",
  "content": "[La proposición del punto: una frase.]\\n\\n- [Movimiento por concepto, como viñeta.]",
  "scriptureReferences": ["Juan 1:1"],
  "illustration": "**[Título]**\\n\\n[Desarrollo]",
  "implications": ["[Desarrollo de la aplicación aprobada — texto simple, sin prefijos ni negritas]"],
  "authorityQuote": null,
  "transition": "[Frase de transición]"
}

---

${illustrationGuidelinesMD}
`;
}

export function buildChatSystemPrompt(phase: WorkflowPhase, context: any, language?: SupportedLanguage): string {
  return withLanguage(language, buildChatSystemPromptBody(phase, context));
}

function buildChatSystemPromptBody(phase: WorkflowPhase, context: any): string {
  const base = "Actúa como un experto teólogo y mentor. Tu objetivo es colaborar con el pastor en una mesa de trabajo.";

  // RAG Context Generation (Reusable for all phases)
  // Check if we have library context either via Cache, RAG chunks, or File Search Store
  const hasCacheContext = !!context.cacheName;
  const hasRAGContext = context.hasLibraryContext && context.relevantChunks?.length > 0;
  // 🎯 NEW: Check for Global File Search Store
  const hasFileSearchContext = !!context.fileSearchStoreId;

  let libraryContextSection = '';

  if (hasCacheContext) {
    // Using Gemini Cache - full book access
    const resourcesList = context.resources
      ?.filter((r: any) => r.metadata?.geminiUri)
      ?.map((r: any) => `- ${r.title} (${r.author})`)
      ?.join('\n') || '';

    libraryContextSection = `
## 📚 ACCESO COMPLETO A BIBLIOTECA DEL PASTOR (VÍA CACHÉ):
Tienes acceso al CONTENIDO COMPLETO (no solo fragmentos) de estos libros:

${resourcesList}

INSTRUCCIONES CRÍTICAS:
1. Estos libros están COMPLETAMENTE disponibles en tu contexto. Puedes consultar cualquier parte de ellos.
2. SIEMPRE que uses información de estos libros, DEBES citar la fuente.
3. Formato de cita: (Autor, Título) o "Como señala [Autor] en '[Título]'..."
4. Este es contenido REAL y COMPLETO. Úsalo con prioridad sobre tu conocimiento general.
5. No digas "no tengo acceso" a estos libros. Los tienes completos.`;

  } else if (hasFileSearchContext) {
    // 🎯 NEW: Using File Search Tool (Global Store)
    libraryContextSection = `
## 📚 ACCESO A BIBLIOTECA DEL PASTOR (VÍA FILE SEARCH):
Tienes acceso a la biblioteca EXEGÉTICA/HOMILÉTICA completa del pastor a través de la herramienta 'fileSearch'.

INSTRUCCIONES CRÍTICAS PARA USO DE HERRAMIENTA:
1. **USO OBLIGATORIO**: Para cada consulta teológica o bíblica, DEBES usar la herramienta 'fileSearch' provista por el sistema (tool calling/enrutamiento interno) para buscar en la biblioteca del pastor.
2. **NUNCA ESCRIBAS CÓDIGO PYTHON**: No escribas bloques de código intentando llamar a la herramienta (Ej. nada de \`print(file_search.query(...))\`). Usa el mecanismo de tools nativo de la API.
3. **PRIORIDAD**: La información recuperada de la biblioteca tiene PRIORIDAD ABSOLUTA sobre tu conocimiento general.
4. **CITAS**: Al usar información recuperada, cita la fuente (Libro/Autor) que la herramienta te indique.
5. **MANEJO DE RESULTADOS VACÍOS**: Si la herramienta 'fileSearch' no devuelve resultados relevantes, usa tu conocimiento general para responder como un teólogo experto.
`;

  } else if (hasRAGContext) {
    // Using Manual RAG - fragment access (Fallback)
    const chunksContext = context.relevantChunks.slice(0, 10).map((chunk: any, i: number) => {
      const pageInfo = chunk.metadata?.page ? `, p.${chunk.metadata.page}` : '';
      return `[${i + 1}] ${chunk.resourceAuthor} - "${chunk.resourceTitle}"${pageInfo}:
"${chunk.text.substring(0, 500)}..."`;
    }).join('\n\n');

    libraryContextSection = `
## CONTENIDO VERIFICADO DE LA BIBLIOTECA DEL PASTOR (FRAGMENTOS):
He encontrado estos fragmentos relevantes de los recursos indexados:

${chunksContext}

INSTRUCCIONES CRÍTICAS DE CITACIÓN:
1. Usa este contenido VERIFICADO para fundamentar tus respuestas.
2. SIEMPRE que uses una idea de estos textos, DEBES citar la fuente.
3. Formato de cita: (Autor, p.XX) o "Como señala Autor en 'Título'..."
4. Esto es contenido REAL de los libros del pastor. Úsalo con prioridad sobre tu conocimiento general.`;
  } else {
    // No library context available - provide recommended evangelical sources
    libraryContextSection = `
## 📚 FUENTES TEOLÓGICAS RECOMENDADAS (Conocimiento General):
NO se encontró información en la biblioteca personal del pastor para esta consulta.

**Basa tu respuesta en fuentes evangélicas reconocidas**:
- Comentarios bíblicos estándar (Nuevo Comentario Bíblico Siglo XXI, Mundo Hispano)
- Léxicos y concordancias (Strong, Vine, Tuggy)
- Teología sistemática evangélica (Grudem, Berkhof)
- Consenso exegético histórico-gramatical

**INSTRUCCIONES DE TRANSPARENCIA**:
1. Declara explícitamente: "Basado en mi conocimiento general de fuentes evangélicas..."
2. Cuando cites, usa formato genérico: "Como señalan comentaristas evangélicos..." o "Según el consenso exegético..."
3. NO inventes citas específicas de páginas o autores si no estás absolutamente seguro
4. Mantén fidelidad al método histórico-gramatical-literal de Dos Filos`;
  }

  switch (phase) {
    case WorkflowPhase.EXEGESIS:
      // Build exegesis context summary if available
      let exegesisContext = '';
      if (context.exegesisResult) {
        const ex = context.exegesisResult;
        exegesisContext = `
        
## 📖 CONTEXTO EXEGÉTICO ACTUAL:

**Pasaje**: ${ex.passage || context.passage}

**Proposición Exegética**: ${ex.exegeticalProposition || 'Pendiente'}

**Palabras Clave Analizadas**:
${ex.keyWords && ex.keyWords.length > 0
            ? ex.keyWords.map((kw: any) => `- ${kw.original} (${kw.transliteration}): ${kw.significance}`).join('\n')
            : 'Ninguna analizada aún'}

**Contexto**:
- Histórico-cultural: ${ex.context?.historical || 'Pendiente'}
- Literario: ${ex.context?.literary || 'Pendiente'}
- Audiencia original: ${ex.context?.audience || 'Pendiente'}

**Insights Pastorales**:
${ex.pastoralInsights && ex.pastoralInsights.length > 0
            ? ex.pastoralInsights.map((i: string) => `- ${i}`).join('\n')
            : 'Ninguno aún'}
`;
      }

      return `${base} Eres el EXPERTO EN EXÉGESIS. Tu trabajo es analizar el texto original, contexto histórico y literario.
      
**PASAJE EN ANÁLISIS**: "${context.passage}"
${exegesisContext}
${libraryContextSection}

**TU ROL**: Responde a las preguntas del pastor con profundidad académica pero claridad pastoral. 
SIEMPRE ten en cuenta el CONTEXTO EXEGÉTICO ACTUAL arriba. Si el pastor pregunta sobre una palabra, 
verifica primero si ya está en las "Palabras Clave Analizadas" y construye sobre ese análisis.`;

    case WorkflowPhase.HOMILETICS:
      // Build readable homiletics context
      const exegesisSummary = context.exegesisResult
        ? `**Pasaje**: ${context.exegesisResult.passage}
**Proposición Exegética**: ${context.exegesisResult.exegeticalProposition}
**Palabras Clave**: ${context.exegesisResult.keyWords?.map((kw: any) => kw.original).join(', ') || 'N/A'}`
        : 'Exégesis no disponible';

      const homileticsInfo = context.homileticsResult
        ? `**Proposición Homilética Actual**: ${context.homileticsResult.homileticalProposition || 'Pendiente'}
**Enfoque**: ${context.homileticsResult.homileticalApproach || 'Pendiente'}
${buildOutlineBlock(context.homileticsResult.outline)}
${buildPastorDirectiveContract(context.homileticsResult.outline)}`
        : '';

      return `${base} Eres el EXPERTO EN HOMILÉTICA. Tu trabajo es ayudar a estructurar el sermón.
      
## 📖 FUNDAMENTO EXEGÉTICO:
${exegesisSummary}

## 🎯 DESARROLLO HOMILÉTICO ACTUAL:
${homileticsInfo || 'Pendiente de desarrollo'}

${libraryContextSection}

**TU ROL**: Ayuda a encontrar el mejor ángulo, la proposición homilética y el bosquejo. 
Mantén coherencia con la proposición exegética y el pasaje original.`;

    case WorkflowPhase.DRAFTING:
      // Build sermon context summary
      const sermonContext = context.homileticsResult
        ? `**Pasaje**: ${context.exegesisResult?.passage || 'N/A'}
**Proposición Homilética**: ${context.homileticsResult.homileticalProposition}
**Enfoque**: ${context.homileticsResult.homileticalApproach || 'No especificado'}
${buildOutlineBlock(context.homileticsResult.outline)}
${buildPastorDirectiveContract(context.homileticsResult.outline)}`
        : 'Análisis homilético no disponible';

      const draftInfo = context.draft
        ? `**Título**: ${context.draft.title}
**Estructura**: Introducción + ${context.draft.body?.length || 0} puntos + Conclusión`
        : '';

      return `${base} Eres el EDITOR Y REDACTOR. Tu trabajo es ayudar a escribir el sermón completo.
      
## 📖 BASE DEL SERMÓN:
${sermonContext}

## ✍️ BORRADOR ACTUAL:
${draftInfo || 'Pendiente de redacción'}

${libraryContextSection}

**TU ROL**: Ayuda a redactar, mejorar el estilo, buscar ilustraciones y afinar la retórica.
IMPORTANTE: Al redactar, integra las citas de la biblioteca de forma natural en el flujo del sermón.
Mantén coherencia con la proposición homilética y el enfoque elegido.`;

    case WorkflowPhase.PLANNING:
      // Use dynamic strategy from context, or default Socratic behavior
      const coachingInstructions = context.strategyPromptAdditions || `
## ESTILO DE COACHING: SOCRÁTICO (PREDETERMINADO)
Eres un mentor experto que guía al pastor a través de la reflexión profunda.
`;

      return `${base} Eres el EXPERTO EN PLANIFICACIÓN DE SERIES. Tu trabajo es ayudar al pastor a diseñar una serie de predicación coherente.
      
Contexto de la serie:
- Tipo: ${context.type === 'thematic' ? 'Serie Temática' : 'Serie Expositiva'}
- Tema/Libro: ${context.topicOrBook}
- Recursos de Biblioteca: ${context.resources?.map((r: any) => r.title).join(', ') || 'Ninguno'}
${libraryContextSection}
${coachingInstructions}

Sé conciso pero profundo. Cuando cites contenido de la biblioteca, hazlo con precisión.`;

    case 'brainstorming' as any:
      return `${base} Eres un MENTOR CREATIVO Y TEOLÓGICO. Tu trabajo es ayudar al pastor a "aterrizar" una idea para un sermón.
      
      ## 🎯 OBJETIVO DE ESTA SESIÓN:
      Ayudar al pastor a definir claramente:
      1. Un **Tema Central** o Idea Principal.
      2. Un **Pasaje Bíblico** base que respalde esa idea.
      
      ${libraryContextSection}
      
      ## TU ESTILO:
      - Sé breve y conversacional (como un colega tomando café).
      - Haz preguntas clarificadoras si la idea es vaga.
      - Sugiere pasajes bíblicos si el pastor tiene el tema pero no el texto.
      - Sugiere temas si el pastor tiene el texto pero no el enfoque.
      - Una vez que la idea y el pasaje estén claros, confirma con el pastor: "¿Te parece bien este pasaje y tema para generar el sermón?".
      
      TU META FINAL: Que el pastor tenga CLARO qué va a predicar (Idea + Pasaje).`;

    default:
      return base;
  }
}
