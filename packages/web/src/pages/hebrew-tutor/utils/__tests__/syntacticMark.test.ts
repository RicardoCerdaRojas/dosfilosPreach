import { describe, it, expect } from 'vitest';
import type { WordAnalysis } from '@dosfilos/domain';
import { getSyntacticMark } from '../syntacticMark';

/** U11b (revisión del profesor, 2026-11): con MACULA alineado, la frase preposicional es dato. */
const palabra = (p: Partial<WordAnalysis>) => ({ category: 'NOUN', morphemes: [], ...p }) as unknown as WordAnalysis;

describe('getSyntacticMark con el dato de MACULA', () => {
    it('la palabra SIN preposición dentro de la frase también se marca (בְּאֶרֶץ מוֹאָב: מוֹאָב)', () => {
        expect(getSyntacticMark(palabra({}), 'a')).toBe('PREP_PHRASE');
        expect(getSyntacticMark(palabra({}), 'n')).toBe('PREP_PHRASE');
    });

    it('fuera de toda frase, ni la etiqueta del asistente ni el prefijo la hacen frase; constructo y aposición siguen', () => {
        const prefijo = palabra({ clauseTag: 'PREP_PHRASE', morphemes: [{ role: 'PREPOSITION_PREFIX' }] } as never);
        expect(getSyntacticMark(prefijo, null)).toBeNull();
        expect(getSyntacticMark(palabra({ nominalMorphology: { state: 'CONSTRUCT' } } as never), null)).toBe('CONSTRUCT');
        expect(getSyntacticMark(palabra({ syntacticFunction: 'aposición de Booz' }), null)).toBe('APPOSITION');
    });

    it('sin dato (undefined: palabra no alineada o versículo sin estructura), como antes', () => {
        const prefijo = palabra({ morphemes: [{ role: 'PREPOSITION_PREFIX' }] } as never);
        expect(getSyntacticMark(prefijo)).toBe('PREP_PHRASE');
        expect(getSyntacticMark(prefijo, undefined)).toBe('PREP_PHRASE');
    });
});
