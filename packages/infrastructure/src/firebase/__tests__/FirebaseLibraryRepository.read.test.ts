import { describe, it, expect } from 'vitest';
import { FirebaseLibraryRepository } from '../FirebaseLibraryRepository';

/**
 * La LECTURA también es una lista blanca, y tuvo el mismo defecto que la
 * escritura con la numeración impresa: lo que no se enumera desaparece sin
 * avisar.
 *
 * Tres campos que las funciones escriben y la tarjeta sabe mostrar nunca se
 * copiaban a la entidad. El código de la interfaz existía y no se ejecutaba:
 * la píldora decía «Procesando…» a secas en una cadena de dos horas con su
 * avance escrito en Firestore, un índice que llegó a la página 433 de 711 se
 * mostraba «Listo» en verde, y las páginas ilegibles no se avisaban.
 */
const repo = new FirebaseLibraryRepository();

const base = {
    userId: 'u',
    title: 'Libro',
    type: 'grammar',
    storageUrl: 'gs://x',
    mimeType: 'application/pdf',
    sizeBytes: 1,
    textExtractionStatus: 'processing',
};

describe('FirebaseLibraryRepository — lectura de un recurso', () => {
    it('lleva el avance de la extracción en cola a la entidad', () => {
        const extractionProgress = {
            paginasHechas: 746, totalPaginas: 792, porcentaje: 94,
            ultimoRango: '735-746', rangosEstimados: 132,
        };
        const r = repo.firestoreToResource('id', { ...base, extractionProgress });
        expect(r.extractionProgress).toEqual(extractionProgress);
    });

    it('lleva el aviso de índice incompleto', () => {
        const indexingWarning = 'Se indexó hasta la página 433 de 711.';
        const r = repo.firestoreToResource('id', { ...base, textExtractionStatus: 'ready', indexingWarning });
        expect(r.indexingWarning).toEqual(indexingWarning);
    });

    it('lleva las páginas que la extracción no pudo leer', () => {
        const paginasFaltantes = { total: 2, paginas: [14, 15] };
        const r = repo.firestoreToResource('id', { ...base, paginasFaltantes });
        expect(r.paginasFaltantes).toEqual(paginasFaltantes);
    });

    it('deja los tres ausentes en un recurso que no los tiene', () => {
        const r = repo.firestoreToResource('id', base);
        expect(r.extractionProgress).toBeUndefined();
        expect(r.indexingWarning).toBeUndefined();
        expect(r.paginasFaltantes).toBeUndefined();
    });
});
