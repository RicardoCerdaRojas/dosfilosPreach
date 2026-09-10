import { formatPassageReference } from '../../bible/canon/passage-reference';
import { relabelProsePages } from './relabelProsePages';
import { collectAnalysisCitations } from './citationAnchoring';
import type { CanonicalVerseAnalysis, CitationPageKind } from '../entities/CanonicalVerseAnalysis';

/**
 * Serializes a `CanonicalVerseAnalysis` into a compact "briefing"
 * format the composer's prompt feeds to Gemini.
 *
 * The briefing is denser than the original JSON — flat sections with
 * inline labels — so the model parses it as a knowledge artifact
 * rather than as data structure to walk. This frees the model to
 * focus on PROSE COMPOSITION instead of JSON traversal, which
 * empirically produces more fluent academic writing.
 *
 * Stable per-verse layout:
 *
 *   == Verse {ref} ==
 *   Greek: ...
 *   Initial translation: ...
 *   Final translation: ...
 *   Argumentative role: ...
 *
 *   Syntax:
 *   - {fragment} ({morphology}, fn={syntacticFunction}): {significance}
 *   ...
 *
 *   Lexis:
 *   - {term} ({lemma}, "{gloss}"): general=[...]; verse-loading: {...}
 *   ...
 *
 *   Discourse particles:
 *   - {particle} ({function}): {note}
 *
 *   Textual criticism:
 *   {note}
 *   - variant: {lemma} → adopted "{adoptedReading}". rationale: ...
 *
 *   Historical context:
 *   - {aspect}: {relevance}
 *
 *   OT links:
 *   - [{type}] {sourcePassage}: {bearing}
 *
 *   Commentator positions:
 *   - [{role}] {sourceKey} (p. {page}): {position}
 *   ...
 *
 *   Translation cruxes:
 *   - "{phrase}": {description}
 *     options: ["{a}" ({chr-a}), "{b}" ({chr-b})]
 *     positions: [{key} (p.{p}) → {idx}; ...]
 *     commitment: "{chosen}". rationale: {rationale}
 *   ...
 *
 *   Verse thesis: {thesis}
 *
 *   Footnote extensions:
 *   - anchor: "{anchor}"
 *     text: {text}
 *     sources: [{key} p.{p}, ...]
 *
 *   Confidence flags:
 *   - [{level}] {claim} → hedges: [...]
 *   ...
 *
 *   Theological hooks: {locus1}, {locus2}, ...
 */
/**
 * Cómo rotular el número de una fuente citada.
 *
 * El número que guarda el análisis puede ser la página impresa —cuando el
 * recurso declaraba su numeración al analizar— o la hoja del archivo, y
 * `pageKind` dice cuál. Ausente significa hoja, que describe con exactitud
 * todo lo analizado antes de la calibración.
 *
 * Sin este gancho el compositor tendría que reescribir cadenas ya formateadas.
 */
export interface SerializeAnalysisOptions {
    /**
     * Por defecto rotula según `pageKind`: `p. N` para la página impresa y
     * `hoja N` para la hoja del archivo.
     *
     * El default anterior era `p. {hoja}` a secas, y ése fue el defecto: un
     * trabajo real salió con diez citas que decían «p.» sobre hojas de PDF,
     * todas verosímiles y todas equivocadas —en Adamson por cuatro páginas,
     * en Mayor por doscientas setenta y ocho—.
     */
    pageLabel?: (sourceKey: string, page: number, kind: CitationPageKind) => string;
    /**
     * Claves citables del paper.
     *
     * Sirven para reetiquetar también las menciones de página que el
     * análisis dejó escritas dentro de su PROSA («Adamson (p. 59) lo
     * conecta con…»), que de otro modo viajan con el número de hoja
     * mientras la cita formal del mismo párrafo lleva el impreso. Ver
     * `relabelProsePages`. Sin esto sólo se reetiqueta lo estructurado.
     */
    citableKeys?: readonly string[];
}

export function serializeAnalysis(
    analysis: CanonicalVerseAnalysis,
    language: 'es' | 'en',
    options: SerializeAnalysisOptions = {},
): string {
    const page = options.pageLabel
        ?? ((_key: string, value: number, kind: CitationPageKind) =>
            kind === 'printed' ? `p. ${value}` : `hoja ${value}`);
    /** Rotula una cita usando el tipo que quedó registrado al analizarla. */
    const cite = (c: { sourceKey: string; page: number; pageKind?: CitationPageKind }) =>
        page(c.sourceKey, c.page, c.pageKind ?? 'sheet');
    // Las menciones sueltas dentro de la prosa —«Adamson (p. 59) lo conecta
    // con…»— no llevan tipo propio, pero el tipo es homogéneo por fuente: el
    // ancla que vio el modelo fue la misma para todos los fragmentos de un
    // mismo recurso. Así que se deduce de las citas estructuradas.
    const kindBySource = collectPageKinds(analysis);
    // La prosa sólo se toca cuando hay con qué: sin rótulo propio ni
    // claves, reescribirla sería cambiar números por los mismos números.
    const citableKeys = options.citableKeys ?? [];
    const prose = options.pageLabel && citableKeys.length > 0
        ? (text: string) => relabelProsePages(
            text,
            citableKeys,
            (key, value) => page(key, value, kindBySource.get(key) ?? 'sheet'),
        )
        : (text: string) => text;
    const ref = formatPassageReference(analysis.reference, language);
    const lines: string[] = [];
    lines.push(`== Verse ${ref} ==`);
    lines.push(`Greek: ${analysis.greekText}`);
    lines.push(`Initial translation: ${analysis.initialTranslation}`);
    lines.push(`Final translation: ${analysis.finalTranslation}`);
    lines.push(`Argumentative role: ${analysis.argumentativeRole}`);

    // ── Syntax ─────────────────────────────────────────────────────
    if (analysis.syntacticAnalysis.mainVerb || analysis.syntacticAnalysis.keyConstructions.length > 0) {
        lines.push('');
        lines.push('Syntax:');
        if (analysis.syntacticAnalysis.mainVerb) {
            const mv = analysis.syntacticAnalysis.mainVerb;
            lines.push(`- [main verb] ${mv.text} (${mv.morphology}, fn=${mv.syntacticFunction}): ${prose(mv.interpretiveSignificance)}`);
        } else if (analysis.syntacticAnalysis.mainVerbNote) {
            lines.push(`- [main verb] (none in this verse) — ${prose(analysis.syntacticAnalysis.mainVerbNote)}`);
        }
        for (const kc of analysis.syntacticAnalysis.keyConstructions) {
            lines.push(`- ${kc.text} (${kc.morphology}, fn=${kc.syntacticFunction}): ${prose(kc.interpretiveSignificance)}`);
        }
    }
    if (analysis.syntacticAnalysis.discourseParticles.length > 0) {
        lines.push('');
        lines.push('Discourse particles:');
        for (const p of analysis.syntacticAnalysis.discourseParticles) {
            lines.push(`- ${p.particle} (${p.function}): ${prose(p.note)}`);
        }
    }

    // ── Lexis ───────────────────────────────────────────────────────
    if (analysis.lexicalAnalyses.length > 0) {
        lines.push('');
        lines.push('Lexis:');
        for (const la of analysis.lexicalAnalyses) {
            const generalRange = la.generalSemanticRange.glosses.join(' / ');
            const generalSrcs = la.generalSemanticRange.sources
                .map(s => `${s.sourceKey} ${cite(s)}`)
                .join('; ');
            const loadingSrcs = la.loadingSources
                .map(s => `${s.sourceKey} ${cite(s)}`)
                .join('; ');
            lines.push(`- ${la.term} (${la.lemma}, "${la.gloss}"):`);
            lines.push(`  general range = [${generalRange}]${generalSrcs ? ` (sources: ${generalSrcs})` : ''}`);
            lines.push(`  verse loading: ${prose(la.verseSpecificLoading)}${loadingSrcs ? ` (sources: ${loadingSrcs})` : ''}`);
        }
    }

    // ── Textual criticism ──────────────────────────────────────────
    lines.push('');
    lines.push('Textual criticism:');
    lines.push(`  ${prose(analysis.textualCriticism.note)}`);
    for (const v of analysis.textualCriticism.variants) {
        lines.push(`- variant: ${v.lemma} → adopted "${v.adoptedReading}"`);
        for (const r of v.readings) {
            lines.push(`    reading "${r.text}" (witnesses: ${r.witnesses.join(', ')})`);
        }
        lines.push(`    rationale: ${prose(v.rationale)}${v.apparatusReference ? ` [${v.apparatusReference}]` : ''}`);
    }

    // ── Historical context ─────────────────────────────────────────
    if (analysis.historicalContext.length > 0) {
        lines.push('');
        lines.push('Historical context:');
        for (const h of analysis.historicalContext) {
            const srcs = h.sources.map(s => `${s.sourceKey} ${cite(s)}`).join('; ');
            lines.push(`- ${h.aspect}: ${prose(h.relevance)}${srcs ? ` (sources: ${srcs})` : ''}`);
        }
    }

    // ── OT links ────────────────────────────────────────────────────
    if (analysis.oldTestamentLinks.length > 0) {
        lines.push('');
        lines.push('OT links:');
        for (const l of analysis.oldTestamentLinks) {
            const formula = l.citationFormula ? ` (formula: ${l.citationFormula})` : '';
            const srcs = l.sources.map(s => `${s.sourceKey} ${cite(s)}`).join('; ');
            lines.push(`- [${l.type}] ${l.sourcePassage}${formula}: ${prose(l.interpretiveBearing)}${srcs ? ` (sources: ${srcs})` : ''}`);
        }
    }

    // ── Commentator positions ──────────────────────────────────────
    if (analysis.commentatorEngagement.length > 0) {
        lines.push('');
        lines.push('Commentator positions:');
        for (const c of analysis.commentatorEngagement) {
            const verbatim = c.verbatimQuote ? ` [verbatim: "${c.verbatimQuote}"]` : '';
            lines.push(`- [${c.role}] ${c.sourceKey} (${cite(c)}): ${prose(c.position)}${verbatim}`);
        }
    }

    // ── Translation cruxes ─────────────────────────────────────────
    if (analysis.translationCruxes.length > 0) {
        lines.push('');
        lines.push('Translation cruxes:');
        for (const cx of analysis.translationCruxes) {
            lines.push(`- "${cx.phrase}": ${prose(cx.description)}`);
            const opts = cx.options
                .map((o, i) => `${i}=${JSON.stringify(o.translation)} (${o.characterization})`)
                .join('; ');
            lines.push(`    options: ${opts}`);
            const positions = cx.commentatorPositions
                .map(p => {
                    const verbatim = p.verbatimQuote?.trim()
                        ? ` [verbatim: "${p.verbatimQuote.trim()}"]`
                        : '';
                    return `${p.sourceKey} ${cite(p)} → opt ${p.supports}: ${prose(p.summary)}${verbatim}`;
                })
                .join(' | ');
            if (positions) lines.push(`    positions: ${positions}`);
            lines.push(`    commitment: "${cx.commitment.chosen}". Rationale: ${prose(cx.commitment.rationale)}`);
        }
    }

    // ── Verse thesis ───────────────────────────────────────────────
    lines.push('');
    lines.push(`Verse thesis: ${prose(analysis.verseThesis)}`);

    // ── Footnote extensions ────────────────────────────────────────
    if (analysis.footnoteExtensions.length > 0) {
        lines.push('');
        lines.push('Footnote extensions:');
        for (const fn of analysis.footnoteExtensions) {
            const srcs = fn.sources.map(s => `${s.sourceKey} ${cite(s)}`).join('; ');
            lines.push(`- anchor: "${fn.anchorPhrase}"`);
            lines.push(`  text: ${prose(fn.text)}${srcs ? ` (sources: ${srcs})` : ''}`);
        }
    }

    // ── Confidence flags ───────────────────────────────────────────
    if (analysis.confidenceFlags.length > 0) {
        lines.push('');
        lines.push('Confidence flags:');
        for (const f of analysis.confidenceFlags) {
            const hedges = f.preferredHedges.join(', ');
            lines.push(`- [${f.level}] ${prose(f.claim)}${hedges ? ` → preferred hedges: ${hedges}` : ''}`);
        }
    }

    // ── Theological hooks ──────────────────────────────────────────
    if (analysis.theologicalHooks.length > 0) {
        const loci = analysis.theologicalHooks
            .map(h => h.locus === 'otro' ? (h.customLocus ?? 'otro') : h.locus)
            .join(', ');
        lines.push('');
        lines.push(`Theological hooks: ${loci}`);
    }

    return lines.join('\n');
}

/**
 * Tipo de página por fuente, leído de las citas estructuradas del análisis.
 *
 * `citationAnchorFor` nunca mezcla las dos formas dentro de una misma fuente,
 * así que la primera cita que declara su tipo lo declara para todas.
 */
function collectPageKinds(analysis: CanonicalVerseAnalysis): Map<string, CitationPageKind> {
    const kinds = new Map<string, CitationPageKind>();
    // El recorrido de los seis sitios vive en `collectAnalysisCitations`. Tenía
    // una copia acá y otra en el script de auditoría, y tres copias de un
    // recorrido son tres oportunidades de olvidar un sitio en una sola.
    for (const c of collectAnalysisCitations(analysis)) {
        if (c.pageKind && !kinds.has(c.sourceKey)) kinds.set(c.sourceKey, c.pageKind);
    }
    return kinds;
}
