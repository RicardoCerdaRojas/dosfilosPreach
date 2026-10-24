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
import { LONG_GENERATION_TIMEOUT_MS } from '../llm/llmTimeouts';

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
                // El razonamiento del modelo se descuenta del mismo tope: medido en
                // producción (NT785, gemini-3.8-flash), ~9 200 tokens de respuesta
                // más ~6 000 de razonamiento por lectura, y con 16 384 se cortaba.
                // Se paga lo generado, no el tope: 65 536 es el techo del proxy.
                maxOutputTokens: 65536,
                // Copiar datos no pide razonar: ~6 000 tokens por lectura eran
                // gasto (y espacio de salida perdido).
                thinking: 'minimal',
                ...(input.image ? { inlineImage: { mimeType: input.image.mimeType, base64: input.image.base64 } } : {}),
                // 16k de salida no caben en los 70 s del SDK: sin este tope el
                // navegador cortaba con «deadline-exceeded» mientras el servidor
                // seguía leyendo (prueba del fundador con el sílabo de NT785).
            }, { timeoutMs: LONG_GENERATION_TIMEOUT_MS }),
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
    // Las obras van AL FINAL: si la respuesta se corta en un documento muy
    // largo, lo del encargo (requisitos, prohibiciones) ya llegó entero y se
    // rescatan las obras completas hasta el corte.
    const esquema = `{
  "documentKind": "assignment"|"bibliography",
  "requirementItems": [{ "kind": "minimum-type"|"quantity"|"date-range"|"perspectives"|"variety"|"rule"|"other",
                "text": string, "sourceType": tipo|null, "minimum": number|null, "unit": "works"|"pages"|null,
                "before": number|null, "after": number|null, "types": [tipo]|null }],
  "requirements": string|null,
  "prohibitions": string|null,
  "entries": [{ "title": string, "author": string|null, "series": string|null, "year": number|null, "publisher": string|null,
                "requirement": "required"|"recommended", "sourceType": one of [${TIPOS.join(', ')}] | null, "note": string|null,
                "pageCount": number|null, "doi": string|null, "isbn": string|null }]
}`;
    const forma = es
        ? 'Forma: JSON compacto, sin sangrías ni saltos de línea, en el orden del esquema (las obras al final). Omite las claves cuyo valor sería null.'
        : 'Format: compact JSON, no indentation or line breaks, in the schema order (works last). Omit keys whose value would be null.';
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
            '- "documentKind": "assignment" si es un encargo (sílabo, consigna, rúbrica: dice qué se pide); "bibliography" si es solo una lista de obras (la bibliografía de un artículo o un libro).',
            '- "requirementItems": SOLO en un encargo. Cada exigencia sobre las fuentes, una por entrada, con "text" copiado del documento:',
            '  · «mínimo de 100 páginas de artículos» → "quantity", sourceType "journal-article", minimum 100, unit "pages";',
            '  · «al menos tres comentarios críticos» → "minimum-type", sourceType "commentary-critical", minimum 3;',
            '  · «fuentes antiguas y actuales» → "date-range"; "before" y "after" SOLO si el documento da años, si no null;',
            '  · «puntos de vista opuestos» → "perspectives"; "minimum" solo si da un número;',
            '  · «variedad de recursos (comentarios, artículos)» → "variety", con "types";',
            '  · «no usar la misma fuente dos semanas consecutivas» → "rule";',
            '  · lo que no encaja → "other". Lo que el documento no dice va en null: nunca inventes cifras.',
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
            '- "documentKind": "assignment" for a syllabus, brief or rubric; "bibliography" for a plain list of works.',
            '- "requirementItems": ONLY for an assignment. One per requirement about sources, "text" copied from the document; kinds: quantity (N pages or works of a type), minimum-type, date-range (years only if given), perspectives, variety (with types), rule, other. Never invent numbers: null when not given.',
        ].join('\n');
    const texto = input.text?.trim()
        ? `${es ? 'Documento' : 'Document'}:\n"""\n${input.text.trim()}\n"""`
        : (es ? 'El documento es la imagen adjunta.' : 'The document is the attached image.');
    return { system, prompt: [`${es ? 'Esquema' : 'Schema'}:\n${esquema}`, forma, reglas, texto].join('\n\n') };
}

/** El JSON del lector, defensivo: lo que no es del esquema se descarta. */
export function parseBibliographyJson(raw: string): Omit<ExtractedCourseBibliography, 'tokensUsed'> {
    const limpio = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    let data: any;
    let rescate: { truncated: true; truncatedAfter: string | null } | null = null;
    try {
        data = JSON.parse(limpio);
    } catch (err) {
        // Una respuesta cortada (lista muy larga) se distingue de una rota.
        // Si se cortó, se rescatan las obras completas hasta el corte; si no
        // queda ninguna, la pantalla pide importar por partes.
        const cortada = limpio.startsWith('{') && !limpio.endsWith('}');
        const rescatado = cortada ? rescatarCortado(limpio) : null;
        if (!rescatado) throw Object.assign(new Error(`Bibliography extractor produced invalid JSON: ${(err as Error).message}`), cortada ? { code: 'truncated' } : {});
        data = rescatado;
        const ultima = Array.isArray(data.entries) ? data.entries[data.entries.length - 1] : null;
        rescate = { truncated: true, truncatedAfter: typeof ultima?.title === 'string' ? ultima.title : null };
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
    const tiposValidos = (xs: unknown) => (Array.isArray(xs) ? xs.filter((t): t is SourceType => typeof t === 'string' && tipos.has(t)) : null);
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : null);
    const KINDS = new Set(['minimum-type', 'quantity', 'date-range', 'perspectives', 'variety', 'rule', 'other']);
    const documentKind = data?.documentKind === 'bibliography' ? 'bibliography' : 'assignment';
    // Una bibliografía no trae requisitos: si el lector los inventó, no entran.
    const requirementItems = documentKind === 'bibliography' ? [] : (Array.isArray(data?.requirementItems) ? data.requirementItems : [])
        .filter((r: any) => KINDS.has(r?.kind) && texto(r?.text))
        .map((r: any) => ({
            kind: r.kind,
            text: texto(r.text)!,
            sourceType: typeof r.sourceType === 'string' && tipos.has(r.sourceType) ? r.sourceType as SourceType : null,
            minimum: num(r.minimum),
            unit: r.unit === 'pages' ? 'pages' as const : r.unit === 'works' ? 'works' as const : null,
            before: num(r.before),
            after: num(r.after),
            types: tiposValidos(r.types),
        }));
    const fichas = entries.map((e, i) => {
        const raw = (Array.isArray(data?.entries) ? data.entries.filter((x: any) => texto(x?.title)) : [])[i] ?? {};
        return { ...e, pageCount: num(raw.pageCount), doi: texto(raw.doi), isbn: texto(raw.isbn) };
    });
    return { documentKind, requirementItems, entries: fichas, requirements: texto(data?.requirements), prohibitions: texto(data?.prohibitions), ...(rescate ?? {}) };
}

/**
 * Lo que se puede salvar de un JSON cortado: todo lo anterior a `entries`
 * (los requisitos del encargo) y las obras COMPLETAS hasta el corte. La
 * obra a medio escribir se descarta. null si no hay al menos una obra
 * completa o lo rescatado no es un JSON válido.
 */
export function rescatarCortado(limpio: string): any | null {
    const clave = limpio.search(/"entries"\s*:\s*\[/);
    if (clave < 0) return null;
    const inicio = limpio.indexOf('[', clave);
    let profundidad = 0, enTexto = false, escape = false, ultimoCierre = -1;
    for (let i = inicio + 1; i < limpio.length; i++) {
        const c = limpio[i];
        if (enTexto) {
            if (escape) escape = false;
            else if (c === '\\') escape = true;
            else if (c === '"') enTexto = false;
            continue;
        }
        if (c === '"') enTexto = true;
        else if (c === '{' || c === '[') profundidad++;
        else if (c === '}' || c === ']') {
            if (profundidad === 0) return null; // el arreglo cerró: no estaba cortado aquí
            profundidad--;
            if (profundidad === 0 && c === '}') ultimoCierre = i;
        }
    }
    if (ultimoCierre < 0) return null;
    try {
        return JSON.parse(`${limpio.slice(0, ultimoCierre + 1)}]}`);
    } catch {
        return null;
    }
}
