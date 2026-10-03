import { describe, it, expect } from 'vitest';
import { buildPaperStudyReference } from '../paperStudyReference';
import { buildEmptyCanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import { EMPTY_STEP_SOURCE_PLAN } from '../../entities/StepSourcePlan';
import { languageForPassage } from '../../../bible/inferLanguageFromBook';
import type { CanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import type { ExegeticalPaper } from '../../entities/ExegeticalPaper';
import type { ExegeticalStep } from '../../entities/ExegeticalStep';
import type { BibleBookId } from '../../../bible/canon/BibleCanon';

/**
 * El estudio de palabras desde el paper (ejercicio de Jonás 4:5-11, #28 y #29).
 *
 * En Jonás el paso arrancaba en «Griego» y la palabra del paper no se podía
 * llevar al estudio: había que copiarla a mano. La tarjeta trae ahora lo
 * necesario para empezar el estudio, con la explicación ENTERA para que el
 * pastor la adapte (decisión del fundador: «la idea de tomar el texto del
 * estudio es reutilizar partes. No lo cortes»).
 */
const NOW = new Date('2026-01-01T00:00:00Z');

function paperCon(bookId: BibleBookId, analysis: Partial<CanonicalVerseAnalysis>): ExegeticalPaper {
    const ref = { bookId, chapterStart: 4, chapterEnd: 4, verseStart: 6, verseEnd: 6 };
    const a = { ...buildEmptyCanonicalVerseAnalysis(ref), ...analysis };
    const v = { id: 'v', markdown: '', origin: 'generated', parentVersionId: null, createdAt: NOW, canonicalAnalysis: a };
    const step = {
        id: 's', paperId: 'p', kind: 'verse', verseRef: ref, order: 1, state: 'accepted',
        current: v, accepted: v, versions: [v], createdAt: NOW, updatedAt: NOW,
    } as unknown as ExegeticalStep;
    return {
        id: 'p', ownerId: 'o', createdAt: NOW, updatedAt: NOW, passage: ref, displayLanguage: 'es',
        assignmentBrief: null, styleGuideId: null, sources: [], rubric: null, stepPlan: EMPTY_STEP_SOURCE_PLAN,
        phase: 'in-progress', steps: [step], currentStepId: null, assembledMarkdown: null, archivedAt: null,
    } as ExegeticalPaper;
}

const LARGA = 'El verbo describe una provisión deliberada de Dios, no un accidente: '.repeat(6).trim();

const qiqayon = {
    term: 'קִיקָיוֹן', lemma: 'קִיקָיוֹן', gloss: 'planta de ricino',
    generalSemanticRange: { glosses: ['ricino', 'calabacera'], sources: [] },
    verseSpecificLoading: LARGA, loadingSources: [],
};

describe('la palabra del paper trae su semilla de estudio', () => {
    it('en Jonás va en hebreo, con el versículo y la explicación entera', () => {
        const ref = buildPaperStudyReference(paperCon('JON', { lexicalAnalyses: [qiqayon] }));
        const item = ref.byStep.wordStudies![0]!;
        expect(item.wordStudySeed).toEqual({
            word: 'קִיקָיוֹן',
            lemma: 'קִיקָיוֹן',
            reference: item.verseLabel,
            language: 'hebrew',
            explanation: item.detail,
        });
        // Sin recortar: la explicación larga llega completa.
        expect(item.wordStudySeed!.explanation).toContain(LARGA);
    });

    it('en Santiago va en griego', () => {
        const ref = buildPaperStudyReference(paperCon('JAS', {
            lexicalAnalyses: [{ ...qiqayon, term: 'χαρὰν', lemma: 'χαρά' }],
        }));
        expect(ref.byStep.wordStudies![0]!.wordStudySeed!.language).toBe('greek');
    });

    it('sólo el estudio de palabras trae semilla', () => {
        const ref = buildPaperStudyReference(paperCon('JON', {
            lexicalAnalyses: [qiqayon],
            finalTranslation: 'Y preparó Jehová Dios una calabacera',
        }));
        expect(ref.byStep.reading!.every(i => !i.wordStudySeed)).toBe(true);
    });
});

describe('languageForPassage', () => {
    it.each([
        ['Jonás 4:5-11', 'hebrew'],
        ['Santiago 1:2-4', 'greek'],
        ['Rut 1:7', 'hebrew'],
        ['Romanos 8:4', 'greek'],
        ['Jonah 4', 'hebrew'],
    ])('%s → %s', (pasaje, lengua) => {
        expect(languageForPassage(pasaje)).toBe(lengua);
    });
});
