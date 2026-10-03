import { describe, it, expect } from 'vitest';
import {
    customManuscriptStyle,
    DEFAULT_MANUSCRIPT_STYLE,
    manuscriptStyleFor,
    SERMON_MANUSCRIPT_STYLE,
} from '../sermonManuscriptStyle';
import { buildSectionProsePrompt } from '../buildSectionProsePrompt';
import { deriveSectionWalk } from '../deriveSectionWalk';
import { SPANISH_REGISTER } from '../../shared/spanishRegister';

/**
 * El estilo del manuscrito, editable (#5 del ejercicio de Jonás 4:5-11): el
 * usuario guarda el suyo; el registro del español no se toca.
 */
const MIO = 'Escribe párrafos largos, con una ilustración por idea.';

describe('manuscriptStyleFor', () => {
    it('sin estilo propio es el del sistema', () => {
        expect(manuscriptStyleFor(null)).toBe(SERMON_MANUSCRIPT_STYLE);
        expect(manuscriptStyleFor('   ')).toBe(SERMON_MANUSCRIPT_STYLE);
        expect(SERMON_MANUSCRIPT_STYLE).toContain(DEFAULT_MANUSCRIPT_STYLE);
    });

    it('con estilo propio reemplaza el del sistema pero conserva el registro', () => {
        const s = manuscriptStyleFor(MIO);
        expect(s).toContain(MIO);
        expect(s).toContain(SPANISH_REGISTER);
        expect(s).not.toContain('EL MANUSCRITO NO ES LA PREDICACIÓN');
    });
});

describe('customManuscriptStyle — qué se guarda', () => {
    it('igual al del sistema, aunque cambien los espacios, no se guarda', () => {
        expect(customManuscriptStyle(DEFAULT_MANUSCRIPT_STYLE)).toBeNull();
        expect(customManuscriptStyle(`\n${DEFAULT_MANUSCRIPT_STYLE.replace(/\n\s+/g, '\n')}  `)).toBeNull();
        expect(customManuscriptStyle('')).toBeNull();
        expect(customManuscriptStyle(undefined)).toBeNull();
    });

    it('distinto se guarda', () => {
        expect(customManuscriptStyle(`  ${MIO}  `)).toBe(MIO);
    });
});

describe('el redactor por sección usa el estilo del usuario', () => {
    const [seccion] = deriveSectionWalk({ points: [{ title: 'I. Dios prepara' }], sermonPassage: 'Jonás 4:6' });
    const input = {
        section: seccion!, sectionLabel: 's', sectionJob: 'j', elements: [], passage: 'Jonás 4:6',
    };

    it('con el suyo', () => {
        const p = buildSectionProsePrompt({ ...input, manuscriptStyle: MIO });
        expect(p).toContain(MIO);
        expect(p).toContain(SPANISH_REGISTER);
        expect(p).not.toContain('EL MANUSCRITO NO ES LA PREDICACIÓN');
    });

    it('sin el suyo, el del sistema', () => {
        expect(buildSectionProsePrompt(input)).toContain('EL MANUSCRITO NO ES LA PREDICACIÓN');
    });
});
