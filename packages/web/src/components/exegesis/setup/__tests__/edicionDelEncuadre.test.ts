import { describe, it, expect } from 'vitest';
import { ASSIGNMENT_BRIEF_MAX_CHARS } from '@dosfilos/domain';
import { evaluarEdicionDelEncuadre } from '../edicionDelEncuadre';

describe('evaluarEdicionDelEncuadre', () => {
    it('sin cambios cuando el borrador repite el encuadre', () => {
        expect(evaluarEdicionDelEncuadre('Encuadre', 'Encuadre')).toEqual({ tipo: 'sinCambios' });
    });

    it('los espacios en los bordes no cuentan como cambio', () => {
        expect(evaluarEdicionDelEncuadre('Encuadre', '  Encuadre\n')).toEqual({ tipo: 'sinCambios' });
    });

    it('un trabajo sin encuadre y un borrador vacío no tienen nada que guardar', () => {
        expect(evaluarEdicionDelEncuadre(null, '   ')).toEqual({ tipo: 'sinCambios' });
        expect(evaluarEdicionDelEncuadre(undefined, '')).toEqual({ tipo: 'sinCambios' });
    });

    it('guarda el texto nuevo recortado en los bordes', () => {
        expect(evaluarEdicionDelEncuadre('Viejo', '  Nuevo  ')).toEqual({ tipo: 'listo', valor: 'Nuevo' });
    });

    it('vaciar el encuadre guarda null', () => {
        expect(evaluarEdicionDelEncuadre('Viejo', '  ')).toEqual({ tipo: 'listo', valor: null });
    });

    it('acepta exactamente el tope', () => {
        const justo = 'x'.repeat(ASSIGNMENT_BRIEF_MAX_CHARS);
        expect(evaluarEdicionDelEncuadre('Viejo', justo)).toEqual({ tipo: 'listo', valor: justo });
    });

    it('pasado el tope bloquea y dice cuánto sobra, sin recortar', () => {
        // Recortar en silencio borraría el final del encuadre, donde suele ir
        // el formato de citas.
        const largo = 'x'.repeat(ASSIGNMENT_BRIEF_MAX_CHARS + 7);
        expect(evaluarEdicionDelEncuadre('Viejo', largo)).toEqual({ tipo: 'excedido', sobran: 7 });
    });

    it('un encuadre ya largo sin tocar no bloquea nada: no hay cambio', () => {
        const largo = 'x'.repeat(ASSIGNMENT_BRIEF_MAX_CHARS + 7);
        expect(evaluarEdicionDelEncuadre(largo, largo)).toEqual({ tipo: 'sinCambios' });
    });
});
