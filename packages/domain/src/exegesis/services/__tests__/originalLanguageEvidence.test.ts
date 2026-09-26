import { describe, expect, it } from 'vitest';
import {
    MIN_CHARS_PARA_AFIRMAR_AUSENCIA,
    claimsQuotingUnreadableOriginal,
    countOriginalLanguageChars,
    sourcesWithoutOriginalLanguage,
} from '../originalLanguageEvidence';
import type { CanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';

const relleno = (n: number) => 'palabra inglesa corriente. '.repeat(Math.ceil(n / 27)).slice(0, n);

describe('countOriginalLanguageChars', () => {
    it('cuenta griego politónico y hebreo', () => {
        expect(countOriginalLanguageChars('μέντοι')).toBe(6);
        expect(countOriginalLanguageChars('ἐλεγχόμενοι')).toBe(11);
        expect(countOriginalLanguageChars('שׁוב')).toBeGreaterThan(0);
    });

    it('el griego transliterado NO cuenta, que es justamente el caso', () => {
        // La extracción de Adamson escribe «6€§a00¢e» donde el libro imprime
        // δέξασθε, y «logos» donde imprime λόγος.
        expect(countOriginalLanguageChars('6€§a00¢e')).toBe(0);
        expect(countOriginalLanguageChars('the logos here means')).toBe(0);
    });
});

describe('sourcesWithoutOriginalLanguage', () => {
    it('marca la fuente con texto de sobra y cero lengua original', () => {
        // El caso medido: 18.888 caracteres de Adamson, ni una letra griega.
        const sin = sourcesWithoutOriginalLanguage([{ citationKey: 'Adamson', text: relleno(18_888) }]);
        expect([...sin]).toEqual(['Adamson']);
    });

    it('no marca a la que sí la trae', () => {
        // Mayor mide 1.470 ‰ en el corpus real.
        const texto = `${relleno(5000)} μέντοι προσωπολημψία`;
        expect(sourcesWithoutOriginalLanguage([{ citationKey: 'Mayor', text: texto }]).size).toBe(0);
    });

    it('un texto corto no alcanza para afirmar una ausencia', () => {
        // Sin esto, una fuente con dos frases entraría en la lista y la
        // advertencia sería ruido.
        const corto = relleno(MIN_CHARS_PARA_AFIRMAR_AUSENCIA - 1);
        expect(sourcesWithoutOriginalLanguage([{ citationKey: 'X', text: corto }]).size).toBe(0);
    });

    it('una fuente sin clave de cita no se puede atribuir, así que no entra', () => {
        expect(sourcesWithoutOriginalLanguage([{ citationKey: null, text: relleno(9000) }]).size).toBe(0);
    });
});

/** Un análisis mínimo con dos afirmaciones citables. */
const analisis = (claims: Array<{ sourceKey: string; claim: string; quote?: string }>): CanonicalVerseAnalysis => ({
    reference: { bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 8, verseEnd: 8 },
    commentatorEngagement: claims.map(c => ({
        sourceKey: c.sourceKey,
        page: 113,
        position: c.claim,
        verbatimQuote: c.quote ?? null,
    })),
    syntacticAnalysis: { keyConstructions: [], discourseParticles: [] },
    lexicalAnalyses: [], translationCruxes: [], historicalContext: [],
    oldTestamentLinks: [], footnoteExtensions: [], confidenceFlags: [], theologicalHooks: [],
} as unknown as CanonicalVerseAnalysis);

describe('claimsQuotingUnreadableOriginal', () => {
    it('señala la forma griega apoyada en una fuente sin griego', () => {
        const encontradas = claimsQuotingUnreadableOriginal(
            analisis([{ sourceKey: 'Adamson', claim: 'trata μέντοι como un punto crucial' }]),
            new Set(['Adamson']),
        );
        expect(encontradas).toHaveLength(1);
        expect(encontradas[0]!.form).toBe('μέντοι');
        expect(encontradas[0]!.sourceKey).toBe('Adamson');
    });

    it('la forma también puede venir en la cita textual que dijo haber copiado', () => {
        const encontradas = claimsQuotingUnreadableOriginal(
            analisis([{ sourceKey: 'Adamson', claim: 'lo comenta', quote: 'the particle διεκρίθητε' }]),
            new Set(['Adamson']),
        );
        expect(encontradas[0]!.form).toBe('διεκρίθητε');
    });

    it('una afirmación SIN lengua original no se señala', () => {
        // El problema no es citar a una fuente con la extracción pobre: es
        // atribuirle una lectura del original que su texto no contiene.
        expect(claimsQuotingUnreadableOriginal(
            analisis([{ sourceKey: 'Adamson', claim: 'subraya el trasfondo social' }]),
            new Set(['Adamson']),
        )).toEqual([]);
    });

    it('la misma forma apoyada en una fuente que SÍ trae griego no se señala', () => {
        expect(claimsQuotingUnreadableOriginal(
            analisis([{ sourceKey: 'Mayor', claim: 'trata μέντοι como adversativo' }]),
            new Set(['Adamson']),
        )).toEqual([]);
    });

    it('sin fuentes marcadas no recorre nada', () => {
        expect(claimsQuotingUnreadableOriginal(
            analisis([{ sourceKey: 'Adamson', claim: 'μέντοι' }]),
            new Set(),
        )).toEqual([]);
    });
});
