import { beforeAll, describe, expect, it, vi } from 'vitest';
import { revisarOReponer } from '../reponerPaginas';
import { armar, prepararPdfs } from './fakesDelLote';

beforeAll(prepararPdfs);

const ingles = (n: number) => `Page ${n} of the commentary discusses the passage carefully with several technical terms and notes`;
const griego = 'φθορᾷ φθαρήσονται ἀδικούμενοι μισθὸν ἀδικίας';
const md = (paginas: Record<number, string>) => Object.entries(paginas).map(([n, t]) => `<!-- page: ${n} -->\n${t}`).join('\n\n---\n\n');
const DIEZ = Array.from({ length: 10 }, (_, i) => i + 1);

/** El libro B ya aplicado: el texto actual perdió el griego de la p. 7; el respaldo de antes del lote lo tiene. */
const MARCA = { lote: 'prueba-2', fecha: '2026-10-19T15:42:14.861Z' };
function aplicado(opciones: { sinRespaldo?: boolean; respaldoDistinto?: boolean; recurso?: Record<string, unknown> } = {}) {
    const x = armar();
    const mdPath = 'users/u/library/B/structured.md';
    x.recurso('B', {
        structuredContentUrl: `gs://b/${mdPath}`, textContent: '[PAGE 1]\nviejo', extractionVersion: '6.0-gemini-cola',
        reprocesadoEnLote: MARCA, extractedAt: '2026-10-19T15:42:14.800Z', ...opciones.recurso,
    });
    x.guardados.set(mdPath, md(Object.fromEntries(DIEZ.map(n => [n, `${ingles(n)}.`]))));
    if (!opciones.sinRespaldo) {
        const respaldo = Object.fromEntries(DIEZ.map(n => [n, opciones.respaldoDistinto
            ? `${ingles(n)} con la nota: ${griego}.`
            : `${ingles(n)}${n === 7 ? ` con la nota: ${griego}` : ''}.`]));
        x.guardados.set('users/u/library/B/structured.antes-del-lote-prueba-2-2026-10-19T15-42-06-777Z.md', md(respaldo));
    }
    return { x, mdPath };
}

describe('revisar y reponer el griego y el hebreo desde el respaldo', () => {
    it('revisar dice qué páginas perdieron escritura y no escribe nada', async () => {
        const { x } = aplicado();
        const r = await revisarOReponer(x.d, { rid: 'B', lote: 'prueba-2', escribir: false });
        expect(r).toMatchObject({ paginas: [{ pagina: 7, escritura: 'griego', antes: 5, despues: 0 }], desalineado: false, repuestas: [] });
        expect(r.respaldo).toContain('antes-del-lote-prueba-2');
        expect(x.escritos.size).toBe(0);
        expect(x.actualizaciones).toEqual([]);
    });

    it('reponer devuelve sólo esas páginas, respalda el estado actual, pasa por processing → ready y audita', async () => {
        const { x, mdPath } = aplicado();
        const auditado = vi.fn(async () => undefined);
        const r = await revisarOReponer(x.d, { rid: 'B', lote: 'prueba-2', escribir: true }, auditado);
        expect(r.repuestas).toEqual([7]);
        const nuevo = x.escritos.get(mdPath)!.contenido;
        expect(nuevo).toContain(`${ingles(7)} con la nota: ${griego}`);
        expect(nuevo).toContain(`${ingles(8)}.`);
        expect(nuevo).not.toContain(`${ingles(8)} con la nota`);
        expect([...x.escritos.keys()].some(k => k.includes('structured.antes-de-reponer-'))).toBe(true);
        expect(x.actualizaciones.filter(a => a.path === 'library_resources/B').map(a => a.campos.textExtractionStatus)).toEqual(['processing', 'ready']);
        expect(x.docs.get('library_resources/B')).toMatchObject({ needsReindex: true, 'reprocesadoEnLote.paginasRepuestas': [7] });
        expect(auditado).toHaveBeenCalledWith({ repuestas: [7], dueno: 'u' });
    });

    it('sin respaldo de ese lote, lo dice', async () => {
        const { x } = aplicado({ sinRespaldo: true });
        await expect(revisarOReponer(x.d, { rid: 'B', lote: 'prueba-2', escribir: false })).rejects.toMatchObject({ codigo: 'not-found' });
    });

    it('si el respaldo no se corresponde (todas las páginas «pierden»), no repone nada', async () => {
        const { x } = aplicado({ respaldoDistinto: true });
        const r = await revisarOReponer(x.d, { rid: 'B', lote: 'prueba-2', escribir: true });
        expect(r).toMatchObject({ desalineado: true, paginas: [], repuestas: [] });
        expect(x.escritos.size).toBe(0);
    });

    it('si el libro cambió entre la lectura y la escritura, no lo toca', async () => {
        const { x } = aplicado();
        const listar = x.d.almacen.listar;
        x.d.almacen.listar = async p => { x.tocar('library_resources/B'); return listar(p); };
        await expect(revisarOReponer(x.d, { rid: 'B', lote: 'prueba-2', escribir: true })).rejects.toMatchObject({ message: expect.stringContaining('cambió mientras se revisaba') });
        expect(x.escritos.size).toBe(0);
    });

    it('si falla la escritura del documento, devuelve el md y el estado', async () => {
        const { x, mdPath } = aplicado();
        const antes = x.guardados.get(mdPath);
        x.fallarEn((path, campos) => path === 'library_resources/B' && 'textContent' in campos);
        await expect(revisarOReponer(x.d, { rid: 'B', lote: 'prueba-2', escribir: true })).rejects.toThrow('la escritura falló');
        expect(x.escritos.get(mdPath)!.contenido).toBe(antes);
        expect(x.docs.get('library_resources/B')!.textExtractionStatus).toBe('ready');
    });

    it('nombres inválidos no llegan a Storage', async () => {
        const { x } = aplicado();
        await expect(revisarOReponer(x.d, { rid: '../otro', lote: 'prueba-2', escribir: false })).rejects.toMatchObject({ codigo: 'invalid-argument' });
        await expect(revisarOReponer(x.d, { rid: 'B', lote: 'Lote Raro', escribir: false })).rejects.toMatchObject({ codigo: 'invalid-argument' });
    });

    it('si el libro se volvió a procesar después de ese lote (otro lote, otra extracción), no se toca', async () => {
        const otroLote = aplicado({ recurso: { reprocesadoEnLote: { lote: 'biblioteca9', fecha: MARCA.fecha } } });
        await expect(revisarOReponer(otroLote.x.d, { rid: 'B', lote: 'prueba-2', escribir: false })).rejects.toMatchObject({ message: expect.stringContaining('se volvió a procesar') });
        const reextraido = aplicado({ recurso: { extractedAt: '2026-10-20T10:00:00.000Z' } });
        await expect(revisarOReponer(reextraido.x.d, { rid: 'B', lote: 'prueba-2', escribir: false })).rejects.toMatchObject({ message: expect.stringContaining('volvió a extraer') });
    });

    it('un libro que no está listo (falló, pendiente) no se repone', async () => {
        const { x } = aplicado({ recurso: { textExtractionStatus: 'failed' } });
        await expect(revisarOReponer(x.d, { rid: 'B', lote: 'prueba-2', escribir: true })).rejects.toMatchObject({ message: expect.stringContaining('no está listo') });
        expect(x.escritos.size).toBe(0);
    });

    it('usa el respaldo MÁS ANTIGUO de ese lote, y nunca el de otro lote con el mismo prefijo', async () => {
        const { x } = aplicado();
        // Un segundo «aplicar» del mismo lote dejó la salida parcial; y hay un lote `prueba-2-otro` (mismo prefijo, sello más antiguo).
        x.guardados.set('users/u/library/B/structured.antes-del-lote-prueba-2-2026-10-20T09-00-00-000Z.md', x.guardados.get('users/u/library/B/structured.md')!);
        x.guardados.set('users/u/library/B/structured.antes-del-lote-prueba-2-otro-2026-10-18T09-00-00-000Z.md', x.guardados.get('users/u/library/B/structured.md')!);
        const r = await revisarOReponer(x.d, { rid: 'B', lote: 'prueba-2', escribir: false });
        expect(r.respaldo).toBe('antes-del-lote-prueba-2-2026-10-19T15-42-06-777Z');
        expect(r.paginas.map(p => p.pagina)).toEqual([7]);
        expect(r.total).toBe(1);
    });

    it('un respaldo sin marcas de página lo dice (no «sin pérdidas»)', async () => {
        const { x } = aplicado({ sinRespaldo: true });
        x.guardados.set('users/u/library/B/textContent.antes-del-lote-prueba-2-2026-10-19T15-42-06-777Z.txt', 'texto sin marcas de página');
        await expect(revisarOReponer(x.d, { rid: 'B', lote: 'prueba-2', escribir: false })).rejects.toMatchObject({ message: expect.stringContaining('no tiene marcas de página') });
    });

    it('la auditoría lleva al dueño del libro', async () => {
        const { x } = aplicado();
        const auditado = vi.fn(async () => undefined);
        await revisarOReponer(x.d, { rid: 'B', lote: 'prueba-2', escribir: true }, auditado);
        expect(auditado).toHaveBeenCalledWith({ repuestas: [7], dueno: 'u' });
    });
});

