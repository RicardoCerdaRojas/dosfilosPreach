import { describe, expect, it, vi } from 'vitest';

/** U7: el mismo resumen pedido dos veces mientras se arma sale UNA vez (no cobra dos). */
const { llamadas, soltar } = vi.hoisted(() => ({ llamadas: [] as unknown[], soltar: { fn: null as null | ((v: unknown) => void) } }));
vi.mock('../../config/firebase', () => ({ db: {} }));
vi.mock('firebase/functions', () => ({
    getFunctions: () => ({}),
    httpsCallable: () => (datos: unknown) => { llamadas.push(datos); return new Promise(r => { soltar.fn = r; }); },
}));
const { resumirEnBiblioteca } = await import('../consultaBiblioteca');

describe('resumirEnBiblioteca', () => {
    it('dos pedidos iguales simultáneos comparten la llamada; terminado, uno nuevo sale', async () => {
        const a = resumirEnBiblioteca({ resourceId: 'v', tipo: 'mapa' });
        const b = resumirEnBiblioteca({ resourceId: 'v', tipo: 'mapa' });
        expect(llamadas).toHaveLength(1);
        soltar.fn!({ data: { resumen: 'x' } });
        expect(await a).toEqual({ resumen: 'x' });
        expect(await b).toEqual({ resumen: 'x' });
        void resumirEnBiblioteca({ resourceId: 'v', tipo: 'mapa' });
        expect(llamadas).toHaveLength(2);
    });
});
