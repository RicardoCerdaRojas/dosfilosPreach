import { describe, it, expect } from 'vitest';
import { MorphemeRole, reconcileGlobalWords, type VerseAnalysis } from '@dosfilos/domain';
import { parseMorphhbXml } from '../morphhb/morphhb-bible-provider';
import { RUT_1_7_A_9_XML } from './fixtures/rut1';

/**
 * Las letras corridas entre palabras del tutor de hebreo (2026-09-30).
 *
 * El fundador estudiaba Rut con su profesor y el tutor mostraba las palabras
 * con letras de la vecina, en la línea del versículo y en las tarjetas. Dos
 * causas, las dos acá con el texto real de morphhb:
 *
 * - Rut 1:7: el modelo contó 4 consonantes en שָׁמָּה (son 3) y el reparto de
 *   TODO el versículo según esos conteos corría cada palabra siguiente.
 * - Rut 1:8: el lector de morphhb tomaba el ketiv יעשה Y el qere יַעַשׂ como dos
 *   palabras; el modelo escribe una.
 */
const libro = parseMorphhbXml(RUT_1_7_A_9_XML);
const tokens = (v: number) => libro.verses.get(`Ruth.1.${v}`)!.words;

const sinTeamim = (s: string) => s.replace(/[֑-֯׃׀]/g, '');
const esqueleto = (s: string) => Array.from(s).filter(c => c >= 'א' && c <= 'ת').join('');

/** Lo que devuelve el modelo: cada token como una palabra de un morfema, sin te'amim. */
function palabrasDelModelo(v: number, errores: Record<number, string[]> = {}): VerseAnalysis['words'] {
    return tokens(v).map((t, i) => ({
        hebrewText: sinTeamim(t.text),
        morphemes: (errores[i] ?? [sinTeamim(t.text)]).map(text => ({ text, role: MorphemeRole.ROOT_R1, label: '' })),
    })) as unknown as VerseAnalysis['words'];
}

describe('morphhb: ketiv y qere', () => {
    it('Rut 1:8 trae el qere y no el ketiv', () => {
        const textos = tokens(8).map(t => t.text);
        expect(textos.some(t => t === 'יעשה')).toBe(false);
        expect(textos.some(t => esqueleto(t) === 'יעש')).toBe(true);
        expect(libro.verses.get('Ruth.1.8')!.hebrewText).not.toContain('יעשה');
    });

    it('el fin de versículo sigue pegado a la última palabra', () => {
        expect(tokens(9).at(-1)!.text.endsWith('׃')).toBe(true);
    });
});

describe('reconcileGlobalWords — cada palabra recibe SUS letras', () => {
    it('Rut 1:7: un conteo equivocado en שָׁמָּה no corre a las siguientes', () => {
        const i = tokens(7).findIndex(t => esqueleto(t.text) === 'שמה');
        // El modelo contó la ה direccional dos veces: 4 consonantes en 3.
        const palabras = reconcileGlobalWords(
            palabrasDelModelo(7, { [i]: ['שָׁמָּה', 'ה'] }),
            tokens(7),
        );

        palabras.forEach((p, k) => {
            expect(p.hebrewText).toBe(tokens(7)[k]!.text);
            expect(esqueleto(p.morphemes.map(m => m.text).join(''))).toBe(esqueleto(tokens(7)[k]!.text));
        });
        // La palabra mal contada va entera, en un solo morfema: sin color, con sus letras.
        expect(palabras[i]!.morphemes).toHaveLength(1);
    });

    it('Rut 1:8: con el qere solo, las palabras calzan una a una', () => {
        // El modelo contó 8 consonantes en וַתֹּאמֶר (son 5).
        const palabras = reconcileGlobalWords(
            palabrasDelModelo(8, { 0: ['וַ', 'תֹּאמֶר', 'נָעֳמִ'] }),
            tokens(8),
        );
        expect(palabras[1]!.hebrewText).toBe(tokens(8)[1]!.text);
        expect(esqueleto(palabras[1]!.morphemes.map(m => m.text).join(''))).toBe('נעמי');
    });

    it('Rut 1:9: el sof pasuq queda en el texto de la palabra, no en sus morfemas', () => {
        const palabras = reconcileGlobalWords(palabrasDelModelo(9), tokens(9));
        const ultima = palabras.at(-1)!;
        expect(ultima.hebrewText.endsWith('׃')).toBe(true);
        expect(ultima.morphemes.some(m => m.text.includes('׃'))).toBe(false);
    });

    it('si el modelo junta dos palabras unidas por maqaf, las demás siguen en su sitio', () => {
        const t = tokens(7);
        const j = t.findIndex(x => esqueleto(x.text) === 'מן');
        const modelo = palabrasDelModelo(7);
        const juntas = [...modelo.slice(0, j), {
            hebrewText: sinTeamim(t[j]!.text + t[j + 1]!.text),
            morphemes: [
                { text: sinTeamim(t[j]!.text), role: MorphemeRole.PREPOSITION_PREFIX, label: '' },
                { text: sinTeamim(t[j + 1]!.text), role: MorphemeRole.ROOT_R1, label: '' },
            ],
        }, ...modelo.slice(j + 2)] as unknown as VerseAnalysis['words'];

        const palabras = reconcileGlobalWords(juntas, t);
        expect(palabras).toHaveLength(t.length - 1);
        expect(palabras[j]!.hebrewText).toBe(t[j]!.text + t[j + 1]!.text);
        expect(palabras.at(-1)!.hebrewText).toBe(t.at(-1)!.text);
    });

    it('reconciliar lo ya reconciliado no cambia nada (el caché se relee así)', () => {
        const una = reconcileGlobalWords(palabrasDelModelo(9), tokens(9));
        expect(reconcileGlobalWords(una, tokens(9))).toEqual(una);
    });
});
