import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase-functions/v2/https', async (orig) => ({ ...(await orig<object>()), onCall: (_o: unknown, h: unknown) => h }));

import { armarPedido, extractoLegible, leerRespuesta, normalizarMarcas, tituloDeConsulta, type FragmentoRecuperado } from '../armarConsulta';
import { elegirDelPozo, topePorLibro } from '../recuperarFragmentos';
import { motivoSinCuota, periodoActual } from '../cuotaDeConsultas';
import { leerAlcance } from '../consultarBiblioteca';
import { agruparPorLibro } from '../buscarTemas';

const frag = (resourceId: string, hoja: number, texto = 'texto del libro'): FragmentoRecuperado => ({
    resourceId, titulo: `Libro ${resourceId}`, autor: `Autor ${resourceId}`, hoja, seccion: 'Cap. 1', texto, score: 0.8,
});

describe('armarPedido', () => {
    it('numera los fragmentos y deja la pregunta al final', () => {
        const { system, prompt } = armarPedido('¿Qué es la sabiduría de arriba?', [frag('a', 12), frag('b', 40)]);
        expect(prompt).toContain('[F1] Autor a, «Libro a» (hoja 12, § Cap. 1)');
        expect(prompt).toContain('[F2] Autor b');
        expect(prompt.trim().endsWith('Pregunta del pastor: ¿Qué es la sabiduría de arriba?')).toBe(true);
        expect(system).toContain('SOLO los fragmentos');
    });
    it('sin fragmentos lo dice, y la conversación previa viaja sin sus marcas', () => {
        const { prompt } = armarPedido('¿y Moo?', [], [{ pregunta: '¿Qué dice Varner?', respuesta: 'Varner dice X [F1].' }]);
        expect(prompt).toContain('No se encontraron fragmentos');
        expect(prompt).toContain('Varner dice X .');
        expect(prompt).not.toContain('[F1]');
    });
});

describe('armarPedido — contexto acotado', () => {
    it('sólo viajan los últimos turnos de la conversación', () => {
        const turnos = [1, 2, 3, 4, 5].map(n => ({ pregunta: `pregunta ${n}`, respuesta: `respuesta ${n}` }));
        const { prompt } = armarPedido('¿y ahora?', [frag('a', 1)], turnos);
        expect(prompt).not.toContain('pregunta 2');
        expect(prompt).toContain('pregunta 3');
        expect(prompt).toContain('pregunta 5');
    });
});

describe('leerRespuesta', () => {
    const fragmentos = [frag('a', 12, 'uno'), frag('b', 40, 'dos'), frag('c', 7, 'tres')];
    it('quita las marcas que no son de un fragmento y guarda sólo las fuentes citadas', () => {
        const r = leerRespuesta('Varner dice X [F3]. Moo agrega Y [F1][F9]. Otra [F0].', fragmentos);
        expect(r.respuesta).toBe('Varner dice X [F3]. Moo agrega Y [F1]. Otra .');
        expect(r.fuentes.map(f => [f.n, f.resourceId, f.hoja])).toEqual([[1, 'a', 12], [3, 'c', 7]]);
    });
    it('recorta el extracto guardado', () => {
        const r = leerRespuesta('[F1]', [frag('a', 1, 'x'.repeat(1000))]);
        expect(r.fuentes[0]!.extracto.length).toBeLessThanOrEqual(401);
    });
});

describe('normalizarMarcas', () => {
    it('lleva las marcas escritas a su manera a la forma única', () => {
        expect(normalizarMarcas('a [F2, F5] b [F2; F5] c [f3] d [F2,5] e [F1]')).toBe('a [F2][F5] b [F2][F5] c [F3] d [F2][F5] e [F1]');
    });
    it('y entonces cuentan como citas', () => {
        const r = leerRespuesta('X [F1, F2].', [frag('a', 1), frag('b', 2)]);
        expect(r.respuesta).toBe('X [F1][F2].');
        expect(r.fuentes.map(f => f.n)).toEqual([1, 2]);
    });
});

describe('tituloDeConsulta', () => {
    it('recorta una pregunta larga', () => {
        expect(tituloDeConsulta('  ¿qué  es? ')).toBe('¿qué es?');
        expect(tituloDeConsulta('a'.repeat(200)).length).toBe(78);
    });
});

describe('elegirDelPozo', () => {
    const pozo = [frag('a', 1), frag('a', 2), frag('a', 3), frag('b', 1), frag('c', 1), frag('b', 2)];
    it('respeta el tope por libro y el total, en el orden del pozo', () => {
        expect(elegirDelPozo(pozo, { porLibro: 2, total: 4 }).map(f => `${f.resourceId}${f.hoja}`)).toEqual(['a1', 'a2', 'b1', 'c1']);
    });
    it('sólo de los libros pedidos', () => {
        expect(elegirDelPozo(pozo, { ids: new Set(['b']), porLibro: 9, total: 9 }).map(f => `${f.resourceId}${f.hoja}`)).toEqual(['b1', 'b2']);
    });
});

describe('topePorLibro', () => {
    it('un libro: todos; varios: que entren al menos dos de cada uno; toda la biblioteca: no más de un tercio', () => {
        expect(topePorLibro({ tipo: 'libros', ids: ['a'] }, 14)).toBe(14);
        expect(topePorLibro({ tipo: 'libros', ids: ['a', 'b'] }, 14)).toBe(7);
        expect(topePorLibro({ tipo: 'libros', ids: Array(20).fill('x') }, 14)).toBe(2);
        expect(topePorLibro({ tipo: 'todo' }, 14)).toBe(5);
    });
});

describe('cuota de consultas', () => {
    it('ilimitado, con cupo, y sin cupo', () => {
        expect(motivoSinCuota(-1, 999)).toBeNull();
        expect(motivoSinCuota(undefined, 999)).toBeNull();
        expect(motivoSinCuota(50, 49)).toBeNull();
        expect(motivoSinCuota(50, 50)).toContain('50 consultas');
    });
    it('el período es el mes UTC, como el de Facultad', () => {
        expect(periodoActual(new Date('2026-10-31T23:30:00Z'))).toBe('2026-10');
    });
});

describe('leerAlcance', () => {
    it('acepta toda la biblioteca o una lista de libros sin repetidos', () => {
        expect(leerAlcance({ tipo: 'todo' })).toEqual({ tipo: 'todo' });
        expect(leerAlcance({ tipo: 'libros', ids: ['a', ' a ', 'b', 3] })).toEqual({ tipo: 'libros', ids: ['a', 'b'] });
    });
    it('rechaza lo demás', () => {
        expect(() => leerAlcance({ tipo: 'libros', ids: [] })).toThrow();
        expect(() => leerAlcance({ tipo: 'otro' })).toThrow();
        expect(() => leerAlcance(undefined)).toThrow();
    });
});

describe('agruparPorLibro (buscar temas)', () => {
    it('conserva el orden de pertinencia recibido: libros por su mejor fragmento, hojas sin repetir', () => {
        const f = (rid: string, hoja: number) => frag(rid, hoja);
        const r = agruparPorLibro([f('b', 3), f('a', 12), f('a', 10), f('b', 3), f('a', 10)]);
        expect(r.map(l => l.resourceId)).toEqual(['b', 'a']);
        expect(r[0]!.hojas.map(h => h.hoja)).toEqual([3]);
        expect(r[1]!.hojas.map(h => h.hoja)).toEqual([12, 10]);
    });
});

describe('extractoLegible', () => {
    it('quita tablas, etiquetas HTML y bloques de código; conserva el texto (griego incluido)', () => {
        const varner = '| P | S |\n| :---: | :---: |\n| ἀσθενεῖ | τις ἐν ὑμῖν |\n<table><tr><td>ἀλείψαντες</td></tr></table>';
        expect(extractoLegible(varner)).toBe('P S ἀσθενεῖ τις ἐν ὑμῖν ἀλείψαντες');
        expect(extractoLegible('```python 168 THE EPISTLE OF ST. JAMES')).toBe('168 THE EPISTLE OF ST. JAMES');
        expect(extractoLegible('**15. ἡ εὐχή.** The prayer')).toBe('15. ἡ εὐχή. The prayer');
    });
    it('recorta al largo pedido', () => {
        expect(extractoLegible('palabra '.repeat(200), 20)).toBe('palabra palabra pala…');
    });
    it('no borra «<», «>» ni «---» que son texto (revisión adversarial)', () => {
        expect(extractoLegible('*qatal < *qatala; luego qatal > qāṭal')).toBe('*qatal < *qatala; luego qatal > qāṭal');
        expect(extractoLegible('El códice <A> y <B>')).toBe('El códice <A> y <B>');
        expect(extractoLegible('El aoristo --- dice Moo --- es puntual')).toBe('El aoristo --- dice Moo --- es puntual');
        expect(extractoLegible('| | | | :--- | :--- | | ¹³Κακοπαθεῖ')).toBe('¹³Κακοπαθεῖ');
    });
});
