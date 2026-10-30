import { describe, expect, it } from 'vitest';
import { replaceVerseSection } from '../composedVerseSections';

describe('replaceVerseSection — recomponer un verso sin tocar los demás', () => {
    const paper = [
        '# Análisis de Salmo 23:1-3',
        '',
        '## Salmos 23:1',
        '',
        'La primera cláusula es nominal.',
        '',
        '## Salmos 23:2',
        '',
        'Ficha mecánica.',
        '',
        '## Salmos 23:3',
        '',
        'El polel de שׁוב.',
        '',
    ].join('\n');

    it('cambia solo el verso pedido', () => {
        const out = replaceVerseSection(paper, 'Salmos 23:2', 'Prosa nueva y más extensa para el verso 2.');
        expect(out).toContain('Prosa nueva y más extensa');
        expect(out).not.toContain('Ficha mecánica');
        expect(out).toContain('La primera cláusula es nominal.');
        expect(out).toContain('El polel de שׁוב.');
    });

    it('sin sección para ese verso no pega nada: dos versiones del mismo verso es peor', () => {
        expect(replaceVerseSection(paper, 'Salmos 23:9', 'texto')).toBeNull();
    });

    it('una prosa vacía no borra el verso', () => {
        expect(replaceVerseSection(paper, 'Salmos 23:2', '   ')).toBeNull();
    });

    it('REGRESIÓN B68a: un ensamble guardado con «Salmos 23:2» se encuentra con la clave nueva «Salmo 23:2»', () => {
        const out = replaceVerseSection(paper, 'Salmo 23:2', 'Prosa nueva.');
        expect(out).toContain('Prosa nueva.');
        expect(out).not.toContain('Ficha mecánica');
        expect(out).toContain('El polel de שׁוב.');
    });

    it('la misma prosa deja el documento intacto', () => {
        expect(replaceVerseSection(paper, 'Salmos 23:2', 'Ficha mecánica.')).toBe(paper);
    });
});
