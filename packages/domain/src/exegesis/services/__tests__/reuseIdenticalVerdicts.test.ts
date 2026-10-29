import { describe, it, expect } from 'vitest';
import type { VerifiedCitation } from '../../entities/CitationVerification';
import { citationIdentity, dependsOnContext, reuseIdenticalVerdicts, sourceFingerprint } from '../evidenceForCitation';

/**
 * TP #9 (B46): «(Varner, 162)» salió verificada a las 19:46 y «página no
 * coincide: el pasaje de apoyo está en 163» a las 22:03 con el mismo texto;
 * «Kittel y Friedrich, pp. 230–231», del análisis, igual, sin que nadie lo
 * tocara. Una cita que no cambió no cambia de veredicto.
 */
const KITTEL = {
    raw: 'Kittel y Friedrich, 230–231 · lexical-range', author: 'Kittel y Friedrich', title: '', pages: '230–231',
    evidencePage: '230', offset: 13, site: 'lexical-range' as const, otherSources: ['Tuggy'],
    evidence: 'ζωὴ: vida física o natural, vitalidad, duración de la vida, vida sobrenatural, vida eterna',
    evidenceIsQuoted: false,
};
const verde = (over: Partial<VerifiedCitation> = {}): VerifiedCitation => ({
    ...KITTEL, origin: 'analysis', status: 'verified', matchedCorpusId: 'res-kittel', matchedSourceLabel: 'DTNT',
    similarityScore: 0.99, matchedPage: '230', matchedPageLabel: 'p. 230', sourceFingerprint: 'h1',
    note: 'La fuente respalda la vida natural y, en la p. 231, también la vida eterna.',
    takenFromSource: 'El diccionario presenta ζωή como vida natural, duración de la vida y vida eterna.',
    supportingSpan: { text: 'En el NT ζωή y ζῆν se refieren primeramente a la vida natural', pageLabel: 'p. 230' },
    ...over,
});
const FUENTES = new Map([['res-kittel', 'h1']]);

describe('reuseIdenticalVerdicts — B46', () => {
    it('Kittel 230–231 del análisis: la misma cita conserva el verde de la corrida anterior', () => {
        const [r] = reuseIdenticalVerdicts([KITTEL], [verde()], FUENTES);
        expect(r).toMatchObject({ status: 'verified', matchedPage: '230', note: verde().note, offset: 13 });
    });

    it('la cita es la nueva: offset y `raw` de ahora, veredicto de antes', () => {
        const [r] = reuseIdenticalVerdicts([{ ...KITTEL, offset: 99, raw: 'otro raw' }], [verde()], FUENTES);
        expect(r).toMatchObject({ offset: 99, raw: 'otro raw', status: 'verified' });
    });

    it('espacios, mayúsculas y la raya del rango no la hacen otra cita', () => {
        const [r] = reuseIdenticalVerdicts([{ ...KITTEL, author: 'kittel y  friedrich', pages: '230-231', evidence: ` ${KITTEL.evidence}  ` }], [verde()], FUENTES);
        expect(r).not.toBeNull();
    });

    it.each([
        ['otra página', { pages: '231' }],
        ['otra afirmación', { evidence: 'ζωὴ: vida física' }],
        ['una tilde griega distinta', { evidence: KITTEL.evidence.replace('ζωὴ', 'ζωή') }],
        ['ahora es textual', { evidenceIsQuoted: true }],
        ['otras fuentes', { otherSources: ['Tuggy', 'Ropes'] }],
        ['otro sitio del análisis', { site: 'lexical-loading' as const }],
        ['otra fuente', { author: 'Tuggy' }],
    ])('%s: se juzga de nuevo', (_n, cambio) => {
        expect(reuseIdenticalVerdicts([{ ...KITTEL, ...cambio }], [verde()], FUENTES)[0]).toBeNull();
    });

    it('solo los verdes: una alarma previa no se reusa (volver a verificar puede rescatarla)', () => {
        for (const status of ['page-mismatch', 'not-found', 'fuzzy-low', 'page-unverifiable', 'manual-pending'] as const) {
            expect(reuseIdenticalVerdicts([KITTEL], [verde({ status })], FUENTES)[0]).toBeNull();
        }
    });

    it('si la fuente ya no está en el trabajo, se juzga', () => {
        expect(reuseIdenticalVerdicts([KITTEL], [verde()], new Map([['res-otra', 'h1']]))[0]).toBeNull();
    });

    it('si la fuente cambió (otra huella: numeración recalibrada, libro re-extraído), se juzga', () => {
        expect(reuseIdenticalVerdicts([KITTEL], [verde()], new Map([['res-kittel', 'h2']]))[0]).toBeNull();
    });

    it('un verde sin huella (anterior a la regla) no se reusa; el reusado conserva la suya', () => {
        expect(reuseIdenticalVerdicts([KITTEL], [verde({ sourceFingerprint: undefined })], FUENTES)[0]).toBeNull();
        expect(reuseIdenticalVerdicts([KITTEL], [verde()], FUENTES)[0]!.sourceFingerprint).toBe('h1');
    });

    it('no copia claves `undefined` (Firestore las rechaza)', () => {
        const [r] = reuseIdenticalVerdicts([{ ...KITTEL, evidenceContext: undefined }], [verde({ bookSearch: undefined })], FUENTES);
        expect(Object.entries(r!).filter(([, v]) => v === undefined)).toEqual([]);
    });

    it('si hay varios, gana el primero de la lista (el llamador pone primero la versión más nueva)', () => {
        const [r] = reuseIdenticalVerdicts([KITTEL], [verde({ note: 'nueva' }), verde({ note: 'vieja' })], FUENTES);
        expect(r!.note).toBe('nueva');
    });
});

describe('el contexto previo solo entra en la identidad si la afirmación depende de él', () => {
    const robertson = { author: 'Robertson', title: '', pages: '961', evidence: 'Robertson cita el versículo sin él', evidenceIsQuoted: false };
    const varner = { author: 'Varner', title: '', pages: '162', evidence: 'Varner, en cambio, distingue la relativa, una interrogación principal, y la explicación final', evidenceIsQuoted: false };

    it('«sin él»: cambiar la oración anterior cambia la cita', () => {
        expect(citationIdentity({ ...robertson, evidenceContext: 'solo B omite el artículo' }))
            .not.toBe(citationIdentity({ ...robertson, evidenceContext: 'solo B omite el pronombre' }));
    });

    it('Varner 162: editar la oración anterior NO cambia la cita (el caso de B46)', () => {
        expect(citationIdentity({ ...varner, evidenceContext: 'McCartney adopta esta lectura' }))
            .toBe(citationIdentity({ ...varner, evidenceContext: 'McCartney, en su comentario, adopta esta lectura' }));
    });

    it('«that» conjunción y «there» existencial no son deixis (afinado tras la revisión)', () => {
        expect(dependsOnContext('Varner argues that the clause is final')).toBe(false);
        expect(dependsOnContext('there is an argument in οἵτινες')).toBe(false);
        expect(dependsOnContext('Ropes reads it as a question')).toBe(true);
    });

    it('qué cuenta como deixis', () => {
        expect(dependsOnContext('Robertson cita el versículo sin él')).toBe(true);
        expect(dependsOnContext('Tuggy clasifica ζωή en este versículo como vida física')).toBe(true);
        expect(dependsOnContext('Ropes lo explica aquí')).toBe(true);
        expect(dependsOnContext('Varner argues that this clause is final')).toBe(true); // por «this»
        expect(dependsOnContext(varner.evidence)).toBe(false);
        // «el» artículo no es «él», ni «estable» es «esta».
        expect(dependsOnContext('El genitivo se manifiesta en el artículo')).toBe(false);
        expect(dependsOnContext('una lectura estable')).toBe(false);
    });
});

describe('sourceFingerprint — la huella de la fuente', () => {
    const fuente = {
        numbering: { origin: 'confirmed' as const, segments: [{ fromSheet: 1, toSheet: 999, offset: -4 }] },
        chunks: [{ text: 'En el NT ζωή y ζῆν se refieren primeramente a la vida natural', pageHint: 'p. 230' }],
    };
    it('es estable con la misma fuente', () => {
        expect(sourceFingerprint(fuente)).toBe(sourceFingerprint(structuredClone(fuente)));
    });
    it('cambia si se recalibra la numeración, se re-extrae el texto o cambia el rótulo', () => {
        const base = sourceFingerprint(fuente);
        expect(sourceFingerprint({ ...fuente, numbering: { ...fuente.numbering, segments: [{ fromSheet: 1, toSheet: 999, offset: -3 }] } })).not.toBe(base);
        expect(sourceFingerprint({ ...fuente, numbering: null })).not.toBe(base);
        expect(sourceFingerprint({ ...fuente, chunks: [{ ...fuente.chunks[0]!, text: fuente.chunks[0]!.text + '.' }] })).not.toBe(base);
        expect(sourceFingerprint({ ...fuente, chunks: [{ ...fuente.chunks[0]!, pageHint: 'hoja 234' }] })).not.toBe(base);
    });
    it('el corte entre fragmentos cuenta: «ab»+«c» no es «a»+«bc»', () => {
        expect(sourceFingerprint({ numbering: null, chunks: [{ text: 'ab', pageHint: null }, { text: 'c', pageHint: null }] }))
            .not.toBe(sourceFingerprint({ numbering: null, chunks: [{ text: 'a', pageHint: null }, { text: 'bc', pageHint: null }] }));
    });
});
