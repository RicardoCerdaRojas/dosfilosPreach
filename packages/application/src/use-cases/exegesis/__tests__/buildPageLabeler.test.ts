import { describe, expect, it } from 'vitest';
import type { ExegeticalPaper, IPageNumberingReader, PageNumbering } from '@dosfilos/domain';
import { buildPageLabeler } from '../buildPageLabeler';

const KITTEL: PageNumbering = {
    origin: 'confirmed',
    segments: [{ fromSheet: 1, toSheet: 1120, offset: null }],
    sheetPages: { '525': { from: 666, to: 667 }, '526': { from: 667, to: 667 } },
};

const paper = { sources: [{ citationKey: 'Kittel', sourceType: 'theological-dictionary', sourceLibraryResourceId: 'k1', corpusId: 'k1' }] } as unknown as ExegeticalPaper;
const reader = { numberingFor: async () => KITTEL } as unknown as IPageNumberingReader;

describe('buildPageLabeler — hojas con varias páginas (Kittel, A8b)', () => {
    it('una cita guardada como hoja se rotula con las páginas de la hoja', async () => {
        const rotular = (await buildPageLabeler(reader, paper, 'prueba'))!;
        // El TP #10 citó «Kittel 525»: es la hoja, que trae las pp. 666–667.
        expect(rotular('Kittel', 525, 'sheet')).toBe('pp. 666–667');
        expect(rotular('Kittel', 526, 'sheet')).toBe('p. 667');
        expect(rotular('Kittel', 9, 'sheet')).toBe('hoja 9');
        expect(rotular('Kittel', 666, 'printed')).toBe('p. 666');
    });
});
