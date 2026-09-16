import { describe, it, expect } from 'vitest';
import { ASSIGNMENT_BRIEF_MAX_CHARS, type UserAssignmentBrief } from '@dosfilos/domain';
import { estadoDelEncuadre } from '../encuadreAplicado';

const plantilla = (over: Partial<UserAssignmentBrief>): UserAssignmentBrief => ({
    id: 'p',
    ownerId: 'u',
    displayName: 'Plantilla',
    body: 'texto',
    isDefault: false,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...over,
});

const tp = plantilla({ id: 'tp', displayName: 'TP semanal', body: 'Trabajo práctico semanal', isDefault: true });
const inv = plantilla({ id: 'inv', displayName: 'Investigación AT', body: 'Trabajo de investigación' });

describe('estadoDelEncuadre', () => {
    it('nombra la plantilla ELEGIDA, no la predeterminada', () => {
        // El defecto original: se elegía «Investigación AT», el texto cambiaba,
        // y el rótulo seguía diciendo «TP semanal» porque era la predeterminada.
        const estado = estadoDelEncuadre([tp, inv], inv.body);
        expect(estado).toEqual({ tipo: 'plantilla', plantilla: inv });
    });

    it('reconoce la predeterminada cuando la página la carga sola', () => {
        expect(estadoDelEncuadre([tp, inv], tp.body)).toEqual({ tipo: 'plantilla', plantilla: tp });
    });

    it('deja de nombrar una plantilla en cuanto el texto se edita', () => {
        // Lo que se guarda en el trabajo es el texto. Seguir anunciando la
        // plantilla después de editarlo afirmaría algo que ya no es cierto.
        expect(estadoDelEncuadre([tp, inv], `${inv.body} con un agregado`)).toEqual({ tipo: 'propio' });
    });

    it('un texto escrito a mano es propio, aunque haya plantillas', () => {
        expect(estadoDelEncuadre([tp, inv], 'Mi profesor pidió otra cosa')).toEqual({ tipo: 'propio' });
    });

    it('un cuadro vacío no es propio: invita a cargar una plantilla', () => {
        expect(estadoDelEncuadre([tp, inv], '')).toEqual({ tipo: 'vacio' });
        expect(estadoDelEncuadre([tp, inv], '   \n ')).toEqual({ tipo: 'vacio' });
    });

    it('ignora espacios en los bordes al comparar', () => {
        expect(estadoDelEncuadre([tp, inv], `\n  ${inv.body}  \n`)).toEqual({ tipo: 'plantilla', plantilla: inv });
    });

    it('si dos plantillas comparten el texto, nombra la predeterminada', () => {
        const copia = plantilla({ id: 'copia', displayName: 'Copia', body: tp.body });
        expect(estadoDelEncuadre([copia, tp], tp.body)).toEqual({ tipo: 'plantilla', plantilla: tp });
    });

    it('reconoce una plantilla más larga que el tope, recortada al aplicarla', () => {
        // La página corta el texto al tope del cuadro. Sin comparar con el
        // mismo recorte, esa plantilla aparecería como «propia» apenas cargada.
        const larga = plantilla({ id: 'larga', body: 'x'.repeat(ASSIGNMENT_BRIEF_MAX_CHARS + 50) });
        const recortado = larga.body.slice(0, ASSIGNMENT_BRIEF_MAX_CHARS);
        expect(estadoDelEncuadre([larga], recortado)).toEqual({ tipo: 'plantilla', plantilla: larga });
    });
});
