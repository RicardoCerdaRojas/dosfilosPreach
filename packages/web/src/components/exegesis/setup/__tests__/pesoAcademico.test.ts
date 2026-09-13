import { describe, it, expect } from 'vitest';
import type { LibraryResource } from '@dosfilos/domain';
import { pesoDeRecurso, pesoDeTipo, type PesoAcademico } from '../pesoAcademico';

const recurso = (over: Partial<LibraryResource>): LibraryResource =>
    ({ id: 'r1', type: 'other', ...over } as LibraryResource);

describe('pesoAcademico', () => {
    it('separa el comentario crítico del expositivo', () => {
        // Es la distinción que el pastor no puede hacer solo y por la que pedía
        // ayuda: los dos se llaman «comentario» en el lomo.
        expect(pesoDeTipo('commentary-critical')).toBe('tecnica');
        expect(pesoDeTipo('commentary-expository')).toBe('academica');
    });

    it('no llama «no citable» al texto que el pastor sí cita', () => {
        // BHQ y NA28 valen 0 en la rúbrica porque son el texto estudiado, no un
        // estudio; pero se citan todo el tiempo. Decir lo contrario en pantalla
        // sería falso.
        expect(pesoDeTipo('biblical-text-edition')).toBe('textoBase');
        expect(pesoDeTipo('style-template-paper')).toBe('noCitable');
    });

    it('usa la clasificación del recurso cuando existe', () => {
        expect(pesoDeRecurso(recurso({ type: 'commentary', exegeticalType: 'commentary-critical' })))
            .toBe('tecnica');
    });

    it('deduce del tipo de biblioteca cuando el recurso no fue clasificado', () => {
        // Sin esto, la mitad de las filas saldría sin peso y parecería que no
        // se sabe nada de esos libros.
        expect(pesoDeRecurso(recurso({ type: 'exegetical-commentary' }))).toBe('tecnica');
        expect(pesoDeRecurso(recurso({ type: 'commentary' }))).toBe('academica');
        expect(pesoDeRecurso(recurso({ type: 'grammar' }))).toBe('tecnica');
    });

    it('no se cae con un tipo que el catálogo no conoce', () => {
        // Cae en `other`, que el catálogo puntúa como de apoyo.
        expect(pesoDeRecurso(recurso({ type: 'inventado' as never }))).toBe('apoyo');
    });

    it('un tipo académico desconocido se rotula de apoyo, no «no se cita»', () => {
        // Desconocer un libro no es saber que no se cita. El rótulo duro sobre
        // un comentario crítico mal clasificado lo haría descartar.
        expect(pesoDeTipo('tipo-que-no-existe' as never)).toBe('apoyo');
    });

    it('un texto crítico de la biblioteca se rotula texto base', () => {
        expect(pesoDeRecurso(recurso({ type: 'critical-text' }))).toBe('textoBase');
    });
});

/**
 * Cada peso tiene que tener su palabra y su explicación en los dos idiomas.
 *
 * Sin esto, agregar un valor a `PesoAcademico` compila y despliega, y el
 * usuario ve la ruta cruda de la clave en la fila del libro. El tipo se recorre
 * entero a propósito: es lo único que obliga a actualizar los textos cuando la
 * escala cambie.
 */
describe('textos del peso académico', () => {
    const TODOS: PesoAcademico[] = ['tecnica', 'academica', 'apoyo', 'textoBase', 'noCitable'];

    it.each(['es', 'en'])('%s tiene rótulo y explicación para cada peso', async (locale) => {
        const json = await import(`../../../../i18n/locales/${locale}/exegesis.json`);
        const peso = json.default.paperSetup.subSteps.corpus.extract.peso;

        for (const p of TODOS) {
            expect(peso[p], `falta el rótulo ${locale}/${p}`).toBeTruthy();
            expect(peso[`hint_${p}`], `falta la explicación ${locale}/${p}`).toBeTruthy();
        }
        expect(json.default.paperSetup.subSteps.corpus.extract.dosEjes).toBeTruthy();
    });
});
