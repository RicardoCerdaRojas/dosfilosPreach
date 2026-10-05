import { describe, expect, it } from 'vitest';
import { toMarkdown } from 'mdast-util-to-markdown';
import { parseSermonDocument, runsText } from '@dosfilos/domain';

import { HardLineBreakVisitor } from '../hardLineBreak';

type Visitor = {
    testLexicalNode: (node: { getType: () => string }) => boolean;
    visitLexicalNode: (args: { mdastParent: unknown; actions: { appendToParent: (p: unknown, n: unknown) => unknown } }) => void;
    priority: number;
};
const visitor = HardLineBreakVisitor as unknown as Visitor;

describe('el editor guarda el salto de línea estándar', () => {
    it('toma el nodo de salto de Lexical, y no otros', () => {
        expect(visitor.testLexicalNode({ getType: () => 'linebreak' })).toBe(true);
        expect(visitor.testLexicalNode({ getType: () => 'text' })).toBe(false);
        expect(visitor.priority).toBeGreaterThan(0);
    });

    it('REGRESIÓN: lo exporta como salto de markdown («\\» al final del renglón), no como un espacio', () => {
        const paragraph = { type: 'paragraph', children: [{ type: 'text', value: 'A nivel institucional' }] as unknown[] };
        visitor.visitLexicalNode({
            mdastParent: paragraph,
            actions: { appendToParent: (parent, node) => (parent as typeof paragraph).children.push(node) },
        });
        paragraph.children.push({ type: 'text', value: 'Hace muchos años.' });
        const markdown = toMarkdown({ type: 'root', children: [paragraph] } as never);
        expect(markdown.trim()).toBe('A nivel institucional\\\nHace muchos años.');
        // Y lo que se guarda, los lectores lo leen en dos renglones.
        const [block] = parseSermonDocument(markdown);
        expect(runsText((block as unknown as { runs: Parameters<typeof runsText>[0] }).runs)).toBe('A nivel institucional\nHace muchos años.');
    });
});
