import { describe, it, expect } from 'vitest';
import { TEXT_CONTENT_MAX_BYTES, textContentIsComplete } from '../textContentCompleteness';

describe('textContentIsComplete', () => {
    it('con conteo: completo si el guardado llega al largo real', () => {
        expect(textContentIsComplete('abc', 3)).toBe(true);
        expect(textContentIsComplete('abc', 900_000)).toBe(false);
    });
    it('sin conteo: cortado sólo si llega al tope de bytes', () => {
        expect(textContentIsComplete('a'.repeat(1000), undefined)).toBe(true);
        expect(textContentIsComplete('א'.repeat(TEXT_CONTENT_MAX_BYTES / 2), null)).toBe(false);
    });
    it('sin texto no está completo', () => {
        expect(textContentIsComplete('', 0)).toBe(false);
        expect(textContentIsComplete(null)).toBe(false);
    });
});
