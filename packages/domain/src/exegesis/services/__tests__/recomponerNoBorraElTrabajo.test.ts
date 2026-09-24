import { describe, it, expect } from 'vitest';
import { locateVerseSections, replaceVerseSection } from '../composedVerseSections';

/**
 * Recomponer un verso BORRABA EL TRABAJO ENTERO.
 *
 * Medido sobre el trabajo de Santiago 2:1–13 del fundador: 41.416 caracteres
 * quedaron en 39. La prosa nueva del verso 2:1 reemplazó el documento
 * completo, y el ensamblado guardado pasó a contener sólo ese verso.
 *
 * La cadena: el título era «# Santiago 2:1-13» y la clave del verso «Santiago
 * 2:1». El guardián que impide que «1:2» capture a «1:20» miraba el carácter
 * siguiente y sólo rechazaba dígitos y dos puntos; un guion —el de un RANGO—
 * pasaba. Con el título reclamado, y siendo de nivel 1 mientras las secciones
 * son de nivel 2, su sección llegaba hasta el final del documento.
 */
const TRABAJO = [
    '# Santiago 2:1-13',
    '',
    '## Introducción',
    '',
    'El pasaje abre la sección parenética.',
    '',
    '## Santiago 2:1',
    '',
    'Prosa vieja del primer verso.',
    '',
    '## Santiago 2:2',
    '',
    'Prosa del segundo verso, que NO debe desaparecer.',
    '',
    '## Conclusión',
    '',
    'El cierre del trabajo.',
].join('\n');

describe('el título con rango no se hace pasar por su primer verso', () => {
    it('la clave del verso reclama su propia sección, no el título', () => {
        const loc = locateVerseSections(TRABAJO, ['Santiago 2:1']);
        const bounds = loc!.get('Santiago 2:1')!;
        expect(TRABAJO.slice(0, bounds.bodyStart)).toContain('## Santiago 2:1');
        // Si reclamara el título, la sección llegaría al final del documento.
        expect(bounds.end).toBeLessThan(TRABAJO.length);
    });

    it('recomponer un verso deja el resto del trabajo en pie', () => {
        const next = replaceVerseSection(TRABAJO, 'Santiago 2:1', 'Prosa nueva y corta.');
        expect(next).not.toBeNull();
        expect(next!).toContain('Prosa nueva y corta.');
        expect(next!).not.toContain('Prosa vieja del primer verso.');
        // Lo que se perdía:
        expect(next!).toContain('Prosa del segundo verso, que NO debe desaparecer.');
        expect(next!).toContain('El cierre del trabajo.');
        expect(next!).toContain('El pasaje abre la sección parenética.');
    });

    it('un trabajo de un solo verso: el título y la sección se llaman igual', () => {
        // Acá el guion no salva: los dos encabezados dicen exactamente lo
        // mismo. Los distingue la profundidad.
        const unSoloVerso = [
            '# Santiago 2:1', '', '## Santiago 2:1', '', 'Prosa del verso.', '',
            '## Conclusión', '', 'El cierre.',
        ].join('\n');
        const next = replaceVerseSection(unSoloVerso, 'Santiago 2:1', 'Prosa nueva.');
        expect(next!).toContain('Prosa nueva.');
        expect(next!).toContain('El cierre.');
    });

    it('sigue sin confundir 1:2 con 1:20', () => {
        // La razón por la que el guardián existe.
        const conVeinte = [
            '# Santiago 1:1-27', '', '## Santiago 1:20', '', 'Prosa del veinte.', '',
            '## Santiago 1:2', '', 'Prosa del dos.',
        ].join('\n');
        const next = replaceVerseSection(conVeinte, 'Santiago 1:2', 'NUEVA.');
        expect(next!).toContain('Prosa del veinte.');
        expect(next!).not.toContain('Prosa del dos.');
    });

    it('un rango de dos versos se reclama a sí mismo', () => {
        const conRango = [
            '# Santiago 2:1-13', '', '## Santiago 2:1-2', '', 'Prosa del par.', '',
            '## Santiago 2:3', '', 'Prosa del tres.',
        ].join('\n');
        const next = replaceVerseSection(conRango, 'Santiago 2:1-2', 'NUEVA.');
        expect(next!).toContain('NUEVA.');
        expect(next!).toContain('Prosa del tres.');
    });
});
