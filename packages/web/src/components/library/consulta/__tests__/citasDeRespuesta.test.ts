import { describe, expect, it } from 'vitest';
import type { FuenteDeConsulta } from '@dosfilos/infrastructure';
import { enlazarFuentes, PREFIJO_FUENTE, textoConCitas } from '../citasDeRespuesta';

const fuente = (n: number, autor: string, hoja: number): FuenteDeConsulta => ({
    n, resourceId: autor, titulo: `Libro de ${autor}`, autor, hoja, seccion: '', extracto: '',
});
/** Una etiqueta de prueba: la regla real la pone quien muestra la respuesta. */
const etiquetar = (f: FuenteDeConsulta) => `(${f.autor}, p. ${f.hoja! - 4})`;
const fuentes = [fuente(1, 'Varner', 192), fuente(2, 'Varner', 194), fuente(4, 'Moo', 34)];

describe('enlazarFuentes y textoConCitas', () => {
    it('cada corrida de marcas es un enlace con sus fuentes; las marcas sin fuente se quitan', () => {
        const r = enlazarFuentes('Varner dice X [F1][F4]. Y [F2]. Z [F9].', fuentes, etiquetar);
        expect(r.markdown).toBe(`Varner dice X [(Varner, p. 188; Moo, p. 30)](${PREFIJO_FUENTE}0). Y [(Varner, p. 190)](${PREFIJO_FUENTE}1). Z .`);
        expect(r.enlaces.map(e => e.map(f => f.n))).toEqual([[1, 4], [2]]);
    });
    it('dos marcas de la misma página no repiten la cita', () => {
        expect(textoConCitas('X [F1][F1].', fuentes, etiquetar)).toBe('X (Varner, p. 188).');
    });
    it('el texto para copiar lleva las citas armadas', () => {
        expect(textoConCitas('Varner dice X [F1]. Moo, Y [F4].', fuentes, etiquetar)).toBe('Varner dice X (Varner, p. 188). Moo, Y (Moo, p. 30).');
    });
});
