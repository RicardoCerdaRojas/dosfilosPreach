import { describe, it, expect, vi } from 'vitest';
import type { ExegeticalPaper, ProjectSource } from '@dosfilos/domain';
import { VerifierSourcesBuilder } from '../VerifierSourcesBuilder';

/**
 * Con qué evidencia se juzga una cita.
 *
 * Una fuente `full-document` caía al texto completo del libro como UN
 * fragmento sin página, del que el verificador se queda con sus primeros
 * caracteres: la portada y el arranque. Con esa evidencia, toda cita a una
 * página interior vuelve «no encontrada», que es el peor veredicto posible
 * porque el autor borra una cita correcta.
 *
 * Medido en Jonás 4:3: las citas a Calvino en las hojas 60 y 61 volvieron
 * «no encontrada» con la nota de que los fragmentos cubrían «la introducción
 * y el inicio del libro». La hoja 60 dice, palabra por palabra, lo que la
 * afirmación sostenía.
 */
const NOW = new Date('2026-01-01T00:00:00Z');

const fuente = (overrides: Partial<ProjectSource> = {}): ProjectSource => ({
    id: 'src-1',
    paperId: 'paper-1',
    corpusId: 'res-1',
    sourceType: 'commentary-critical',
    displayLabel: 'Comentario Jonás',
    citationKey: 'Calvino',
    order: 0,
    mode: 'full-document',
    excerptSelectionMode: null,
    excerptRecipe: {
        sheetRanges: [{ start: 52, end: 69 }],
        proposedRanges: [],
        pinnedRanges: [],
        passageFingerprint: 'fp',
    },
    excerpts: [],
    sourceLibraryResourceId: 'res-1',
    extractedAt: NOW,
    extractionFingerprint: 'fp',
    createdAt: NOW,
    ...overrides,
} as ProjectSource);

const paper = (sources: ProjectSource[]) => ({ sources } as ExegeticalPaper);

const LIBRO_ENTERO = 'PORTADA · PREFACIO · El libro de Jonás comienza en el capítulo 1…';

function construir(opts: { admitidos?: Array<{ text: string; sheet: number }> | 'falla'; source?: ProjectSource }) {
    const contentReader = { getTextContent: vi.fn().mockResolvedValue(LIBRO_ENTERO) };
    const corpusReader = {
        readAdmitted: vi.fn(async () => {
            if (opts.admitidos === 'falla') throw new Error('la callable no respondió');
            return (opts.admitidos ?? []).map((c, i) => ({
                resourceId: 'res-1', chunkIndex: i, text: c.text, sheet: c.sheet, section: null, score: 1,
            }));
        }),
    };
    const pageNumbering = { numberingFor: vi.fn().mockResolvedValue(null) };
    const builder = new VerifierSourcesBuilder(
        contentReader as never,
        corpusReader as never,
        pageNumbering as never,
    );
    return { builder, contentReader, source: opts.source ?? fuente() };
}

describe('VerifierSourcesBuilder — una fuente con receta no se juzga contra la portada', () => {
    it('con evidencia admitida, esa es la evidencia', async () => {
        const { builder, source } = construir({
            admitidos: [{ text: 'esta oración brotó de un celo piadoso y santo', sheet: 60 }],
        });
        const out = await builder.build(paper([source]));
        expect(out[0]!.chunks[0]!.text).toContain('celo piadoso');
        expect(out[0]!.chunks[0]!.pageHint).toBe('hoja 60');
    });

    it('si la lectura admitida FALLA, la fuente no cae al libro entero', async () => {
        const { builder, source, contentReader } = construir({ admitidos: 'falla' });
        const out = await builder.build(paper([source]));
        expect(out[0]!.chunks).toHaveLength(0);
        expect(JSON.stringify(out)).not.toContain('PORTADA');
        expect(contentReader.getTextContent).not.toHaveBeenCalled();
    });

    it('si la lectura admitida vuelve VACÍA, tampoco', async () => {
        const { builder, source } = construir({ admitidos: [] });
        const out = await builder.build(paper([source]));
        expect(out[0]!.chunks).toHaveLength(0);
        expect(JSON.stringify(out)).not.toContain('PORTADA');
    });

    it('la fuente entra igual aunque venga sin evidencia, para que el verificador la reconozca', async () => {
        // Dejarla fuera no es mejor: la cita volvería «sin fuente
        // coincidente», que se informa igual que una cita inventada.
        const { builder, source } = construir({ admitidos: [] });
        const out = await builder.build(paper([source]));
        expect(out).toHaveLength(1);
        expect(out[0]!.citationKey).toBe('Calvino');
    });

    it('una fuente SIN receta sigue usando el libro entero', async () => {
        // Es la carga directa de un extracto acotado: ahí el documento
        // entero ES la curaduría, y nunca hubo hojas que contradecir.
        const { builder, source } = construir({ source: fuente({ excerptRecipe: null }) });
        const out = await builder.build(paper([source]));
        expect(out[0]!.chunks[0]!.text).toContain('PORTADA');
    });
});
