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

    it('un respaldo sin marcas de página (texto plano de antes): compara el libro entero y no repone nada', async () => {
        // Chapell, Montoya, Guía TMS (biblioteca1 y 5): antes del lote sólo había texto plano.
        const tc = 'users/u/library/B/textContent.antes-del-lote-prueba-2-2026-10-19T15-42-06-777Z.txt';
        const sinPerder = aplicado({ sinRespaldo: true });
        sinPerder.x.guardados.set(tc, `${ingles(1)} ${ingles(2)} sin griego`);
        const r = await revisarOReponer(sinPerder.x.d, { rid: 'B', lote: 'prueba-2', escribir: true });
        expect(r).toMatchObject({ paginas: [], total: 0, repuestas: [], respaldo: 'antes-del-lote-prueba-2-2026-10-19T15-42-06-777Z' });
        expect(r.libroEntero).toEqual({ griego: { antes: 0, despues: 0 }, hebreo: { antes: 0, despues: 0 }, pierde: false, recortado: false });
        expect(sinPerder.x.escritos.size).toBe(0);
        expect(sinPerder.x.actualizaciones).toEqual([]);

        // El texto viejo tenía griego que el actual no: lo dice (no «sin pérdidas»), y tampoco escribe.
        const perdio = aplicado({ sinRespaldo: true });
        perdio.x.guardados.set(tc, `${ingles(1)} ${griego} ${griego} y en hebreo בְּרֵאשִׁית בָּרָא אֱלֹהִים`);
        const p = await revisarOReponer(perdio.x.d, { rid: 'B', lote: 'prueba-2', escribir: true });
        expect(p.libroEntero).toMatchObject({ griego: { antes: 10, despues: 0 }, hebreo: { antes: 3, despues: 0 }, pierde: true });
        expect(perdio.x.escritos.size).toBe(0);
    });

    it('en el libro entero, unas pocas palabras de diferencia no son «perder»', async () => {
        const tc = 'users/u/library/B/textContent.antes-del-lote-prueba-2-2026-10-19T15-42-06-777Z.txt';
        const pocas = aplicado({ sinRespaldo: true });
        // 3 palabras griegas en el viejo, 0 en el actual: no supera el mínimo de 3.
        pocas.x.guardados.set(tc, 'φθορᾷ μισθὸν ἀδικίας');
        expect((await revisarOReponer(pocas.x.d, { rid: 'B', lote: 'prueba-2', escribir: false })).libroEntero!.pierde).toBe(false);
        const cuatro = aplicado({ sinRespaldo: true });
        cuatro.x.guardados.set(tc, 'φθορᾷ μισθὸν ἀδικίας ἀδικούμενοι');
        expect((await revisarOReponer(cuatro.x.d, { rid: 'B', lote: 'prueba-2', escribir: false })).libroEntero!.pierde).toBe(true);
    });

    it('en el libro entero: el umbral es el 2 %, cuenta el hebreo solo, y avisa si el respaldo estaba recortado', async () => {
        const tc = 'users/u/library/B/textContent.antes-del-lote-prueba-2-2026-10-19T15-42-06-777Z.txt';
        const palabrasGriegas = (n: number) => Array.from({ length: n }, () => 'ἀδικίας').join(' ');
        const caso = async (viejo: string, actual: string) => {
            const { x, mdPath } = aplicado({ sinRespaldo: true });
            x.guardados.set(tc, viejo);
            x.guardados.set(mdPath, md({ 1: actual }));
            return (await revisarOReponer(x.d, { rid: 'B', lote: 'prueba-2', escribir: false })).libroEntero!;
        };
        // 200 → 190 es un 5 %: pierde. 1000 → 985 (1,5 %, más que el mínimo de 3) no.
        expect((await caso(palabrasGriegas(200), palabrasGriegas(190))).pierde).toBe(true);
        expect((await caso(palabrasGriegas(1000), palabrasGriegas(985))).pierde).toBe(false);
        // Sólo hebreo perdido, el griego igual.
        const hebreo = (await caso(`${griego} ${'בְּרֵאשִׁית '.repeat(10)}`, griego));
        expect(hebreo).toMatchObject({ griego: { antes: 5, despues: 5 }, hebreo: { antes: 10, despues: 0 }, pierde: true, recortado: false });
        // La «µ» de micro del texto viejo cuenta como «μ»: «ἀµήν µαθηταί» son dos palabras griegas.
        expect((await caso('ἀµήν µαθηταί ἀµήν µαθηταί', 'nada'))).toMatchObject({ griego: { antes: 4, despues: 0 }, pierde: true });
        // Un textContent de 900 KB está recortado: la cuenta de antes se queda corta.
        expect((await caso('a'.repeat(900_000), 'nada')).recortado).toBe(true);
    });

    it('un respaldo vacío lo dice (no «sin pérdidas»)', async () => {
        const { x } = aplicado({ sinRespaldo: true });
        x.guardados.set('users/u/library/B/textContent.antes-del-lote-prueba-2-2026-10-19T15-42-06-777Z.txt', '  ');
        await expect(revisarOReponer(x.d, { rid: 'B', lote: 'prueba-2', escribir: false })).rejects.toMatchObject({ message: expect.stringContaining('vacío') });
    });

    it('el respaldo sin sello del primer lote (`structured.antes-del-lote-prueba1.md`) se encuentra, y cuenta como el más antiguo', async () => {
        const { x } = aplicado({ recurso: { reprocesadoEnLote: { ...MARCA, lote: 'prueba1' } } });
        const conSello = 'users/u/library/B/structured.antes-del-lote-prueba-2-2026-10-19T15-42-06-777Z.md';
        x.guardados.set('users/u/library/B/structured.antes-del-lote-prueba1.md', x.guardados.get(conSello)!);
        // Uno con sello y la salida del lote (sin la p. 7 con griego): no se elige.
        x.guardados.set('users/u/library/B/structured.antes-del-lote-prueba1-2026-10-16T09-00-00-000Z.md', x.guardados.get('users/u/library/B/structured.md')!);
        // De otros lotes con el mismo comienzo: ni `prueba10` ni `prueba1-b`.
        x.guardados.set('users/u/library/B/structured.antes-del-lote-prueba10.md', 'otro');
        x.guardados.set('users/u/library/B/structured.antes-del-lote-prueba1-b.md', 'otro');
        const r = await revisarOReponer(x.d, { rid: 'B', lote: 'prueba1', escribir: false });
        expect(r.respaldo).toBe('antes-del-lote-prueba1');
        expect(r.paginas.map(p => p.pagina)).toEqual([7]);
    });

    it('la auditoría lleva al dueño del libro', async () => {
        const { x } = aplicado();
        const auditado = vi.fn(async () => undefined);
        await revisarOReponer(x.d, { rid: 'B', lote: 'prueba-2', escribir: true }, auditado);
        expect(auditado).toHaveBeenCalledWith({ repuestas: [7], dueno: 'u' });
    });
});

