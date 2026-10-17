import { beforeAll, describe, expect, it } from 'vitest';
import { aplicarLibro, compararLibro } from '../aplicarLote';
import { resumirLote } from '../estadoDelLote';
import { procesarLibro, sondearLote } from '../orquestarLote';
import { armar, lanzar, PLAZO, prepararPdfs, responder } from './fakesDelLote';

beforeAll(prepararPdfs);

const diez = Array.from({ length: 10 }, (_, i) => i + 1);

/** Un lote de B (10 páginas) leído entero; el texto actual de B no tiene marcas de página. */
async function loteListo(respuestas = [responder(0, diez)], extraB: Record<string, unknown> = {}) {
    const x = armar();
    x.recurso('B', { textContent: 'Texto viejo de B, leído por un motor sin visión.', ...extraB });
    await lanzar(x.d, ['B']);
    await procesarLibro(x.d, { loteId: 'b6', rid: 'B', ronda: 1 }, PLAZO);
    x.g.estados.set('batches/1', { estado: 'JOB_STATE_SUCCEEDED', respuestas });
    await sondearLote(x.d, 'b6', 's1');
    return x;
}

const aplicar = (x: Awaited<ReturnType<typeof loteListo>>, extra: { aceptarIncompletos?: boolean } = {}) =>
    aplicarLibro(x.d, { loteId: 'b6', rid: 'B', aceptarIncompletos: false, por: 'admin', ...extra });

describe('comparar', () => {
    it('guarda sólo números y el motivo, y queda vieja si se lee otra ronda', async () => {
        const x = await loteListo();
        const c = await compararLibro(x.d, 'b6', 'B');
        expect(c).toMatchObject({ reemplazar: true, nueva: { faltantes: 0 } });
        const libro = resumirLote(x.lote()).libros[0]!;
        expect(libro).toMatchObject({ listo: true, incompletos: 0, comparacionVieja: false, comparacion: { reemplazar: true } });
        expect(JSON.stringify(x.lote().libros[0]!.comparacion)).not.toContain('Contenido legible');
        // Otra ronda leída: la comparación ya no vale.
        const l = x.lote();
        l.rondas.push({ ...l.rondas[0]!, numero: 2 });
        x.docs.set('admin_lotes/b6', l as unknown as Record<string, unknown>);
        expect(resumirLote(x.lote()).libros[0]!.comparacionVieja).toBe(true);
    });
});

describe('aplicar', () => {
    it('respalda, escribe el md, pasa por processing → ready con la marca del lote, y no se aplica dos veces', async () => {
        const x = await loteListo();
        expect(await aplicar(x)).toMatchObject({ reemplazado: true });
        const respaldo = [...x.escritos.entries()].find(([p]) => p.startsWith('users/u/library/B/textContent.antes-del-lote-b6-'));
        expect(respaldo?.[1]).toMatchObject({ contenido: 'Texto viejo de B, leído por un motor sin visión.', sinPisar: true });
        expect(x.escritos.get('users/u/library/B/structured.md')?.contenido).toContain('Contenido legible de la página 10');
        const delLibro = x.actualizaciones.filter(a => a.path === 'library_resources/B').map(a => a.campos.textExtractionStatus);
        expect(delLibro).toEqual(['processing', 'ready']);
        expect(x.docs.get('library_resources/B')).toMatchObject({
            extractionVersion: '6.0-gemini-cola', extractionModel: 'gemini-3.8-flash', needsReindex: true,
            structuredContentUrl: 'gs://b/users/u/library/B/structured.md', reprocesadoEnLote: { lote: 'b6' },
        });
        expect(x.lote().libros[0]).toMatchObject({ aplicado: { reemplazado: true }, aplicando: null });
        expect(x.docs.get('extraction_runs/lote-b6-B')).toMatchObject({ path: 'batch-reprocess', outcome: 'ready', userId: 'u', pages: { expected: 10, emitted: 10, missing: 0 } });
        await expect(aplicar(x)).rejects.toMatchObject({ codigo: 'failed-precondition', message: expect.stringContaining('ya se aplicó') });
    });

    it('si no mejora, no escribe y deja anotado por qué', async () => {
        const x = await loteListo([responder(0, diez)], { extractionVersion: '6.0-gemini-cola', extractionModel: 'gemini-3.8-flash' });
        // Mismo modelo y el texto actual ya completo: nada mejora.
        const actual = diez.map(n => `<!-- page: ${n} -->\nContenido legible de la página ${n} con bastante texto para contar como leída.`).join('\n\n');
        x.recurso('B', { textContent: actual, extractionVersion: '6.0-gemini-cola', extractionModel: 'gemini-3.8-flash' });
        const r = await aplicar(x);
        expect(r.reemplazado).toBe(false);
        expect(x.escritos.size).toBe(0);
        expect(x.lote().libros[0]!.aplicado).toMatchObject({ reemplazado: false, motivo: expect.stringContaining('se queda como está') });
    });

    it('no aplica si el libro se está extrayendo, y suelta el reclamo para volver a intentar', async () => {
        const x = await loteListo();
        x.recurso('B', { textContent: 'Texto viejo', textExtractionStatus: 'processing' });
        await expect(aplicar(x)).rejects.toMatchObject({ message: expect.stringContaining('se está extrayendo') });
        expect(x.lote().libros[0]!.aplicando).toBeNull();
        x.recurso('B', { textContent: 'Texto viejo' });
        expect((await aplicar(x)).reemplazado).toBe(true);
    });

    it('no aplica si el PDF cambió desde que se preparó', async () => {
        const x = await loteListo();
        x.generaciones['users/u/b.pdf'] = '2';
        await expect(aplicar(x)).rejects.toMatchObject({ message: expect.stringContaining('PDF del libro cambió') });
        expect(x.escritos.size).toBe(0);
    });

    it('con tramos incompletos sólo aplica si se acepta', async () => {
        const x = await loteListo([responder(0, [1, 2, 3, 4, 5, 6, 7, 8])]);
        await expect(aplicar(x)).rejects.toMatchObject({ message: expect.stringContaining('faltan 1 tramos') });
        expect((await aplicar(x, { aceptarIncompletos: true })).reemplazado).toBe(true);
    });

    it('con tramos en curso no aplica', async () => {
        const x = armar();
        await lanzar(x.d, ['B']);
        await procesarLibro(x.d, { loteId: 'b6', rid: 'B', ronda: 1 }, PLAZO);
        await expect(aplicar(x)).rejects.toMatchObject({ message: expect.stringContaining('todavía hay tramos en curso') });
    });

    it('si la escritura del documento falla, deshace: md anterior y estado anterior', async () => {
        const x = await loteListo([responder(0, diez)], { structuredContentUrl: 'gs://b/users/u/library/B/structured.md' });
        x.guardados.set('users/u/library/B/structured.md', 'md viejo');
        const bajar = x.d.almacen.bajar;
        x.d.almacen.bajar = async r => (r.path.endsWith('structured.md') ? Buffer.from('md viejo') : bajar(r));
        // Falla la segunda escritura (la de los campos nuevos), no la que deshace.
        x.fallarEn((path, campos) => path === 'library_resources/B' && 'extractionVersion' in campos);
        await expect(aplicar(x)).rejects.toThrow('la escritura falló');
        expect(x.escritos.get('users/u/library/B/structured.md')?.contenido).toBe('md viejo');
        expect(x.docs.get('library_resources/B')!.textExtractionStatus).toBe('ready');
        expect(x.lote().libros[0]!.aplicado ?? null).toBeNull();
        expect(x.lote().libros[0]!.aplicando).toBeNull();
        expect(x.docs.get('extraction_runs/lote-b6-B')).toMatchObject({ outcome: 'failed', reason: 'la escritura falló' });
    });

    it('un error al bajar el md actual (que no sea «no existe») corta sin escribir nada', async () => {
        const x = await loteListo([responder(0, diez)], { structuredContentUrl: 'gs://b/users/u/library/B/structured.md' });
        const bajar = x.d.almacen.bajar;
        x.d.almacen.bajar = async r => { if (r.path.endsWith('structured.md')) throw Object.assign(new Error('503 Service Unavailable'), { code: 503 }); return bajar(r); };
        await expect(aplicar(x)).rejects.toThrow('503');
        expect(x.escritos.size).toBe(0);
        expect(x.actualizaciones.filter(a => a.path === 'library_resources/B')).toEqual([]);
    });

    it('si el libro cambió entre la comparación y la escritura (otra extracción), no lo toca', async () => {
        const x = await loteListo();
        const generacion = x.d.almacen.generacion;
        // Justo después de leerlo, el usuario pulsa «Reprocesar».
        x.d.almacen.generacion = async r => { x.tocar('library_resources/B'); return generacion(r); };
        await expect(aplicar(x)).rejects.toMatchObject({ message: expect.stringContaining('cambió mientras se comparaba') });
        expect(x.escritos.size).toBe(0);
        expect(x.lote().libros[0]!.aplicando).toBeNull();
    });

    it('al tomarlo renueva la señal de vida (el barrido mira esa hora)', async () => {
        const x = await loteListo();
        await aplicar(x);
        const tomar = x.actualizaciones.find(a => a.path === 'library_resources/B' && a.campos.textExtractionStatus === 'processing')!;
        expect(tomar.campos.extractionHeartbeatAt).toBeInstanceOf(Date);
        expect(tomar.campos.processingStartedAt).toBeInstanceOf(Date);
    });

    it('si no había md y la escritura falla, el md nuevo se borra', async () => {
        const x = await loteListo();
        x.fallarEn((path, campos) => path === 'library_resources/B' && 'extractionVersion' in campos);
        await expect(aplicar(x)).rejects.toThrow('la escritura falló');
        expect(x.borrados).toEqual(['users/u/library/B/structured.md']);
        expect(x.docs.get('library_resources/B')!.textExtractionStatus).toBe('ready');
    });

    it('la auditoría se escribe apenas cambia el libro, aunque después falle anotarlo en el lote', async () => {
        const x = await loteListo();
        const auditado: string[] = [];
        const runTransaction = x.d.db.runTransaction.bind(x.d.db);
        let escrito = false;
        await expect(aplicarLibro(x.d, { loteId: 'b6', rid: 'B', aceptarIncompletos: false, por: 'admin' }, async r => {
            auditado.push(r.motivo);
            escrito = true;
            // La próxima transacción (anotar en el lote) falla.
            (x.d.db as unknown as { runTransaction: unknown }).runTransaction = async (fn: never) => {
                if (escrito) { escrito = false; throw new Error('Firestore no responde'); }
                return runTransaction(fn);
            };
        })).rejects.toThrow('Firestore no responde');
        expect(auditado).toHaveLength(1);
        expect(x.docs.get('library_resources/B')!.extractionVersion).toBe('6.0-gemini-cola');
    });

    it('un lote preparado sin la huella del PDF lo dice, en vez de «el PDF cambió»', async () => {
        const x = await loteListo();
        const l = x.lote();
        l.libros[0]!.pdf = null;
        x.docs.set('admin_lotes/b6', l as unknown as Record<string, unknown>);
        await expect(aplicar(x)).rejects.toMatchObject({ message: expect.stringContaining('sin la huella del PDF') });
    });
});

describe('cuándo un libro se puede aplicar', () => {
    it('con un tramo en «fallo» no (como el script): hay que reintentar', async () => {
        const x = await loteListo([{ ...responder(0, diez), finishReason: 'MAX_TOKENS' }]);
        await expect(aplicar(x, { aceptarIncompletos: true })).rejects.toMatchObject({ message: expect.stringContaining('fallaron: reintenta') });
    });

    it('con la ronda leída pero sin revisar no (sus páginas en blanco aún figuran «ok»)', async () => {
        const x = await loteListo();
        const l = x.lote();
        l.rondas[0]!.revisada = false;
        x.docs.set('admin_lotes/b6', l as unknown as Record<string, unknown>);
        await expect(aplicar(x)).rejects.toMatchObject({ message: expect.stringContaining('se está revisando') });
    });

    it('«no mejora» no bloquea para siempre: con una ronda nueva leída se puede volver a aplicar; un libro reemplazado no se reintenta', async () => {
        const x = await loteListo([responder(0, diez)], { extractionVersion: '6.0-gemini-cola', extractionModel: 'gemini-3.8-flash' });
        const actual = diez.map(n => `<!-- page: ${n} -->\nContenido legible de la página ${n} con bastante texto para contar como leída.`).join('\n\n');
        x.recurso('B', { textContent: actual, extractionVersion: '6.0-gemini-cola', extractionModel: 'gemini-3.8-flash' });
        expect((await aplicar(x)).reemplazado).toBe(false);
        await expect(aplicar(x)).rejects.toMatchObject({ message: expect.stringContaining('no mejoraba') });
        const l = x.lote();
        l.rondas[0]!.leidaEn = l.libros[0]!.aplicado!.fecha + 1;
        x.docs.set('admin_lotes/b6', l as unknown as Record<string, unknown>);
        expect(resumirLote(x.lote()).libros[0]!.listo).toBe(true);
    });
});

