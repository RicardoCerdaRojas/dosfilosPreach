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

/**
 * TP #9 (2026-10-28): «Diagnosticar esta cita» propuso cambiar a la p. 1067
 * una cita cuya afirmación es del estudiante con la etiqueta de Robertson.
 * Lo que distingue «hallada entera en otra página» de «hallado algo parecido»
 * es lo que el juez anota que la fuente no dice (`notFromSource`).
 */
describe('diagnoseCitation — el banco del TP #9', () => {
    const ROBERTSON_4_15 = v({
        raw: '(Robertson, pp. 1069–1070)', author: 'Robertson', pages: '1069–1070', origin: 'prose',
        evidence: 'El genitivo se manifiesta en el artículo, no en una terminación del infinitivo; el pronombre funciona como sujeto acusativo de «decir», no como su objeto',
        status: 'page-mismatch', matchedPage: '1067', matchedPageLabel: 'p. 1067', bookSearch: 'cited-page', similarityScore: 0.99,
        note: 'Citaste p. 1069–1070 pero el pasaje de apoyo está en 1067.',
        takenFromSource: 'Robertson señala que el infinitivo articular puede llevar el artículo τοῦ y que el infinitivo había perdido en gran medida la distinción de sus antiguas terminaciones de caso.',
        supportingSpan: { text: 'One must recall the fact that the inf. had already lost for the most part the significance of the dative ending', pageLabel: 'p. 1067' },
    });

    const PROPIO = 'el pronombre funciona como sujeto acusativo de «decir», no como su objeto';

    it('Robertson 1069–1070 → 1067, lo hallado es algo parecido: afirmación mixta, no «corregir a p. 1067»', () => {
        const d = diagnoseCitation({ ...ROBERTSON_4_15, claimCoverage: 'partial', notFromSource: PROPIO }, 'es', CLAVES);
        expect(d!.cause).toBe('mixed-claim');
        expect(d!.remedy.kind).toBe('review-with-note');
        // Lo que la fuente dice, con SUS palabras (el tramo), no la paráfrasis del juez.
        expect(d!.detail).toMatchObject({ foundAt: 'p. 1067', sourceSays: ROBERTSON_4_15.supportingSpan!.text, sentenceAdds: PROPIO });
        const nota = (d!.remedy as { note: string }).note;
        expect(nota).toContain('la fuente no dice exactamente eso');
        expect(nota).toContain('Lo más cercano (p. 1067) dice «One must recall the fact');
        expect(nota).toContain(`«${PROPIO}» es tuyo`);
    });

    it('sin tramo copiado, la mixta usa lo que el juez leyó; sin `notFromSource`, la oración entera', () => {
        const d = diagnoseCitation({ ...ROBERTSON_4_15, claimCoverage: 'partial', supportingSpan: undefined }, 'es', CLAVES);
        expect(d!.detail).toMatchObject({ sourceSays: ROBERTSON_4_15.takenFromSource, sentenceAdds: ROBERTSON_4_15.evidence });
    });

    it('en inglés, con paridad («is yours», como «es tuyo»)', () => {
        const d = diagnoseCitation({ ...ROBERTSON_4_15, claimCoverage: 'partial', notFromSource: 'the pronoun is the accusative subject' }, 'en', CLAVES);
        const nota = (d!.remedy as { note: string }).note;
        expect(nota).toContain('Mixed claim: the source does not say exactly that');
        expect(nota).toContain('"the pronoun is the accusative subject" is yours');
    });

    it('Adamson 171 → 170 con conclusión propia agregada: sigue «otra página» con su corrección, y la parte propia aparte', () => {
        const adamson = v({
            status: 'page-mismatch', matchedPage: '170', matchedPageLabel: 'p. 170', bookSearch: 'cited-page',
            evidence: 'Adamson cataloga las propuestas sobre el origen de la cita, lo que confirma su trasfondo sapiencial.',
            claimCoverage: 'whole', notFromSource: 'lo que confirma su trasfondo sapiencial',
            supportingSpan: { text: 'Several proposals have been made as to the source of the quotation', pageLabel: 'p. 170' },
        });
        const d = diagnoseCitation(adamson, 'es', CLAVES);
        expect(d).toMatchObject({
            cause: 'other-page',
            detail: { foundAt: 'p. 170', ownPart: 'lo que confirma su trasfondo sapiencial' },
            remedy: { kind: 'correct-page', page: 170, pageKind: 'printed' },
        });
    });

    it('sin la marca de cobertura (veredictos de antes) sigue siendo «está en otra página», aunque traiga parte propia', () => {
        expect(diagnoseCitation(ROBERTSON_4_15, 'es', CLAVES)!.cause).toBe('other-page');
        expect(diagnoseCitation({ ...ROBERTSON_4_15, notFromSource: PROPIO }, 'es', CLAVES)).toMatchObject({ cause: 'other-page', detail: { ownPart: PROPIO } });
        expect(diagnoseCitation({ ...ROBERTSON_4_15, notFromSource: '   ' }, 'es', CLAVES)!.detail).not.toHaveProperty('ownPart');
    });

    it('Ropes 282 en 4:17 (acertó): la fuente dice X y la oración agrega una conclusión → afirmación mixta', () => {
        const d = diagnoseCitation(v({
            author: 'Ropes', pages: '282', status: 'fuzzy-low', matchedPage: '281', matchedPageLabel: 'p. 281', bookSearch: 'not-in-book',
            evidence: 'La combinación del enlace retrospectivo οὖν con el contraste inmediato entre πονηρά en 4:16 y καλόν en 4:17 distingue el cierre contextual de una máxima independiente o primordialmente prospectiva.',
            takenFromSource: 'Ropes sostiene que οὖν introduce una oración conclusiva de resumen aplicable a toda la situación descrita anteriormente.',
            supportingSpan: { text: 'οὖν, "so then," serving to introduce this summary concluding sentence', pageLabel: 'p. 281' },
        }), 'es', CLAVES);
        expect(d!.cause).toBe('mixed-claim');
        expect(d!.detail.sourceSays).toBe('Ropes sostiene que οὖν introduce una oración conclusiva de resumen aplicable a toda la situación descrita anteriormente.');
    });

    it('Tuggy 540 (acertó): sostiene una parte → afirmación mixta; con `notFromSource`, eso es lo que agrega', () => {
        const tuggy = v({
            author: 'Tuggy', pages: '540', status: 'fuzzy-low', matchedPage: '540', matchedPageLabel: 'p. 540', bookSearch: 'not-in-book',
            evidence: 'κριτής: juez oficial, juez no oficial, juez divino',
            takenFromSource: 'El léxico distingue κριτής como juez referido a hombres y como juez referido a Dios.',
            supportingSpan: { text: 'N.T. *Juez*. A) Refiriéndose a hombres… B) Refiriéndose a Dios', pageLabel: 'p. 540' },
        });
        expect(diagnoseCitation(tuggy, 'es', CLAVES)).toMatchObject({ cause: 'mixed-claim', detail: { sentenceAdds: tuggy.evidence } });
        expect(diagnoseCitation({ ...tuggy, notFromSource: 'juez no oficial' }, 'es', CLAVES))
            .toMatchObject({ cause: 'mixed-claim', detail: { sentenceAdds: 'juez no oficial' } });
    });
});
