import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verseWords, type ChapterStructure } from '../chapterStructure';

/**
 * R1 — los ejemplos que el autor da para cada categoría, sacados de la capa de
 * texto del ejemplar con `scripts/language-rules/ejemplos-del-libro.py`. Son el
 * conjunto de prueba de las reglas de R4 (y el de control: otra sección del
 * mismo libro). Sólo etiquetas, nombres de categoría, páginas y referencias:
 * ningún texto del libro.
 */
interface Ejemplo { libro: string; capitulo: number; versiculo: number; pagina: number | null }
interface Sub { etiqueta: string; nombre: string | null; pagina: number | null; ejemplos: Ejemplo[] }
interface Seccion { seccion: string; titulo: string | null; pagina: number | null; subcategorias: Sub[]; ejemplos?: Ejemplo[] }
interface Archivo { obra: string; edicion: string; ejemplos: number; secciones: Seccion[] }

const BASE = fileURLToPath(new URL('../../../../web/public/language-data/v1/he/', import.meta.url));
const leer = (n: string): Archivo => JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${n}.json`, import.meta.url)), 'utf8'));
const todos = (a: Archivo) => a.secciones.flatMap(s => [...(s.ejemplos ?? []), ...s.subcategorias.flatMap(c => c.ejemplos)]);

describe('R1 — ejemplos de Arnold y Choi (1.ª ed., 2003)', () => {
    for (const nombre of ['arnoldChoi-infinitivo', 'arnoldChoi-preposiciones']) {
        it(`${nombre}: cada referencia existe en nuestros datos (OSHB/MACULA) y las páginas avanzan`, () => {
            const a = leer(nombre);
            expect(a.edicion).toMatch(/2003/);
            const ej = todos(a);
            expect(ej.length).toBe(a.ejemplos);
            const faltan = ej.filter(e => {
                const ruta = `${BASE}${e.libro}/${e.capitulo}.json`;
                if (!existsSync(ruta)) return true;
                const ch: ChapterStructure = JSON.parse(readFileSync(ruta, 'utf8'));
                return verseWords(ch, e.versiculo).length === 0;
            });
            expect(faltan).toEqual([]);
            const paginas = a.secciones.map(s => s.pagina ?? 0);
            expect(paginas).toEqual([...paginas].sort((x, y) => x - y));
            // Ninguna página vacía (revisión de R1: con `?? 0` pasaban), y cada ejemplo cae entre la página de
            // su subcategoría y la de la siguiente.
            expect(ej.filter(e => typeof e.pagina !== 'number')).toEqual([]);
            for (const sec of a.secciones) {
                expect(typeof sec.pagina, sec.seccion).toBe('number');
                const subs = sec.subcategorias;
                const pags = subs.map(c => c.pagina!);
                expect(pags, sec.seccion).toEqual([...pags].sort((x, y) => x - y));
                expect(pags.every(p => p >= sec.pagina!), sec.seccion).toBe(true);
                subs.forEach((c, k) => {
                    const hasta = subs[k + 1]?.pagina ?? Infinity;
                    const fuera = c.ejemplos.filter(e => e.pagina! < c.pagina! || e.pagina! > hasta);
                    expect(fuera, `${sec.seccion} (${c.etiqueta})`).toEqual([]);
                });
            }
        });
    }

    it('REGRESIÓN (revisión de R1): las referencias partidas entre líneas se recuperan — «(2\\nSam 3:16)» en 3.4.2 (b), «(1\\nKgs 12:27)» en 4.1.5 (a)', () => {
        const b = leer('arnoldChoi-infinitivo').secciones[1]!.subcategorias.find(s => s.etiqueta === 'b')!;
        expect(b.ejemplos.some(e => e.libro === '2Sam' && e.capitulo === 3 && e.versiculo === 16)).toBe(true);
        const a5 = leer('arnoldChoi-preposiciones').secciones.find(x => x.seccion === '4.1.5')!.subcategorias.find(s => s.etiqueta === 'a')!;
        expect(a5.ejemplos[0]).toMatchObject({ libro: '1Kgs', capitulo: 12, versiculo: 27 });
    });

    it('ancla: 3.4.1 (b.3), עַד + infinitivo = «hasta», p. 70 — Gn 19:22, 3:19, 32:25', () => {
        const b3 = leer('arnoldChoi-infinitivo').secciones[0]!.subcategorias.find(s => s.etiqueta === 'b.3')!;
        expect(b3.pagina).toBe(70);
        expect(b3.ejemplos.map(e => `${e.libro} ${e.capitulo}:${e.versiculo}`)).toEqual(['Gen 19:22', 'Gen 3:19', 'Gen 32:25']);
    });

    it('el control (cap. 4.1) trae las 18 preposiciones con la página del índice del libro', () => {
        const s = leer('arnoldChoi-preposiciones').secciones.filter(x => x.seccion.split('.').length === 3);
        expect(s.map(x => x.seccion)).toHaveLength(18);
        expect(s.find(x => x.seccion === '4.1.5')?.pagina).toBe(102); // בְּ
        expect(s.find(x => x.seccion === '4.1.15')?.pagina).toBe(120); // עַד
    });
});
