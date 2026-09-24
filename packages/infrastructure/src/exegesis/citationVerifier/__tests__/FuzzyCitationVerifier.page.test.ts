import { describe, it, expect } from 'vitest';
import type { ParsedCitation, VerifierSource } from '@dosfilos/domain';
import { FuzzyCitationVerifier } from '../FuzzyCitationVerifier';

const AFIRMACION = 'el genitivo atributivo funciona como un adjetivo que califica al sustantivo principal';

const cita = (pages: string | null): ParsedCitation => ({
    raw: `(Wallace, p. ${pages})`,
    author: 'Wallace',
    title: '',
    pages,
    offset: 0,
    evidence: AFIRMACION,
    evidenceIsQuoted: true,
});

const fuente = (pageHint: string | null): VerifierSource => ({
    corpusId: 'c7ac8c56',
    citationKey: 'Wallace',
    fullAuthor: 'Daniel B. Wallace',
    displayLabel: 'Gramática Griega',
    chunks: [{ text: `Texto de la fuente: ${AFIRMACION}, y otras cosas más.`, pageHint }],
});

const verificar = (c: ParsedCitation, s: VerifierSource) =>
    new FuzzyCitationVerifier().verify({ markdown: '', citations: [c], sources: [s] })
        .then(r => r.citations[0]!);

describe('FuzzyCitationVerifier — cotejo de página', () => {
    it('la página coincide: verificada', async () => {
        const v = await verificar(cita('54'), fuente('p. 54'));
        expect(v.status).toBe('verified');
    });

    it('la página discrepa: página no coincide', async () => {
        const v = await verificar(cita('87'), fuente('p. 54'));
        expect(v.status).toBe('page-mismatch');
    });

    it('la afirmación está en la fuente y el fragmento no trae ancla: no se puede comprobar', async () => {
        // El defecto que este estado cierra. La «Gramática Griega» está
        // guardada con su libro entero como tramo sin folio, de modo que sus
        // fragmentos llegan sin página. Antes esto salía `verified` —la
        // comprobación estaba condicionada a que el fragmento trajera número—
        // y la página 87 que citaba el modelo, copiada de una referencia
        // cruzada impresa en el texto, nunca se comparó con nada.
        const v = await verificar(cita('87'), fuente(null));
        expect(v.status).toBe('page-unverifiable');
        expect(v.matchedPage).toBeNull();
    });

    it('sin página citada no hay nada que comprobar: sigue verificada', async () => {
        // Una cita que no afirma página no puede afirmar una página falsa.
        const v = await verificar(cita(null), fuente(null));
        expect(v.status).toBe('verified');
    });

    it('un fragmento anclado en hoja sí se coteja: la cita copió ese mismo rótulo', async () => {
        const v = await verificar(cita('54'), fuente('hoja 54'));
        expect(v.status).toBe('verified');
    });

    it('si la afirmación no está en la fuente, manda «no encontrada» y no el cotejo de página', async () => {
        const v = await verificar(
            { ...cita('87'), evidence: 'una afirmación que no aparece en ninguna parte del libro' },
            fuente(null),
        );
        expect(v.status).toBe('not-found');
    });
});
