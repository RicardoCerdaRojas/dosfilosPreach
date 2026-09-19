import {
    type CourseBibliographyEntry,
    type ExtractRubricInput,
    type ExtractedRubric,
    type IPaperRubricExtractor,
    type PaperRubric,
    type SourceRequirement,
    type SourceType,
    type StructuralExpectation,
    SOURCE_TYPE_GROUPS,
} from '@dosfilos/domain';
import { withGeminiRetry } from './geminiRetry';
import { runLlmPromptWithUsage } from '../llm/callableLlm';

/**
 * Gemini implementation of `IPaperRubricExtractor`.
 *
 * Uses Pro 2.5 with `responseMimeType: 'application/json'` so the
 * model returns structured JSON we can parse. The prompt enumerates
 * the canonical SourceType vocabulary so the extractor maps the
 * rubric's natural-language type names ("comentario crítico técnico")
 * onto our catalog values ("commentary-critical").
 *
 * Design choices:
 *   - Pro 2.5 (not Flash) — extraction is one-shot and accuracy
 *     matters more than throughput. Pro's larger context window also
 *     comfortably absorbs even multi-page rubric documents.
 *   - Thinking on (default budget). Reading a rubric and mapping to
 *     a structured schema benefits from the reasoning bandwidth.
 *   - Single-shot extraction (no streaming). The setup UI shows a
 *     spinner; partial output is meaningless for structured data.
 *   - Confidence is computed deterministically from how many fields
 *     the model returned (vs. left null). Lower confidence → the
 *     UI nudges the student to double-check.
 *
 * Errors: throws on parse failure. The use case decides whether to
 * fall back to the system default rubric or surface the error.
 */
export class GeminiPaperRubricExtractor implements IPaperRubricExtractor {
    private modelName: string;

    constructor(modelName?: string) {
        this.modelName = modelName || 'gemini-2.5-pro';
    }

    async extract(input: ExtractRubricInput): Promise<ExtractedRubric> {
        const { systemInstruction, userMessage } = buildExtractionPrompt(input);

        console.log('[GeminiPaperRubricExtractor] extracting', {
            language: input.language,
            source: input.source,
            rawTextChars: input.rawText.length,
            hasInlineImage: !!input.inlineImage,
            imageMimeType: input.inlineImage?.mimeType,
        });

        // Image source: send the bytes inline alongside the text
        // instructions so Gemini Vision parses the rubric directly from
        // the picture. Skips the PDF-text-extraction roundtrip that
        // breaks for screenshots and clipboard pastes.
        //
        // Es el ÚNICO adapter multimodal de exégesis; el resto es texto→texto.
        // El proxy arma las `parts` del lado del servidor a partir de este
        // campo — acá ya no se construyen a mano.
        //
        // Pro 2.5 hits intermittent 503s ("model experiencing high demand")
        // during peak windows. Retry transparently with exponential
        // backoff before surfacing the failure to the user.
        const { text: rawJson, tokensUsed } = await withGeminiRetry(
            () => runLlmPromptWithUsage({
                feature: 'exegesis.extractRubric',
                model: this.modelName,
                system: systemInstruction,
                prompt: userMessage,
                responseMimeType: 'application/json',
                temperature: 0.2, // Low — extraction is deterministic, not creative.
                topP: 0.9,
                maxOutputTokens: 8192,
                ...(input.inlineImage
                    ? {
                        inlineImage: {
                            mimeType: input.inlineImage.mimeType,
                            base64: input.inlineImage.base64,
                        },
                    }
                    : {}),
            }),
            { contextLabel: 'GeminiPaperRubricExtractor' },
        );

        const parsed = parseExtractorJson(rawJson);
        const rubric = mapToDomain(parsed, input);
        const confidence = inferConfidence(parsed);
        const reviewNotes = collectReviewNotes(parsed, input.language);

        return {
            rubric,
            confidence,
            reviewNotes,
            tokensUsed,
            modelId: this.modelName,
        };
    }
}

// ── Prompt builder ──────────────────────────────────────────────────────

interface BuiltPrompt {
    systemInstruction: string;
    userMessage: string;
}

function buildExtractionPrompt(input: ExtractRubricInput): BuiltPrompt {
    const lang = input.language;
    const allTypes = SOURCE_TYPE_GROUPS.flatMap(g => g.types);
    const typeList = allTypes.join(', ');

    if (lang === 'en') {
        return {
            systemInstruction: [
                `You are a structured-data extractor for academic exegetical paper rubrics.`,
                ``,
                `Read a seminary's grading rubric (or assignment brief) and emit a JSON object matching the schema below. Map any source-type vocabulary to the canonical catalog. Return null for fields the rubric doesn't mention — do NOT invent values.`,
                ``,
                `Output JSON ONLY — no markdown fences, no commentary, no preamble.`,
            ].join('\n'),
            userMessage: buildUserMessageEN(input.rawText, typeList, input.source),
        };
    }

    return {
        systemInstruction: [
            `Sos un extractor de datos estructurados para rúbricas de trabajos exegéticos académicos.`,
            ``,
            `Leé la rúbrica de calificación del seminario (o brief de asignación) y devolvé un objeto JSON que cumpla el esquema más abajo. Mapeá el vocabulario de tipos de fuente al catálogo canónico. Devolvé null para los campos que la rúbrica no menciona — NO inventes valores.`,
            ``,
            `Devolvé SOLO JSON — sin fences markdown, sin comentarios, sin preámbulo.`,
        ].join('\n'),
        userMessage: buildUserMessageES(input.rawText, typeList, input.source),
    };
}

function buildUserMessageEN(rawText: string, typeList: string, source: 'document' | 'text' | 'image'): string {
    const header = source === 'image'
        ? `Extract the rubric from the attached image:`
        : `Extract the rubric from this document:`;
    const body = source === 'image' && !rawText.trim()
        ? '(Source is the attached image — read it directly.)'
        : ['```', rawText.trim(), '```'].join('\n');
    return [
        header,
        body,
        ``,
        `## Output schema`,
        `Return a single JSON object with these fields (use null where the rubric is silent):`,
        ``,
        `{`,
        `  "description": string | null,`,
        `  "citationStandard": string | null,                              // e.g. "TMS / Turabian", "SBL Handbook"`,
        `  "expectedLength": { "unit": "pages" | "words", "min": number | null, "max": number | null } | null,`,
        `  "sourceRequirements": [                                          // one entry per source type the rubric requires`,
        `    {`,
        `      "sourceType": <one of: ${typeList}>,`,
        `      "minimum": number,                                            // 0 means "optional / recommended only"`,
        `      "maximum": number | null,                                     // null = no upper bound`,
        `      "justification": string                                       // localized academic rationale`,
        `    }, ...`,
        `  ],`,
        `  "courseBibliography": [                                          // the WORKS the syllabus names, by title. Empty when it names none.`,
        `    {`,
        `      "title": string,                                              // as the syllabus writes it`,
        `      "author": string | null,`,
        `      "series": string | null,                                      // "IBHS", "WBC 19", when given`,
        `      "requirement": "required" | "recommended",`,
        `      "note": string | null                                         // what the syllabus says about it, if anything`,
        `    }, ...`,
        `  ],`,
        `  "structuralExpectations": [                                      // one entry per section the rubric addresses`,
        `    {`,
        `      "section": "introduction" | "verse" | "conclusion",`,
        `      "emphasizedTypes": [<source type>, ...],`,
        `      "justification": string`,
        `    }, ...`,
        `  ],`,
        `  "qualityCriteria": [                                              // one entry per qualitative grading criterion (e.g. "Estilo", "Coherencia"). EMPTY when the rubric is purely prescriptive.`,
        `    {`,
        `      "id": string,                                                 // stable id like "qc-style"`,
        `      "name": string,                                               // criterion label as in the rubric grid`,
        `      "description": string | null,                                 // one-line summary of what the criterion evaluates`,
        `      "maxPoints": number | null,                                   // total points the criterion can earn (null when no weights)`,
        `      "levels": [                                                   // 2-5 entries, ordered from BEST to WORST quality`,
        `        { "label": string, "description": string, "points": number | null }, ...`,
        `      ]`,
        `    }, ...`,
        `  ],`,
        `  "extractionNotes": string[]                                       // anything you were unsure about, in English`,
        `}`,
        ``,
        `## Quality criteria extraction`,
        `Many real-world seminary rubrics are levels-based grids — rows like "Style and format / Organization / Academic interaction / Coherence / Evidence", each with 4 quality levels (Exemplary / Competent / Acceptable / Deficient) and per-level descriptions plus point ranges (e.g. 15/13/11/7). Capture EVERY visible row of that grid into \`qualityCriteria\`, ONE entry per row. Each entry MUST keep the level descriptions verbatim — they are the exact text the professor uses to grade. Do not paraphrase. When the grid has point columns, populate \`maxPoints\` with the highest level's points and each level's \`points\` accordingly.`,
        ``,
        `## Mapping guide`,
        `- "critical commentary / technical commentary / WBC / NIGTC / Hermeneia / ICC" → commentary-critical`,
        `- "expository commentary / NICOT / NICNT / BECNT / Pillar / NIVAC / Tyndale" → commentary-expository`,
        `- "lexicon / BDAG / HALOT / LSJ" → lexicon-technical`,
        `- "theological dictionary / TDNT / NIDNTTE / EDNT" → theological-dictionary`,
        `- "grammar / syntax / Wallace / BDF / Robertson" → grammar-syntax`,
        `- "critical apparatus / textual variants / NA28 apparatus / BHS apparatus" → critical-apparatus`,
        `- "biblical text / Greek text / Hebrew text / NA28 / BHS / LXX edition" → biblical-text-edition`,
        `- "background / cultural / historical / deSilva / Keener / ABD" → historical-background`,
        `- "monograph / focused study" → theological-monograph`,
        `- "journal article / peer-reviewed / JBL / NTS / JETS" → journal-article`,
        `- "primary source / Josephus / Philo / Apostolic Fathers / OTP" → primary-source-ancient`,
        `- "model paper / sample paper / style template" → style-template-paper`,
        `- anything else that doesn't fit cleanly → other`,
        ``,
        `## Justifications`,
        `Each requirement and structural expectation MUST include a one- or two-sentence academic justification IN ENGLISH explaining WHY that requirement matters for serious exegesis. Phrase it as if teaching a student.`,
    ].join('\n');
}

function buildUserMessageES(rawText: string, typeList: string, source: 'document' | 'text' | 'image'): string {
    const header = source === 'image'
        ? `Extraé la rúbrica de la imagen adjunta:`
        : `Extraé la rúbrica de este documento:`;
    const body = source === 'image' && !rawText.trim()
        ? '(La fuente es la imagen adjunta — leéla directamente.)'
        : ['```', rawText.trim(), '```'].join('\n');
    return [
        header,
        body,
        ``,
        `## Esquema de salida`,
        `Devolvé un único objeto JSON con estos campos (usá null donde la rúbrica calle):`,
        ``,
        `{`,
        `  "description": string | null,`,
        `  "citationStandard": string | null,                              // ej. "TMS / Turabian", "SBL Handbook"`,
        `  "expectedLength": { "unit": "pages" | "words", "min": number | null, "max": number | null } | null,`,
        `  "sourceRequirements": [                                          // un entry por tipo de fuente que la rúbrica requiere`,
        `    {`,
        `      "sourceType": <uno de: ${typeList}>,`,
        `      "minimum": number,                                            // 0 = opcional / recomendado`,
        `      "maximum": number | null,                                     // null = sin límite superior`,
        `      "justification": string                                       // racional académico localizado`,
        `    }, ...`,
        `  ],`,
        `  "courseBibliography": [                                          // las OBRAS que el sílabo nombra, por su título. Vacío si no nombra ninguna.`,
        `    {`,
        `      "title": string,                                              // tal como lo escribe el sílabo`,
        `      "author": string | null,`,
        `      "series": string | null,                                      // "IBHS", "WBC 19", cuando lo da`,
        `      "requirement": "required" | "recommended",`,
        `      "note": string | null                                         // lo que el sílabo dice de ella, si dice algo`,
        `    }, ...`,
        `  ],`,
        `  "structuralExpectations": [                                      // un entry por sección que la rúbrica menciona`,
        `    {`,
        `      "section": "introduction" | "verse" | "conclusion",`,
        `      "emphasizedTypes": [<tipo de fuente>, ...],`,
        `      "justification": string`,
        `    }, ...`,
        `  ],`,
        `  "qualityCriteria": [                                              // un entry por criterio cualitativo de evaluación (ej. "Estilo", "Coherencia"). VACÍO cuando la rúbrica es puramente prescriptiva.`,
        `    {`,
        `      "id": string,                                                 // id estable tipo "qc-estilo"`,
        `      "name": string,                                               // etiqueta del criterio como aparece en la grilla`,
        `      "description": string | null,                                 // resumen de una línea de qué evalúa`,
        `      "maxPoints": number | null,                                   // puntos totales del criterio (null si no hay pesos)`,
        `      "levels": [                                                   // 2-5 entries, ordenados de MEJOR a PEOR calidad`,
        `        { "label": string, "description": string, "points": number | null }, ...`,
        `      ]`,
        `    }, ...`,
        `  ],`,
        `  "extractionNotes": string[]                                       // todo lo que no quedó claro, en español`,
        `}`,
        ``,
        `## Extracción de criterios cualitativos`,
        `Muchas rúbricas reales del seminario son grillas por niveles — filas como "Estilo y formato / Organización / Interacción académica / Coherencia / Evidencia", cada una con 4 niveles de calidad (Ejemplar / Competente / Aceptable / Deficiente), descripciones por nivel y rangos de puntos (ej. 15/13/11/7). Capturá CADA fila visible de esa grilla en \`qualityCriteria\`, UN entry por fila. Cada entry DEBE preservar las descripciones de nivel verbatim — son el texto exacto que el profesor usa para calificar. NO parafrasees. Cuando la grilla tenga columna de puntos, poné \`maxPoints\` con los puntos del nivel más alto y \`points\` por nivel correspondiente.`,
        ``,
        `## Guía de mapeo`,
        `- "comentario crítico / comentario técnico / WBC / NIGTC / Hermeneia / ICC" → commentary-critical`,
        `- "comentario expositivo / NICOT / NICNT / BECNT / Pillar / NIVAC / Tyndale" → commentary-expository`,
        `- "léxico / BDAG / HALOT / LSJ" → lexicon-technical`,
        `- "diccionario teológico / TDNT / NIDNTTE / EDNT" → theological-dictionary`,
        `- "gramática / sintaxis / Wallace / BDF / Robertson" → grammar-syntax`,
        `- "aparato crítico / variantes textuales / aparato de NA28 / aparato de BHS" → critical-apparatus`,
        `- "texto bíblico / texto griego / texto hebreo / NA28 / BHS / edición LXX" → biblical-text-edition`,
        `- "trasfondo / cultural / histórico / deSilva / Keener / ABD" → historical-background`,
        `- "monografía / estudio focalizado" → theological-monograph`,
        `- "artículo de revista / peer-reviewed / JBL / NTS / JETS" → journal-article`,
        `- "fuente primaria / Josefo / Filón / Padres apostólicos / Pseudoepígrafos" → primary-source-ancient`,
        `- "trabajo modelo / paper de muestra / plantilla de estilo" → style-template-paper`,
        `- cualquier otra cosa que no encaje → other`,
        ``,
        `## Justificaciones`,
        `Cada requisito y expectativa estructural DEBE incluir una justificación académica de una o dos oraciones EN ESPAÑOL explicando POR QUÉ ese requisito importa para una exégesis seria. Frasealo como enseñándole al alumno.`,
    ].join('\n');
}

// ── JSON parsing + mapping ─────────────────────────────────────────────

interface RawExtractionResult {
    description: string | null;
    citationStandard: string | null;
    expectedLength: { unit: 'pages' | 'words'; min: number | null; max: number | null } | null;
    sourceRequirements: Array<{
        sourceType: string;
        minimum: number;
        maximum: number | null;
        justification: string;
    }>;
    courseBibliography?: unknown;
    structuralExpectations: Array<{
        section: string;
        emphasizedTypes: string[];
        justification: string;
    }>;
    qualityCriteria: Array<{
        id?: string;
        name: string;
        description: string | null;
        maxPoints: number | null;
        levels: Array<{ label: string; description: string; points: number | null }>;
    }>;
    extractionNotes: string[];
}

function parseExtractorJson(rawJson: string): RawExtractionResult {
    // Pro sometimes wraps responses in ```json fences despite the
    // mime-type contract. Strip defensively.
    const cleaned = rawJson
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();

    let parsed: any;
    try {
        parsed = JSON.parse(cleaned);
    } catch (err) {
        throw new Error(`Rubric extractor produced invalid JSON: ${(err as Error).message}`);
    }

    return {
        description: typeof parsed.description === 'string' ? parsed.description : null,
        citationStandard: typeof parsed.citationStandard === 'string' ? parsed.citationStandard : null,
        expectedLength: parsed.expectedLength && typeof parsed.expectedLength === 'object'
            ? {
                unit: parsed.expectedLength.unit === 'words' ? 'words' : 'pages',
                min: typeof parsed.expectedLength.min === 'number' ? parsed.expectedLength.min : null,
                max: typeof parsed.expectedLength.max === 'number' ? parsed.expectedLength.max : null,
            }
            : null,
        sourceRequirements: Array.isArray(parsed.sourceRequirements) ? parsed.sourceRequirements : [],
        structuralExpectations: Array.isArray(parsed.structuralExpectations) ? parsed.structuralExpectations : [],
        qualityCriteria: Array.isArray(parsed.qualityCriteria) ? parsed.qualityCriteria : [],
        extractionNotes: Array.isArray(parsed.extractionNotes) ? parsed.extractionNotes.filter((n: any) => typeof n === 'string') : [],
    };
}

function mapToDomain(raw: RawExtractionResult, input: ExtractRubricInput): Omit<PaperRubric, 'createdAt' | 'updatedAt'> {
    const validTypes = new Set<SourceType>(SOURCE_TYPE_GROUPS.flatMap(g => g.types) as SourceType[]);
    const isValidType = (t: any): t is SourceType => typeof t === 'string' && validTypes.has(t as SourceType);

    const sourceRequirements: SourceRequirement[] = raw.sourceRequirements
        .filter(r => isValidType(r.sourceType))
        .map(r => ({
            sourceType: r.sourceType as SourceType,
            minimum: Math.max(0, Math.floor(r.minimum ?? 0)),
            maximum: r.maximum === null || r.maximum === undefined
                ? null
                : Math.max(Math.max(0, Math.floor(r.maximum)), Math.max(0, Math.floor(r.minimum ?? 0))),
            justification: typeof r.justification === 'string' ? r.justification : '',
        }));

    const structuralExpectations: StructuralExpectation[] = raw.structuralExpectations
        .filter(e => e.section === 'introduction' || e.section === 'verse' || e.section === 'conclusion')
        .map(e => ({
            section: e.section as 'introduction' | 'verse' | 'conclusion',
            emphasizedTypes: (Array.isArray(e.emphasizedTypes) ? e.emphasizedTypes : [])
                .filter(isValidType) as SourceType[],
            justification: typeof e.justification === 'string' ? e.justification : '',
        }));

    const qualityCriteria = (Array.isArray(raw.qualityCriteria) ? raw.qualityCriteria : [])
        .filter(c => c && typeof c.name === 'string' && c.name.trim() && Array.isArray(c.levels) && c.levels.length >= 2)
        .map((c, idx) => ({
            id: typeof c.id === 'string' && c.id.trim()
                ? c.id.trim()
                : `qc-${idx + 1}`,
            name: c.name.trim(),
            description: typeof c.description === 'string' && c.description.trim() ? c.description.trim() : undefined,
            maxPoints: typeof c.maxPoints === 'number' && Number.isFinite(c.maxPoints) ? c.maxPoints : undefined,
            levels: c.levels
                .filter(l => l && typeof l.label === 'string' && typeof l.description === 'string')
                .map(l => ({
                    label: l.label.trim(),
                    description: l.description.trim(),
                    points: typeof l.points === 'number' && Number.isFinite(l.points) ? l.points : undefined,
                }))
                .slice(0, 5),
        }))
        .filter(c => c.levels.length >= 2);

    return {
        provenance: input.source === 'text' ? 'extracted-from-text' : 'extracted-from-document',
        description: raw.description,
        expectedLength: raw.expectedLength,
        citationStandard: raw.citationStandard,
        sourceRequirements,
        courseBibliography: parseCourseBibliography(raw.courseBibliography),
        structuralExpectations,
        qualityCriteria,
        sourceCorpusId: input.sourceCorpusId,
        sourcePastedText: input.source === 'text' ? input.rawText : null,
        // Extraction creates a fresh origin; any prior template link
        // is irrelevant. Caller (ExtractRubricFromTextUseCase) relies
        // on this being null to clear the breadcrumb.
        sourceTemplateId: null,
    };
}

function inferConfidence(raw: RawExtractionResult): 'high' | 'medium' | 'low' {
    let score = 0;
    if (raw.description) score++;
    if (raw.citationStandard) score++;
    if (raw.expectedLength) score++;
    if (raw.sourceRequirements.length >= 3) score += 2;
    else if (raw.sourceRequirements.length >= 1) score += 1;
    if (raw.structuralExpectations.length === 3) score += 2;
    else if (raw.structuralExpectations.length >= 1) score += 1;
    // Qualitative rubric: 4+ criteria with their level descriptions
    // is a strong signal of a complete grid extraction (the typical
    // 4-row × 4-column seminary rubric). Counts toward 'high'
    // confidence even when the prescriptive side is sparse — purely
    // qualitative rubrics are legitimate and shouldn't be flagged
    // low.
    if (raw.qualityCriteria.length >= 4) score += 3;
    else if (raw.qualityCriteria.length >= 2) score += 2;
    else if (raw.qualityCriteria.length >= 1) score += 1;

    if (score >= 7) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
}

function collectReviewNotes(raw: RawExtractionResult, lang: 'es' | 'en'): string[] {
    const notes: string[] = [...raw.extractionNotes];
    if (raw.sourceRequirements.length === 0) {
        notes.push(lang === 'en'
            ? 'No source requirements were extracted. Verify the rubric document or add requirements manually.'
            : 'No se extrajeron requisitos de fuente. Verificá el documento de rúbrica o agregá requisitos manualmente.',
        );
    }
    if (raw.structuralExpectations.length === 0) {
        notes.push(lang === 'en'
            ? 'No structural expectations were extracted. The structural plan will fall back to no recommendations.'
            : 'No se extrajeron expectativas estructurales. El plan estructural quedará sin recomendaciones.',
        );
    }
    return notes;
}

/**
 * Las obras que el sílabo nombra.
 *
 * Se guarda lo que el modelo leyó, sin completar lo que falte: un sílabo
 * que dice «Waltke–O'Connor» y nada más deja el autor puesto y el resto
 * vacío. Inventar la editorial o el año aquí sería repetir el defecto que
 * la ficha bibliográfica vino a cerrar.
 *
 * Tope de 40 obras: un sílabo real lista entre tres y quince, y una lista
 * más larga es el modelo confundiendo la bibliografía del curso con las
 * obras citadas en el propio documento.
 */
function parseCourseBibliography(raw: unknown): CourseBibliographyEntry[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
        .map(e => {
            const title = typeof e.title === 'string' ? e.title.trim() : '';
            if (!title) return null;
            const author = typeof e.author === 'string' ? e.author.trim() : '';
            const series = typeof e.series === 'string' ? e.series.trim() : '';
            const note = typeof e.note === 'string' ? e.note.trim() : '';
            return {
                title,
                ...(author ? { author } : {}),
                ...(series ? { series } : {}),
                requirement: e.requirement === 'recommended' ? 'recommended' as const : 'required' as const,
                ...(note ? { note } : {}),
            };
        })
        .filter((e): e is CourseBibliographyEntry => e !== null)
        .slice(0, 40);
}
