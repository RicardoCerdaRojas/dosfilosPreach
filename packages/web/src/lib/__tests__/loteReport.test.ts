import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    comandoDePreparar, diagnosticar, esRecomendado, estimar, lotesPasados, MODELO_ACTUAL, nombreDeLote, ordenarCandidatos,
    PRECIO_EN_LINEA, SUBA_DE_PRECIO, USD_POR_PAGINA_EN_LOTE, type CandidatoCrudo,
} from '../loteReport';

const base = (extra: Partial<CandidatoCrudo> = {}): CandidatoCrudo => ({
    id: 'r', titulo: 'Libro', autor: '', mimeType: 'application/pdf', sizeBytes: 1_000_000, pdfPageCount: 200, pageCount: 200,
    paginasFaltantes: null, textoEstructuradoVacio: false, extractionVersion: '6.0-gemini-cola', extractionModel: 'gemini-3.8-flash',
    textExtractionStatus: 'ready', reprocesadoEnLote: null, ...extra,
});

describe('diagnosticar', () => {
    it('un libro sano leído con el modelo actual: sin motivo', () => {
        expect(diagnosticar(base())).toMatchObject({ motivos: [], prioridad: 0, excluido: false, paginas: 200 });
    });
    it('faltan páginas pesa más cuanto más faltan; el texto vacío pesa mucho', () => {
        const pocas = diagnosticar(base({ paginasFaltantes: { total: 2, paginas: [3, 4] } }));
        const muchas = diagnosticar(base({ paginasFaltantes: { total: 150, paginas: [] } }));
        expect(muchas.prioridad).toBeGreaterThan(pocas.prioridad);
        expect(diagnosticar(base({ textoEstructuradoVacio: true })).motivos).toContain('vacio');
    });
    it('motor sin visión y modelo viejo', () => {
        expect(diagnosticar(base({ extractionVersion: '3.0-llamaparse' })).motivos).toEqual(['sinVision']);
        expect(diagnosticar(base({ extractionModel: 'gemini-2.5-flash' })).motivos).toEqual(['modeloViejo']);
    });
    it('ya reprocesado baja la prioridad, sin borrarla', () => {
        const antes = diagnosticar(base({ extractionVersion: '3.0-llamaparse' })).prioridad;
        const despues = diagnosticar(base({ extractionVersion: '3.0-llamaparse', reprocesadoEnLote: { lote: 'b1', fecha: null, motivo: null } })).prioridad;
        expect(despues).toBeLessThan(antes);
        expect(despues).toBeGreaterThan(0);
    });
    it('se excluyen: dominio público, no PDF y en proceso', () => {
        expect(diagnosticar(base({ extractionVersion: '6.0-thml-public-domain' })).excluido).toBe(true);
        expect(diagnosticar(base({ mimeType: 'application/epub+zip', extractionVersion: '3.0-llamaparse' })).excluido).toBe(true);
        expect(diagnosticar(base({ textExtractionStatus: 'processing', extractionVersion: '3.0-llamaparse' }))).toMatchObject({ excluido: true, prioridad: 0 });
    });
    it('cualquier versión que no es de visión cuenta como sin visión', () => {
        for (const v of ['fallback-pdfparse', '1.0-legacy', '7.0-pdfjs-lineas']) {
            expect(diagnosticar(base({ extractionVersion: v })).motivos).toContain('sinVision');
        }
    });
    it('fallido, sin extraer y sin medir nunca se ven «bien leídos»', () => {
        expect(diagnosticar(base({ textExtractionStatus: 'failed' }))).toMatchObject({ motivos: ['fallido'] });
        expect(diagnosticar(base({ textExtractionStatus: 'failed' })).prioridad).toBeGreaterThan(0);
        const sinExtraer = diagnosticar(base({ extractionVersion: null, extractionModel: null, textExtractionStatus: 'pending' }));
        expect(sinExtraer.motivos).toContain('sinExtraer');
        expect(sinExtraer.prioridad).toBeGreaterThan(0);
        const sinMedir = diagnosticar(base({ pdfPageCount: null }));
        expect(sinMedir.motivos).toEqual(['sinMedir']);
        expect(sinMedir.prioridad).toBe(0);
    });
    it('una ficha del catálogo del sistema (sin PDF) no es candidata ni «sin extraer»', () => {
        const ficha = diagnosticar(base({ tienePdf: false, extractionVersion: null, extractionModel: null, pdfPageCount: null, pageCount: null, sizeBytes: 0 }));
        expect(ficha).toMatchObject({ excluido: true, prioridad: 0, motivos: ['sinPdf'] });
        expect(esRecomendado(ficha)).toBe(false);
        // Una respuesta vieja sin el campo sigue como antes.
        expect(diagnosticar(base({ extractionVersion: null })).motivos).toContain('sinExtraer');
    });
    it('más de 60 MB lleva el aviso (si está cifrado, sólo la terminal lo descifra)', () => {
        expect(diagnosticar(base({ sizeBytes: 70 * 1024 * 1024 })).motivos).toContain('grande');
    });
});

describe('ordenarCandidatos', () => {
    it('los más convenientes primero y los excluidos al final', () => {
        const orden = ordenarCandidatos([
            base({ id: 'sano', titulo: 'A' }),
            base({ id: 'excluido', titulo: 'B', extractionVersion: '6.0-thml-public-domain' }),
            base({ id: 'vacio', titulo: 'C', textoEstructuradoVacio: true }),
            base({ id: 'viejo', titulo: 'D', extractionModel: 'gemini-2.5-flash' }),
        ]).map(c => c.id);
        expect(orden).toEqual(['vacio', 'viejo', 'sano', 'excluido']);
    });
});

describe('esRecomendado', () => {
    it('el ya reprocesado no se recomienda (se elige a mano); el excluido y el sano tampoco', () => {
        expect(esRecomendado(diagnosticar(base({ extractionVersion: '3.0-llamaparse' })))).toBe(true);
        expect(esRecomendado(diagnosticar(base({ paginasFaltantes: { total: 9, paginas: [] }, reprocesadoEnLote: { lote: 'b1', fecha: null, motivo: null } })))).toBe(false);
        expect(esRecomendado(diagnosticar(base({ extractionVersion: '6.0-thml-public-domain' })))).toBe(false);
        expect(esRecomendado(diagnosticar(base()))).toBe(false);
    });
});

describe('estimar', () => {
    it('lote, con reintentos y en línea (el doble)', () => {
        const e = estimar([{ paginas: 1000 }, { paginas: null }], new Date('2026-10-17'));
        expect(e).toMatchObject({ libros: 2, paginas: 1000, sinPaginas: 1, preciosDuplicados: false });
        expect(e.loteUsd).toBeCloseTo(1000 * USD_POR_PAGINA_EN_LOTE, 6);
        // Medido en los lotes reales: US$1,95–2,23 cada 1.000 páginas.
        expect(e.loteUsd).toBeGreaterThan(1.9);
        expect(e.loteUsd).toBeLessThan(2.3);
        expect(e.conReintentosUsd).toBeCloseTo(e.loteUsd * 1.2, 6);
        expect(e.enLineaUsd).toBeCloseTo(e.loteUsd * 2, 6);
    });
    it('desde 2027 el precio se duplica', () => {
        const antes = estimar([{ paginas: 100 }], new Date('2026-12-31'));
        const despues = estimar([{ paginas: 100 }], new Date('2027-01-02'));
        expect(despues.loteUsd).toBeCloseTo(antes.loteUsd * 2, 6);
        expect(despues.preciosDuplicados).toBe(true);
    });
    it('avisa a menos de dos días de la suba y cuando las páginas no son las del PDF', () => {
        expect(estimar([{ paginas: 1, pdfPageCount: 1 }], new Date('2026-12-30T12:00:00Z')).cercaDeLaSuba).toBe(true);
        expect(estimar([{ paginas: 1, pdfPageCount: 1 }], new Date('2026-12-20')).cercaDeLaSuba).toBe(false);
        expect(estimar([{ paginas: 1, pdfPageCount: 1 }], new Date('2027-01-02')).cercaDeLaSuba).toBe(false);
        expect(estimar([{ paginas: 80, pdfPageCount: null }, { paginas: 90, pdfPageCount: 90 }]).paginasAproximadas).toBe(1);
    });
});

describe('comandoDePreparar y nombreDeLote', () => {
    it('arma el comando de la terminal con un nombre válido y la clave dentro de la orden', () => {
        expect(nombreDeLote('Hebreo: Lexicón #2')).toBe('hebreo-lexicon-2');
        const cmd = comandoDePreparar('Biblioteca 6', ['a', 'b']);
        expect(cmd.startsWith('GEMINI_API_KEY="$(gcloud secrets versions access latest --secret=GEMINI_API_KEY --project=dosfilosapp)" ')).toBe(true);
        expect(cmd.endsWith('npx tsx scripts/reprocesar-en-lote.ts preparar biblioteca-6 --ids a,b')).toBe(true);
    });
    it('sin nombre usa la fecha (dos lotes «lote» chocan) y deja fuera los ids raros', () => {
        expect(comandoDePreparar('', ['a'], new Date('2026-10-17T15:00:00Z'))).toContain('preparar lote-2026-10-17 --ids a');
        expect(comandoDePreparar('x', ['ok_1-A', 'mal;rm -rf', 'b c'])).toMatch(/--ids ok_1-A$/);
    });
});

describe('lotesPasados', () => {
    it('agrupa por la marca que deja `aplicar`, el más reciente primero', () => {
        const l = lotesPasados([
            base({ id: 'x', titulo: 'X', reprocesadoEnLote: { lote: 'biblioteca1', fecha: '2026-10-15T10:00:00Z', motivo: 'faltantes 12 → 0' } }),
            base({ id: 'y', titulo: 'Y', reprocesadoEnLote: { lote: 'biblioteca5', fecha: '2026-10-16T18:00:00Z', motivo: null } }),
            base({ id: 'z', titulo: 'Z', reprocesadoEnLote: { lote: 'biblioteca1', fecha: '2026-10-15T11:00:00Z', motivo: null } }),
            base({ id: 'w' }),
        ]);
        expect(l.map(x => [x.nombre, x.libros.length, x.fecha])).toEqual([
            ['biblioteca5', 1, '2026-10-16T18:00:00Z'],
            ['biblioteca1', 2, '2026-10-15T11:00:00Z'],
        ]);
    });
});

/**
 * Paridad con functions (web no puede importarlo): el modelo actual y el
 * precio de 3.8 Flash. Si functions cambia de modelo o de precio, el panel
 * diría «modelo anterior» a todo o estimaría mal.
 */
describe('paridad con functions', () => {
    const raiz = resolve(__dirname, '../../../../functions/src/llm');
    it('MODELO_ACTUAL = MODEL_VISION', () => {
        const fuente = readFileSync(resolve(raiz, 'modelCatalog.ts'), 'utf8');
        expect(fuente).toMatch(new RegExp(`export const MODEL_VISION = '${MODELO_ACTUAL.replace(/\./g, '\\.')}';`));
    });
    it('ResumenDeLote del hook = el de estadoDelLote (mismos campos)', () => {
        const campos = (fuente: string) => {
            const bloque = fuente.match(/export interface ResumenDeLote \{([\s\S]*?)\n\}/)?.[1] ?? '';
            return [...bloque.matchAll(/^ {4}(\w+)\??:/gm)].map(m => m[1]).sort();
        };
        const servidor = campos(readFileSync(resolve(raiz, '../library/estadoDelLote.ts'), 'utf8'));
        const web = campos(readFileSync(resolve(__dirname, '../../hooks/admin/useBatchJobs.ts'), 'utf8'));
        expect(servidor.length).toBeGreaterThan(10);
        expect(web).toEqual(servidor);
    });
    it('precio en línea y fecha de la suba = llmCost', () => {
        const fuente = readFileSync(resolve(raiz, 'llmCost.ts'), 'utf8');
        const bloque = fuente.match(new RegExp(`'${MODELO_ACTUAL.replace(/\./g, '\\.')}': \\{([\\s\\S]*?)\\n    \\}`))?.[1] ?? '';
        expect(bloque).toContain(`inputPer1M: ${PRECIO_EN_LINEA.entradaPor1M},`);
        expect(bloque).toContain(`outputPer1M: ${PRECIO_EN_LINEA.salidaPor1M},`);
        expect(bloque).toContain(`desde: '${SUBA_DE_PRECIO.toISOString().slice(0, 10)}', inputPer1M: ${PRECIO_EN_LINEA.entradaPor1M * 2}, outputPer1M: ${PRECIO_EN_LINEA.salidaPor1M * 2}`);
    });
});
