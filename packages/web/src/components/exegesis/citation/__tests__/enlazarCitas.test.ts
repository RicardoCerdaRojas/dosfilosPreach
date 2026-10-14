import { describe, it, expect } from 'vitest';
import { destinoDeCita, destinoDeFuente, enlazarCitas, PREFIJO_CITA } from '../destinosDelVisor';

const CLAVES = ['McCartney', 'Robertson', 'Varner', 'Mayor', 'Ropes', 'NA28'];

describe('enlazarCitas — las citas de la prosa abren el visor en su página', () => {
    it('enlaza «(Clave, p. N)» con su página impresa', () => {
        const { markdown, citas } = enlazarCitas('rara vez indica agente (McCartney, p. 204).', CLAVES);
        expect(markdown).toBe(`rara vez indica agente ([McCartney, p. 204](${PREFIJO_CITA}0)).`);
        expect(citas).toEqual([{ sourceKey: 'McCartney', page: 204, pageKind: 'printed' }]);
    });

    it('una cita compuesta da un enlace por página', () => {
        const { citas } = enlazarCitas('(Robertson, p. 534; Robertson, pp. 538–539)', CLAVES);
        expect(citas.map(c => c.page)).toEqual([534, 538]);
    });

    it('la forma entregada (sin «p.») es página impresa; «hoja N» es hoja', () => {
        const { citas } = enlazarCitas('(Varner, 140) y (Ropes, hoja 224) y (NA28, p. 723)', CLAVES);
        expect(citas).toEqual([
            { sourceKey: 'Varner', page: 140, pageKind: 'printed' },
            { sourceKey: 'Ropes', page: 224 },
            { sourceKey: 'NA28', page: 723, pageKind: 'printed' },
        ]);
    });

    it('con título entre comillas también', () => {
        const { citas } = enlazarCitas('(Mayor, "The Epistle of St. James", p. 77)', CLAVES);
        expect(citas).toEqual([{ sourceKey: 'Mayor', page: 77, pageKind: 'printed' }]);
    });

    it('no enlaza lo que no es una fuente del trabajo ni un nombre suelto', () => {
        const texto = 'Según (Génesis 19:25, 29) y Varner lo clasifica; (Wallace, p. 165).';
        expect(enlazarCitas(texto, CLAVES)).toEqual({ markdown: texto, citas: [] });
        expect(enlazarCitas('(McCartney, p. 204)', [])).toEqual({ markdown: '(McCartney, p. 204)', citas: [] });
    });

    it('el destino de una cita y el de una fuente', () => {
        expect(destinoDeCita('p1', { sourceKey: 'McCartney', page: 204, pageKind: 'printed' }))
            .toEqual({ paperId: 'p1', citation: { sourceKey: 'McCartney', page: 204, pageKind: 'printed' } });
        const fuente = { citationKey: 'Robertson', displayLabel: 'Grammar…', sourceLibraryResourceId: 'res-rob', corpusId: 'c', excerptRecipe: { sheetRanges: [{ start: 958, end: 959 }, { start: 612, end: 613 }] } };
        expect(destinoDeFuente('p1', fuente as never)).toEqual({
            paperId: 'p1', citation: { sourceKey: 'Robertson', page: 612, resourceId: 'res-rob', label: 'Grammar…' },
        });
        expect(destinoDeFuente('p1', { ...fuente, excerptRecipe: undefined } as never).citation.page).toBe(1);
    });
});
