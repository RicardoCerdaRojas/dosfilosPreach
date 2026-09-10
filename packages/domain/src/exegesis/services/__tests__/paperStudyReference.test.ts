import { describe, it, expect } from 'vitest';
import {
    buildPaperStudyReference,
    paperHasStudyMaterial,
    PAPER_FED_STEP_KEYS,
} from '../paperStudyReference';
import { buildEmptyCanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import { EMPTY_STEP_SOURCE_PLAN } from '../../entities/StepSourcePlan';
import type { CanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import type { ExegeticalPaper } from '../../entities/ExegeticalPaper';
import type { ExegeticalStep, ExegeticalStepVersion } from '../../entities/ExegeticalStep';
import type { ProjectSource } from '../../entities/ProjectSource';
import type { PassageReference } from '../../../bible/canon/passage-reference';

const NOW = new Date('2026-01-01T00:00:00Z');

function makeAnalysis(
    verse: number,
    overrides: Partial<CanonicalVerseAnalysis> = {},
): CanonicalVerseAnalysis {
    const ref: PassageReference = {
        bookId: 'JAS',
        chapterStart: 1,
        chapterEnd: 1,
        verseStart: verse,
        verseEnd: verse,
    };
    return { ...buildEmptyCanonicalVerseAnalysis(ref), ...overrides };
}

function makeVersion(analysis: CanonicalVerseAnalysis | null, id: string): ExegeticalStepVersion | null {
    if (!analysis) return null;
    return {
        id,
        markdown: '',
        origin: 'generated',
        parentVersionId: null,
        createdAt: NOW,
        canonicalAnalysis: analysis,
    } as ExegeticalStepVersion;
}

function makeStep(
    order: number,
    analysis: CanonicalVerseAnalysis | null,
    overrides: Partial<ExegeticalStep> = {},
): ExegeticalStep {
    const accepted = makeVersion(analysis, `v-${order}`);
    return {
        id: `step-${order}`,
        paperId: 'paper-1',
        kind: 'verse',
        verseRef: analysis ? analysis.reference : null,
        order,
        state: accepted ? 'accepted' : 'pending',
        current: accepted,
        accepted,
        versions: accepted ? [accepted] : [],
        createdAt: NOW,
        updatedAt: NOW,
        ...overrides,
    };
}

function makeSource(displayLabel: string, citationKey: string | null): ProjectSource {
    return {
        id: `src-${citationKey ?? displayLabel}`,
        paperId: 'paper-1',
        corpusId: 'corpus-1',
        sourceType: 'commentary-critical',
        displayLabel,
        citationKey,
        order: 0,
        mode: 'full-document',
        excerptSelectionMode: null,
        excerptRecipe: null,
        excerpts: [],
        sourceLibraryResourceId: null,
        extractedAt: null,
        extractionFingerprint: null,
        createdAt: NOW,
    };
}

function makePaper(overrides: Partial<ExegeticalPaper> = {}): ExegeticalPaper {
    return {
        id: 'paper-1',
        ownerId: 'owner-1',
        createdAt: NOW,
        updatedAt: NOW,
        passage: { bookId: 'JAS', chapterStart: 1, chapterEnd: 1, verseStart: 1, verseEnd: 5 },
        displayLanguage: 'es',
        assignmentBrief: null,
        styleGuideId: null,
        sources: [],
        rubric: null,
        stepPlan: EMPTY_STEP_SOURCE_PLAN,
        phase: 'in-progress',
        steps: [],
        currentStepId: null,
        assembledMarkdown: null,
        archivedAt: null,
        ...overrides,
    };
}

describe('buildPaperStudyReference', () => {
    it('deja los tres pasos de voz del pastor SIEMPRE vacíos', () => {
        // La garantía central del módulo. `function`, `timelessPrinciple`
        // e `insight` son el trabajo interpretativo y pastoral del
        // predicador — `insight` contiene además los cinco campos
        // prohibidos para el asistente. Un paper riquísimo no debe
        // filtrar ni un ítem ahí.
        const analysis = makeAnalysis(2, {
            originalText: 'Πᾶσαν χαρὰν ἡγήσασθε',
            finalTranslation: 'Tenedlo por sumo gozo',
            argumentativeRole: 'Abre la sección sobre la prueba.',
            verseThesis: 'El gozo es un juicio, no un sentimiento.',
            historicalContext: [
                { aspect: 'honor-vergüenza', relevance: 'La prueba pública define el estatus.', sources: [] },
            ],
            lexicalAnalyses: [
                {
                    term: 'χαρὰν',
                    lemma: 'χαρά',
                    gloss: 'gozo',
                    generalSemanticRange: { glosses: ['gozo', 'alegría'], sources: [] },
                    verseSpecificLoading: 'El imperativo fuerza la lectura volitiva.',
                    loadingSources: [],
                },
            ],
            commentatorEngagement: [
                { sourceKey: 'Moo', page: 54, role: 'anchor', position: 'Lee el gozo como decisión.' },
            ],
            oldTestamentLinks: [
                {
                    type: 'echo',
                    sourcePassage: 'Proverbios 3:11-12',
                    interpretiveBearing: 'La disciplina como cuidado paterno.',
                    sources: [],
                },
            ],
        });

        const ref = buildPaperStudyReference(makePaper({ steps: [makeStep(1, analysis)] }));

        expect(ref.totalItems).toBeGreaterThan(0);
        expect(ref.byStep.function).toBeUndefined();
        expect(ref.byStep.timelessPrinciple).toBeUndefined();
        expect(ref.byStep.insight).toBeUndefined();
        // Y lo que sí alimenta está declarado, no implícito.
        for (const key of Object.keys(ref.byStep)) {
            expect(PAPER_FED_STEP_KEYS).toContain(key);
        }
    });

    it('reparte cada hallazgo al paso que le corresponde', () => {
        const analysis = makeAnalysis(2, {
            originalText: 'Πᾶσαν χαρὰν ἡγήσασθε',
            finalTranslation: 'Tenedlo por sumo gozo',
            historicalContext: [
                { aspect: 'honor-vergüenza', relevance: 'La prueba define estatus.', sources: [] },
            ],
            syntacticAnalysis: {
                mainVerb: {
                    text: 'ἡγήσασθε',
                    morphology: 'aoristo imperativo medio, 2a plural',
                    syntacticFunction: 'verbo principal',
                    interpretiveSignificance: 'Manda un juicio deliberado.',
                },
                keyConstructions: [],
                discourseParticles: [
                    { particle: 'δέ', function: 'marcador de desarrollo', note: 'Avanza el argumento.' },
                ],
            },
            lexicalAnalyses: [
                {
                    term: 'χαρὰν',
                    lemma: 'χαρά',
                    gloss: 'gozo',
                    generalSemanticRange: { glosses: ['gozo', 'alegría'], sources: [] },
                    verseSpecificLoading: 'El imperativo fuerza la lectura volitiva.',
                    loadingSources: [],
                },
            ],
            commentatorEngagement: [
                { sourceKey: 'Moo', page: 54, role: 'anchor', position: 'Lee el gozo como decisión.' },
            ],
        });

        const ref = buildPaperStudyReference(
            makePaper({
                steps: [makeStep(1, analysis)],
                sources: [makeSource('Moo, Santiago (NICNT)', 'Moo')],
            }),
        );

        expect(ref.byStep.reading?.map(i => i.detail)).toContain('Tenedlo por sumo gozo');
        expect(ref.byStep.contextGenre?.[0]?.label).toBe('honor-vergüenza');
        expect(ref.byStep.structuralAnalysis?.map(i => i.label)).toEqual([
            'Verbo principal: ἡγήσασθε',
            'δέ — marcador de desarrollo',
        ]);
        expect(ref.byStep.wordStudies?.[0]?.label).toBe('χαρὰν (χαρά)');
        expect(ref.byStep.wordStudies?.[0]?.detail).toContain('El imperativo fuerza la lectura volitiva.');
        // La clave de cita se resuelve al nombre de la obra: el pastor
        // reconoce "Moo, Santiago (NICNT)", no la clave suelta.
        expect(ref.byStep.recognition?.[0]?.label).toBe('Moo, Santiago (NICNT), p. 54');
    });

    it('cae a la clave cruda cuando la fuente ya no está en el paper', () => {
        const analysis = makeAnalysis(2, {
            commentatorEngagement: [
                { sourceKey: 'Adamson', page: 12, role: 'contrast', position: 'Disiente.' },
            ],
        });
        const ref = buildPaperStudyReference(makePaper({ steps: [makeStep(1, analysis)] }));

        // Mejor una clave que un hueco: el pastor puede rastrearla.
        expect(ref.byStep.recognition?.[0]?.label).toBe('Adamson, p. 12');
    });

    it('ignora lo generado que el pastor todavía no aceptó', () => {
        // La distinción es el punto entero: evidencia es lo confirmado.
        const analysis = makeAnalysis(2, { finalTranslation: 'Borrador sin revisar' });
        const pending = makeStep(1, null);
        pending.current = makeVersion(analysis, 'v-pending');
        pending.state = 'awaiting-review';

        const paper = makePaper({ steps: [pending] });

        expect(buildPaperStudyReference(paper).totalItems).toBe(0);
        expect(paperHasStudyMaterial(paper)).toBe(false);
    });

    it('sobrevive a papers sin análisis canónico (legacy / estrategia libre)', () => {
        const legacy = makeStep(1, null);
        legacy.accepted = {
            id: 'v-legacy',
            markdown: '## Prosa suelta',
            origin: 'generated',
            parentVersionId: null,
            createdAt: NOW,
        } as ExegeticalStepVersion;
        legacy.state = 'accepted';

        const paper = makePaper({ steps: [legacy] });
        const ref = buildPaperStudyReference(paper);

        expect(ref.totalItems).toBe(0);
        expect(ref.analyzedVerses).toEqual([]);
        expect(paperHasStudyMaterial(paper)).toBe(false);
        // Sigue identificando el paper: el estudio se abre igual.
        expect(ref.passageLabel).toBe('Santiago 1:1-5');
    });

    it('solo mira los pasos de verso, no la introducción ni la conclusión', () => {
        const analysis = makeAnalysis(2, { finalTranslation: 'Tenedlo por sumo gozo' });
        const intro = makeStep(1, analysis, { kind: 'introduction' });

        expect(buildPaperStudyReference(makePaper({ steps: [intro] })).totalItems).toBe(0);
    });

    it('nombra el paper por su título y registra los versos analizados', () => {
        const paper = makePaper({
            title: 'Santiago y la prueba',
            assignmentBrief: 'Argumentar que el gozo es volitivo.',
            steps: [
                makeStep(1, makeAnalysis(2, { finalTranslation: 'Tenedlo por sumo gozo' })),
                makeStep(2, makeAnalysis(3, { finalTranslation: 'sabiendo que la prueba' })),
            ],
        });
        const ref = buildPaperStudyReference(paper);

        expect(ref.paperTitle).toBe('Santiago y la prueba');
        expect(ref.assignmentBrief).toBe('Argumentar que el gozo es volitivo.');
        expect(ref.analyzedVerses).toEqual(['Santiago 1:2', 'Santiago 1:3']);
        expect(paperHasStudyMaterial(paper)).toBe(true);
    });
});
