import {
    SOURCE_TYPE_CATALOG,
    type ExtractCourseBibliographyInput,
    type ExtractedBibliographyEntry,
    type ExtractedCourseBibliography,
    type ICourseBibliographyExtractor,
    type SourceType,
} from '@dosfilos/domain';
import { withGeminiRetry } from './geminiRetry';
import { runLlmPromptWithUsage } from '../llm/callableLlm';

/**
 * Lee la bibliografía de un sílabo, una lista o una foto (estado del arte,
 * paso 1). Es una extracción: copia lo que dice el documento, no recomienda
 * ni completa. Lo que el documento no da queda en `null`.
 *
 * Etiqueta del proxy `exegesis.extractBibliography`, que cobra con la
 * reserva `extractProjectBibliography`.
 */
export class GeminiCourseBibliographyExtractor implements ICourseBibliographyExtractor {
    constructor(private modelName: string = 'gemini-2.5-flash') { }

    async extract(input: ExtractCourseBibliographyInput): Promise<ExtractedCourseBibliography> {
        const { system, prompt } = buildBibliographyPrompt(input);
        const { text: raw, tokensUsed } = await withGeminiRetry(
            () => runLlmPromptWithUsage({
                feature: 'exegesis.extractBibliography',
                model: this.modelName,
                system,
                prompt,
                responseMimeType: 'application/json',
                temperature: 0.1,
                topP: 0.9,
                // Un sílabo de NT785 trae ~90 obras: ~60 tokens cada una.
                maxOutputTokens: 16384,
                ...(input.image ? { inlineImage: { mimeType: input.image.mimeType, base64: input.image.base64 } } : {}),
            }),
            { contextLabel: 'GeminiCourseBibliographyExtractor' },
        );
        return { ...parseBibliographyJson(raw), ...(typeof tokensUsed === 'number' ? { tokensUsed } : {}) };
    }
}

const TIPOS = (Object.keys(SOURCE_TYPE_CATALOG) as SourceType[]).filter(t => t !== 'style-template-paper');

export function buildBibliographyPrompt(input: Pick<ExtractCourseBibliographyInput, 'text' | 'image' | 'language'>): { system: string; prompt: string } {
    const es = input.language !== 'en';
    const system = es
        ? [
            'Eres un extractor de datos bibliográficos de sílabos de seminario y listas de bibliografía.',
            'Copia lo que dice el documento: no recomiendes obras, no completes datos que no estén, no traduzcas títulos.',
            'Responde SOLO un objeto JSON, sin bloques de código ni comentarios.',
        ].join('\n')
        : [
            'You extract bibliographic data from seminary syllabi and bibliography lists.',
            'Copy what the document says: do not recommend works, do not fill in data that is not there, do not translate titles.',
            'Answer ONLY a JSON object, with no code fences or commentary.',
        ].join('\n');
    const esquema = `{
  "entries": [{ "title": string, "author": string|null, "series": string|null, "year": number|null, "publisher": string|null,
                "requirement": "required"|"recommended", "sourceType": one of [${TIPOS.join(', ')}] | null, "note": string|null }],
  "requirements": string|null,
  "prohibitions": string|null
}`;
    const reglas = es
        ? [
            'Reglas:',
            '- Una entrada por obra. Un capítulo o artículo dentro de un libro o revista es UNA obra: el título es el del capítulo o artículo, y la serie, el libro o la revista.',
            '- «———.» o «---.» repite el autor de la entrada anterior.',
            '- "author": como lo da el documento («Davids, Peter H.»). Varios autores, separados por « y ».',
            '- "requirement": "required" solo si el documento la exige (libro de texto, lectura obligatoria, lectura semanal asignada). Lo demás de la bibliografía, "recommended".',
            '- "sourceType": tu mejor clasificación por lo que es la obra (comentario crítico o expositivo, gramática, léxico, artículo de revista, monografía…). Si no se sabe, null.',
            '- "note": lo que el documento dice de la obra («lectura semanal según el calendario»), si dice algo.',
            '- "requirements": lo que el documento EXIGE sobre las fuentes (mínimos, tipos, páginas de artículos, guía de estilo), en frases cortas. null si nada.',
            '- "prohibitions": lo que PROHÍBE o restringe sobre las fuentes (no repetir, no usar cierto tipo). null si nada.',
        ].join('\n')
        : [
            'Rules:',
            '- One entry per work. A chapter or article inside a book or journal is ONE work: the title is the chapter or article; the series is the book or journal.',
            '- "———." or "---." repeats the previous entry\'s author.',
            '- "author": as the document gives it. Several authors, joined by " and ".',
            '- "requirement": "required" only when the document requires it (textbook, required or weekly assigned reading). The rest of the bibliography, "recommended".',
            '- "sourceType": your best classification by what the work is. null if unknown.',
            '- "note": what the document says about the work, if anything.',
            '- "requirements": what the document REQUIRES about sources, in short sentences. null if nothing.',
            '- "prohibitions": what it FORBIDS or restricts about sources. null if nothing.',
        ].join('\n');
    const texto = input.text?.trim()
        ? `${es ? 'Documento' : 'Document'}:\n"""\n${input.text.trim()}\n"""`
        : (es ? 'El documento es la imagen adjunta.' : 'The document is the attached image.');
    return { system, prompt: [`${es ? 'Esquema' : 'Schema'}:\n${esquema}`, reglas, texto].join('\n\n') };
}

/** El JSON del lector, defensivo: lo que no es del esquema se descarta. */
export function parseBibliographyJson(raw: string): Omit<ExtractedCourseBibliography, 'tokensUsed'> {
    const limpio = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    let data: any;
    try {
        data = JSON.parse(limpio);
    } catch (err) {
        // Una respuesta cortada (lista muy larga) se distingue de una rota:
        // la pantalla pide importar por partes.
        const cortada = limpio.startsWith('{') && !limpio.endsWith('}');
        throw Object.assign(new Error(`Bibliography extractor produced invalid JSON: ${(err as Error).message}`), cortada ? { code: 'truncated' } : {});
    }
    const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    const tipos = new Set<string>(TIPOS);
    const entries: ExtractedBibliographyEntry[] = (Array.isArray(data?.entries) ? data.entries : [])
        .map((e: any): ExtractedBibliographyEntry | null => {
            const title = texto(e?.title);
            if (!title) return null;
            const year = typeof e?.year === 'number' && e.year > 0 ? Math.round(e.year) : null;
            return {
                title,
                author: texto(e?.author),
                series: texto(e?.series),
                year,
                publisher: texto(e?.publisher),
                requirement: e?.requirement === 'required' ? 'required' : 'recommended',
                sourceType: typeof e?.sourceType === 'string' && tipos.has(e.sourceType) ? e.sourceType as SourceType : null,
                note: texto(e?.note),
            };
        })
        .filter((e: ExtractedBibliographyEntry | null): e is ExtractedBibliographyEntry => !!e);
    return { entries, requirements: texto(data?.requirements), prohibitions: texto(data?.prohibitions) };
}
