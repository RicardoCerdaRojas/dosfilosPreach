import type { CanonicalVerseAnalysis, CitationPageKind } from '../entities/CanonicalVerseAnalysis';
import { printedLabelIn, type PageNumbering } from '../outline/pageNumbering';

/** Una cita del análisis, sin importar en cuál de sus seis sitios vivía. */
export interface AnalysisCitation {
    sourceKey: string;
    page: number;
    /** Ausente equivale a `'sheet'`: describe todo análisis previo a la calibración. */
    pageKind?: CitationPageKind;
}

/**
 * Todas las citas de un análisis.
 *
 * El análisis guarda citas en seis sitios distintos y ninguno es opcional al
 * contarlas: una cita en `footnoteExtensions` llega al documento igual que una
 * de `commentatorEngagement`. Este recorrido estaba escrito tres veces —el
 * serializador, el script de auditoría y el contador de tipos— y cada copia era
 * una oportunidad de olvidar un sitio en una sola de ellas.
 */
export function collectAnalysisCitations(
    analysis: CanonicalVerseAnalysis,
): AnalysisCitation[] {
    const out: AnalysisCitation[] = [];
    const push = (c: { sourceKey?: string; page?: number; pageKind?: CitationPageKind }) => {
        if (!c?.sourceKey || typeof c.page !== 'number' || !Number.isFinite(c.page)) return;
        out.push({ sourceKey: c.sourceKey, page: c.page, pageKind: c.pageKind });
    };
    for (const c of analysis.commentatorEngagement) push(c);
    for (const crux of analysis.translationCruxes) for (const p of crux.commentatorPositions) push(p);
    for (const l of analysis.lexicalAnalyses) {
        for (const s of l.generalSemanticRange.sources) push(s);
        for (const s of l.loadingSources) push(s);
    }
    for (const f of analysis.footnoteExtensions) for (const s of f.sources) push(s);
    for (const o of analysis.oldTestamentLinks) for (const s of o.sources) push(s);
    for (const h of analysis.historicalContext) for (const s of h.sources) push(s);
    return out;
}

/** Cómo queda una fuente cuando el trabajo se componga. */
export interface SourceAnchoring {
    citationKey: string;
    displayLabel: string;
    /** Cuántas citas del trabajo se apoyan en ella. */
    citations: number;
    /**
     * Si sus citas podrán decir una página del ejemplar impreso. Cuando es
     * `false` dirán «hoja N», que es el número de una hoja del archivo y no
     * existe en ningún ejemplar: nadie puede comprobarlas.
     */
    anchored: boolean;
}

export interface CitationAnchoringSummary {
    /** Citas del trabajo entero. */
    total: number;
    /** Las que no podrán señalar una página del ejemplar impreso. */
    unanchored: number;
    /** Sólo las fuentes sin anclar, de la que más pesa a la que menos. */
    sources: SourceAnchoring[];
}

/**
 * Qué parte del trabajo se apoya en fuentes que nadie puede comprobar.
 *
 * Existe por un caso real. En un trabajo de Santiago, la ÚNICA cita fabricada
 * —una afirmación que no está en el libro— fue la del único libro sin
 * numeración confirmada. No es casualidad: donde el sistema no puede traducir
 * la hoja a una página impresa, la cita sale como «hoja 55», nadie la contrasta
 * contra el ejemplar, y el error sobrevive hasta la entrega.
 *
 * Decir «hoja N» en vez de inventar una página es honesto, pero es honestidad
 * callada. Esto la vuelve visible ANTES de componer, que es el único momento en
 * que todavía se puede hacer algo: calibrar el libro, cambiar la fuente, o
 * revisar esas citas a mano con el ejemplar delante.
 *
 * La regla de anclaje es la misma que la de `buildPageLabeler`, y a propósito:
 * dos reglas que deberían coincidir y viven aparte terminan no coincidiendo.
 */
export function summarizeCitationAnchoring(
    analyses: ReadonlyArray<CanonicalVerseAnalysis>,
    sources: ReadonlyArray<{
        citationKey: string;
        displayLabel: string;
        numbering: PageNumbering | null;
    }>,
): CitationAnchoringSummary {
    const byKey = new Map(sources.map(s => [s.citationKey, s]));
    const counts = new Map<string, number>();
    let total = 0;
    let unanchored = 0;

    for (const analysis of analyses) {
        for (const cita of collectAnalysisCitations(analysis)) {
            const source = byKey.get(cita.sourceKey);
            // Una clave que el trabajo no declara como fuente no se cuenta: no
            // es una cita sin anclar, es otra clase de problema y el
            // verificador la reporta como «fuente no encontrada».
            if (!source) continue;
            total++;
            // `printed` ya es la página impresa: el recurso declaraba su
            // numeración cuando se analizó el verso.
            const anclada = cita.pageKind === 'printed'
                || printedLabelIn(source.numbering, cita.page) !== null;
            if (anclada) continue;
            unanchored++;
            counts.set(cita.sourceKey, (counts.get(cita.sourceKey) ?? 0) + 1);
        }
    }

    const sinAnclar = [...counts.entries()]
        .map(([citationKey, citations]) => ({
            citationKey,
            displayLabel: byKey.get(citationKey)?.displayLabel ?? citationKey,
            citations,
            anchored: false,
        }))
        .sort((a, b) => b.citations - a.citations || a.citationKey.localeCompare(b.citationKey));

    return { total, unanchored, sources: sinAnclar };
}
