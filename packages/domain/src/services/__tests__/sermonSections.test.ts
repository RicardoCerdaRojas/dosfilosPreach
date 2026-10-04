import { describe, expect, it } from 'vitest';
import { extractSections, extractSectionsWithBody, slugifyHeader, tokenizeCitations } from '../sermonSections';

/**
 * Los slugs anclan las marcas entre web y tablet (M-05). Estos casos fijan el
 * contrato: si cambian, la tinta del sábado no aparece el domingo.
 */
describe('secciones del sermón', () => {
    const md = [
        'Texto antes del primer título.',
        '',
        '## I. La inclinación egocéntrica (vv. 5-8)',
        'Cuerpo uno.',
        '### Palabras clave',
        'Sub.',
        '## Conclusión',
        'Fin.',
        '## Conclusión',
        'Otra vez.',
    ].join('\n');

    it('slug sin tildes ni signos, con guiones', () => {
        expect(slugifyHeader('I. La inclinación egocéntrica (vv. 5-8)')).toBe('i-la-inclinacion-egocentrica-vv-5-8');
        expect(slugifyHeader('¿Por qué?')).toBe('por-que');
    });

    it('sólo los ## son secciones; los ### quedan dentro del cuerpo', () => {
        const s = extractSectionsWithBody(md);
        expect(s.map((x) => x.slug)).toEqual([
            'preambulo',
            'i-la-inclinacion-egocentrica-vv-5-8',
            'conclusion',
            'conclusion-2',
        ]);
        expect(s[1]!.body).toContain('### Palabras clave');
    });

    it('la navegación de la web y la tablet usan los MISMOS slugs', () => {
        const conCuerpo = extractSectionsWithBody(md).filter((x) => x.title).map((x) => x.slug);
        expect(extractSections(md).map((x) => x.slug)).toEqual(conCuerpo);
    });

    it('marcadores de cita [N] y [1, 3], pero no referencias ni corchetes de prosa', () => {
        const t = tokenizeCitations('Dios es fiel [1] y bueno [2, 3]. Ver [Jonás 4:2] y [nota].');
        expect(t.filter((x) => x.kind === 'citation').map((x) => (x.kind === 'citation' ? x.ordinals : []))).toEqual([
            [1],
            [2, 3],
        ]);
    });
});

describe('slugs únicos (revisión adversarial de A7)', () => {
    it('un título «Preámbulo» con texto antes no repite el slug de la sección sin título', () => {
        const s = extractSectionsWithBody('Texto suelto.\n\n## Preámbulo\nCuerpo.');
        expect(s.map((x) => x.slug)).toEqual(['preambulo', 'preambulo-2']);
    });

    it('sin texto antes, «Preámbulo» conserva su slug (no cambian las marcas que ya existen)', () => {
        expect(extractSectionsWithBody('## Preámbulo\nCuerpo.').map((x) => x.slug)).toEqual(['preambulo']);
    });
});
