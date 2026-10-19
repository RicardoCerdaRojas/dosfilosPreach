import { describe, expect, it } from 'vitest';
import { conservarEscritura, listaDePaginas, paginasDelTexto } from '../loteDeExtraccion';

describe('paginasDelTexto', () => {
    it('lee las dos formas del texto actual: el md (`<!-- page: N -->` y `---`) y el textContent (`[PAGE N]`)', () => {
        const md = '<!-- page: 1 -->\nUno\n\n---\n\n<!-- page: 2 -->\nDos y φθορᾷ';
        expect([...paginasDelTexto(md)]).toEqual([[1, 'Uno'], [2, 'Dos y φθορᾷ']]);
        const tc = '[PAGE 1]\nUno\n\n[PAGE 2]\nDos';
        expect([...paginasDelTexto(tc)]).toEqual([[1, 'Uno'], [2, 'Dos']]);
        expect(paginasDelTexto('sin marcas').size).toBe(0);
    });
});

// El caso real: Schreiner, 1-2 Pedro, p. 302, nota 78 (lote prueba-2, 2026-10-19).
const ingles = 'could refer to moral corruption, but the parallel term shows that destruction at the end of the age is intended by the author';
const actual302 = `⁷⁸ The term φθορᾷ ${ingles} (φθαρήσονται; ἀδικούμενοι μισθὸν ἀδικίας).`;
const nueva302 = `⁷⁸ The term ᾷ ${ingles} ( ; ).`;
const pag = (page: number, t: string) => ({ page, text: t, md: t });

describe('conservarEscritura', () => {
    it('una página que pierde más de la mitad de las palabras griegas conserva el texto actual; las demás quedan nuevas', () => {
        const r = conservarEscritura([pag(301, `Texto nuevo bien leído ${ingles}.`), pag(302, nueva302)], new Map([[301, 'Texto viejo.'], [302, actual302]]));
        expect(r.paginas[0]!.md).toContain('Texto nuevo');
        expect(r.paginas[1]!.md).toBe(actual302);
        expect(r.conservadas).toEqual([{ pagina: 302, escritura: 'griego', antes: 5, despues: 0 }]);
        expect(r.desalineado).toBe(false);
    });

    it('la basura del OCR (mayúsculas latinas leídas como griegas) no cuenta como griego', () => {
        const basura = `ΙΝΤRΟDUCΤΙΟΝ ΤΟ ΤΗΕ ΕΡΙSΤLΕS ΟF ΡΕΤΕR ${ingles}`;
        const r = conservarEscritura([pag(1, `INTRODUCTION TO THE EPISTLES OF PETER ${ingles}`)], new Map([[1, basura]]));
        expect(r.conservadas).toEqual([]);
    });

    it('si no es la misma página (numeración corrida), no se conserva', () => {
        const otraPagina = `Una página que habla de otra cosa por completo, distinta, sin relación alguna con esta nota: φθορᾷ φθαρήσονται ἀδικούμενοι μισθὸν`;
        const r = conservarEscritura([pag(302, nueva302)], new Map([[302, otraPagina]]));
        expect(r.conservadas).toEqual([]);
    });

    it('muchas páginas a la vez es desalineación: no se conserva ninguna y se avisa', () => {
        const nuevas = Array.from({ length: 50 }, (_, i) => pag(i + 1, nueva302));
        const r = conservarEscritura(nuevas, new Map(nuevas.map(p => [p.page, actual302])));
        expect(r.desalineado).toBe(true);
        expect(r.paginas.every(p => p.md === nueva302)).toBe(true);
    });

    it('también el hebreo (consonantes; los puntos solos no cuentan)', () => {
        const heb = 'בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם';
        const r = conservarEscritura([pag(5, `Genesis 1:1 ${ingles}`)], new Map([[5, `Genesis 1:1 ${heb} ${ingles}`]]));
        expect(r.conservadas.map(c => c.escritura)).toEqual(['hebreo']);
        const sinPuntos = 'בראשית ברא אלהים את השמים';
        expect(conservarEscritura([pag(5, `${sinPuntos} ${ingles}`)], new Map([[5, `${heb} ${ingles}`]])).conservadas).toEqual([]);
    });
});

describe('listaDePaginas', () => {
    it('páginas sueltas y tramos, con tope', () => {
        expect(listaDePaginas([{ desde: 2, hasta: 2 }, { desde: 7, hasta: 9 }])).toBe('2, 7–9');
        expect(listaDePaginas(Array.from({ length: 15 }, (_, i) => ({ desde: i * 2, hasta: i * 2 })), 3)).toBe('0, 2, 4 y 12 más');
    });
});
