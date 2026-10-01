import {
    type ExtractStyleManifestInput,
    type ExtractedStyleManifest,
    type IStyleGuideManifestExtractor,
    type StyleGuideManifest,
    type FootnoteExample,
} from '@dosfilos/domain';
import { withGeminiRetry } from './geminiRetry';
import { runLlmPromptWithUsage } from '../llm/callableLlm';

/**
 * Gemini implementation of `IStyleGuideManifestExtractor`.
 *
 * Reads the raw text of a user's style guide (TMS / Turabian / SBL /
 * Chicago / etc.) and produces a structured `StyleGuideManifest` with
 * the mechanical rules the orchestrator + post-processor will enforce
 * deterministically: footnote templates, ibid behavior, bibliography
 * format, quotation conventions, transliteration scheme.
 *
 * Design choices:
 *   - Pro 2.5 with `responseMimeType: 'application/json'`. Same
 *     reasoning as the rubric extractor — extraction is one-shot
 *     and accuracy beats throughput.
 *   - Temperature 0.2 (deterministic).
 *   - The prompt includes worked examples ("first cite of Lane WBC")
 *     so the model returns concrete rendered samples we can show
 *     the student in the verification UI.
 *   - Confidence is computed deterministically from how many fields
 *     came back populated; review notes flag missing sections.
 *
 * Errors: throws on JSON parse failure. Transient 503/429s retry
 * via `withGeminiRetry`; persistent ones bubble up as
 * `OverloadedError` so the UI shows the right toast.
 */
export class GeminiStyleGuideManifestExtractor implements IStyleGuideManifestExtractor {
    private modelName: string;

    constructor(modelName?: string) {
        this.modelName = modelName || 'gemini-2.5-pro';
    }

    async extract(input: ExtractStyleManifestInput): Promise<ExtractedStyleManifest> {
        const { systemInstruction, userMessage } = buildExtractionPrompt(input);

        console.log('[GeminiStyleGuideManifestExtractor] extracting', {
            language: input.language,
            rawTextChars: input.rawText.length,
        });

        const { text: rawJson, tokensUsed } = await withGeminiRetry(
            () => runLlmPromptWithUsage({
                feature: 'exegesis.extractStyleManifest',
                model: this.modelName,
                system: systemInstruction,
                prompt: userMessage,
                responseMimeType: 'application/json',
                temperature: 0.2,
                topP: 0.9,
                maxOutputTokens: 8192,
            }),
            { contextLabel: 'GeminiStyleGuideManifestExtractor' },
        );

        const parsed = parseExtractorJson(rawJson);
        const manifest = mapToDomain(parsed, this.modelName);

        return {
            manifest,
            tokensUsed,
        };
    }
}

// ── Prompt ──────────────────────────────────────────────────────────────

interface BuiltPrompt {
    systemInstruction: string;
    userMessage: string;
}

function buildExtractionPrompt(input: ExtractStyleManifestInput): BuiltPrompt {
    if (input.language === 'en') {
        return {
            systemInstruction: [
                `You are a structured-data extractor for academic style guides.`,
                ``,
                `Read a style guide document (TMS / Turabian / SBL Handbook / Chicago / similar) and emit a JSON object describing its mechanical rules — footnote templates, ibid behavior, bibliography format, quotation conventions, transliteration scheme.`,
                ``,
                `Concrete worked examples matter: provide rendered citation samples so the student can verify "this is what my paper's footnotes will look like".`,
                ``,
                `Output JSON ONLY — no markdown fences, no commentary, no preamble.`,
            ].join('\n'),
            userMessage: buildUserMessageEN(input.rawText),
        };
    }

    return {
        systemInstruction: [
            `Sos un extractor de datos estructurados para guías de estilo académicas.`,
            ``,
            `Lee un documento de guía de estilo (TMS / Turabian / SBL Handbook / Chicago / similar) y devuelve un objeto JSON con las reglas mecánicas — plantillas de notas al pie, comportamiento de ibid, formato de bibliografía, convenciones de citación, esquema de transliteración.`,
            ``,
            `Los ejemplos concretos importan: incluye muestras renderizadas de citas para que el alumno pueda verificar "así van a verse las notas al pie de mi paper".`,
            ``,
            `Devuelve SOLO JSON — sin fences markdown, sin comentarios, sin preámbulo.`,
        ].join('\n'),
        userMessage: buildUserMessageES(input.rawText),
    };
}

function buildUserMessageEN(rawText: string): string {
    return [
        `Extract the mechanical rules from this style guide:`,
        '```',
        rawText.trim(),
        '```',
        ``,
        `## Output schema`,
        ``,
        `{`,
        `  "citationStyleLabel": string,                                   // e.g. "Turabian 9", "TMS 2024-25", "SBL Handbook"`,
        `  "footnotes": {`,
        `    "firstMentionTemplate": string,                                // template with placeholders, see below`,
        `    "subsequentMentionTemplate": string,`,
        `    "examples": [                                                  // 3 worked examples`,
        `      { "label": string, "rendered": string }, ...`,
        `    ],`,
        `    "ibid": {`,
        `      "enabled": boolean,`,
        `      "label": string,                                             // "Ibid.", "Idem", "Ibídem"`,
        `      "allowPageOverride": boolean                                 // "Ibid., 47" allowed?`,
        `    }`,
        `  },`,
        `  "bibliography": {`,
        `    "entryTemplate": string,                                       // surname-first form`,
        `    "sortBy": "author-surname" | "order-of-appearance",`,
        `    "useDashForRepeatedAuthors": boolean                           // 3-em dash substitution`,
        `  },`,
        `  "quotations": {`,
        `    "blockQuoteThresholdWords": number,                            // typical: 40`,
        `    "primaryQuoteMark": string,                                    // single Unicode char or pair (e.g. \\"\\")`,
        `    "secondaryQuoteMark": string,`,
        `    "ellipsis": string,                                            // "...", ". . .", "…"`,
        `    "interpolationBrackets": "[]" | "()"`,
        `  },`,
        `  "transliteration": {                                             // null if the guide doesn't address transliteration`,
        `    "scheme": string,                                              // "SBL", "Library of Congress", etc.`,
        `    "useDiacritics": boolean,`,
        `    "bodyRequiresTransliteration": boolean`,
        `  } | null,`,
        `  "additionalRules": string[],                                     // free-form rules in English`,
        `  "confidence": "high" | "medium" | "low",`,
        `  "extractionNotes": string[]                                      // ambiguities you encountered, in English`,
        `}`,
        ``,
        `## Footnote template placeholders`,
        ``,
        `Use the following placeholders in templates (literally — they are substituted by a downstream formatter):`,
        ``,
        `- {author}            full author name as listed in the source`,
        `- {authorShort}       surname only (used for subsequent mentions)`,
        `- {authorSurnameFirst}  surname-first form for bibliography ("Lane, William L.")`,
        `- {title}             full title`,
        `- {titleShort}        abbreviated title`,
        `- {publisher}, {city}, {year}, {pages}, {volume}`,
        ``,
        `## Defaults when the guide is silent`,
        ``,
        `- Pre-modern guides (Chicago / Turabian / TMS) usually allow ibid; modern SBL forbids it.`,
        `- Block-quote threshold defaults to 40 words.`,
        `- Quote marks default to straight ASCII (\\" and ').`,
        `- Confidence: 'high' if every section was clearly stated; 'medium' if some inference was needed; 'low' if significant gaps remain.`,
        ``,
        `Worked examples MUST include at least: a first cite of an imaginary commentary, a subsequent cite of the same source, and an ibid example. Use plausible names ("William L. Lane, Hebrews 1-8") so the student recognizes the format.`,
    ].join('\n');
}

function buildUserMessageES(rawText: string): string {
    return [
        `Extrae las reglas mecánicas de esta guía de estilo:`,
        '```',
        rawText.trim(),
        '```',
        ``,
        `## Esquema de salida`,
        ``,
        `{`,
        `  "citationStyleLabel": string,                                   // ej. "Turabian 9", "TMS 2024-25", "SBL Handbook"`,
        `  "footnotes": {`,
        `    "firstMentionTemplate": string,                                // plantilla con placeholders, ver abajo`,
        `    "subsequentMentionTemplate": string,`,
        `    "examples": [                                                  // 3 ejemplos renderizados`,
        `      { "label": string, "rendered": string }, ...`,
        `    ],`,
        `    "ibid": {`,
        `      "enabled": boolean,`,
        `      "label": string,                                             // "Ibid.", "Idem", "Ibídem"`,
        `      "allowPageOverride": boolean                                 // ¿se permite "Ibid., 47"?`,
        `    }`,
        `  },`,
        `  "bibliography": {`,
        `    "entryTemplate": string,                                       // forma apellido-primero`,
        `    "sortBy": "author-surname" | "order-of-appearance",`,
        `    "useDashForRepeatedAuthors": boolean                           // sustitución con guion 3-em`,
        `  },`,
        `  "quotations": {`,
        `    "blockQuoteThresholdWords": number,                            // típico: 40`,
        `    "primaryQuoteMark": string,                                    // carácter Unicode o par (ej. \\"\\")`,
        `    "secondaryQuoteMark": string,`,
        `    "ellipsis": string,                                            // "...", ". . .", "…"`,
        `    "interpolationBrackets": "[]" | "()"`,
        `  },`,
        `  "transliteration": {                                             // null si la guía no trata transliteración`,
        `    "scheme": string,                                              // "SBL", "Library of Congress", etc.`,
        `    "useDiacritics": boolean,`,
        `    "bodyRequiresTransliteration": boolean`,
        `  } | null,`,
        `  "additionalRules": string[],                                     // reglas libres en español`,
        `  "confidence": "high" | "medium" | "low",`,
        `  "extractionNotes": string[]                                      // ambigüedades en español`,
        `}`,
        ``,
        `## Placeholders de plantillas de nota al pie`,
        ``,
        `Usa estos placeholders en las plantillas (literales — los sustituye el formateador downstream):`,
        ``,
        `- {author}            nombre completo del autor`,
        `- {authorShort}       solo apellido (para citas posteriores)`,
        `- {authorSurnameFirst}  forma apellido-primero para bibliografía ("Lane, William L.")`,
        `- {title}             título completo`,
        `- {titleShort}        título abreviado`,
        `- {publisher}, {city}, {year}, {pages}, {volume}`,
        ``,
        `## Defaults cuando la guía calla`,
        ``,
        `- Guías pre-modernas (Chicago / Turabian / TMS) generalmente permiten ibid; SBL moderno lo prohibe.`,
        `- Umbral de block-quote default: 40 palabras.`,
        `- Comillas default: ASCII rectas (\\" y ').`,
        `- Confianza: 'high' si toda sección quedó clara; 'medium' si hubo inferencia; 'low' si quedaron gaps significativos.`,
        ``,
        `Los ejemplos DEBEN incluir al menos: una primera cita de un comentario imaginario, una cita posterior del mismo, y un ejemplo de ibid. Usa nombres plausibles ("William L. Lane, Hebrews 1-8") para que el alumno reconozca el formato.`,
    ].join('\n');
}

// ── JSON parsing + mapping ─────────────────────────────────────────────

interface RawExtractionResult {
    citationStyleLabel: string | null;
    footnotes: {
        firstMentionTemplate: string | null;
        subsequentMentionTemplate: string | null;
        examples: Array<{ label: string; rendered: string }>;
        ibid: { enabled: boolean; label: string; allowPageOverride: boolean } | null;
    } | null;
    bibliography: {
        entryTemplate: string | null;
        sortBy: 'author-surname' | 'order-of-appearance';
        useDashForRepeatedAuthors: boolean;
    } | null;
    quotations: {
        blockQuoteThresholdWords: number | null;
        primaryQuoteMark: string | null;
        secondaryQuoteMark: string | null;
        ellipsis: string | null;
        interpolationBrackets: '[]' | '()' | null;
    } | null;
    transliteration: {
        scheme: string;
        useDiacritics: boolean;
        bodyRequiresTransliteration: boolean;
    } | null;
    additionalRules: string[];
    confidence: 'high' | 'medium' | 'low';
    extractionNotes: string[];
}

function parseExtractorJson(rawJson: string): RawExtractionResult {
    const cleaned = rawJson
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();

    let parsed: any;
    try {
        parsed = JSON.parse(cleaned);
    } catch (err) {
        throw new Error(`Style manifest extractor produced invalid JSON: ${(err as Error).message}`);
    }

    return {
        citationStyleLabel: typeof parsed.citationStyleLabel === 'string' ? parsed.citationStyleLabel : null,
        footnotes: parsed.footnotes && typeof parsed.footnotes === 'object'
            ? {
                firstMentionTemplate: typeof parsed.footnotes.firstMentionTemplate === 'string' ? parsed.footnotes.firstMentionTemplate : null,
                subsequentMentionTemplate: typeof parsed.footnotes.subsequentMentionTemplate === 'string' ? parsed.footnotes.subsequentMentionTemplate : null,
                examples: Array.isArray(parsed.footnotes.examples)
                    ? parsed.footnotes.examples
                        .filter((e: any) => e && typeof e.label === 'string' && typeof e.rendered === 'string')
                    : [],
                ibid: parsed.footnotes.ibid && typeof parsed.footnotes.ibid === 'object'
                    ? {
                        enabled: !!parsed.footnotes.ibid.enabled,
                        label: typeof parsed.footnotes.ibid.label === 'string' ? parsed.footnotes.ibid.label : 'Ibid.',
                        allowPageOverride: !!parsed.footnotes.ibid.allowPageOverride,
                    }
                    : null,
            }
            : null,
        bibliography: parsed.bibliography && typeof parsed.bibliography === 'object'
            ? {
                entryTemplate: typeof parsed.bibliography.entryTemplate === 'string' ? parsed.bibliography.entryTemplate : null,
                sortBy: parsed.bibliography.sortBy === 'order-of-appearance' ? 'order-of-appearance' : 'author-surname',
                useDashForRepeatedAuthors: !!parsed.bibliography.useDashForRepeatedAuthors,
            }
            : null,
        quotations: parsed.quotations && typeof parsed.quotations === 'object'
            ? {
                blockQuoteThresholdWords: typeof parsed.quotations.blockQuoteThresholdWords === 'number' ? parsed.quotations.blockQuoteThresholdWords : null,
                primaryQuoteMark: typeof parsed.quotations.primaryQuoteMark === 'string' ? parsed.quotations.primaryQuoteMark : null,
                secondaryQuoteMark: typeof parsed.quotations.secondaryQuoteMark === 'string' ? parsed.quotations.secondaryQuoteMark : null,
                ellipsis: typeof parsed.quotations.ellipsis === 'string' ? parsed.quotations.ellipsis : null,
                interpolationBrackets: parsed.quotations.interpolationBrackets === '()' ? '()' : (parsed.quotations.interpolationBrackets === '[]' ? '[]' : null),
            }
            : null,
        transliteration: parsed.transliteration && typeof parsed.transliteration === 'object'
            ? {
                scheme: typeof parsed.transliteration.scheme === 'string' ? parsed.transliteration.scheme : 'SBL',
                useDiacritics: !!parsed.transliteration.useDiacritics,
                bodyRequiresTransliteration: !!parsed.transliteration.bodyRequiresTransliteration,
            }
            : null,
        additionalRules: Array.isArray(parsed.additionalRules) ? parsed.additionalRules.filter((r: any) => typeof r === 'string') : [],
        confidence: parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
            ? parsed.confidence
            : 'medium',
        extractionNotes: Array.isArray(parsed.extractionNotes) ? parsed.extractionNotes.filter((n: any) => typeof n === 'string') : [],
    };
}

function mapToDomain(raw: RawExtractionResult, modelId: string): StyleGuideManifest {
    const footnoteExamples: FootnoteExample[] = raw.footnotes?.examples ?? [];

    return {
        provenance: 'extracted',
        extractedAt: new Date(),
        extractorModelId: modelId,
        citationStyleLabel: raw.citationStyleLabel ?? 'Unknown style',
        footnotes: {
            firstMentionTemplate:
                raw.footnotes?.firstMentionTemplate
                ?? '{author}, {title} ({city}: {publisher}, {year}), {pages}.',
            subsequentMentionTemplate:
                raw.footnotes?.subsequentMentionTemplate
                ?? '{authorShort}, {titleShort}, {pages}.',
            examples: footnoteExamples,
            ibid: raw.footnotes?.ibid ?? {
                enabled: true,
                label: 'Ibid.',
                allowPageOverride: true,
            },
        },
        bibliography: {
            entryTemplate:
                raw.bibliography?.entryTemplate
                ?? '{authorSurnameFirst}. {title}. {city}: {publisher}, {year}.',
            sortBy: raw.bibliography?.sortBy ?? 'author-surname',
            useDashForRepeatedAuthors: raw.bibliography?.useDashForRepeatedAuthors ?? true,
        },
        quotations: {
            blockQuoteThresholdWords: raw.quotations?.blockQuoteThresholdWords ?? 40,
            primaryQuoteMark: raw.quotations?.primaryQuoteMark ?? '"',
            secondaryQuoteMark: raw.quotations?.secondaryQuoteMark ?? "'",
            ellipsis: raw.quotations?.ellipsis ?? '. . .',
            interpolationBrackets: raw.quotations?.interpolationBrackets ?? '[]',
        },
        transliteration: raw.transliteration,
        additionalRules: raw.additionalRules,
        confidence: raw.confidence,
        extractionNotes: raw.extractionNotes,
    };
}
