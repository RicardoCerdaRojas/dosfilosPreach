import { addExportVisitor$, realmPlugin, type LexicalVisitor } from '@mdxeditor/editor';

/**
 * El salto de línea del editor (Mayúsculas+Enter) se guarda como salto de
 * línea ESTÁNDAR de markdown (`\` al final del renglón), no como un `\n`
 * suelto.
 *
 * Por qué: MDXEditor exporta su nodo de salto como el texto `"\n"`
 * (`LexicalLinebreakVisitor`), y en markdown estándar eso es un espacio. Los
 * lectores ya aplican `LINE_BREAK_RULE` (un salto dentro del párrafo se ve
 * como salto), así que el sermón se lee bien igual; esto hace que además el
 * texto GUARDADO diga lo que el pastor escribió, para cualquier herramienta
 * de afuera. La importación ya lo entiende (`MdastBreakVisitor`).
 */
export const HardLineBreakVisitor = {
    // `linebreak` es el tipo del LineBreakNode de Lexical.
    testLexicalNode: (node: { getType: () => string }) => node.getType() === 'linebreak',
    visitLexicalNode: ({ mdastParent, actions }: { mdastParent: unknown; actions: { appendToParent: (parent: unknown, node: unknown) => unknown } }) => {
        actions.appendToParent(mdastParent, { type: 'break' });
    },
    // Antes que el de MDXEditor (prioridad 0), que lo escribe como texto.
    priority: 100,
} as unknown as LexicalVisitor;

export const hardLineBreakPlugin = realmPlugin({
    init(realm) {
        realm.pubIn({ [addExportVisitor$]: HardLineBreakVisitor });
    },
});
