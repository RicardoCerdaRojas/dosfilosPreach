import { formatPassageReference } from '../../bible/canon/passage-reference';
import { relabelProsePages } from './relabelProsePages';
import { verseSectionKey } from './verseAnalysisCoverage';
import type {
    CanonicalVerseAnalysis,
    SourceCitation,
    CitationPageKind,
} from '../entities/CanonicalVerseAnalysis';

/**
 * Render de PUBLICACIÓN de un análisis de verso: prosa continua con
 * los dieciocho campos dentro, y sin modelo de por medio.
 *
 * No confundir con `renderCanonicalAnalysisAsMarkdown`, que es un
 * rescate en viñetas para el paso de ensamble cuando todavía no se
 * compuso prosa. Éste va al paper: se usa cuando el compositor
 * publicó el verso incompleto, y entonces manda lo estructurado.
 *
 * Por qué existe: el compositor es un modelo, y un modelo elige qué
 * decir. Medido sobre Santiago 1:1-5, elegía tres de dieciocho campos
 * sin declarar los otros quince. La regla que este archivo materializa
 * es que lo estructurado se renderiza — no se le pide permiso a un
 * modelo para publicar lo que el análisis ya afirmó y el estudiante ya
 * aceptó.
 *
 * Las frases del análisis se reutilizan TAL CUAL. Los campos del
 * `CanonicalVerseAnalysis` ya son prosa —«indica acción anterior al
 * verbo principal del v. 2»—; lo que este render aporta es el orden,
 * la juntura y las citas con su página. Reescribirlas sería volver a
 * poner un redactor donde se acaba de sacar uno.
 *
 * Las notas al pie se rinden EN LÍNEA, entre paréntesis, y no como
 * marcador `[^N]`: la sección se inserta dentro de un paper cuya
 * numeración de notas la lleva el compositor, y meter marcadores
 * propios produciría dos series de números en el mismo documento.
 */
export interface RenderVerseProseOptions {
    /**
     * Rótulo de página. Por defecto `p. {hoja}`, que es lo que el
     * análisis guarda. El compositor pasa el suyo para citar página
     * impresa donde se puede medir y «hoja» donde no.
     */
    pageLabel?: (sourceKey: string, page: number, kind: CitationPageKind) => string;
    /** Claves citables, para reetiquetar también las páginas escritas en prosa. */
    citableKeys?: readonly string[];
    /** Cuando es `false`, se omite el encabezado `### {verso}`. Por defecto lo incluye. */
    includeHeading?: boolean;
}

export function renderVerseAnalysisProse(
    analysis: CanonicalVerseAnalysis,
    language: 'es' | 'en',
    options: RenderVerseProseOptions = {},
): string {
    const en = language === 'en';
    const L = (es: string, eng: string) => (en ? eng : es);
    const pageOf = options.pageLabel
        ?? ((_key: string, value: number, kind: CitationPageKind) =>
            kind === 'printed' ? `p. ${value}` : `hoja ${value}`);
    /** Rotula una cita con el tipo de página que registró el análisis. */
    const cited = (c: { sourceKey: string; page: number; pageKind?: CitationPageKind }) =>
        pageOf(c.sourceKey, c.page, c.pageKind ?? 'sheet');
    const kindBySource = new Map<string, CitationPageKind>();
    for (const c of analysis.commentatorEngagement) {
        if (c.pageKind && !kindBySource.has(c.sourceKey)) kindBySource.set(c.sourceKey, c.pageKind);
    }
    const citableKeys = options.citableKeys ?? [];
    const prose = options.pageLabel && citableKeys.length > 0
        ? (text: string) => relabelProsePages(
            text,
            citableKeys,
            (key, value) => pageOf(key, value, kindBySource.get(key) ?? 'sheet'),
        )
        : (text: string) => text;

    const cite = (sources: readonly SourceCitation[]): string => {
        const rendered = sources
            .map(s => `${s.sourceKey}, ${cited(s)}${s.locator ? `, ${s.locator}` : ''}`)
            .join('; ');
        return rendered ? ` (${rendered})` : '';
    };
    const sentence = (text: string): string => {
        const t = prose(text.trim());
        if (!t) return '';
        return /[.!?»"]$/.test(t) ? t : `${t}.`;
    };

    const paragraphs: string[] = [];
    const ref = formatPassageReference(analysis.reference, language);

    if (options.includeHeading !== false) {
        paragraphs.push(`### ${verseSectionKey(analysis, language)}`);
    }

    // ── Texto, traducción y función en el argumento ────────────────
    const opening: string[] = [];
    if (analysis.greekText.trim()) {
        opening.push(`${ref}: «${analysis.greekText.trim()}»`);
    }
    if (analysis.finalTranslation.trim()) {
        opening.push(L(
            `Este trabajo traduce: «${analysis.finalTranslation.trim()}»`,
            `This paper renders it: «${analysis.finalTranslation.trim()}»`,
        ));
    }
    if (analysis.initialTranslation.trim()
        && analysis.initialTranslation.trim() !== analysis.finalTranslation.trim()) {
        opening.push(L(
            `La traducción de trabajo previa a resolver las cruces decía: «${analysis.initialTranslation.trim()}»`,
            `The working translation prior to resolving the cruxes read: «${analysis.initialTranslation.trim()}»`,
        ));
    }
    if (analysis.argumentativeRole.trim()) {
        opening.push(sentence(analysis.argumentativeRole));
    }
    if (opening.length > 0) paragraphs.push(opening.join('. ').replace(/\.\./g, '.'));

    // ── Crítica textual ────────────────────────────────────────────
    const textual: string[] = [];
    if (analysis.textualCriticism.note.trim()) {
        textual.push(sentence(analysis.textualCriticism.note));
    }
    for (const v of analysis.textualCriticism.variants) {
        const readings = v.readings
            .map(r => `«${r.text}»${r.witnesses.length > 0 ? ` (${r.witnesses.join(', ')})` : ''}`)
            .join(L(' frente a ', ' against '));
        const apparatus = v.apparatusReference ? ` [${v.apparatusReference}]` : '';
        textual.push(L(
            `En «${v.lemma}» el aparato ofrece ${readings}; se adopta «${v.adoptedReading}»${apparatus}. ${sentence(v.rationale)}`,
            `At «${v.lemma}» the apparatus offers ${readings}; this paper adopts «${v.adoptedReading}»${apparatus}. ${sentence(v.rationale)}`,
        ));
    }
    if (textual.length > 0) paragraphs.push(textual.join(' '));

    // ── Sintaxis y morfología ──────────────────────────────────────
    const syntax: string[] = [];
    const mainVerb = analysis.syntacticAnalysis.mainVerb;
    if (mainVerb) {
        syntax.push(L(
            `El verbo principal es «${mainVerb.text}» (${mainVerb.morphology}), que funciona como ${mainVerb.syntacticFunction}. ${sentence(mainVerb.interpretiveSignificance)}`,
            `The main verb is «${mainVerb.text}» (${mainVerb.morphology}), functioning as ${mainVerb.syntacticFunction}. ${sentence(mainVerb.interpretiveSignificance)}`,
        ));
    } else if (analysis.syntacticAnalysis.mainVerbNote?.trim()) {
        syntax.push(sentence(analysis.syntacticAnalysis.mainVerbNote));
    }
    for (const kc of analysis.syntacticAnalysis.keyConstructions) {
        syntax.push(L(
            `«${kc.text}» (${kc.morphology}) opera como ${kc.syntacticFunction}. ${sentence(kc.interpretiveSignificance)}`,
            `«${kc.text}» (${kc.morphology}) operates as ${kc.syntacticFunction}. ${sentence(kc.interpretiveSignificance)}`,
        ));
    }
    if (syntax.length > 0) paragraphs.push(syntax.join(' '));

    // ── Partículas de discurso ─────────────────────────────────────
    const particles = analysis.syntacticAnalysis.discourseParticles.map(p => L(
        `La partícula «${p.particle}» funciona como ${p.function}. ${sentence(p.note)}`,
        `The particle «${p.particle}» functions as ${p.function}. ${sentence(p.note)}`,
    ));
    if (particles.length > 0) paragraphs.push(particles.join(' '));

    // ── Léxico ─────────────────────────────────────────────────────
    for (const lex of analysis.lexicalAnalyses) {
        const range = lex.generalSemanticRange.glosses.join(' / ');
        const parts: string[] = [];
        parts.push(L(
            `«${lex.term}» (${lex.lemma}, «${lex.gloss}») cubre en el uso neotestamentario el rango ${range}${cite(lex.generalSemanticRange.sources)}`,
            `«${lex.term}» (${lex.lemma}, «${lex.gloss}») carries across NT usage the range ${range}${cite(lex.generalSemanticRange.sources)}`,
        ));
        parts.push(L(
            `Carga en este verso: ${sentence(lex.verseSpecificLoading)}${cite(lex.loadingSources)}`,
            `Loading in this verse: ${sentence(lex.verseSpecificLoading)}${cite(lex.loadingSources)}`,
        ));
        paragraphs.push(`${parts.join('. ').replace(/\.\./g, '.')}.`.replace(/\.\.$/, '.'));
    }

    // ── Contexto histórico-cultural ────────────────────────────────
    const historical = analysis.historicalContext.map(h => L(
        `Sobre ${h.aspect}: ${sentence(h.relevance)}${cite(h.sources)}`,
        `On ${h.aspect}: ${sentence(h.relevance)}${cite(h.sources)}`,
    ));
    if (historical.length > 0) paragraphs.push(historical.join(' '));

    // ── Intertextualidad veterotestamentaria ───────────────────────
    const otLabel = (type: 'quotation' | 'allusion' | 'echo'): string => {
        if (en) return type === 'quotation' ? 'quotation of' : type === 'allusion' ? 'allusion to' : 'echo of';
        return type === 'quotation' ? 'cita de' : type === 'allusion' ? 'alusión a' : 'eco de';
    };
    const otLinks = analysis.oldTestamentLinks.map(l => {
        const formula = l.citationFormula?.trim()
            ? L(` con la fórmula «${l.citationFormula.trim()}»`, ` with the formula «${l.citationFormula.trim()}»`)
            : '';
        return L(
            `El verso presenta una ${otLabel(l.type)} ${l.sourcePassage}${formula}. ${sentence(l.interpretiveBearing)}${cite(l.sources)}`,
            `The verse presents a ${otLabel(l.type)} ${l.sourcePassage}${formula}. ${sentence(l.interpretiveBearing)}${cite(l.sources)}`,
        );
    });
    if (otLinks.length > 0) paragraphs.push(otLinks.join(' '));

    // ── Diálogo con los comentaristas ──────────────────────────────
    const commentators = analysis.commentatorEngagement.map(c => {
        const quote = c.verbatimQuote?.trim()
            ? L(` Escribe: «${c.verbatimQuote.trim()}»`, ` He writes: «${c.verbatimQuote.trim()}»`)
            : '';
        return `${c.sourceKey} (${cited(c)}) ${sentence(c.position)}${quote}`;
    });
    if (commentators.length > 0) paragraphs.push(commentators.join(' '));

    // ── Cruces de traducción ───────────────────────────────────────
    for (const cx of analysis.translationCruxes) {
        const parts: string[] = [];
        parts.push(L(
            `La traducción de «${cx.phrase}» está en disputa. ${sentence(cx.description)}`,
            `The rendering of «${cx.phrase}» is contested. ${sentence(cx.description)}`,
        ));
        if (cx.options.length > 0) {
            const opts = cx.options
                .map(o => `«${o.translation}» (${o.characterization})`)
                .join(L('; frente a ', '; against '));
            parts.push(L(`Las opciones sobre la mesa son ${opts}.`, `The options on the table are ${opts}.`));
        }
        for (const p of cx.commentatorPositions) {
            const supported = cx.options[p.supports]?.translation;
            const forOption = supported
                ? L(` a favor de «${supported}»`, ` in favor of «${supported}»`)
                : '';
            const quote = p.verbatimQuote?.trim() ? ` «${p.verbatimQuote.trim()}»` : '';
            parts.push(`${p.sourceKey} (${cited(p)}) ${sentence(p.summary)}${forOption}${quote}`.replace(/\.\s*$/, '.'));
        }
        parts.push(L(
            `Por esta razón, en este trabajo se adopta la traducción «${cx.commitment.chosen}»: ${sentence(cx.commitment.rationale)}`,
            `For this reason, this paper adopts the rendering «${cx.commitment.chosen}»: ${sentence(cx.commitment.rationale)}`,
        ));
        paragraphs.push(parts.join(' '));
    }

    // ── Extensiones que irían a nota al pie ────────────────────────
    const footnotes = analysis.footnoteExtensions.map(fn => L(
        `Sobre «${fn.anchorPhrase}»: ${sentence(fn.text)}${cite(fn.sources)}`,
        `On «${fn.anchorPhrase}»: ${sentence(fn.text)}${cite(fn.sources)}`,
    ));
    if (footnotes.length > 0) paragraphs.push(footnotes.join(' '));

    // ── Síntesis ───────────────────────────────────────────────────
    if (analysis.verseThesis.trim()) {
        paragraphs.push(L(
            `En conclusión: ${sentence(analysis.verseThesis)}`,
            `In conclusion: ${sentence(analysis.verseThesis)}`,
        ));
    }

    return paragraphs.join('\n\n');
}
