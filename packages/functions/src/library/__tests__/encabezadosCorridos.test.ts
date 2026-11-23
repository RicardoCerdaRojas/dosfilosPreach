import { describe, expect, it } from 'vitest';
import { clasificarTitulosAlTope, claveDeCorrido, claveDeEncabezado, encabezadosCorridosAIgnorar, esDelCorrido } from '../encabezadosCorridos';
import { chunkStructuredMarkdown } from '../markdownChunker';

/** Medido en Robertson (A8c): el título del libro abre 357 páginas y reiniciaba la sección. */
const LIBRO = 'A GRAMMAR OF THE GREEK NEW TESTAMENT';

describe('encabezadosCorridosAIgnorar', () => {
    it('el del libro, intercalado con varios capítulos, se ignora salvo la primera vez; los de capítulo no', () => {
        // Páginas pares: el libro; impares: el capítulo (tres capítulos, tres páginas cada uno).
        const caps = ['THE CASES', 'THE CASES', 'THE CASES', 'MODE', 'MODE', 'MODE', 'TENSE', 'TENSE', 'TENSE'];
        const topes = caps.flatMap((c, i) => [i === 4 ? 'A GRAMMAR OF THEGREEK NEW TESTAMENT' : LIBRO, c]);
        const out = encabezadosCorridosAIgnorar(topes);
        // Ninguna aparición del libro cuenta, tampoco la variante del escaneo.
        expect(out.filter((x, i) => i % 2 === 0 && x).length).toBe(9);
        expect(out[8]).toBe(true);
        // Los de capítulo siguen siendo títulos.
        expect(out.filter((x, i) => i % 2 === 1 && x).length).toBe(0);
    });

    it('un corrido que atraviesa solo dos capítulos se trata como de capítulo', () => {
        const caps = ['A', 'A', 'A', 'B', 'B', 'B'];
        const topes = caps.flatMap(c => [LIBRO, c]);
        expect(encabezadosCorridosAIgnorar(topes).every(x => x === false)).toBe(true);
    });

    it('un título que abre menos de tres páginas no es corrido', () => {
        expect(encabezadosCorridosAIgnorar(['A', 'B', 'A', 'C', 'D'])).toEqual([false, false, false, false, false]);
    });

    it('una palabra corta no se toma por variante («TENSE» / «TERSE»)', () => {
        // «TENSE» es el del libro (atraviesa X1, X2, X3); «TERSE», una vez, no es su variante.
        const capitulos = ['X1', 'X1', 'X1', 'X2', 'X2', 'X2', 'X3', 'X3', 'X3'];
        const topes = capitulos.flatMap((c, i) => [i === 4 ? 'TERSE' : 'TENSE', c]);
        const out = encabezadosCorridosAIgnorar(topes, topes);
        expect(out[0]).toBe(true);
        expect(out[8]).toBe(false);
    });

    it('la clave quita acentos y puntuación, en latín y griego, y conserva las cifras', () => {
        expect(claveDeEncabezado('MODE (ἜΓΚΛΙΣΙΣ)')).toBe(claveDeEncabezado('MODE (ΕΓΚΛΙΣΙΣ)'));
        expect(claveDeEncabezado('354  A GRAMMAR, OF')).toBe('354 a grammar of');
    });
});

describe('chunkStructuredMarkdown — encabezados corridos (Robertson, A8c)', () => {
    const relleno = 'Texto del cuerpo de la gramática con suficiente largo para formar un fragmento propio. '.repeat(4);
    // Cada capítulo abre con `#`, tiene una subsección `##`, y en las páginas
    // impares repite su título como `##`; las pares llevan el del libro.
    const capitulos = [['THE CASES', 'VIII. The Genitive'], ['MODE', '2. Causal sentences'], ['TENSE', 'Aorist']] as const;
    let n = 0;
    const md = capitulos.map(([cap, sub]) => [
        `<!-- page: ${++n} -->\n# ${cap}\n\n## ${sub}\n\n${relleno}\n`,
        `<!-- page: ${++n} -->\n## ${n === 4 ? 'A GRAMMAR OF THE GREEK NEW TESTAMKNT' : LIBRO}\n\n${relleno}\n`,
        `<!-- page: ${++n} -->\n## ${cap}\n\n${relleno}\n`,
        `<!-- page: ${++n} -->\n## ${LIBRO}\n\n${relleno}\n`,
        `<!-- page: ${++n} -->\n## ${cap}\n\n${relleno}\n`,
    ].join('')).join('');
    const cs = chunkStructuredMarkdown(md);
    const rutaDe = (hoja: number) => cs.find(c => c.page === hoja)?.sectionPath;

    it('el título del libro arriba de la página no reemplaza la sección', () => {
        // Hoja 2: la subsección sigue; hoja 4: tampoco la variante del escaneo la reemplaza.
        expect(rutaDe(2)).toEqual(['THE CASES', 'VIII. The Genitive']);
        expect(rutaDe(4)).toEqual(['THE CASES', 'VIII. The Genitive']);
        expect(rutaDe(9)).toEqual(['MODE', '2. Causal sentences']);
        expect(cs.some(c => c.sectionPath.some(h => /GRAMMAR/.test(h)))).toBe(false);
    });

    it('el del capítulo en que ya se está no reinicia la ruta: la página conserva su subsección (2026-11-23)', () => {
        // Antes la hoja 3 decía solo «THE CASES»: la 575 de Robertson perdía el genitivo.
        expect(rutaDe(3)).toEqual(['THE CASES', 'VIII. The Genitive']);
        expect(rutaDe(5)).toEqual(['THE CASES', 'VIII. The Genitive']);
        expect(rutaDe(6)).toEqual(['MODE', '2. Causal sentences']);
        expect(rutaDe(10)).toEqual(['MODE', '2. Causal sentences']);
        expect(rutaDe(11)).toEqual(['TENSE', 'Aorist']);
    });

    it('al entrar en otro capítulo, su corrido reinicia la ruta: la subsección del anterior no pasa', () => {
        // El capítulo nuevo llega SOLO por su corrido (sin «#» propio): no está en la ruta, y la reinicia.
        const md3 = [
            `<!-- page: 1 -->\n# THE CASES\n\n## VIII. The Genitive\n\n${relleno}\n`,
            ...[2, 3, 4].map(n => `<!-- page: ${n} -->\n## THE CASES\n\n${relleno}\n`),
            ...[5, 6, 7].map(n => `<!-- page: ${n} -->\n## MODE\n\n${relleno}\n`),
        ].join('');
        const cs3 = chunkStructuredMarkdown(md3);
        expect(cs3.find(c => c.page === 4)?.sectionPath).toEqual(['THE CASES', 'VIII. The Genitive']);
        expect(cs3.find(c => c.page === 6)?.sectionPath).toEqual(['THE CASES', 'MODE']);
        expect(cs3.some(c => c.page >= 5 && c.sectionPath.includes('VIII. The Genitive'))).toBe(false);
    });

    it('un subtítulo que abre páginas pero casi siempre va en medio no es corrido: reinicia como siempre', () => {
        // «Comment» abre 3 páginas y va en medio en 6: es un título real de cada perícopa.
        const pericopas = [1, 2, 3, 4, 5, 6].map(n => `<!-- page: ${n} -->\n${n <= 3 ? '' : `${relleno}\n\n`}## Comment\n\n${relleno}\n\n### ${n + 1}. Detalle de la perícopa\n\n${relleno}\n`).join('')
            + `<!-- page: 7 -->\n${relleno}\n\n## Comment\n\n${relleno}\n<!-- page: 8 -->\n${relleno}\n\n## Comment\n\n${relleno}\n<!-- page: 9 -->\n${relleno}\n\n## Comment\n\n${relleno}\n`;
        const cs4 = chunkStructuredMarkdown(`<!-- page: 0 -->\n# Jas 1\n\n${relleno}\n${pericopas}`);
        expect(cs4.filter(c => c.page === 7).at(-1)?.sectionPath).toEqual(['Jas 1', 'Comment']);
        // Arriba de la hoja 2, «Comment» reinicia: el detalle de la perícopa anterior no pasa.
        expect(cs4.find(c => c.page === 2)?.sectionPath).toEqual(['Jas 1', 'Comment']);
        expect(cs4.filter(c => c.page === 2).at(-1)?.sectionPath).toEqual(['Jas 1', 'Comment', '3. Detalle de la perícopa']);
    });

    it('«CAPÍTULO 3» y «CAPÍTULO 4» no son variantes: el 4 no hereda la ruta del 3 (revisión adversarial)', () => {
        const md5 = [
            `<!-- page: 1 -->\n## CAPÍTULO 3\n\n### El pecado\n\n${relleno}\n`,
            ...[2, 3, 4, 5].map(n => `<!-- page: ${n} -->\n## CAPÍTULO 3\n\n${relleno}\n`),
            `<!-- page: 6 -->\n## CAPÍTULO 4\n\n### La gracia\n\n${relleno}\n`,
            ...[7, 8, 9].map(n => `<!-- page: ${n} -->\n## CAPÍTULO 4\n\n${relleno}\n`),
        ].join('');
        const cs5 = chunkStructuredMarkdown(md5);
        // Como en main: «CAPÍTULO 4» entra como título; lo que importa es que «El pecado» no pasa.
        expect(cs5.filter(c => c.page >= 6).every(c => c.sectionPath.includes('CAPÍTULO 4') && !c.sectionPath.includes('El pecado'))).toBe(true);
        expect(esDelCorrido('CAPÍTULO 4', claveDeCorrido('CAPÍTULO 3'))).toBe(false);
        expect(esDelCorrido('SANTIAGO 2', claveDeCorrido('SANTIAGO 1'))).toBe(false);
        expect(esDelCorrido('CHAPTER XIII', claveDeCorrido('CHAPTER XII'))).toBe(false);
        expect(esDelCorrido('A GRAMMAR OP THE GREEK NEW TESTAMENT', claveDeCorrido(LIBRO))).toBe(true);
    });

    it('una subsección sin número no pasa la página del capítulo: sin numeración que la cierre, vuelve a lo grueso', () => {
        const md6 = `<!-- page: 1 -->\n# MODE\n\n### Causal sentences\n\n${relleno}\n` + [2, 3, 4].map(n => `<!-- page: ${n} -->\n# MODE\n\n${relleno}\n`).join('');
        expect(chunkStructuredMarkdown(md6).find(c => c.page === 3)?.sectionPath).toEqual(['MODE']);
    });

    it('una variante del escaneo que abre tres páginas es del título del libro, no un capítulo aparte', () => {
        const variante = 'A GRAMMAR OP THE GREEK NEW TESTAMENT';
        const caps = ['THE CASES', 'THE CASES', 'THE CASES', 'MODE', 'MODE', 'MODE', 'TENSE', 'TENSE', 'TENSE'];
        const topes = caps.flatMap((c, i) => [i % 3 === 1 ? variante : LIBRO, c]);
        expect(clasificarTitulosAlTope(topes).filter((c, i) => topes[i] === variante).every(c => c?.tipo === 'libro')).toBe(true);
        expect(clasificarTitulosAlTope(topes)[1]).toEqual({ tipo: 'capitulo', grupo: 'the cases' });
    });

    it('títulos numerados siguen siendo distintos (revisión adversarial: JFB quedaba todo en «GEN 1:1»)', () => {
        const md2 = ['GEN 1:1', 'GEN 1:2', 'GEN 1:3'].map(t => `## ${t}\n\n${relleno}\n`).join('');
        expect(chunkStructuredMarkdown(`<!-- page: 1 -->\n${md2}`).map(c => c.section)).toEqual(['GEN 1:1', 'GEN 1:2', 'GEN 1:3']);
    });
});

describe('qué cuenta como el título del libro', () => {
    // Un comentario de 40 páginas: el título del volumen abre las pares; las
    // impares, el capítulo; los subtítulos de perícopa van en medio y a veces arriba.
    const subtitulos = ['Translation', 'Notes', 'Comment', 'Explanation'];
    const topes: string[] = [];
    const todos: string[] = [];
    for (let p = 0; p < 40; p++) {
        const t = p % 2 === 0 ? 'A COMMENTARY ON JAMES' : p < 14 ? 'CHAPTER ONE' : p < 27 ? 'CHAPTER TWO' : 'CHAPTER THREE';
        // Cada tanto, un subtítulo abre la página.
        const arriba = p % 5 === 4 ? subtitulos[p % 4]! : t;
        topes.push(arriba);
        todos.push(arriba, ...subtitulos, ...subtitulos);
    }
    const out = encabezadosCorridosAIgnorar(topes, todos);

    it('solo el título del volumen; los subtítulos de perícopa que a veces abren página, no', () => {
        const ignorados = new Set(topes.filter((_, i) => out[i]));
        expect([...ignorados]).toEqual(['A COMMENTARY ON JAMES']);
    });

    it('una parte que corre solo por su tramo no es el título del libro', () => {
        const partes = Array.from({ length: 30 }, (_, p) => (p < 12 ? (p % 2 ? 'INTRODUCTION' : ['I. Author', 'II. Date', 'III. Place'][p % 3]!) : null));
        expect(encabezadosCorridosAIgnorar(partes, partes.filter((x): x is string => !!x)).every(x => !x)).toBe(true);
    });

    it('hay uno solo: el más frecuente de los que cumplen', () => {
        const libro = Array.from({ length: 60 }, (_, p) => (p % 2 === 0 ? 'OBADIAH, JONAH AND MICAH' : p % 6 === 1 ? 'INTRODUCTION' : ['OBADIAH', 'JONAH', 'MICAH'][Math.floor(p / 20)]!));
        const ign = encabezadosCorridosAIgnorar(libro, libro);
        expect(new Set(libro.filter((_, i) => ign[i]))).toEqual(new Set(['OBADIAH, JONAH AND MICAH']));
    });

    it('la clave del corrido quita el folio solo si hay al menos dos palabras de letras', () => {
        expect(claveDeCorrido('354 A GRAMMAR OF')).toBe('a grammar of');
        expect(claveDeCorrido('THE CASES 355')).toBe('the cases');
        expect(claveDeCorrido('GEN 1:1')).toBe('gen 1 1');
        expect(claveDeEncabezado('Chapter 2')).not.toBe(claveDeEncabezado('Chapter 1'));
        expect(claveDeEncabezado('בְּרֵאשִׁית')).not.toBe(claveDeEncabezado('וַיֹּאמֶר'));
    });

    // Cada condición, sola: un candidato que cumple todas menos una no se ignora.
    const capitulos = (n: number) => Array.from({ length: n }, (_, i) => ['CAP UNO', 'CAP DOS', 'CAP TRES'][Math.floor((i * 3) / n)]!);
    const alternado = (titulo: string, n: number) => capitulos(n).flatMap(c => [titulo, c]);

    it('cumple todo: se ignora', () => {
        const topes = alternado('Comment on the text', 12);
        expect(encabezadosCorridosAIgnorar(topes, topes).filter(Boolean).length).toBe(12);
    });

    it('casi siempre va en medio (menos del 90 % arriba): no', () => {
        const topes = alternado('Comment on the text', 12);
        const todos = [...topes, ...Array(12).fill('Comment on the text')];
        expect(encabezadosCorridosAIgnorar(topes, todos).some(Boolean)).toBe(false);
    });

    it('recorre solo una parte del volumen (menos del 60 %): no', () => {
        const topes = [...alternado('INTRODUCTION', 12), ...Array(40).fill(null)];
        expect(encabezadosCorridosAIgnorar(topes, topes.filter(Boolean)).some(Boolean)).toBe(false);
    });

    it('abre muy pocas páginas (menos del 5 %): no', () => {
        // 6 apariciones repartidas en 300 páginas, intercalando tres capítulos.
        const topes: Array<string | null> = Array(300).fill(null);
        [0, 60, 120, 180, 240, 299].forEach(p => { topes[p] = 'A RARE RUNNING HEAD'; });
        [[10, 20, 30], [100, 110, 130], [200, 210, 220]].forEach((ps, k) => ps.forEach(p => { topes[p] = ['CAP UNO', 'CAP DOS', 'CAP TRES'][k]!; }));
        expect(encabezadosCorridosAIgnorar(topes, topes.filter((x): x is string => !!x)).some(Boolean)).toBe(false);
    });
});
