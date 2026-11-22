import { describe, expect, it, vi, beforeEach } from 'vitest';
import { firestoreFalso } from './firestoreFalso';

const busquedas: unknown[][] = [];
let permitido = true;
vi.mock('../../../functions/src/library/consulta/recuperarFragmentos', () => ({
    buscarPertinentes: async (...a: unknown[]) => {
        busquedas.push(a);
        return {
            reordenado: true,
            fragmentos: [
                { id: 'c1', resourceId: 'varner', titulo: 'The Book of James', autor: 'Varner, William', hoja: 192, seccion: 'Paragraph 22', texto: 'Diaspora encyclical text…', score: 0.8, pertinencia: 9 },
                { id: 'c2', resourceId: 'pd-jfb', titulo: 'JFB', autor: 'Jamieson, Robert', hoja: null, seccion: 'JAS 1:5', texto: 'If any of you lack wisdom', score: 0.7, pertinencia: 8 },
            ],
        };
    },
}));
vi.mock('../../../functions/src/shared/rateLimit', () => ({ consumeRateLimitToken: async () => permitido }));
const { HERRAMIENTAS } = await import('../herramientas/registro');
const { ErrorDeHerramienta } = await import('../herramientas/tipos');
const herramienta = (n: string) => HERRAMIENTAS.find(h => h.nombre === n)!;

const varner = { userId: 'yo', title: 'The Book of James', author: 'Varner, William', pageNumbering: { origin: 'confirmed', segments: [{ fromSheet: 5, toSheet: 244, offset: -4 }] } };
const jfb = { userId: '__system__', title: 'JFB', author: 'Jamieson, Robert', publiclyCitable: true, pageCount: 0 };
const protegido = { userId: '__system__', title: 'Protegido', author: 'X', publiclyCitable: false, pageCount: 300 };
const ajeno = { userId: 'otro', title: 'Ajeno', author: 'Y' };
const chunk = (resourceId: string, userId: string, page: number, chunkIndex: number, text: string, section = '') => ({ resourceId, userId, chunkIndex, text, metadata: { page, section } });

function armar(extra: Record<string, Record<string, Record<string, unknown>>> = {}) {
    return firestoreFalso({
        library_resources: { varner, 'pd-jfb': jfb, protegido, ajeno },
        document_chunks: {
            v1: chunk('varner', 'yo', 192, 2, 'segunda parte'),
            v0: chunk('varner', 'yo', 192, 1, 'primera parte'),
            j1: chunk('pd-jfb', '__system__', 1, 5, 'If any of you lack wisdom', 'JAS 1:5'),
            p1: chunk('protegido', '__system__', 10, 0, 'texto protegido'),
            a1: chunk('ajeno', 'otro', 3, 0, 'texto ajeno'),
        },
        ...extra,
    });
}
const ctxDe = (db: unknown) => ({ uid: 'yo', clienteId: 'claude', db: db as never, geminiKey: 'k' });
const json = (r: { texto: string }) => JSON.parse(r.texto);

beforeEach(() => { busquedas.length = 0; permitido = true; });

describe('herramientas del corpus (A9)', () => {
    it('registra las cinco de lectura, todas con corpus:read y esquema de objeto', () => {
        expect(HERRAMIENTAS.map(h => h.nombre)).toEqual(['buscar_biblioteca', 'leer_hoja', 'leer_trabajo', 'leer_requisitos', 'consultar_catalogo']);
        expect(HERRAMIENTAS.every(h => h.modo === 'lee' && h.alcance === 'corpus:read' && h.esquema.type === 'object')).toBe(true);
    });

    describe('leer_hoja', () => {
        it('una hoja de un libro propio: el texto en orden, la cita con su página y el cupo', async () => {
            const { db } = armar();
            const r = json(await herramienta('leer_hoja').ejecutar({ libro: 'varner', hoja: 192 }, ctxDe(db)));
            expect(r.texto).toBe('primera parte\n\nsegunda parte');
            expect(r.cita).toBe('(Varner, p. 188)');
            expect(r.hojasQueQuedanHoy).toBe(59);
        });
        it('un libro de otro usuario o un compartido protegido: no encontrado, sin leer sus fragmentos', async () => {
            const { db, consultas } = armar();
            await expect(herramienta('leer_hoja').ejecutar({ libro: 'ajeno', hoja: 3 }, ctxDe(db))).rejects.toThrow('No encontré ese libro');
            await expect(herramienta('leer_hoja').ejecutar({ libro: 'protegido', hoja: 10 }, ctxDe(db))).rejects.toBeInstanceOf(ErrorDeHerramienta);
            expect(consultas.filter(c => c.coleccion === 'document_chunks')).toHaveLength(0);
        });
        it('un libro sin hojas (JFB) se lee por sección, sin cupo', async () => {
            const { db } = armar();
            await expect(herramienta('leer_hoja').ejecutar({ libro: 'pd-jfb', hoja: 1 }, ctxDe(db))).rejects.toThrow('pide una sección');
            const r = json(await herramienta('leer_hoja').ejecutar({ libro: 'pd-jfb', seccion: 'JAS 1:5' }, ctxDe(db)));
            expect(r.cita).toBe('(Jamieson, § JAS 1:5)');
            expect(r.hoja).toBeNull();
            expect(r.hojasQueQuedanHoy).toBeUndefined();
        });
        it('el cupo: 60 hojas distintas por libro y día; repetir una ya leída no gasta', async () => {
            const { db, store } = armar();
            const { diaDeHoy } = await import('../cupo');
            store.corpus_quota = { [`yo_varner_${diaDeHoy()}`]: { hojas: Array.from({ length: 60 }, (_, i) => i + 100) } };
            await expect(herramienta('leer_hoja').ejecutar({ libro: 'varner', hoja: 192 }, ctxDe(db))).rejects.toThrow('cupo');
            store.corpus_quota[`yo_varner_${diaDeHoy()}`] = { hojas: [...Array.from({ length: 59 }, (_, i) => i + 100), 192] };
            const r = json(await herramienta('leer_hoja').ejecutar({ libro: 'varner', hoja: 192 }, ctxDe(db)));
            expect(r.hojasQueQuedanHoy).toBe(0);
        });
        it('una hoja sin texto no gasta cupo', async () => {
            const { db, store } = armar();
            await expect(herramienta('leer_hoja').ejecutar({ libro: 'varner', hoja: 99999 }, ctxDe(db))).rejects.toThrow('no tiene texto');
            expect(store.corpus_quota).toBeUndefined();
        });
        it('argumentos: falta la hoja; hoja no entera', async () => {
            const { db } = armar();
            await expect(herramienta('leer_hoja').ejecutar({ libro: 'varner' }, ctxDe(db))).rejects.toThrow('Falta «hoja»');
            await expect(herramienta('leer_hoja').ejecutar({ libro: 'varner', hoja: 1.5 }, ctxDe(db))).rejects.toThrow('entero');
        });
    });

    describe('buscar_biblioteca', () => {
        it('busca en toda la biblioteca o en los libros pedidos, y cita como la web', async () => {
            const { db } = armar();
            const r = json(await herramienta('buscar_biblioteca').ejecutar({ consulta: 'sabiduría' }, ctxDe(db)));
            expect(busquedas[0]![2]).toEqual({ tipo: 'todo' });
            expect(r.libros[0].pasajes[0].cita).toBe('(Varner, p. 188)');
            expect(r.libros[1].pasajes[0].cita).toBe('(Jamieson, § JAS 1:5)');
            await herramienta('buscar_biblioteca').ejecutar({ consulta: 'sabiduría', libros: ['varner', 'varner'] }, ctxDe(db));
            expect(busquedas[1]![2]).toEqual({ tipo: 'libros', ids: ['varner'] });
        });
        it('comparte el tope por hora con la web', async () => {
            const { db } = armar();
            permitido = false;
            await expect(herramienta('buscar_biblioteca').ejecutar({ consulta: 'sabiduría' }, ctxDe(db))).rejects.toThrow('Demasiadas búsquedas');
            expect(busquedas).toHaveLength(0);
        });
    });

    describe('consultar_catalogo', () => {
        it('reconoce el libro en español, inglés o por id, y filtra por tipo', async () => {
            const { db } = armar();
            const a = json(await herramienta('consultar_catalogo').ejecutar({ libro: 'Santiago' }, ctxDe(db)));
            const b = json(await herramienta('consultar_catalogo').ejecutar({ libro: 'JAS', tipo: 'commentary-critical' }, ctxDe(db)));
            expect(a.libro.id).toBe('JAS');
            expect(a.obras.length).toBeGreaterThan(b.obras.length);
            expect(b.obras.length).toBeGreaterThan(0);
            expect(b.obras.every((o: { tipo: string }) => o.tipo === 'commentary-critical')).toBe(true);
            await expect(herramienta('consultar_catalogo').ejecutar({ libro: 'Hezekiah' }, ctxDe(db))).rejects.toThrow('No reconozco');
        });
    });

    describe('leer_trabajo y leer_requisitos', () => {
        const paper = (ownerId: string, extra: Record<string, unknown> = {}) => ({
            ownerId, title: 'TP #10', passage: { bookId: 'JAS', chapterStart: 5, chapterEnd: 5, verseStart: 1, verseEnd: 6 },
            sources: [], steps: [], updatedAt: { toDate: () => new Date('2026-11-04') }, ...extra,
        });
        it('sin id, los trabajos propios no archivados, el más reciente primero; nunca los ajenos', async () => {
            const { db } = armar({ exegeticalPapers: {
                t1: paper('yo'),
                t2: { ...paper('yo'), title: 'Reciente', updatedAt: { toDate: () => new Date('2026-11-20') } },
                t3: { ...paper('yo'), title: 'Archivado', archivedAt: new Date() },
                t4: paper('otro'),
            } });
            const r = json(await herramienta('leer_trabajo').ejecutar({}, ctxDe(db)));
            expect(r.trabajos.map((t: { titulo: string }) => t.titulo)).toEqual(['Reciente', 'TP #10']);
            expect(r.trabajos[1].pasaje).toMatch(/Santiago 5:1/);
        });
        it('un trabajo ajeno no se lee; uno propio da su estado y sus requisitos', async () => {
            const { db } = armar({ exegeticalPapers: { t1: paper('yo'), t4: paper('otro') } });
            await expect(herramienta('leer_trabajo').ejecutar({ trabajo: 't4' }, ctxDe(db))).rejects.toThrow('No encontré ese trabajo');
            await expect(herramienta('leer_requisitos').ejecutar({ trabajo: 't4' }, ctxDe(db))).rejects.toThrow('No encontré ese trabajo');
            const t = json(await herramienta('leer_trabajo').ejecutar({ trabajo: 't1' }, ctxDe(db)));
            expect(t.titulo).toBe('TP #10');
            expect(t.documentoArmado).toBe(false);
            const q = json(await herramienta('leer_requisitos').ejecutar({ trabajo: 't1' }, ctxDe(db)));
            expect(Array.isArray(q.requisitos)).toBe(true);
            expect(q.requisitos.some((x: { id: string }) => x.id.startsWith('tipo:'))).toBe(true);
        });
    });
});
