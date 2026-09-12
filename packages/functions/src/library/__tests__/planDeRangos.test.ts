import { describe, it, expect } from 'vitest';
import { siguienteRango, primerRango, planDeRangos, nombreDeRango } from '../planDeRangos';
import { OVERLAP_PAGES } from '../calibrarTanda';

/**
 * La cadena avanza porque cada tarea calcula su sucesor. Si ese cálculo se
 * equivoca, no hay nadie que lo note: una cadena que no avanza se ve igual que
 * una que está trabajando, y una que salta páginas produce un libro con huecos
 * que el guard de cobertura recién detecta al final, después de pagar todo.
 */
describe('siguienteRango', () => {
    it('el siguiente arranca antes, para que el solapamiento cubra el corte', () => {
        // 1-43 terminó; el siguiente vuelve OVERLAP_PAGES atrás.
        expect(siguienteRango(43, 43, 170)).toEqual({ desde: 41, hasta: 83 });
        expect(43 - 41 + 1).toBe(OVERLAP_PAGES);
    });

    it('el último rango se recorta al final del libro, no lo pasa', () => {
        expect(siguienteRango(163, 43, 170)).toEqual({ desde: 161, hasta: 170 });
    });

    it('devuelve null cuando el anterior ya tocó el final', () => {
        // Es la única señal de «parar y ensamblar» que tiene la cadena.
        expect(siguienteRango(170, 43, 170)).toBeNull();
        expect(siguienteRango(200, 43, 170)).toBeNull();
    });

    /**
     * Una cadena que no avanza es un bucle infinito PAGADO: cada vuelta es una
     * llamada al modelo. Se corta acá y no en producción.
     */
    it('nunca devuelve un rango que no avance', () => {
        for (let tamano = 1; tamano <= OVERLAP_PAGES; tamano++) {
            const r = siguienteRango(50, tamano, 500);
            if (r !== null) expect(r.hasta).toBeGreaterThan(50);
        }
    });

    it('cifras inválidas no producen un rango inventado', () => {
        expect(siguienteRango(10, 0, 100)).toBeNull();
        expect(siguienteRango(10, 43, 0)).toBeNull();
        expect(siguienteRango(NaN, 43, 100)).toBeNull();
        expect(siguienteRango(10, 43, NaN)).toBeNull();
    });
});

describe('primerRango', () => {
    it('arranca en 1 y no se pasa del libro', () => {
        expect(primerRango(43, 170)).toEqual({ desde: 1, hasta: 43 });
        expect(primerRango(43, 10)).toEqual({ desde: 1, hasta: 10 });
    });

    it('un libro sin páginas no tiene primer rango', () => {
        expect(primerRango(43, 0)).toBeNull();
        expect(primerRango(0, 100)).toBeNull();
    });
});

describe('planDeRangos', () => {
    /**
     * El caso real: Barrick, 170 páginas, calibrado en 43. En producción se
     * recorrió en cinco tandas —1-43, 41-83, 81-123, 121-163, 161-170— y esa
     * secuencia es la que el plan tiene que reproducir, porque el ensamblado
     * comprueba contra ella.
     */
    it('reproduce el recorrido real de Barrick', () => {
        expect(planDeRangos(170, 43)).toEqual([
            { desde: 1, hasta: 43 },
            { desde: 41, hasta: 83 },
            { desde: 81, hasta: 123 },
            { desde: 121, hasta: 163 },
            { desde: 161, hasta: 170 },
        ]);
    });

    it('cubre el libro entero, sin huecos y sin pasarse', () => {
        for (const [total, tamano] of [[170, 43], [392, 31], [1006, 40], [7, 43], [1, 10]] as const) {
            const rangos = planDeRangos(total, tamano);
            expect(rangos[0]!.desde).toBe(1);
            expect(rangos[rangos.length - 1]!.hasta).toBe(total);
            // Ninguna página del libro queda fuera de algún rango.
            const cubiertas = new Set<number>();
            for (const r of rangos) for (let p = r.desde; p <= r.hasta; p++) cubiertas.add(p);
            expect(cubiertas.size, `total=${total} tamaño=${tamano}`).toBe(total);
        }
    });

    it('un libro de una sola tanda es un solo rango', () => {
        expect(planDeRangos(20, 43)).toEqual([{ desde: 1, hasta: 20 }]);
    });

    it('un libro sin páginas no produce plan', () => {
        expect(planDeRangos(0, 43)).toEqual([]);
    });

    /**
     * INVARIANTE: el plan completo y el avance paso a paso tienen que describir
     * el MISMO recorrido. Son dos caminos al mismo número —uno lo usa la
     * interfaz para decir «rango 3 de 9», el otro lo usa la cadena para
     * avanzar— y si se separan, la barra de progreso miente o el ensamblado
     * busca un archivo que nadie escribió.
     *
     * Es el patrón de `docs/REVISION_ADVERSARIAL.md` §5.
     */
    it('invariante: el plan y el avance paso a paso coinciden', () => {
        for (const total of [1, 7, 20, 170, 392, 1006]) {
            for (const tamano of [8, 24, 31, 43, 48]) {
                const plan = planDeRangos(total, tamano);
                const caminado = [primerRango(tamano, total)!];
                for (;;) {
                    const s = siguienteRango(caminado[caminado.length - 1]!.hasta, tamano, total);
                    if (!s) break;
                    caminado.push(s);
                }
                expect(caminado, `total=${total} tamaño=${tamano}`).toEqual(plan);
            }
        }
    });
});

describe('nombreDeRango', () => {
    it('nombra por el rango, que es lo que lo hace idempotente', () => {
        // Cloud Tasks reintenta. Una tarea que murió DESPUÉS de escribir
        // repetiría 200 s de trabajo pagado si el nombre no fuera deducible.
        expect(nombreDeRango({ desde: 41, hasta: 83 })).toBe('41-83.json');
    });
});

/**
 * El total de páginas tiene que VIAJAR con la tarea, no leerse del documento.
 *
 * Defecto del 12-09-2026: la tarea de rango leía `pageCount` del recurso, pero
 * ese campo se escribe al TERMINAR la extracción — en una subida nueva todavía
 * no existe. La tarea recibió `null`:
 *
 *     ⛓️ [Cola] …: 392 páginas en cola (~19 rangos)
 *     📦 [Rango] …: páginas 1-24 de null
 *     🧩 [Rango] …: 24 páginas de 1 rangos — listo
 *
 * Un comentario de 392 páginas quedó certificado con 24. Quien encola SÍ sabía
 * el total; simplemente no se lo pasaba.
 */
describe('un total ausente no puede parecer un libro terminado', () => {
    it('sin total, la cadena no puede calcular su siguiente paso', () => {
        // Esto es lo que hacía que la cadena terminara tras el primer rango.
        expect(siguienteRango(24, 48, null as unknown as number)).toBeNull();
        expect(siguienteRango(24, 48, undefined as unknown as number)).toBeNull();
    });

    it('con el total correcto, la cadena sigue hasta el final', () => {
        // El mismo caso real, con el total que sí debía llegar.
        const plan = planDeRangos(392, 48);
        expect(plan.length).toBeGreaterThan(1);
        expect(plan[plan.length - 1]!.hasta).toBe(392);
        expect(siguienteRango(24, 48, 392)).not.toBeNull();
    });
});
