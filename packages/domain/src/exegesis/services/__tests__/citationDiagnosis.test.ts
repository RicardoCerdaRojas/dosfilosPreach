import { describe, it, expect } from 'vitest';
import type { VerifiedCitation } from '../../entities/CitationVerification';
import { diagnoseCitation } from '../citationDiagnosis';

/**
 * TP #8 (2026-10-21, fase 8b, D4): las alarmas del banco con la causa que se
 * anotó a mano en la bitácora. El diagnóstico tiene que dar esa causa y el
 * remedio que se aplicó.
 */
const v = (over: Partial<VerifiedCitation>): VerifiedCitation => ({
    raw: 'Adamson, p. 171', author: 'Adamson', title: '', pages: '171', offset: 0,
    evidence: 'Adamson cataloga las propuestas sobre el origen de la cita.', evidenceIsQuoted: false,
    status: 'not-found', matchedCorpusId: 'r', matchedSourceLabel: 'Adamson', similarityScore: 0.3,
    matchedPage: null, note: null, ...over,
});
const CLAVES = ['Mayor', 'Adamson', 'Tuggy', 'Kittel', 'Ropes', 'Wallace'];

describe('diagnoseCitation — el banco del TP #8', () => {
    it('Adamson 171 → 170: otra página, corregir a la hallada', () => {
        const d = diagnoseCitation(v({ status: 'page-mismatch', matchedPage: '170', matchedPageLabel: 'p. 170', bookSearch: 'book' }), 'es', CLAVES);
        expect(d).toMatchObject({ cause: 'other-page', remedy: { kind: 'correct-page', page: 170, pageKind: 'printed', label: 'p. 170' } });
    });

    it('una hoja hallada se corrige como hoja', () => {
        const d = diagnoseCitation(v({ status: 'page-mismatch', matchedPage: '584', matchedPageLabel: 'hoja 584' }), 'es');
        expect(d!.remedy).toEqual({ kind: 'correct-page', page: 584, pageKind: 'sheet', label: 'hoja 584' });
    });

    it('Mayor 134: afirmación mixta, con lo que la fuente dice', () => {
        const d = diagnoseCitation(v({
            author: 'Mayor', status: 'fuzzy-low', takenFromSource: 'Mayor ve en κακῶς un matiz subjetivo',
            supportingSpan: { text: 'κακῶς denotes the wrong motive', pageLabel: 'p. 134' },
        }), 'es', CLAVES);
        expect(d!.cause).toBe('mixed-claim');
        expect(d!.remedy).toEqual({ kind: 'review-with-note', note: 'Afirmación mixta: la fuente dice «Mayor ve en κακῶς un matiz subjetivo»; el resto es conclusión propia y va en otra oración, sin la cita.' });
    });

    it('lo dice otra fuente del corpus', () => {
        const d = diagnoseCitation(v({ author: 'Kittel', bookSearch: 'not-in-book', foundInOtherSource: { sourceKey: 'Mayor', pageLabel: 'p. 133' } }), 'es', CLAVES);
        expect(d).toMatchObject({ cause: 'other-source', detail: { otherSource: 'Mayor, p. 133' } });
        expect((d!.remedy as { note: string }).note).toContain('Lo dice Mayor (p. 133), no Kittel');
    });

    it('segunda mano: la página de Adamson reporta a Mayor y Ropes', () => {
        const d = diagnoseCitation(v({
            status: 'fuzzy-low',
            supportingSpan: { text: 'Mayor, Knowling and Ropes take the spirit as subject', pageLabel: 'p. 170' },
        }), 'es', CLAVES);
        expect(d).toMatchObject({ cause: 'second-hand', detail: { reportedAuthor: 'Mayor' } });
    });

    it('nadie lo dice: se buscó en todo; quitar la cita', () => {
        const d = diagnoseCitation(v({ author: 'Wallace', bookSearch: 'not-in-book' }), 'es', CLAVES);
        expect(d).toEqual({ cause: 'nobody-says-it', detail: {}, remedy: { kind: 'remove' } });
    });

    it('sin buscar en el libro no se afirma «nadie lo dice»', () => {
        expect(diagnoseCitation(v({}), 'es', CLAVES)).toBeNull();
    });

    it('una cita verificada no tiene diagnóstico', () => {
        expect(diagnoseCitation(v({ status: 'verified' }), 'es', CLAVES)).toBeNull();
    });

    it('el autor citado no cuenta como segunda mano de sí mismo', () => {
        const d = diagnoseCitation(v({ status: 'fuzzy-low', supportingSpan: { text: 'Adamson argues', pageLabel: null } }), 'es', CLAVES);
        expect(d!.cause).toBe('mixed-claim');
    });

    it('«en mayor medida» no es Mayor: la segunda mano distingue mayúsculas (revisión de 8b)', () => {
        const d = diagnoseCitation(v({
            author: 'Wallace', status: 'fuzzy-low',
            supportingSpan: { text: 'el presente se usa en mayor medida para lo vigente', pageLabel: 'p. 533' },
        }), 'es', CLAVES);
        expect(d!.cause).not.toBe('second-hand');
    });
});
