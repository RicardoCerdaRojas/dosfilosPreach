import { describe, expect, it } from 'vitest';
import {
    MIN_CHARS_PARA_AFIRMAR_AUSENCIA,
    classifyOriginalLanguageAbsence,
    countTransliterationMarks,
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
        expect([...sin.keys()]).toEqual(['Adamson']);
        // Sin original y sin transliteración: la extracción lo perdió.
        expect(sin.get('Adamson')).toBe('lost');
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
            new Map([['Adamson', 'lost' as const]]),
        );
        expect(encontradas).toHaveLength(1);
        expect(encontradas[0]!.form).toBe('μέντοι');
        expect(encontradas[0]!.sourceKey).toBe('Adamson');
    });

    it('la forma también puede venir en la cita textual que dijo haber copiado', () => {
        const encontradas = claimsQuotingUnreadableOriginal(
            analisis([{ sourceKey: 'Adamson', claim: 'lo comenta', quote: 'the particle διεκρίθητε' }]),
            new Map([['Adamson', 'lost' as const]]),
        );
        expect(encontradas[0]!.form).toBe('διεκρίθητε');
    });

    it('una afirmación SIN lengua original no se señala', () => {
        // El problema no es citar a una fuente con la extracción pobre: es
        // atribuirle una lectura del original que su texto no contiene.
        expect(claimsQuotingUnreadableOriginal(
            analisis([{ sourceKey: 'Adamson', claim: 'subraya el trasfondo social' }]),
            new Map([['Adamson', 'lost' as const]]),
        )).toEqual([]);
    });

    it('la misma forma apoyada en una fuente que SÍ trae griego no se señala', () => {
        expect(claimsQuotingUnreadableOriginal(
            analisis([{ sourceKey: 'Mayor', claim: 'trata μέντοι como adversativo' }]),
            new Map([['Adamson', 'lost' as const]]),
        )).toEqual([]);
    });

    it('sin fuentes marcadas no recorre nada', () => {
        expect(claimsQuotingUnreadableOriginal(
            analisis([{ sourceKey: 'Adamson', claim: 'μέντοι' }]),
            new Map(),
        )).toEqual([]);
    });
});


describe('el libro que translitera NO está roto', () => {
    /**
     * Sasson discute «the root hãyâ in the G-imperfect with a waw-conversive»:
     * morfología seria, sin caracteres hebreos, porque su colección escribe
     * así. La primera versión de esta comprobación lo acusaba de roto.
     */
    const SASSON = `The root hãyâ in the G-imperfect with a waw-conversive is common. `
        + `Discovered at Wadi Murabbaʿat and Naḥal Ḥever, the ṣādê and the šîn `
        + `alternate; compare ʾāmar with hāyâ and the ṭêt of qûm. `.repeat(40);

    it('se distingue del libro cuya extracción perdió el original', () => {
        expect(classifyOriginalLanguageAbsence(SASSON)).toBe('transliterated');
        expect(classifyOriginalLanguageAbsence(relleno(20_000))).toBe('lost');
    });

    it('las tildes corrientes del español no cuentan como transliteración', () => {
        // Si contaran, cualquier comentario en castellano pasaría por semítico.
        expect(countTransliterationMarks('según él, la acción está más allá')).toBe(0);
    });

    it('la afirmación dice POR QUÉ la fuente no la contiene', () => {
        const sin = sourcesWithoutOriginalLanguage([
            { citationKey: 'Sasson', text: SASSON },
            { citationKey: 'Adamson', text: relleno(20_000) },
        ]);
        expect(sin.get('Sasson')).toBe('transliterated');
        expect(sin.get('Adamson')).toBe('lost');
    });

    it('la razón viaja con cada afirmación señalada', () => {
        const encontradas = claimsQuotingUnreadableOriginal(
            analisis([{ sourceKey: 'Sasson', claim: 'trata הָיָה como narrativo' }]),
            new Map([['Sasson', 'transliterated' as const]]),
        );
        expect(encontradas[0]!.absence).toBe('transliterated');
    });
});
