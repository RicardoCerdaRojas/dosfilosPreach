import { describe, it, expect } from 'vitest';
import type { ExegeticalPaper } from '../../entities/ExegeticalPaper';
import { assembleMarkdown, assemblyContents } from '../assemblyContents';

/**
 * El ensamble volcaba el ANÁLISIS ESTRUCTURADO de los versículos sin prosa
 * «para que nunca sea sólo intro + conclusión». Medido sobre el trabajo de
 * Santiago 2:1–13 —cuatro preguntas, cuatro versículos—: de 4.566 palabras,
 * unas 4.000 eran volcados de los nueve versículos que el autor nunca pensó
 * incluir. Un trabajo de 2–3 páginas salió de 18.
 *
 * Y la prosa que SÍ se compuso entraba sin encabezado, mientras el volcado
 * traía el suyo: los versículos escritos quedaban colgando de la introducción.
 */
const paso = (over: Record<string, unknown>) => ({
    id: String(over.id), kind: over.kind, order: over.order ?? 0,
    verseRef: over.verse
        ? { bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: over.verse, verseEnd: over.verse }
        : null,
    accepted: over.body === undefined ? null : { markdown: over.body },
});

const paper = (...steps: unknown[]): ExegeticalPaper => ({
    title: 'Santiago 2:1–13',
    passage: { bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 1, verseEnd: 13 },
    displayLanguage: 'es',
    steps,
} as unknown as ExegeticalPaper);

const TRABAJO = paper(
    paso({ id: 'i', kind: 'introduction', order: 90, body: 'Texto de la introducción.' }),
    paso({ id: 'v1', kind: 'verse', order: 1, verse: 1, body: 'Prosa del uno.' }),
    paso({ id: 'v2', kind: 'verse', order: 2, verse: 2, body: '' }),
    paso({ id: 'v3', kind: 'verse', order: 3, verse: 3, body: '' }),
    paso({ id: 'v8', kind: 'verse', order: 8, verse: 8, body: 'Prosa del ocho.' }),
    paso({ id: 'c', kind: 'conclusion', order: 95, body: 'Texto de la conclusión.' }),
);

describe('assemblyContents', () => {
    it('sólo entra lo que tiene prosa compuesta', () => {
        const c = assemblyContents(TRABAJO.steps, 'es');
        expect(c.included.map(p => p.label)).toEqual(['Introducción', 'Santiago 2:1', 'Santiago 2:8', 'Conclusión']);
    });

    it('lo que queda fuera se dice, con nombre', () => {
        // Era el miedo legítimo del diseño anterior: que el autor descubriera
        // la ausencia al abrir el archivo. Se informa en vez de volcar.
        const c = assemblyContents(TRABAJO.steps, 'es');
        expect(c.excluded.map(p => p.label)).toEqual(['Santiago 2:2', 'Santiago 2:3']);
    });

    it('cuenta las palabras del documento, no las del estudio', () => {
        const c = assemblyContents(TRABAJO.steps, 'es');
        expect(c.words).toBe(14); // 4 + 3 + 3 + 4
    });

    it('un paso sin aceptar no aparece en ninguna de las dos listas', () => {
        const p = paper(paso({ id: 'v1', kind: 'verse', order: 1, verse: 1 }));
        const c = assemblyContents(p.steps, 'es');
        expect(c.included).toHaveLength(0);
        expect(c.excluded).toHaveLength(0);
    });
});

describe('assembleMarkdown', () => {
    it('cada versículo lleva su encabezado', () => {
        // Sin él los versículos escritos quedan colgando de la sección
        // anterior, y `replaceVerseSection` no encuentra la sección al
        // recomponer.
        const md = assembleMarkdown(TRABAJO, 'es');
        expect(md).toContain('## Santiago 2:1');
        expect(md).toContain('## Santiago 2:8');
        expect(md).toContain('## Introducción');
    });

    it('no entra nada de los versículos sin prosa', () => {
        const md = assembleMarkdown(TRABAJO, 'es');
        expect(md).not.toContain('Santiago 2:2');
        expect(md).not.toContain('Santiago 2:3');
    });

    it('un cuerpo que ya trae encabezado no lleva otro encima', () => {
        const p = paper(paso({ id: 'v1', kind: 'verse', order: 1, verse: 1, body: '## Santiago 2:1\n\nProsa.' }));
        const md = assembleMarkdown(p, 'es');
        expect(md.match(/## Santiago 2:1/g)).toHaveLength(1);
    });

    it('abre con el título del trabajo', () => {
        expect(assembleMarkdown(TRABAJO, 'es').startsWith('# Santiago 2:1–13')).toBe(true);
    });
});
