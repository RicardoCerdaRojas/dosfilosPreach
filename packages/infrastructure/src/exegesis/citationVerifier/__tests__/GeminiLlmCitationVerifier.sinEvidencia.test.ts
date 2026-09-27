import { describe, it, expect } from 'vitest';
import type { ParsedCitation, VerifierSource } from '@dosfilos/domain';
import { GeminiLlmCitationVerifier } from '../GeminiLlmCitationVerifier';

/**
 * «No pude comprobar» no es «no existe».
 *
 * Una fuente que el verificador reconoce pero de la que no pudo leer
 * evidencia devolvía `not-found`, el mismo veredicto que una cita inventada.
 * Es el peor de los dos errores: el autor borra una cita correcta porque la
 * pantalla dice que la fuente no la respalda.
 *
 * Medido en Jonás 4:3 — las citas a Calvino en las hojas 60 y 61 volvieron
 * «no encontrada» mientras la hoja 60 decía, palabra por palabra, lo que la
 * afirmación sostenía.
 *
 * Esta rama devuelve ANTES de llamar al modelo, así que se prueba sin red.
 */
const cita = (author: string): ParsedCitation => ({
    raw: `${author}, hoja 60 · commentator`,
    author,
    title: '',
    pages: null,
    evidencePage: '60',
    offset: 0,
    evidence: 'Calvino considera que la oración de Jonás es pecaminosa en su exceso.',
    evidenceIsQuoted: false,
});

const fuente = (chunks: VerifierSource['chunks']): VerifierSource => ({
    corpusId: 'res-1',
    citationKey: 'Calvino',
    fullAuthor: 'Calvino',
    displayLabel: 'Comentario Jonás',
    chunks,
    numbering: null,
});

describe('el verificador distingue no poder leer de no encontrar', () => {
    it('una fuente reconocida y sin evidencia legible queda para revisión manual', async () => {
        const verifier = new GeminiLlmCitationVerifier();
        const { citations } = await verifier.verify({
            markdown: '',
            citations: [cita('Calvino')],
            sources: [fuente([])],
            language: 'es',
        } as never);

        expect(citations[0]!.status).toBe('manual-pending');
        expect(citations[0]!.matchedSourceLabel).toBe('Comentario Jonás');
        expect(citations[0]!.note).toContain('No se pudo leer la evidencia admitida');
    });

    it('una cita cuya fuente NO está en el corpus sigue siendo no encontrada', async () => {
        // La distinción que importa: acá sí se sabe algo —ninguna fuente del
        // trabajo lleva ese nombre— y eso es un hallazgo, no una duda.
        const verifier = new GeminiLlmCitationVerifier();
        const { citations } = await verifier.verify({
            markdown: '',
            citations: [cita('Ropes')],
            sources: [fuente([{ text: 'algo', pageHint: 'hoja 60' }])],
            language: 'es',
        } as never);

        expect(citations[0]!.status).toBe('not-found');
        expect(citations[0]!.matchedSourceLabel).toBeNull();
    });
});
