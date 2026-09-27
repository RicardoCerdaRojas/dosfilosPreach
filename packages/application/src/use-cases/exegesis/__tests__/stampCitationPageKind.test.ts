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

/**
 * El sello mira las hojas que la fuente ofrece, no si el libro numera alguna.
 *
 * Cuando un tramo sin folio devolvía el ancla vacía, preguntarle al libro
 * alcanzaba. Ahora ese tramo dice «hoja N», así que un libro que numera parte
 * de sus hojas emite LAS DOS formas y el sello por libro pondría `printed`
 * sobre una hoja.
 */
describe('stampCitationPageKind — libros que numeran sólo una parte', () => {
    const MAYOR: PageNumbering = {
        origin: 'confirmed',
        segments: [
            { fromSheet: 1, toSheet: 316, offset: null },
            { fromSheet: 317, toSheet: 540, offset: -278 },
        ],
    };
    const conTramos = (ranges: Array<{ start: number; end: number }>) => ({
        ...fuente('m1', 'Mayor'),
        excerptRecipe: { sheetRanges: ranges, proposedRanges: [], pinnedRanges: [], passageFingerprint: 'fp' },
    } as ProjectSource);
    const sello = (src: ProjectSource) => kindDe(stampCitationPageKind(
        analisis('Mayor'),
        [src],
        new Map([[src.id, MAYOR]]),
    ));

    it('las hojas elegidas caen todas en el tramo que numera: página impresa', () => {
        expect(sello(conTramos([{ start: 400, end: 405 }]))).toBe('printed');
    });

    it('una sola hoja elegida en el tramo sin folio baja la fuente entera a hoja', () => {
        // Conservador a propósito: la fuente emite las dos formas y el sello
        // es por fuente. Marcar `printed` pondría el rótulo de comprobable
        // sobre un número que nadie puede comprobar.
        expect(sello(conTramos([{ start: 400, end: 405 }, { start: 100, end: 100 }]))).toBe('sheet');
    });

    it('un tramo que CRUZA el borde no se salva por tener los extremos resueltos', () => {
        // 50-400 resuelve en 400 y no en 50; pero el caso que importa es el
        // hueco interior, que mirar sólo los extremos no ve.
        expect(sello(conTramos([{ start: 50, end: 400 }]))).toBe('sheet');
    });

    it('un hueco INTERIOR entre segmentos declarados tampoco resuelve', () => {
        const conHueco: PageNumbering = {
            origin: 'confirmed',
            segments: [
                { fromSheet: 1, toSheet: 100, offset: -4 },
                { fromSheet: 201, toSheet: 300, offset: -10 },
            ],
        };
        const src = conTramos([{ start: 50, end: 250 }]);
        expect(kindDe(stampCitationPageKind(analisis('Mayor'), [src], new Map([[src.id, conHueco]])))).toBe('sheet');
    });

    it('sin tramos elegidos se sigue preguntando por el libro', () => {
        const src = { ...fuente('m1', 'Mayor'), excerptRecipe: null } as ProjectSource;
        expect(sello(src)).toBe('printed');
    });
});
