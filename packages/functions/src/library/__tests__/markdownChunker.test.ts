import { describe, it, expect } from 'vitest';
import { chunkStructuredMarkdown, esTituloIlegible, limpiarParaIndexar } from '../markdownChunker';

/**
 * Regression guard for the bug that killed the RAG index of a 425-page
 * commentary (`The Minor Prophets`, 2026-08-29).
 *
 * The chunker used to set `headingStack.length = headingLevel - 1` before
 * pushing. When the markdown SKIPPED a heading level (`#` → `###`, with no
 * `##`), growing the array that way left a HOLE, and the `[...headingStack]`
 * spread materialised it as `undefined`. Firestore then rejected the chunk
 * write outright:
 *
 *   Cannot use "undefined" as a Firestore value
 *   (found in field "metadata.sectionPath.`1`")
 *
 * That aborted the write loop after the embeddings had already been paid
 * for, leaving the resource at `indexingStatus: 'failed'` with zero chunks.
 */
describe('chunkStructuredMarkdown — sectionPath integrity', () => {
    const body = (label: string) => `${label} `.repeat(60);

    it('never emits a hole when the document skips a heading level', () => {
        const markdown = [
            '<!-- page: 1 -->',
            '# PART ONE: THE BOOK OF JONAH',
            body('intro'),
            '### Jonah 1:1-3 — The Call and the Flight',
            body('exposition'),
        ].join('\n\n');

        const chunks = chunkStructuredMarkdown(markdown);
        expect(chunks.length).toBeGreaterThan(0);

        for (const c of chunks) {
            // `.every` skips holes in a sparse array, so assert on length
            // and on each index explicitly — this is what Firestore does.
            for (let i = 0; i < c.sectionPath.length; i++) {
                expect(c.sectionPath[i]).toBeTypeOf('string');
            }
        }
    });

    it('collapses the skipped level into a contiguous breadcrumb', () => {
        const markdown = [
            '<!-- page: 1 -->',
            '# PART ONE',
            '### Jonah 1:1-3',
            body('exposition'),
        ].join('\n\n');

        const last = chunkStructuredMarkdown(markdown).at(-1)!;
        expect(last.sectionPath).toEqual(['PART ONE', 'Jonah 1:1-3']);
    });

    it('still pops back to a shallower level correctly', () => {
        const markdown = [
            '<!-- page: 1 -->',
            '# PART ONE',
            '### Jonah 1:1-3',
            body('a'),
            '## Chapter Two',
            body('b'),
            '# PART TWO',
            body('c'),
        ].join('\n\n');

        const chunks = chunkStructuredMarkdown(markdown);
        const pathFor = (heading: string) =>
            chunks.find(c => c.sectionPath.at(-1) === heading)?.sectionPath;

        expect(pathFor('Jonah 1:1-3')).toEqual(['PART ONE', 'Jonah 1:1-3']);
        expect(pathFor('Chapter Two')).toEqual(['PART ONE', 'Chapter Two']);
        expect(pathFor('PART TWO')).toEqual(['PART TWO']);
    });

    it('handles a document that opens at a deep level with no ancestors', () => {
        const markdown = [
            '<!-- page: 1 -->',
            '#### Deeply Nested Opening',
            body('orphan'),
        ].join('\n\n');

        const last = chunkStructuredMarkdown(markdown).at(-1)!;
        expect(last.sectionPath).toEqual(['Deeply Nested Opening']);
        expect(last.sectionPath).not.toContain(undefined);
    });
});

describe('fase «buscador», etapa 2: fragmentos limpios', () => {
    const partir = chunkStructuredMarkdown;
    const palabras = Array.from({ length: 1500 }, (_, i) => `palabra${i}`);
    const texto = `<!-- page: 1 -->\n${palabras.join(' ')}`;

    it('ningún fragmento empieza ni termina en medio de una palabra, y no se pierde ninguna', () => {
        const chunks = partir(texto, { maxChars: 2000, minChars: 200, overlapChars: 150 });
        expect(chunks.length).toBeGreaterThan(5);
        for (const c of chunks) {
            const ps = c.text.split(/\s+/);
            expect(ps[0]).toMatch(/^palabra\d+$/);
            expect(ps[ps.length - 1]).toMatch(/^palabra\d+$/);
        }
        const vistas = new Set(chunks.flatMap(c => c.text.split(/\s+/)));
        expect(palabras.every(p => vistas.has(p))).toBe(true);
    });

    it('los fragmentos se solapan (el contexto de un corte llega al siguiente)', () => {
        const chunks = partir(texto, { maxChars: 2000, minChars: 200, overlapChars: 150 });
        const fin = chunks[0]!.text.split(/\s+/).slice(-3);
        expect(chunks[1]!.text.startsWith(fin[0]!) || chunks[1]!.text.includes(fin[2]!)).toBe(true);
    });

    it('los títulos ilegibles del OCR no son títulos; los buenos sí', () => {
        for (const malo of ['τ πνμ μν υ', 's ωσ', '7 κ ατοι βλασφημουσιν τ καλν νομα τ', "25“.Oμοωs δ καì 'Pααβ n πóρνn οκ ξ εργων"]) {
            expect(esTituloIlegible(malo)).toBe(true);
        }
        for (const bueno of ['5:1–18 CONCLUSION', '2.3 El genitivo', '15. ἡ εὐχή', 'James 3:13–18', 'Excursus H', 'The Epistle of James', 'C. Part 2: Faith and Prayer (5:13–18)',
            // Falsos positivos hallados en la biblioteca real:
            '19.38 ὁ ἐρχόμενος ὁ βασιλεύς {C}', 'CAPÍTULO 4: LA PREPOSICIÓN, εἰμί y EL ADJETIVO', 'B. τίθημι (θε*) y ἵστημι (στα *)', 'Y descendiendo a Jope,… (1:3)', 'B. Demonstrative Pronouns: pointers—οὗτος, ἐκεῖνος, ὅδε (325-35)',
            'Agape/ἀγάπη', 'Juan 3:16 — ἀγαπάω/love', 'Section B λόγος', 'Dagesh in ב ג ד כ פ ת', 'Las letras א ב ג']) {
            expect(esTituloIlegible(bueno)).toBe(false);
        }
        const chunks = partir('<!-- page: 1 -->\n# Capítulo 1\n\n###### τ πνμ μν υ\n\n' + 'texto '.repeat(60), { minChars: 10 });
        expect(chunks.every(c => c.sectionPath.join('|') === 'Capítulo 1')).toBe(true);
    });

    it('sin cercas de código; las tablas HTML pasan a texto con sus celdas', () => {
        expect(limpiarParaIndexar('```python\nIn the Introduction I have stated\n```')).not.toContain('```');
        expect(limpiarParaIndexar('```python\nIn the Introduction')).toContain('In the Introduction');
        const t = limpiarParaIndexar('<table><tr><th>P</th><th>C</th></tr><tr><td>ἀλείψαντες</td><td>αὐτὸν</td></tr></table>');
        expect(t).not.toMatch(/<\/?t[a-z]*>/);
        expect(t).toContain('ἀλείψαντες');
        expect(t).toContain('αὐτὸν');
    });

    it('el chunker aplica la limpieza: ningún fragmento sale con cercas de código', () => {
        const chunks = partir('<!-- page: 1 -->\n```python\n' + 'In the Introduction I have stated '.repeat(20) + '\n```', { minChars: 10 });
        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks.every(c => !c.text.includes('```'))).toBe(true);
    });

    it('no pierde texto con una «palabra» muy larga sin espacios (revisión adversarial)', () => {
        const largo = 'palabra '.repeat(300) + 'x'.repeat(5000) + ' fin'.repeat(300);
        const chunks = partir(`<!-- page: 1 -->\n${largo}`, { maxChars: 2000, minChars: 200, overlapChars: 150 });
        const xs = chunks.reduce((n, c) => n + (c.text.match(/x/g) ?? []).length, 0);
        expect(xs).toBeGreaterThanOrEqual(5000);
        const indice = 'Capítulo uno ' + '.'.repeat(700) + ' 5 ' + 'texto '.repeat(400);
        const ci = partir(`<!-- page: 1 -->\n${indice}`, { maxChars: 600, minChars: 50, overlapChars: 100 });
        expect(ci.reduce((n, c) => n + (c.text.match(/\./g) ?? []).length, 0)).toBeGreaterThanOrEqual(700);
    });

    it('el texto corto bajo un título descartado (o al comienzo de página) no se pierde, y sin «#»', () => {
        const md = '<!-- page: 4 -->\n###### s ωσ\n\nLa sabiduría de lo alto es primeramente pura, después pacífica, amable.\n\n## 3:18 Fruto de justicia\n\n' + 'texto '.repeat(80);
        const chunks = partir(md, { maxChars: 2000, minChars: 200, overlapChars: 150 });
        const todo = chunks.map(c => c.text).join('\n');
        expect(todo).toContain('primeramente pura');
        expect(todo).not.toContain('######');
    });

    it('limpiar no se come palabras ni notación de grafemas', () => {
        expect(limpiarParaIndexar('```In the Introduction')).toContain('In the Introduction');
        expect(limpiarParaIndexar('the grapheme <b> and <p> differ')).toBe('the grapheme <b> and <p> differ');
        expect(limpiarParaIndexar('<TABLE><TR><TD>uno</TD></TR></TABLE>')).not.toMatch(/<\/?T/);
    });
});

