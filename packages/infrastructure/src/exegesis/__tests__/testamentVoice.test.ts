import type { PassageReference } from '@dosfilos/domain';
import { describe, expect, it } from 'vitest';
import { voiceFor } from '../testamentVoice';

function esd(chapterStart: number, verseStart: number | null, chapterEnd: number, verseEnd: number | null): PassageReference {
    return { bookId: 'EZR' as PassageReference['bookId'], chapterStart, chapterEnd, verseStart, verseEnd };
}

/** La voz del AT tal como estaba antes del arameo, copiada de HEAD (eac75562). */
const OT_VOICE_DE_HOY = {
    language: 'hebreo', languageAdjEs: 'hebrea', languageEn: 'Hebrew',
    testamentEs: 'del Antiguo Testamento', testamentEn: 'Old Testament',
    expertEs: 'hebreo bíblico', expertEn: 'Biblical Hebrew',
    grammarsEs: 'Gramática/sintaxis hebrea: Waltke-O\'Connor, Joüon-Muraoka, Gesenius (GKC)',
    grammarsEn: 'Hebrew grammar/syntax: Waltke-O\'Connor, Joüon-Muraoka, Gesenius (GKC)',
    lexiconsEs: 'Léxico: HALOT, BDB, DCH, TDOT, NIDOTTE',
    lexiconsEn: 'Lexicon: HALOT, BDB, DCH, TDOT, NIDOTTE',
    apparatusEs: 'Crítica textual: aparato de BHS/BHQ, Tov, Würthwein',
    apparatusEn: 'Textual criticism: BHS/BHQ apparatus, Tov, Würthwein',
    witnessesEs: 'TM (Códice de Leningrado), Pentateuco Samaritano, LXX, Qumrán (1QIsaᵃ y afines), Peshitta, Vulgata, Targumim según corresponda',
    witnessesEn: 'MT (Leningrad Codex), Samaritan Pentateuch, LXX, Qumran (1QIsaᵃ and related), Peshitta, Vulgate, Targumim as appropriate',
    morphologyEs: 'qatal qal 3ª masculino singular; participio nifal; wayyiqtol hifil',
    morphologyEn: 'qal qatal 3rd masculine singular; niphal participle; hiphil wayyiqtol',
};

describe('voiceFor', () => {
    it('da voz hebrea a un libro del Antiguo Testamento', () => {
        // El caso que motivó esto: Jonás analizado con aparato NA28 y
        // participios aoristos era exégesis del libro equivocado.
        const v = voiceFor('JON');
        expect(v.language).toBe('hebreo');
        expect(v.apparatusEs).toContain('BHS');
        expect(v.grammarsEs).toContain('Waltke');
        expect(v.lexiconsEs).toContain('HALOT');
    });

    it('da voz griega a un libro del Nuevo Testamento', () => {
        const v = voiceFor('HEB');
        expect(v.language).toBe('griego');
        expect(v.apparatusEs).toContain('NA28');
        expect(v.grammarsEs).toContain('Wallace');
        expect(v.lexiconsEs).toContain('BDAG');
    });

    it('no nombra manuscritos del NT al hablar del AT', () => {
        // Citar 𝔓⁴⁶ para un texto hebreo es una cita imposible de verificar:
        // ese papiro no contiene el Antiguo Testamento.
        expect(voiceFor('GEN').witnessesEs).not.toContain('𝔓⁴⁶');
        expect(voiceFor('PSA').witnessesEs).toContain('TM');
    });

    it('no usa morfología griega para el hebreo', () => {
        expect(voiceFor('ISA').morphologyEs).toContain('qatal');
        expect(voiceFor('ISA').morphologyEs).not.toContain('aoristo');
    });

    it('cae en la voz griega ante un libro desconocido', () => {
        // Sin libro reconocible no hay testamento; el NT es el default
        // histórico del módulo y no cambia el comportamiento previo.
        expect(voiceFor('XXX').language).toBe('griego');
    });

    describe('el arameo de Esdras y Daniel', () => {
        it('Esd 4:8-24 es hebreo y arameo, con Rosenthal y Vogt', () => {
            const v = voiceFor('EZR', esd(4, 8, 4, 24));
            expect(v.expertEs).toBe('hebreo y arameo bíblicos');
            expect(v.expertEn).toBe('Biblical Hebrew and Aramaic');
            expect(v.language).toBe('hebreo y arameo');
            expect(v.grammarsEs).toContain('Rosenthal');
            expect(v.grammarsEs).toContain('Waltke');
            expect(v.lexiconsEs).toContain('Vogt');
            expect(v.morphologyEs).toContain('peal');
        });

        it('Esd 4:6-24 empieza en hebreo pero toca arameo', () => {
            expect(voiceFor('EZR', esd(4, 6, 4, 24)).expertEs).toContain('arameo');
        });

        it('Esd 1:1-4 no menciona el arameo', () => {
            const v = voiceFor('EZR', esd(1, 1, 1, 4));
            expect(JSON.stringify(v)).not.toMatch(/arame|Aramaic/);
        });

        it('sin pasaje, o sin arameo, la voz es BYTE A BYTE la de antes', () => {
            // Los llamadores que no pasan el pasaje no cambian.
            expect(JSON.stringify(voiceFor('EZR'))).toBe(JSON.stringify(OT_VOICE_DE_HOY));
            expect(JSON.stringify(voiceFor('EZR', esd(1, 1, 1, 4)))).toBe(JSON.stringify(OT_VOICE_DE_HOY));
            expect(JSON.stringify(voiceFor('JON', null))).toBe(JSON.stringify(OT_VOICE_DE_HOY));
        });

        it('el NT no se entera', () => {
            const jas = { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 8, verseEnd: 8 } as PassageReference;
            expect(voiceFor('JAS', jas).language).toBe('griego');
        });
    });
});
