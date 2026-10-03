import { describe, it, expect } from 'vitest';
import { parseCover } from '../GeminiStyleGuideManifestExtractor';

/** La guía de estilo ahora puede decir cómo va la portada. */
describe('parseCover — lo que el extractor lee de la guía', () => {
    it('una portada descrita entera', () => {
        expect(parseCover({ blankLinesBeforeInstitution: 2, blankLinesAfterInstitution: 5, blankLinesAfterTitle: 5, blankLinesAfterAuthor: 2, uppercase: false, byLine: ' Presentado por ' }))
            .toEqual({ layout: { beforeInstitution: 2, afterInstitution: 5, afterTitle: 5, afterAuthor: 2 }, uppercase: false, byLine: 'Presentado por' });
    });

    it('si falta un número o no es razonable, null: mejor la de TMS que una inventada', () => {
        expect(parseCover({ blankLinesBeforeInstitution: 2, blankLinesAfterInstitution: 5, blankLinesAfterTitle: 5 })).toBeNull();
        expect(parseCover({ blankLinesBeforeInstitution: 2, blankLinesAfterInstitution: 50, blankLinesAfterTitle: 5, blankLinesAfterAuthor: 2 })).toBeNull();
        expect(parseCover(null)).toBeNull();
    });
});
