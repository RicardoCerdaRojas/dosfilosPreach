import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import ReactMarkdown from 'react-markdown';
import { LINE_BREAK_FIXTURES } from '@dosfilos/domain';

import { SERMON_REMARK_PLUGINS } from '../sermonMarkdown';

/** Lo que se ve, bloque por bloque y renglón por renglón (como en los casos compartidos). */
function visibleLines(markdown: string): string[][] {
    const { container } = render(<ReactMarkdown remarkPlugins={SERMON_REMARK_PLUGINS}>{markdown}</ReactMarkdown>);
    const blocks = [...container.querySelectorAll('p, li')].filter((el) => !el.querySelector('p'));
    return blocks.map((el) => {
        // Sólo un <br> es un salto VISIBLE: un \n crudo en el HTML el navegador
        // lo muestra como espacio (era el defecto).
        const html = el.innerHTML.replace(/<br\s*\/?>/g, '\u2063');
        const text = (new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '').replace(/\s+/g, ' ');
        return text.split('\u2063').map((l) => l.trim()).filter(Boolean);
    });
}

describe('saltos de línea en la web (LINE_BREAK_RULE)', () => {
    it.each(LINE_BREAK_FIXTURES)('$name', ({ markdown, lines }) => {
        expect(visibleLines(markdown)).toEqual(lines);
    });
});

describe('quién lee un sermón en la web usa la regla', () => {
    // Si alguien vuelve a `[remarkGfm]` en uno de estos, el salto del pastor
    // vuelve a pegarse ahí y nada más lo notaría (revisión adversarial).
    const SRC = join(__dirname, '../..');
    it.each(['components/sermons/SermonPreview.tsx', 'pages/sermons/preach.tsx'])('%s', (file) => {
        const source = readFileSync(join(SRC, file), 'utf8');
        expect(source).toContain('remarkPlugins={SERMON_REMARK_PLUGINS}');
        expect(source).not.toContain('remarkPlugins={[remarkGfm]}');
    });

    it('el lienzo del borrador, leyendo, también', () => {
        const source = readFileSync(join(SRC, 'components/canvas-chat/MarkdownRenderer.tsx'), 'utf8');
        expect(source).toContain('reading ? SERMON_REMARK_PLUGINS');
    });
});

