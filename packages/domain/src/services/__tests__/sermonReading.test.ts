import { describe, it, expect } from 'vitest';

import { buildReadingBlocks, decodeMarkdownText, normalizeSectionBody } from '../sermonReading';
import { LINE_BREAK_FIXTURES } from '../lineBreakFixtures';
import { splitSentences } from '../sentenceSegmentation';
import {
    buildAnnotationAnchor,
    resolveAnnotationAnchor,
    splitWords,
} from '../../entities/SermonAnnotation';
import { extractClaimForMarker } from '../../entities/FidelityReport';

describe('splitSentences', () => {
    it('splits on terminators and keeps offsets', () => {
        const text = 'Dios llama. El pastor responde con temor. ¿Y nosotros?';
        const spans = splitSentences(text);
        expect(spans.map((s) => s.text)).toEqual([
            'Dios llama.',
            'El pastor responde con temor.',
            '¿Y nosotros?',
        ]);
        for (const span of spans) {
            expect(text.slice(span.start, span.end)).toBe(span.text);
        }
    });

    it('does not split inside abbreviations or numbers', () => {
        expect(splitSentences('Ver cf. Romanos 8.28 para el punto.').map((s) => s.text)).toEqual([
            'Ver cf. Romanos 8.28 para el punto.',
        ]);
    });

    it('keeps closing punctuation with its sentence', () => {
        const spans = splitSentences('Él dijo «basta». Y calló para siempre.');
        expect(spans[0].text).toBe('Él dijo «basta».');
    });

    it('returns the whole text when there is no terminator', () => {
        expect(splitSentences('Un título sin punto').map((s) => s.text)).toEqual([
            'Un título sin punto',
        ]);
    });

    it('is the same ruler the fidelity pass uses for the claim before [N]', () => {
        const prose = 'Pablo escribe desde la cárcel. La alegría no depende del lugar [1].';
        const claim = extractClaimForMarker(prose, 1);
        const sentences = splitSentences(prose).map((s) => s.text);
        expect(claim).toBe('Pablo escribe desde la cárcel.');
        expect(sentences[0]).toBe(claim);
    });
});

describe('normalizeSectionBody', () => {
    it('strips markdown and maps every character back to the raw body', () => {
        const body = 'El **evangelio** es poder.';
        const { text, map } = normalizeSectionBody(body);
        expect(text).toBe('El evangelio es poder.');
        for (let i = 0; i < text.length; i += 1) {
            expect(body[map[i]]).toBe(text[i]);
        }
    });

    it('unwraps internal links and drops anchors', () => {
        const body = 'Lee [Juan 3:16](#juan-3-16) hoy. {#ancla}';
        const { text } = normalizeSectionBody(body);
        expect(text).toBe('Lee Juan 3:16 hoy. ');
    });
});

describe('buildReadingBlocks', () => {
    const body = [
        '### El primer punto',
        '',
        'Dios llama a **Moisés** desde la zarza.',
        'La zarza arde y no se consume.',
        '',
        'Nadie discute con el fuego [1].',
    ].join('\n');

    it('splits subheadings from paragraphs and KEEPS the pastor\'s line breaks (LINE_BREAK_RULE)', () => {
        const blocks = buildReadingBlocks(body);
        expect(blocks.map((b) => b.kind)).toEqual(['subheading', 'paragraph', 'paragraph']);
        expect(blocks[0].text).toBe('El primer punto');
        expect(blocks[1].text).toBe('Dios llama a Moisés desde la zarza.\nLa zarza arde y no se consume.');
        expect(blocks[1].units.map((u) => !!u.lineBreak)).toEqual([false, true]);
    });

    it('gives every unit a range that still reads correctly in the RAW body', () => {
        const blocks = buildReadingBlocks(body);
        const units = blocks[1].units;
        expect(units).toHaveLength(2);
        // The raw slice carries the markdown back — that is the point: the
        // offsets are raw-body coordinates, not rendered ones.
        expect(body.slice(units[0].sourceStart, units[0].sourceEnd)).toBe(
            'Dios llama a **Moisés** desde la zarza.',
        );
        expect(body.slice(units[1].sourceStart, units[1].sourceEnd)).toBe(
            'La zarza arde y no se consume.',
        );
    });

    it('keeps citation markers inside the unit text', () => {
        const blocks = buildReadingBlocks(body);
        expect(blocks[2].units[0].text).toBe('Nadie discute con el fuego [1].');
    });

    it('consumes blockquote markers and keeps the quote as one block', () => {
        const quoted = [
            'Texto de entrega.',
            '',
            '> «From the LORD. RSV has, more literally, from the presence.»',
            '>',
            '> — David W. Baker, Obadiah, Jonah and Micah [1]',
        ].join('\n');
        const blocks = buildReadingBlocks(quoted);
        expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'quote']);
        // Ni `>` literales ni el `> >` que producía la línea vacía de cita.
        expect(blocks[1].text).not.toContain('>');
        expect(blocks[1].text).toContain('David W. Baker');
    });

    it('splits bullets into one block each, marker consumed', () => {
        const listed = [
            '### Referencias Cruzadas',
            '',
            '- "Cuando anduviere por valle de sombra de muerte" (Salmo 23:4)',
            '- "¿Soy yo Dios de cerca solamente?" (Jeremías 23:23)',
        ].join('\n');
        const blocks = buildReadingBlocks(listed);
        expect(blocks.map((b) => b.kind)).toEqual(['subheading', 'listitem', 'listitem']);
        expect(blocks[1].text.startsWith('-')).toBe(false);
        expect(blocks[2].text).toContain('Jeremías 23:23');
    });

    it('keeps a wrapped bullet with its own item', () => {
        const wrapped = ['- Primer punto que sigue', '  en la línea de abajo.', '- Segundo punto.'].join('\n');
        const blocks = buildReadingBlocks(wrapped);
        expect(blocks.map((b) => b.kind)).toEqual(['listitem', 'listitem']);
        expect(blocks[0].text).toBe('Primer punto que sigue\nen la línea de abajo.');
    });

    it('does not let a star bullet open emphasis and swallow the next item', () => {
        const blocks = buildReadingBlocks(['* Primero.', '* Segundo.'].join('\n'));
        expect(blocks.map((b) => b.text)).toEqual(['Primero.', 'Segundo.']);
    });

    it('still unwraps real emphasis', () => {
        expect(buildReadingBlocks('El *evangelio* es poder.')[0].text).toBe('El evangelio es poder.');
    });

    it('returns nothing for an empty body', () => {
        expect(buildReadingBlocks('')).toEqual([]);
        expect(buildReadingBlocks('   \n\n  ')).toEqual([]);
    });
});

describe('annotation anchors', () => {
    const body = 'Dios llama a Moisés desde la zarza. La zarza arde y no se consume.';

    it('round-trips an unchanged body through the fast path', () => {
        const anchor = buildAnnotationAnchor('el-llamado', body, 36, 66);
        expect(anchor.exact).toBe('La zarza arde y no se consume.');
        expect(resolveAnnotationAnchor(anchor, body)).toEqual({ start: 36, end: 66 });
    });

    it('re-finds the text after an edit shifted every offset', () => {
        const anchor = buildAnnotationAnchor('el-llamado', body, 36, 66);
        const edited = 'Al tercer día, ' + body;
        const resolved = resolveAnnotationAnchor(anchor, edited);
        expect(resolved).not.toBeNull();
        expect(edited.slice(resolved!.start, resolved!.end)).toBe(anchor.exact);
    });

    it('uses the surrounding context to pick between repeated text', () => {
        const repeated = 'Él vino. Y calló. Ella vino. Y calló.';
        const second = repeated.lastIndexOf('Y calló.');
        const anchor = buildAnnotationAnchor('x', repeated, second, second + 8);
        expect(anchor.exact).toBe('Y calló.');
        // The offset alone is ambiguous — drop it and let the context decide.
        const resolved = resolveAnnotationAnchor({ ...anchor, offset: 0 }, repeated);
        expect(resolved).toEqual({ start: second, end: second + 8 });
    });

    it('orphans the mark when the highlighted text is gone', () => {
        const anchor = buildAnnotationAnchor('el-llamado', body, 36, 66);
        expect(resolveAnnotationAnchor(anchor, 'Un sermón completamente distinto.')).toBeNull();
    });
});

describe('splitWords', () => {
    it('corta en palabras con offsets que reconstruyen el original', () => {
        const text = 'Dios llama  a Moisés.';
        const words = splitWords(text);
        expect(words.map((w) => w.text)).toEqual(['Dios', 'llama', 'a', 'Moisés.']);
        for (const w of words) expect(text.slice(w.start, w.end)).toBe(w.text);
    });

    it('ignora espacios de sobra y texto vacío', () => {
        expect(splitWords('   ')).toEqual([]);
        expect(splitWords('')).toEqual([]);
    });

    it('sirve para anclar: la primera y la última palabra dan el rango', () => {
        const body = 'Dios llama a Moisés desde la zarza.';
        const words = splitWords(body);
        const from = words[2].start;
        const to = words[4].end;
        expect(body.slice(from, to)).toBe('a Moisés desde');
    });
});

describe('texto limpio en el atril (fase «Atril: tinta y lectura»)', () => {
    const texts = (body: string) => buildReadingBlocks(body).map((b) => b.text);

    it('REGRESIÓN: las entidades del editor web se leen, no se muestran («precaminosa.&#x20;»)', () => {
        expect(texts('Una inclinación precaminosa.&#x20;\n\nOtra&nbsp;cosa &amp; más.')).toEqual([
            'Una inclinación precaminosa.',
            'Otra cosa & más.',
        ]);
    });

    it('REGRESIÓN: los escapes de markdown no dejan la barra («\\[...]»)', () => {
        expect(texts('Como dijo: \\[...] y luego \\*nada\\*.')).toEqual(['Como dijo: [...] y luego *nada*.']);
        // Escapado sólo al abrir: tampoco es énfasis.
        expect(texts('Vale \\*5* pesos.')).toEqual(['Vale *5* pesos.']);
    });

    it('REGRESIÓN: un asterisco solo en su renglón no es un párrafo', () => {
        expect(texts('Último punto.\n\n*\n\n* * *\n\n***')).toEqual(['Último punto.']);
    });

    it('una viñeta con asterisco sigue siendo viñeta', () => {
        expect(buildReadingBlocks('* Primero\n* Segundo').map((b) => [b.kind, b.text])).toEqual([
            ['listitem', 'Primero'],
            ['listitem', 'Segundo'],
        ]);
    });

    it('las posiciones siguen apuntando al texto original (las marcas no se corren)', () => {
        const body = 'Uno &#x20;dos. Tres.';
        const { text, map } = normalizeSectionBody(body);
        const at = text.indexOf('Tres');
        expect(body.slice(map[at]!, map[at]! + 4)).toBe('Tres');
    });

    it('una entidad desconocida se deja como está', () => {
        expect(decodeMarkdownText('a &foo; b')).toBe('a &foo; b');
    });
});

describe('saltos de línea del pastor (LINE_BREAK_RULE)', () => {
    it.each(LINE_BREAK_FIXTURES)('$name', ({ markdown, lines }) => {
        const blocks = buildReadingBlocks(markdown);
        // Cada bloque, renglón por renglón, como lo escribió el pastor.
        expect(blocks.map((b) => b.text.split('\n'))).toEqual(lines);
    });

    it('una etiqueta sin punto no se funde con la oración que sigue: es su propia unidad', () => {
        const [block] = buildReadingBlocks('**A nivel institucional**\nHace muchos años observé algo.');
        expect(block!.units.map((u) => u.text)).toEqual(['A nivel institucional', 'Hace muchos años observé algo.']);
        expect(block!.units[1]!.lineBreak).toBe(true);
    });

    it('los offsets siguen apuntando al texto original después del salto', () => {
        const body = 'Uno.\\\nDos.';
        const [block] = buildReadingBlocks(body);
        const second = block!.units[1]!;
        expect(body.slice(second.sourceStart, second.sourceEnd)).toBe('Dos.');
    });
});

describe('la Escritura del punto (cita que empieza con una referencia)', () => {
    it('se marca como Escritura', () => {
        const [quote] = buildReadingBlocks('> **Jonás 4:5-8** — 5 Y salió Jonás de la ciudad. 6 Y preparó Jehová Dios una calabacera.');
        expect(quote!.kind).toBe('quote');
        expect(quote!.scripture).toBe(true);
    });

    it('una cita de un comentario no', () => {
        const [quote] = buildReadingBlocks('> La lástima de Jonás se corresponde con sus intereses. — David F. Burt, Comentario Jonás, p. 89');
        expect(quote!.scripture).toBeUndefined();
    });

    it('una cita que nombra una referencia en el medio tampoco', () => {
        const [quote] = buildReadingBlocks('> Como dice Jonás 4:2, Dios es clemente.');
        expect(quote!.scripture).toBeUndefined();
    });
});

