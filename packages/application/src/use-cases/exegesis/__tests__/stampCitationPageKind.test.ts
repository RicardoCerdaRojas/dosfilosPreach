import { describe, it, expect } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis } from '@dosfilos/domain';
import type { CanonicalVerseAnalysis, PageNumbering, ProjectSource } from '@dosfilos/domain';
import { stampCitationPageKind } from '../stampCitationPageKind';

const fuente = (id: string, citationKey: string): ProjectSource =>
    ({ id, citationKey } as ProjectSource);

const analisis = (sourceKey: string): CanonicalVerseAnalysis => ({
    ...buildEmptyCanonicalVerseAnalysis({ bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 1, verseEnd: 1 }),
    commentatorEngagement: [{ sourceKey, page: 54, role: 'contrast', position: 'x' }],
} as CanonicalVerseAnalysis);

const kindDe = (a: CanonicalVerseAnalysis) =>
    (a.commentatorEngagement[0] as { pageKind?: string }).pageKind;

describe('stampCitationPageKind', () => {
    it('un libro cuya numeración no resuelve NINGUNA página se sella como hoja', () => {
        // La «Gramática Griega»: un solo tramo, hojas 1-711, `offset: null`.
        // El objeto de numeración existe, así que preguntar por su verdad
        // —que es lo que se preguntaba— la sellaba «printed», afirmando
        // página impresa sobre un número que nadie podía comprobar.
        const numbering: PageNumbering = {
            segments: [{ fromSheet: 1, toSheet: 711, offset: null }],
            origin: 'confirmed',
        };
        const out = stampCitationPageKind(
            analisis('Wallace'),
            [fuente('w1', 'Wallace')],
            new Map([['w1', numbering]]),
        );
        expect(kindDe(out)).toBe('sheet');
    });

    it('basta un tramo que resuelva para sellar página impresa', () => {
        const numbering: PageNumbering = {
            segments: [
                { fromSheet: 1, toSheet: 18, offset: null },
                { fromSheet: 19, toSheet: 278, offset: -18, style: 'roman' },
                { fromSheet: 279, toSheet: 540, offset: -278 },
            ],
            origin: 'confirmed',
        };
        const out = stampCitationPageKind(
            analisis('Mayor'),
            [fuente('m1', 'Mayor')],
            new Map([['m1', numbering]]),
        );
        expect(kindDe(out)).toBe('printed');
    });

    it('un desfase de cero es un desfase: Porter se cita por página', () => {
        const out = stampCitationPageKind(
            analisis('Porter'),
            [fuente('p1', 'Porter')],
            new Map([['p1', { segments: [{ fromSheet: 1, toSheet: 339, offset: 0 }], origin: 'confirmed' }]]),
        );
        expect(kindDe(out)).toBe('printed');
    });

    it('sin numeración guardada, hoja', () => {
        const out = stampCitationPageKind(
            analisis('Sin'),
            [fuente('s1', 'Sin')],
            new Map([['s1', null]]),
        );
        expect(kindDe(out)).toBe('sheet');
    });
});
