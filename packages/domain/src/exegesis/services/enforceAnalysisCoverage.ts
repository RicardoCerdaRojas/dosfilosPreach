import type { CanonicalVerseAnalysis, CitationPageKind } from '../entities/CanonicalVerseAnalysis';
import type { CompositionCoverage } from '../ports/IAcademicComposer';
import { replaceVerseSectionBodies } from './composedVerseSections';
import { renderVerseAnalysisProse } from './renderVerseAnalysisProse';
import {
    buildVerseCoverageContract,
    findUncoveredItems,
    verseSectionKey,
    type AnalysisCoverageItem,
} from './verseAnalysisCoverage';

/**
 * Hace valer, sobre el paper ya compuesto, que lo estructurado se
 * publica.
 *
 * El compositor escribe la prosa; esto comprueba verso por verso que
 * la prosa diga lo que el análisis afirmó, y publica con el render
 * determinista el verso que salió incompleto. El verso que salió
 * entero conserva la prosa del modelo: se cambia por sección completa
 * y nunca por mitades, para que el paper no quede con dos voces
 * cosidas dentro del mismo párrafo.
 *
 * Función pura. El caso de uso la llama después del compositor y
 * antes del formateador de estilo, que es idempotente y trabaja igual
 * sobre prosa del modelo que sobre prosa renderizada.
 */
export interface EnforceAnalysisCoverageInput {
    /** El paper tal como lo entregó el compositor. */
    markdown: string;
    /** Los análisis aceptados, en orden canónico. */
    verseAnalyses: ReadonlyArray<CanonicalVerseAnalysis>;
    language: 'es' | 'en';
    /** Mismo rótulo de página que recibió el compositor. */
    pageLabel?: (sourceKey: string, page: number, kind: CitationPageKind) => string;
    citableKeys?: readonly string[];
}

export function enforceAnalysisCoverage(
    input: EnforceAnalysisCoverageInput,
): { markdown: string; coverage: CompositionCoverage } {
    const { markdown, verseAnalyses, language } = input;
    const renderOptions = {
        pageLabel: input.pageLabel,
        citableKeys: input.citableKeys,
        includeHeading: false,
    };

    const verses = verseAnalyses.map(analysis => ({
        analysis,
        key: verseSectionKey(analysis, language),
        items: buildVerseCoverageContract(analysis, language),
    }));
    const totalItems = verses.reduce((n, v) => n + v.items.length, 0);

    const empty: CompositionCoverage = {
        totalItems,
        composedItems: totalItems,
        renderedVerses: [],
        recoveredItemLabels: [],
        sectioningFailed: false,
    };
    if (totalItems === 0) return { markdown, coverage: empty };

    // ── Camino normal: se pudo trocear por verso ───────────────────
    const uncoveredByKey = new Map<string, AnalysisCoverageItem[]>();
    const rewritten = replaceVerseSectionBodies(
        markdown,
        verses.map(v => v.key),
        (key, body) => {
            const verse = verses.find(v => v.key === key)!;
            const uncovered = findUncoveredItems(body, verse.items);
            if (uncovered.length === 0) return null;
            uncoveredByKey.set(key, uncovered);
            return renderVerseAnalysisProse(verse.analysis, language, renderOptions);
        },
    );

    if (rewritten !== null) {
        const recovered = [...uncoveredByKey.values()].flat();
        return {
            markdown: rewritten,
            coverage: {
                totalItems,
                composedItems: totalItems - recovered.length,
                renderedVerses: [...uncoveredByKey.keys()],
                recoveredItemLabels: recovered.map(i => i.label),
                sectioningFailed: false,
            },
        };
    }

    // ── El paper no trae los encabezados del contrato ──────────────
    // Sin secciones no se puede reemplazar en su lugar sin arriesgar
    // un paper con dos versiones del mismo verso. Se mide contra el
    // documento entero y lo que falte se publica como apéndice: menos
    // elegante que la sustitución, y aun así el análisis llega. Que el
    // troceo falló se declara — no se disimula.
    const missingVerses = verses
        .map(v => ({ ...v, uncovered: findUncoveredItems(markdown, v.items) }))
        .filter(v => v.uncovered.length > 0);

    if (missingVerses.length === 0) {
        return { markdown, coverage: { ...empty, sectioningFailed: true } };
    }

    const heading = language === 'en'
        ? '## Analysis not incorporated into the composed prose'
        : '## Análisis no incorporado a la prosa compuesta';
    const appendix = missingVerses
        .map(v => [
            `### ${v.key}`,
            renderVerseAnalysisProse(v.analysis, language, renderOptions),
        ].join('\n\n'))
        .join('\n\n');
    const recovered = missingVerses.flatMap(v => v.uncovered);

    return {
        markdown: `${markdown.trimEnd()}\n\n${heading}\n\n${appendix}\n`,
        coverage: {
            totalItems,
            composedItems: totalItems - recovered.length,
            renderedVerses: missingVerses.map(v => v.key),
            recoveredItemLabels: recovered.map(i => i.label),
            sectioningFailed: true,
        },
    };
}
