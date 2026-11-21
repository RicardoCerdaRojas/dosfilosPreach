import { describe, expect, it } from 'vitest';
import { numberingFromReview, reviewPdf, reviewSheets, romanInRunningHead, type PdfReviewInput } from '../pdfReview';

/** Martin, WBC 48 (subido el 17-nov): hoja − 111 = página impresa, medido a mano en la p. 104. */
const martin = (over: Partial<PdfReviewInput> = {}): PdfReviewInput => ({
    declared: { title: 'James (Word Biblical Commentary 48)', author: 'Ralph P. Martin', books: ['JAS'], bibliographyYear: null },
    cited: { title: 'James', year: 1988, publisher: 'Word', isbn: null },
    front: [
        { sheet: 1, lines: ['WORD BIBLICAL COMMENTARY', 'Volume 48'] },
        { sheet: 3, lines: ['James', 'RALPH P. MARTIN', 'WORD BOOKS, PUBLISHER · WACO, TEXAS'] },
        { sheet: 4, lines: ['Word Biblical Commentary', 'James', 'Copyright © 1988 by Word, Incorporated', 'Reprinted 2004', 'ISBN 0-8499-0247-9'] },
        // La página de la serie nombra todos los tomos: no dice de cuál libro es éste.
        { sheet: 6, lines: ['1 Corinthians — Gordon Fee', 'Romans 1–8', 'Hebrews 1–8', 'James', '1 Peter', 'Jude, 2 Peter'] },
    ],
    samples: [
        { sheet: 215, lines: ['JAMES 3:13–18', 'Comment'], folio: '104' },
        { sheet: 340, lines: ['Explanation'], folio: '229' },
        { sheet: 460, lines: ['JAMES 5:7–11'], folio: '349' },
    ],
    file: { numPages: 620, producer: 'Adobe PDF Library 9.0', hasText: true },
    ...over,
});

const tramo = (offset: number) => ({ origin: 'confirmed' as const, segments: [{ fromSheet: 1, toSheet: 620, offset }] });

describe('reviewPdf', () => {
    it('Martin WBC 48: es Santiago, edición de 1988 (la reimpresión no cuenta), un desfase de −111', () => {
        const r = reviewPdf(martin());
        expect(r.identity).toMatchObject({ verdict: 'coincide', evidence: 'James' });
        expect(r.edition).toMatchObject({ year: 1988, yearsSeen: [1988, 2004], isbn: '9780849902475', vsCited: 'misma', evidence: 'Copyright © 1988 by Word, Incorporated' });
        expect(r.pagination).toMatchObject({ verdict: 'una', offset: -111, storedDisagrees: false });
        expect(r.signals).toEqual([]);
        expect(r.needsAttention).toBe(false);
    });

    it('Gardner subido como ZECNT Santiago: la portada y los encabezados dicen 1 Corintios', () => {
        const r = reviewPdf(martin({
            declared: { title: 'James (ZECNT)', author: 'Paul Gardner', books: ['JAS'] },
            front: [{ sheet: 3, lines: ['1 CORINTHIANS', 'Paul Gardner', 'Zondervan Exegetical Commentary on the New Testament'] }],
            samples: [{ sheet: 200, lines: ['1 CORINTHIANS 3:1–9'], folio: '170' }],
        }));
        expect(r.identity).toEqual({ verdict: 'otro-libro', found: ['1CO'], evidence: '1 CORINTHIANS' });
        expect(r.needsAttention).toBe(true);
        // La página de la serie ZECNT nombra Santiago entre otros tomos: no lo convierte en Santiago.
        const conSerie = reviewPdf(martin({
            declared: { title: 'James (ZECNT)', author: 'Paul Gardner', books: ['JAS'] },
            front: [
                { sheet: 2, lines: ['Matthew', 'Mark', 'Luke', 'James', 'Galatians'] },
                { sheet: 3, lines: ['1 CORINTHIANS', 'Paul Gardner'] },
            ],
            samples: [],
        }));
        expect(conSerie.identity.verdict).toBe('otro-libro');
    });

    it('una abreviatura que es también una palabra no nombra un libro: «IS» no es Isaías (encabezado de Mayor)', () => {
        const r = reviewPdf(martin({ front: [], samples: [{ sheet: 137, lines: ['TO WHOM THE EPISTLE IS ADDRESSED exix'], folio: null }] }));
        expect(r.identity).toMatchObject({ verdict: 'sin-dato', found: [] });
        // El nombre, aunque sea en singular o en español, sí.
        expect(reviewPdf(martin({ declared: { title: 'Salmos', books: ['PSA'] }, front: [{ sheet: 3, lines: ['PSALM 23'] }], samples: [] })).identity.verdict).toBe('coincide');
        expect(reviewPdf(martin({ front: [{ sheet: 3, lines: ['Comentario a Santiago'] }], samples: [] })).identity.verdict).toBe('coincide');
    });

    it('el nombre del autor no es el libro: «James D. G. Dunn» en un comentario a Romanos', () => {
        const r = reviewPdf(martin({
            declared: { title: 'Romans 1–8', author: 'James D. G. Dunn', books: ['ROM'] },
            front: [{ sheet: 3, lines: ['James D. G. Dunn'] }, { sheet: 4, lines: ['Romans 1–8'] }],
        }));
        expect(r.identity).toMatchObject({ verdict: 'coincide', found: ['ROM'] });
        // Sin la portada, no hay dato: no se acusa a Santiago por el nombre del autor.
        expect(reviewPdf(martin({ declared: { title: 'Romans', author: 'James D. G. Dunn', books: ['ROM'] }, front: [{ sheet: 3, lines: ['James D. G. Dunn'] }], samples: [] })).identity.verdict).toBe('sin-dato');
        // Una gramática no comenta un libro: no aplica.
        expect(reviewPdf(martin({ declared: { title: 'Wallace', books: [] } })).identity.verdict).toBe('no-aplica');
    });

    it('un libro electrónico convertido (Moo, Davids, Vlachos): sin folios y con la señal de conversión', () => {
        const r = reviewPdf(martin({
            samples: [{ sheet: 150, lines: ['texto'], folio: null }, { sheet: 300, lines: ['texto'], folio: null }],
            file: { numPages: 600, producer: 'calibre 6.11.0 [https://calibre-ebook.com]', hasText: true },
        }));
        expect(r.pagination.verdict).toBe('sin-folios');
        expect(r.signals).toEqual([{ kind: 'conversion', detail: 'calibre' }]);
    });

    it('una marca de agua de biblioteca no oficial se informa con la palabra encontrada', () => {
        const r = reviewPdf(martin({ samples: [{ sheet: 215, lines: ['JAMES 3:13', 'Downloaded from Z-Library'], folio: '104' }] }));
        expect(r.signals).toEqual([{ kind: 'marca-de-agua', detail: 'z-library' }]);
        expect(reviewPdf(martin({ file: { numPages: 1, hasText: true, isEbook: true } })).signals).toEqual([{ kind: 'conversion', detail: 'epub' }]);
    });

    it('la edición de la copia no es la citada (Metzger 1975 contra 1994); el ISBN igual manda sobre el año', () => {
        const otra = reviewPdf(martin({ cited: { title: 'James', year: 1994, publisher: null, isbn: null } }));
        expect(otra.edition.vsCited).toBe('distinta');
        expect(otra.needsAttention).toBe(true);
        const mismoIsbn = reviewPdf(martin({ cited: { title: 'James', year: 2004, publisher: null, isbn: '9780849902475' } }));
        expect(mismoIsbn.edition.vsCited).toBe('misma');
        // Contra la ficha guardada.
        expect(reviewPdf(martin({ declared: { ...martin().declared, bibliographyYear: '2004' } })).edition.vsBibliography).toBe('distinta');
    });

    it('sin ©, el último año de los créditos; sin créditos, sin año', () => {
        const sinC = reviewPdf(martin({ front: [{ sheet: 4, lines: ['First published 1976', 'Printed in USA 1982'] }] }));
        // «First published» es la edición; una impresión posterior no cambia las páginas.
        expect(sinC.edition.year).toBe(1976);
        expect(reviewPdf(martin({ front: [{ sheet: 1, lines: ['James'] }] })).edition).toMatchObject({ year: null, isbn: null, evidence: null });
    });

    it('la numeración: varias, parcial, sin texto, y la guardada que no coincide (Kittel, desfase 0)', () => {
        const varias = reviewPdf(martin({ samples: [{ sheet: 20, lines: [], folio: 'xii' }, { sheet: 215, lines: [], folio: '104' }, { sheet: 460, lines: [], folio: '351' }] }));
        expect(varias.pagination).toMatchObject({ verdict: 'varias', offset: null });
        // Dos desfases arábigos (−111 y −109): ni una regla ni dos tramos.
        expect(varias.pagination.points[0]).toEqual({ sheet: 20, folio: 'xii', style: 'roman', offset: -8 });
        expect(varias.pagination.runs).toEqual([]);
        const parcial = reviewPdf(martin({ samples: [{ sheet: 215, lines: [], folio: '104' }, { sheet: 340, lines: [], folio: null }] }));
        expect(parcial.pagination).toMatchObject({ verdict: 'parcial', offset: -111 });
        expect(reviewPdf(martin({ file: { numPages: 600, hasText: false } })).pagination.verdict).toBe('sin-texto');
        const kittel = reviewPdf(martin({ declared: { ...martin().declared, storedNumbering: tramo(0), storedConfirmed: true } }));
        expect(kittel.pagination).toMatchObject({ storedDisagrees: true, storedAgrees: false });
        expect(reviewPdf(martin({ declared: { ...martin().declared, storedNumbering: tramo(-111) } })).pagination).toMatchObject({ storedDisagrees: false, storedAgrees: true });
        // Una sola hoja que no coincide basta: el tramo guardado termina antes de la última muestra.
        const corto = { origin: 'confirmed' as const, segments: [{ fromSheet: 1, toSheet: 400, offset: -111 }] };
        expect(reviewPdf(martin({ declared: { ...martin().declared, storedNumbering: corto } })).pagination).toMatchObject({ storedDisagrees: true, storedAgrees: false });
        // Sin numeración guardada no hay nada que comparar.
        expect(reviewPdf(martin()).pagination).toMatchObject({ storedDisagrees: false, storedAgrees: false });
        // Ni sin folios: dos «nada» no coinciden.
        expect(reviewPdf(martin({ declared: { ...martin().declared, storedNumbering: tramo(-111) }, samples: [{ sheet: 150, lines: [], folio: null }] })).pagination).toMatchObject({ storedAgrees: false, storedDisagrees: false });
        expect(kittel.needsAttention).toBe(true);
    });
});

describe('Mayor (Internet Archive), medido en la biblioteca el 2026-11-21', () => {
    const mayor = martin({
        declared: { title: 'The Epistle of James - the Greek text with introduction', author: 'Mayor', books: ['JAS'], bibliographyYear: '1978' },
        cited: { title: 'The Epistle of St. James', year: 1910, publisher: 'Macmillan', isbn: null },
        front: [
            { sheet: 6, lines: ['Reprinted 1978 from the 1897 edition', 'ISBN: 0-8010-6073-7', '1978'] },
            { sheet: 8, lines: ['Digitized by the Internet Archive', 'in 2022 with funding from', 'Kahle/Austin Foundation'] },
        ],
        samples: [
            { sheet: 137, lines: ['TO WHOM THE EPISTLE IS ADDRESSED exix', 'he also takes occasion'], folio: null },
            { sheet: 272, lines: ['ecliv INTRODUCTION', '2. Speculum (m).'], folio: null },
            { sheet: 405, lines: ['III 15-17] NOTES 127'], folio: '127' },
        ],
        file: { numPages: 540, producer: 'Internet Archive PDF 1.4.16', hasText: true },
    });

    it('la copia es de 1978 (no de la digitalización, 2022) y reimprime la edición de 1897: esa se compara con el catálogo', () => {
        const r = reviewPdf(mayor);
        expect(r.edition).toMatchObject({ year: 1978, reprintOf: 1897, yearsSeen: [1897, 1978], vsCited: 'distinta', vsBibliography: 'misma', evidence: 'Reprinted 1978 from the 1897 edition' });
        expect(r.signals).toEqual([]);
        // El catálogo citando 1897 es la MISMA edición, aunque la copia sea de 1978.
        expect(reviewPdf({ ...mayor, cited: { ...mayor.cited!, year: 1897 } }).edition.vsCited).toBe('misma');
        // La ficha con el año de la edición reproducida también coincide.
        expect(reviewPdf({ ...mayor, declared: { ...mayor.declared, bibliographyYear: '1897' } }).edition.vsBibliography).toBe('misma');
        expect(reviewPdf({ ...mayor, declared: { ...mayor.declared, bibliographyYear: '1910' } }).edition.vsBibliography).toBe('distinta');
    });

    it('la introducción en romanos y el cuerpo en arábigos: dos tramos, cada uno con su regla', () => {
        const r = reviewPdf(mayor);
        expect(r.pagination.points.map(p => p.folio)).toEqual(['cxix', 'ccliv', '127']);
        expect(r.pagination).toMatchObject({ verdict: 'tramos', offset: null });
        expect(r.pagination.runs).toEqual([
            { style: 'roman', offset: -18, fromSheet: 19, lastReadSheet: 272, read: 2 },
            { style: 'arabic', offset: -278, fromSheet: 279, lastReadSheet: 405, read: 1 },
        ]);
        // Con una sola hoja arábiga no se guarda: se calibra.
        expect(r.pagination.proposal).toBeNull();
        expect(r.needsAttention).toBe(true);
    });

    it('con la cuarta muestra (90 %), los dos tramos se pueden guardar; lo no leído queda sin número', () => {
        const r = reviewPdf({ ...mayor, samples: [...mayor.samples, { sheet: 486, lines: ['V 7] NOTES 208'], folio: '208' }] });
        expect(r.pagination.proposal).toEqual({ origin: 'confirmed', segments: [
            { fromSheet: 1, toSheet: 18, offset: null },
            { fromSheet: 19, toSheet: 272, offset: -18, style: 'roman' },
            { fromSheet: 273, toSheet: 278, offset: null },
            { fromSheet: 279, toSheet: 540, offset: -278 },
        ] });
        expect(r.edition.vsCited).toBe('distinta');
        // Con la edición que cita el catálogo, los dos tramos guardables no piden atención; con una sola hoja del cuerpo, sí.
        const citada = { ...mayor.cited!, year: 1897 };
        expect(reviewPdf({ ...mayor, cited: citada, samples: [...mayor.samples, { sheet: 486, lines: [], folio: '208' }] }).needsAttention).toBe(false);
        expect(reviewPdf({ ...mayor, cited: citada }).needsAttention).toBe(true);
        // Si el arábigo empieza justo después del último romano leído, no hay hueco.
        const pegado = reviewPdf({ ...mayor, samples: [mayor.samples[0]!, mayor.samples[1]!, { sheet: 405, lines: [], folio: '133' }, { sheet: 486, lines: [], folio: '214' }] });
        expect(pegado.pagination.proposal?.segments).toEqual([
            { fromSheet: 1, toSheet: 18, offset: null },
            { fromSheet: 19, toSheet: 272, offset: -18, style: 'roman' },
            { fromSheet: 273, toSheet: 540, offset: -272 },
        ]);
        // Guardada igual: coincide en cada hoja leída, romanos incluidos.
        const guardada = reviewPdf({ ...mayor, samples: [...mayor.samples, { sheet: 486, lines: [], folio: '208' }], declared: { ...mayor.declared, storedNumbering: r.pagination.proposal } });
        expect(guardada.pagination).toMatchObject({ storedAgrees: true, storedDisagrees: false });
    });

    it('dos tramos solo si el arábigo empieza (p. 1) después del último romano leído, y cada uno con una regla', () => {
        const con = (samples: PdfReviewInput['samples']) => reviewPdf({ ...mayor, samples }).pagination;
        // El arábigo empezaría en la hoja 279 pero hay un romano en la 300: no es esta forma.
        expect(con([{ sheet: 137, lines: [], folio: 'cxix' }, { sheet: 300, lines: [], folio: 'cclxxxii' }, { sheet: 405, lines: [], folio: '127' }]).verdict).toBe('varias');
        // Dos desfases romanos: no hay regla.
        expect(con([{ sheet: 137, lines: [], folio: 'cxix' }, { sheet: 272, lines: [], folio: 'ccl' }, { sheet: 405, lines: [], folio: '127' }]).verdict).toBe('varias');
        // Un folio que no es número ni romano.
        expect(con([{ sheet: 137, lines: [], folio: 'cxix' }, { sheet: 272, lines: [], folio: 'A-3' }, { sheet: 405, lines: [], folio: '127' }]).verdict).toBe('varias');
        // Arábigo antes que romano.
        expect(con([{ sheet: 137, lines: [], folio: '20' }, { sheet: 405, lines: [], folio: 'ccclxxxvii' }]).verdict).toBe('varias');
        // El romano empezaría antes de la hoja 1.
        expect(con([{ sheet: 10, lines: [], folio: 'xx' }, { sheet: 405, lines: [], folio: '127' }]).verdict).toBe('varias');
    });

    it('el romano del encabezado: solo la primera o la última palabra, y solo si da un romano', () => {
        expect(romanInRunningHead(['TO WHOM THE EPISTLE IS ADDRESSED exix'])).toBe('cxix');
        expect(romanInRunningHead(['texto', 'xiv'])).toBe('xiv');
        expect(romanInRunningHead(['The Epistle mix'])).toBe('mix');
        expect(romanInRunningHead(['Civil rights and the epistle'])).toBeNull();
        expect(romanInRunningHead(['I said', 'he said'])).toBeNull();
        expect(romanInRunningHead([])).toBeNull();
    });
});

describe('la reimpresión: solo cuando la línea dice qué edición reproduce', () => {
    const con = (linea: string, copyright = 'Copyright © 2001') => reviewPdf(martin({ cited: null, front: [{ sheet: 4, lines: [copyright, linea] }] })).edition;
    it('las fórmulas explícitas, en inglés y en español', () => {
        expect(con('Reprint of the 1910 edition published by Macmillan')).toMatchObject({ year: 2001, reprintOf: 1910 });
        expect(con('Reprinted from the third edition, 1913')).toMatchObject({ reprintOf: 1913 });
        expect(con('Facsimile of the 1885 edition')).toMatchObject({ reprintOf: 1885 });
        expect(con('Reimpresión de la segunda edición de 1960')).toMatchObject({ reprintOf: 1960 });
    });
    it('«First published», una reimpresión sin edición, o un año no anterior, no son reproducciones', () => {
        expect(con('First published in 1897').reprintOf).toBeNull();
        expect(con('Reprinted 2004').reprintOf).toBeNull();
        expect(con('Reprinted from the 2001 edition').reprintOf).toBeNull();
        expect(reviewPdf(martin()).edition.reprintOf).toBeNull();
    });
});

describe('numberingFromReview', () => {
    it('Martin: las hojas antes de la página 1 quedan sin número; desde la 112, resta 111', () => {
        const r = reviewPdf(martin());
        expect(numberingFromReview(r.pagination, 620)).toEqual({ origin: 'confirmed', segments: [
            { fromSheet: 1, toSheet: 111, offset: null },
            { fromSheet: 112, toSheet: 620, offset: -111 },
        ] });
    });
    it('con una sola hoja leída no se guarda; un desfase positivo empieza en la hoja 1', () => {
        const una = reviewPdf(martin({ samples: [{ sheet: 215, lines: [], folio: '104' }, { sheet: 340, lines: [], folio: null }] }));
        expect(numberingFromReview(una.pagination, 620)).toBeNull();
        const positivo = reviewPdf(martin({ samples: [{ sheet: 10, lines: [], folio: '12' }, { sheet: 20, lines: [], folio: '22' }] }));
        expect(numberingFromReview(positivo.pagination, 30)).toEqual({ origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 30, offset: 2 }] });
        const parcial = reviewPdf(martin({ samples: [{ sheet: 215, lines: [], folio: '104' }, { sheet: 340, lines: [], folio: '229' }, { sheet: 460, lines: [], folio: null }] }));
        expect(parcial.pagination.verdict).toBe('parcial');
        expect(numberingFromReview(parcial.pagination, 620)?.segments.at(-1)).toEqual({ fromSheet: 112, toSheet: 620, offset: -111 });
        expect(numberingFromReview(reviewPdf(martin()).pagination, 50)).toBeNull();
    });
});

describe('reviewSheets', () => {
    it('las primeras 14 hojas y cuatro del cuerpo; un libro corto no repite', () => {
        expect(reviewSheets(620)).toEqual({ front: Array.from({ length: 14 }, (_, i) => i + 1), samples: [155, 310, 465, 558] });
        expect(reviewSheets(16)).toEqual({ front: Array.from({ length: 14 }, (_, i) => i + 1) , samples: [] });
        expect(reviewSheets(40).samples).toEqual([20, 30, 36]);
    });
});
