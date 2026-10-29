import { describe, it, expect } from 'vitest';
import type { CanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import type { VerifiedCitation } from '../../entities/CitationVerification';
import { buildEmptyCanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import { availableCitationLabel, availableCitations, citationsNamedIn, reviewNotesForReviewer, withoutInventedCitations } from '../proseReviewerContext';

/** TP #9 (Santiago 4:14, 2026-10-28), leído en producción. */
const REF = { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 14, verseEnd: 14 } as const;
const CLAVES = ['Wallace', 'Robertson', 'Tuggy', 'McCartney', 'Varner', 'Ropes', 'NA28'];
const analisis = {
    ...buildEmptyCanonicalVerseAnalysis(REF as never),
    questionAnswers: [{
        questionNumber: 2, directAnswer: 'x', options: [], decision: 'Se prefiere «No saben lo que traerá el mañana…»',
        decisiveCriterion: {
            text: 'La presencia de τὸ permite reconocer τὸ τῆς αὔριον como objeto sustantivado completo antes de ποία.',
            whyThisOverThat: 'x',
            sources: [{ sourceKey: 'Wallace', page: 236, pageKind: 'printed' }, { sourceKey: 'Robertson', page: 767, pageKind: 'printed' }],
        },
    }],
} as unknown as CanonicalVerseAnalysis;
const NOTA = 'Robertson p. 767 no dice que τό permita reconocer un objeto completo: esa inferencia es del análisis. Robertson registra τὰ τῆς αὔριον como lectura del margen de W-H y, en la p. 961, cita el versículo sin τό. NA28 (p. 693) marca τὸ con ♦. El criterio no decide; se corrige en la prosa.';
const REVISIONES = [{ path: 'questionAnswers[0].decisiveCriterion.sources[1]', note: NOTA }];
const PROSA = 'El relativo οἵτινες tiene aquí valor concesivo (Wallace, 663; Robertson, 961). Tuggy clasifica ζωή como «vida física o natural» (Tuggy, 413).';

describe('las notas de revisión manual, legibles para el revisor (B39)', () => {
    it('la ruta se vuelve cita y pregunta', () => {
        expect(reviewNotesForReviewer(analisis, [], REVISIONES, 'es')).toEqual([
            { citation: 'Robertson, p. 767 (pregunta 2, criterio decisivo)', note: NOTA, questionNumber: 2 },
        ]);
    });

    it('una cita de la prosa se nombra por su veredicto; una nota vacía no va', () => {
        const v = { raw: '(Tuggy, 413)', author: 'Tuggy', title: '', pages: '413', offset: 120, origin: 'prose', status: 'not-found' } as unknown as VerifiedCitation;
        expect(reviewNotesForReviewer(analisis, [v], [{ path: 'prosa@120', note: 'Está en la 413.' }, { path: 'x', note: '  ' }], 'es'))
            .toEqual([{ citation: 'Tuggy, 413 (en la prosa)', note: 'Está en la 413.' }]);
    });
});

describe('la cita que el revisor inventó (B40)', () => {
    const notas = reviewNotesForReviewer(analisis, [], REVISIONES, 'es');
    const disponibles = availableCitations(analisis, PROSA, notas, CLAVES);
    const hallazgo = (problem: string, fix = '') => ({ criterion: 9, quote: '', problem, fix });

    it('lee las citas nombradas en texto libre', () => {
        expect(citationsNamedIn('Falta la referencia a Wallace, p. 961.', CLAVES)).toEqual([{ key: 'Wallace', pages: '961' }]);
        expect(citationsNamedIn('como en la p. 574 de Robertson', CLAVES)).toEqual([{ key: 'Robertson', pages: '574' }]);
        expect(citationsNamedIn('Robertson en 4:14 y Tuggy (p. 90)', CLAVES)).toEqual([{ key: 'Tuggy', pages: '90' }]);
    });

    it('«Falta la referencia a Wallace, p. 961» se descarta: 961 es de Robertson', () => {
        const f = [
            hallazgo('Falta la referencia a Wallace, p. 961.', 'Agregar (Wallace, 961).'),
            hallazgo('La prosa no sigue al análisis en el criterio de τό: ¿es a propósito?'),
            hallazgo('Conviene decir cómo clasifica Robertson, p. 961 el relativo.'),
            hallazgo('El análisis cita Wallace, p. 236 y la prosa no.'),
            hallazgo('NA28 (p. 693) marca τό: dilo.'),
        ];
        expect(withoutInventedCitations(f, disponibles, CLAVES).map(x => x.problem)).toEqual([
            'La prosa no sigue al análisis en el criterio de τό: ¿es a propósito?',
            'Conviene decir cómo clasifica Robertson, p. 961 el relativo.',
            'El análisis cita Wallace, p. 236 y la prosa no.',
            'NA28 (p. 693) marca τό: dilo.',
        ]);
    });
});

describe('lo que no es una cita, y las hojas (revisión de B40)', () => {
    it('un año sin «p.» y un número suelto tras el autor no son citas', () => {
        expect(citationsNamedIn('Como dice (Wallace, 1996), y Wallace 3 veces lo repite.', CLAVES)).toEqual([]);
        // Con «p.» sí, aunque parezca un año; y la forma «Wallace p. 961» también.
        expect(citationsNamedIn('Wallace, p. 1996 y Wallace p. 961', CLAVES)).toEqual([{ key: 'Wallace', pages: '1996' }, { key: 'Wallace', pages: '961' }]);
    });

    it('esas observaciones no se descartan por una cita que no es', () => {
        const f = [{ criterion: 9, quote: '', problem: 'Wallace (1996) clasifica el artículo; Wallace 3 veces lo repite.', fix: '' }];
        expect(withoutInventedCitations(f, [], CLAVES)).toEqual(f);
    });

    it('una cita del análisis en hoja se nombra como hoja', () => {
        const a = { ...analisis, commentatorEngagement: [{ commentator: 'Ropes', sourceKey: 'Ropes', page: 12, pageKind: 'sheet', position: 'x', evaluation: '' }] } as unknown as CanonicalVerseAnalysis;
        const disponibles = availableCitations(a, 'Así (Varner, hoja 40).', [], CLAVES);
        const rotulos = disponibles.map(c => availableCitationLabel(c, 'es'));
        expect(rotulos).toContain('Ropes, hoja 12');
        expect(rotulos).toContain('Varner, hoja 40');
        expect(rotulos).toContain('Wallace, p. 236');
        expect(availableCitationLabel({ key: 'Ropes', pages: '12', kind: 'sheet' }, 'en')).toBe('Ropes, sheet 12');
    });
});

