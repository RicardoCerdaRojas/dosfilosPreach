import { describe, expect, it } from 'vitest';
import type { ExegeticalPaper } from '../../entities/ExegeticalPaper';
import { originalWithoutAccents, verseTextBlocks } from '../verseTextUnderHeading';
import { sectionHeadingKey } from '../composedVerseSections';

/** WLC de Sal 23, tal como lo trae OSHB (con te'amim, meteg, paseq y la barra de morfemas). */
const WLC_23_1 = 'מִזְמ֥וֹר לְ/דָוִ֑ד יְהוָ֥ה רֹ֝עִ֗/י לֹ֣א אֶחְסָֽר׃';
const WLC_23_5 = 'תַּעֲרֹ֬ךְ לְ/פָנַ֨/י׀ שֻׁלְחָ֗ן נֶ֥גֶד צֹרְרָ֑/י';
/** Lo que el fundador entregó en el TI #1 bajo el título del v. 1. */
const TI1_23_1 = 'מִזְמוֹר לְדָוִד יְהוָה רֹעִי לֹא אֶחְסָר׃';

describe('originalWithoutAccents — el hebreo con vocales y sin acentos (B68c)', () => {
    it('REGRESIÓN: el WLC de Sal 23:1 queda idéntico a lo que se entregó en el TI #1', () => {
        expect(originalWithoutAccents(WLC_23_1)).toBe(TI1_23_1.normalize('NFC'));
    });

    it('quita el paseq sin dejar la barra ni un espacio doble; conserva vocales, maqaf y sof pasuq', () => {
        const v5 = originalWithoutAccents(WLC_23_5);
        expect(v5).toBe('תַּעֲרֹךְ לְפָנַי שֻׁלְחָן נֶגֶד צֹרְרָי'.normalize('NFC'));
        expect(originalWithoutAccents('עַל־מֵ֖י')).toBe('עַל־מֵי'.normalize('NFC'));
    });

    it('el griego no se toca: sus acentos son ortografía', () => {
        expect(originalWithoutAccents('Ἐν ἀρχῇ ἦν ὁ λόγος')).toBe('Ἐν ἀρχῇ ἦν ὁ λόγος'.normalize('NFC'));
    });
});

describe('verseTextBlocks', () => {
    const PSA = (v: number) => ({ bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: v, verseEnd: v });
    const paper = {
        displayLanguage: 'es',
        steps: [
            { kind: 'introduction', verseRef: null },
            // El análisis está en la versión aceptada del paso, o en la actual si no hay aceptada.
            { kind: 'verse', verseRef: PSA(1), accepted: { canonicalAnalysis: { originalText: WLC_23_1, initialTranslation: 'x', finalTranslation: 'El SEÑOR es mi pastor; nada me falta.' } }, current: null },
            { kind: 'verse', verseRef: PSA(2), accepted: { canonicalAnalysis: null }, current: null },
            { kind: 'verse', verseRef: PSA(3), accepted: null, current: { canonicalAnalysis: { originalText: 'נַפְשִׁ֥י', initialTranslation: '«Restaura mi ser.»', finalTranslation: '' } } },
        ],
    } as unknown as ExegeticalPaper;

    it('por la clave del título del versículo; la traducción final entre comillas', () => {
        const m = verseTextBlocks(paper);
        expect(m.get(sectionHeadingKey('Salmo 23:1'))).toEqual({ original: TI1_23_1.normalize('NFC'), translation: '«El SEÑOR es mi pastor; nada me falta.»' });
        // Un ensamble guardado antes de B68a dice «Salmos 23:1»: es la misma sección.
        expect(m.get(sectionHeadingKey('Salmos 23:1'))).toBeDefined();
    });

    it('sin análisis no entra; sin traducción final, la inicial, sin comillas dobles', () => {
        const m = verseTextBlocks(paper);
        expect(m.has(sectionHeadingKey('Salmo 23:2'))).toBe(false);
        expect(m.get(sectionHeadingKey('Salmo 23:3'))!.translation).toBe('«Restaura mi ser.»');
        expect(m.size).toBe(2);
    });
});
