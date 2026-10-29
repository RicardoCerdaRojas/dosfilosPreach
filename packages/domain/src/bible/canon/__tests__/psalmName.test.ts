import { describe, expect, it } from 'vitest';
import { sameBookNameForPsalms } from '../psalmName';

describe('sameBookNameForPsalms — «Salmo» y «Salmos» son el mismo libro al comparar (B68a)', () => {
    it('une las dos formas, en los dos idiomas y en mayúsculas', () => {
        expect(sameBookNameForPsalms('## Salmos 23:4')).toBe(sameBookNameForPsalms('## Salmo 23:4'));
        expect(sameBookNameForPsalms('v1|salmos 23:4-6|x')).toBe('v1|salmo 23:4-6|x');
        expect(sameBookNameForPsalms('Psalms 23')).toBe('Psalm 23');
        expect(sameBookNameForPsalms('SALMOS 23')).toBe('SALMO 23');
    });

    it('no toca otras palabras', () => {
        expect(sameBookNameForPsalms('salmonete, salmodia y Psalmist')).toBe('salmonete, salmodia y Psalmist');
    });
});
