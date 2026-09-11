import { describe, it, expect } from 'vitest';
import { rescatarPaginas } from '../rescatarPaginas';

/**
 * Medido sobre la BHS: 1 de cada 12 tandas vuelve con JSON inválido, con
 * `finishReason=STOP` y la respuesta entera. El aparato crítico mezcla
 * paréntesis desbalanceados, comillas y tres alfabetos en un renglón.
 *
 * Antes, una tanda así se descartaba completa: ocho páginas perdidas por una
 * rota.
 */
describe('rescatarPaginas', () => {
    it('recupera las entradas buenas de un JSON cortado', () => {
        const roto = '{"pages":[{"page":1,"text":"primera"},{"page":2,"text":"segunda"},{"page":3,"text":"ter';
        expect(rescatarPaginas(roto)).toEqual([
            { page: 1, text: 'primera' },
            { page: 2, text: 'segunda' },
        ]);
    });

    it('sobrevive a una entrada corrupta en el medio', () => {
        // La del medio arrastra una comilla sin escapar; las otras dos se salvan.
        const roto = '{"pages":[{"page":1,"text":"buena"},{"page":2,"text":"rota" sin cerrar},{"page":3,"text":"otra"}]}';
        const r = rescatarPaginas(roto);
        expect(r.map(p => p.page)).toContain(1);
        expect(r.map(p => p.page)).toContain(3);
    });

    it('conserva el hebreo con su vocalización', () => {
        const crudo = '{"pages":[{"page":1,"text":"יְהוָה רֹעִי לֹא אֶחְסָר"}]}';
        expect(rescatarPaginas(crudo)[0]!.text).toBe('יְהוָה רֹעִי לֹא אֶחְסָר');
    });

    it('desescapa saltos de línea y comillas del texto', () => {
        const crudo = String.raw`{"pages":[{"page":7,"text":"uno\ndos \"citado\""}]}`;
        expect(rescatarPaginas(crudo)[0]!.text).toBe('uno\ndos "citado"');
    });

    it('devuelve las páginas ordenadas y sin repetir', () => {
        const crudo = '{"pages":[{"page":3,"text":"c"},{"page":1,"text":"a"},{"page":3,"text":"c otra vez"}]}';
        expect(rescatarPaginas(crudo).map(p => p.page)).toEqual([1, 3]);
    });

    it('acepta la variante que usa «md» en vez de «text»', () => {
        expect(rescatarPaginas('{"pages":[{"page":2,"md":"markdown"}]}'))
            .toEqual([{ page: 2, text: 'markdown', md: 'markdown' }]);
    });

    /**
     * El defecto que costó las tablas de una gramática entera.
     *
     * El patrón anterior tomaba el PRIMER campo que encontrara después de
     * `page` —y `text` va primero—, así que `md` no se capturaba nunca; la
     * interfaz ni siquiera tenía dónde guardarlo. Medido sobre la gramática de
     * Barrick: las dos tandas que pasaron por el rescate quedaron con CERO
     * encabezados y CERO tablas, contra 12 tablas en las que parsearon limpio.
     *
     * En una gramática hebrea, un paradigma verbal sin su tabla deja de decir
     * qué forma corresponde a qué persona. El texto sobrevive y el contenido no.
     */
    it('conserva el markdown, que es donde viven las tablas', () => {
        const crudo = '{"pages":[{"page":7,"text":"Qal Perf 1com","md":"| Qal | Perf. |\\n| קָטַלְתִּי | 1 com. |"}]}';
        const [p] = rescatarPaginas(crudo);
        expect(p!.text).toBe('Qal Perf 1com');
        expect(p!.md).toContain('| Qal | Perf. |');
        expect(p!.md).toContain('קָטַלְתִּי');
    });

    it('el markdown de una página no se lleva el de la siguiente', () => {
        // Sin acotar dónde termina cada entrada, el patrón de `md` de la
        // primera página podía capturar el de la de más abajo.
        const crudo = '{"pages":[{"page":1,"text":"a","md":"# uno"},{"page":2,"text":"b","md":"# dos"}]}';
        expect(rescatarPaginas(crudo)).toEqual([
            { page: 1, text: 'a', md: '# uno' },
            { page: 2, text: 'b', md: '# dos' },
        ]);
    });

    it('una entrada cortada en medio del markdown conserva igual su texto', () => {
        // `md` va después de `text`, así que es el primero en perderse cuando la
        // respuesta se corta. Quedarse sin markdown es peor que nada; perder la
        // página entera por eso sería peor todavía.
        const crudo = '{"pages":[{"page":9,"text":"completo","md":"| a | b';
        const [p] = rescatarPaginas(crudo);
        expect(p).toEqual({ page: 9, text: 'completo' });
    });

    it('no inventa nada cuando no hay nada rescatable', () => {
        expect(rescatarPaginas('esto no es JSON en absoluto')).toEqual([]);
        expect(rescatarPaginas('')).toEqual([]);
    });

    it('NO repara el JSON: una entrada sin texto no se adivina', () => {
        // Cerrar llaves a mano produce texto plausible y equivocado, y este
        // corpus se cita.
        expect(rescatarPaginas('{"pages":[{"page":1}]}')).toEqual([]);
    });
});
