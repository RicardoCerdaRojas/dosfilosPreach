import { describe, it, expect } from 'vitest';
import { bibliographyFileFormat, parseBibtex, parseRis } from '../bibliographyFileFormats';

/** Etapa 2b: lo exportado de ATLA, NTA o Zotero entra sin el asistente. */
const RIS = `TY  - JOUR
AU  - Laws, Sophie
TI  - Does Scripture Speak in Vain? A Reconsideration of James IV. 5
T2  - New Testament Studies
VL  - 20
PY  - 1973
SP  - 210
EP  - 215
DO  - 10.1017/S0028688500023237
ER  -
TY  - BOOK
AU  - Johnson, Luke Timothy
TI  - The Letter of James
T2  - Anchor Bible
PY  - 1995
PB  - Doubleday
SN  - 0385415451
ER  - `;

const BIB = `@article{kirk1969,
  author = {Kirk, J. A.},
  title = {The Meaning of Wisdom in {James}: Examination of a Hypothesis},
  journal = {New Testament Studies},
  volume = 16,
  year = {1969},
  pages = {24--38}
}
@comment{ignorar}
@book{varner2017, author = {Varner, William and Otro, A.}, title = "James: A Commentary on the Greek Text", publisher = {Fontes Press}, year = {2017}}`;

describe('RIS y BibTeX', () => {
    it('RIS: artículo con revista, páginas y DOI; libro con ISBN', () => {
        const [laws, johnson] = parseRis(RIS);
        expect(laws).toMatchObject({ author: 'Laws, Sophie', series: 'New Testament Studies 20', year: 1973, pageCount: 6, doi: '10.1017/S0028688500023237', sourceType: 'journal-article', requirement: 'recommended' });
        expect(johnson).toMatchObject({ title: 'The Letter of James', publisher: 'Doubleday', isbn: '0385415451', sourceType: 'theological-monograph', pageCount: null });
    });

    it('RIS: un registro sin «ER» no se pierde al empezar el siguiente', () => {
        expect(parseRis('TY  - JOUR\nTI  - Primero\nTY  - BOOK\nTI  - Segundo\nER  -').map(x => x.title)).toEqual(['Primero', 'Segundo']);
    });

    it('BibTeX: llaves anidadas, números sueltos, varios autores, @comment fuera', () => {
        const xs = parseBibtex(BIB);
        expect(xs).toHaveLength(2);
        expect(xs[0]).toMatchObject({ title: 'The Meaning of Wisdom in James: Examination of a Hypothesis', series: 'New Testament Studies 16', year: 1969, pageCount: 15, sourceType: 'journal-article' });
        expect(xs[1]).toMatchObject({ author: 'Varner, William y Otro, A.', publisher: 'Fontes Press', sourceType: 'theological-monograph' });
    });

    it('reconoce el formato por la extensión o por el contenido', () => {
        expect(bibliographyFileFormat('export.ris', '')).toBe('ris');
        expect(bibliographyFileFormat('x.txt', RIS)).toBe('ris');
        expect(bibliographyFileFormat('lib.bib', '')).toBe('bibtex');
        expect(bibliographyFileFormat('notas.txt', 'Davids, Peter H. La epístola…')).toBeNull();
    });
});
