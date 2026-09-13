import { describe, it, expect } from 'vitest';
import { proponerCorpusHeredado } from '../corpusHeredado';
import type { ExegeticalPaper } from '../../entities/ExegeticalPaper';
import type { ProjectSource } from '../../entities/ProjectSource';
import type { SourceType } from '../../entities/SourceType';

/**
 * CASO REAL que motivó esto. Un plan de predicación sobre Jonás, seis trabajos
 * con el mismo `seriesId`:
 *
 *     Jon 1:1-3     0 fuentes
 *     Jon 1:4-16    1 fuente
 *     Jon 2:1-11   11 fuentes   ← acá se armó el corpus
 *     Jon 3:1-10    0 fuentes   ← y acá había que empezar de nuevo
 *
 * El sistema sabía que eran una serie y hacía empezar de cero igual.
 */
const fuente = (
    recurso: string | null,
    sourceType: SourceType = 'commentary-critical',
    extras: Partial<ProjectSource> = {},
): ProjectSource => ({
    sourceLibraryResourceId: recurso,
    corpusId: recurso ? `corpus-${recurso}` : null,
    sourceType,
    chosenRole: 'anchor',
    displayLabel: `Libro ${recurso}`,
    citationKey: recurso ? `key-${recurso}` : null,
    excerpts: [{ text: 'fragmento de OTRO pasaje' }],
} as unknown as ProjectSource);

const trabajo = (
    id: string,
    seriesId: string | null,
    sources: ProjectSource[],
): Pick<ExegeticalPaper, 'id' | 'seriesId' | 'sources'> =>
    ({ id, seriesId, sources } as Pick<ExegeticalPaper, 'id' | 'seriesId' | 'sources'>);

describe('proponerCorpusHeredado', () => {
    it('ofrece las fuentes del hermano más completo de la serie', () => {
        const actual = trabajo('jon3', 'serie-jonas', []);
        const p = proponerCorpusHeredado(actual, [
            trabajo('jon1', 'serie-jonas', [fuente('a')]),
            trabajo('jon2', 'serie-jonas', [fuente('a'), fuente('b'), fuente('c')]),
            trabajo('jon4', 'serie-jonas', []),
        ])!;
        expect(p.origenId).toBe('jon2');
        expect(p.fuentes.map(f => f.sourceLibraryResourceId)).toEqual(['a', 'b', 'c']);
    });

    /**
     * Lo que NO se hereda es la mitad del diseño. Los excerpts se extraen
     * contra un pasaje concreto: los de Jonás 2 hablan de Jonás 2, y
     * arrastrarlos metería en el trabajo citas que no vienen al caso.
     */
    it('NUNCA trae los fragmentos: se extraen contra el pasaje nuevo', () => {
        const p = proponerCorpusHeredado(
            trabajo('jon3', 's', []),
            [trabajo('jon2', 's', [fuente('a')])],
        )!;
        expect(p.fuentes[0]).not.toHaveProperty('excerpts');
        expect(Object.keys(p.fuentes[0]!)).toEqual(
            expect.arrayContaining(['sourceType', 'chosenRole', 'displayLabel', 'citationKey']),
        );
    });

    it('no vuelve a ofrecer lo que el trabajo ya tiene', () => {
        const p = proponerCorpusHeredado(
            trabajo('jon3', 's', [fuente('a')]),
            [trabajo('jon2', 's', [fuente('a'), fuente('b')])],
        )!;
        expect(p.fuentes.map(f => f.sourceLibraryResourceId)).toEqual(['b']);
        expect(p.yaPresentes).toBe(1);
    });

    it('conserva la clasificación, que es lo que mantiene coherente la serie', () => {
        // Rearmar a mano produce el mismo comentario clasificado distinto en dos
        // pericopas, dentro de lo que el lector percibe como un solo estudio.
        const p = proponerCorpusHeredado(
            trabajo('jon3', 's', []),
            [trabajo('jon2', 's', [fuente('a', 'lexicon-technical')])],
        )!;
        expect(p.fuentes[0]!.sourceType).toBe('lexicon-technical');
        expect(p.fuentes[0]!.citationKey).toBe('key-a');
        expect(p.fuentes[0]!.chosenRole).toBe('anchor');
    });

    it('no ofrece nada cuando no hay nada que ofrecer', () => {
        // Una propuesta vacía es ruido, y enseña a ignorar el aviso cuando sí
        // tenga algo.
        expect(proponerCorpusHeredado(trabajo('x', null, []), [])).toBeNull();
        expect(proponerCorpusHeredado(trabajo('x', 's', []), [])).toBeNull();
        expect(proponerCorpusHeredado(
            trabajo('x', 's', [fuente('a')]),
            [trabajo('y', 's', [fuente('a')])],
        )).toBeNull();
    });

    it('no cruza series ni se hereda a sí mismo', () => {
        expect(proponerCorpusHeredado(
            trabajo('x', 'serie-1', []),
            [trabajo('y', 'serie-2', [fuente('a')])],
        )).toBeNull();
        expect(proponerCorpusHeredado(
            trabajo('x', 's', []),
            [trabajo('x', 's', [fuente('a')])],
        )).toBeNull();
    });

    it('una fuente sin recurso de biblioteca no se puede heredar', () => {
        // Era un archivo suelto de aquel trabajo: no hay qué volver a adjuntar.
        const p = proponerCorpusHeredado(
            trabajo('jon3', 's', []),
            [trabajo('jon2', 's', [fuente(null), fuente('b')])],
        )!;
        expect(p.fuentes.map(f => f.sourceLibraryResourceId)).toEqual(['b']);
    });

    it('no ofrece un libro que ya no está en la biblioteca', () => {
        // CASO REAL: de las once fuentes del trabajo de Jonás 2, una apunta a
        // un recurso borrado. Heredarla dejaría en el corpus un libro que no se
        // puede abrir ni citar, igual a los buenos hasta intentar usarlo.
        const p = proponerCorpusHeredado(
            trabajo('jon3', 's', []),
            [trabajo('jon2', 's', [fuente('a'), fuente('borrado'), fuente('b')])],
            new Set(['a', 'b']),
        )!;

        expect(p.fuentes.map(f => f.sourceLibraryResourceId)).toEqual(['a', 'b']);
    });

    it('elige al hermano con más fuentes VIVAS, no con más fuentes', () => {
        // Once libros de los que diez ya no están son peor base que cinco
        // vivos, y contar en bruto elegiría al primero.
        const p = proponerCorpusHeredado(trabajo('jon4', 's', []), [
            trabajo('muchas-muertas', 's', [fuente('x'), fuente('y'), fuente('z'), fuente('a')]),
            trabajo('pocas-vivas', 's', [fuente('b'), fuente('c')]),
        ], new Set(['a', 'b', 'c']))!;

        expect(p.origenId).toBe('pocas-vivas');
    });

    it('calla cuando todas las fuentes del hermano están borradas', () => {
        expect(proponerCorpusHeredado(
            trabajo('jon3', 's', []),
            [trabajo('jon2', 's', [fuente('borrado')])],
            new Set(['otro']),
        )).toBeNull();
    });

    it('un mismo libro adjuntado dos veces se trae una', () => {
        const p = proponerCorpusHeredado(
            trabajo('jon3', 's', []),
            [trabajo('jon2', 's', [fuente('a'), fuente('a')])],
        )!;
        expect(p.fuentes).toHaveLength(1);
    });

    it('trae el corpus ya ingerido de cada fuente, no uno nuevo', () => {
        // El texto del libro ya está adentro: la fuente heredada lo reapunta.
        // Ingerirlo de nuevo cobraría cuota por el mismo documento.
        const p = proponerCorpusHeredado(
            trabajo('jon3', 'serie-jonas', []),
            [trabajo('jon2', 'serie-jonas', [fuente('a'), fuente('b')])],
        )!;

        expect(p.fuentes.map(f => f.corpusId)).toEqual(['corpus-a', 'corpus-b']);
    });

    it('entre dos hermanos igual de completos toma el más reciente', () => {
        // La lista llega ordenada por fecha descendente, así que el más
        // reciente es el primero. Empatados en cantidad, gana él: es el que
        // refleja cómo quedó decidida la serie.
        const p = proponerCorpusHeredado(trabajo('jon4', 'serie-jonas', []), [
            trabajo('reciente', 'serie-jonas', [fuente('a'), fuente('b')]),
            trabajo('viejo', 'serie-jonas', [fuente('c'), fuente('d')]),
        ])!;

        expect(p.origenId).toBe('reciente');
    });

    it('hereda también las fuentes viejas, que guardan el recurso en corpusId', () => {
        // Adjuntadas antes de que existiera el backref: `corpusId` tiene el id
        // de biblioteca y `sourceLibraryResourceId` quedó en null. Mirar sólo
        // el backref dejaría estas series sin herencia.
        const vieja = { ...fuente('a'), sourceLibraryResourceId: null } as ProjectSource;
        const p = proponerCorpusHeredado(
            trabajo('jon3', 'serie-jonas', []),
            [trabajo('jon2', 'serie-jonas', [vieja])],
        )!;

        expect(p.fuentes).toHaveLength(1);
        expect(p.fuentes[0].sourceLibraryResourceId).toBe('corpus-a');
        expect(p.fuentes[0].corpusId).toBe('corpus-a');
    });

    it('no duplica un libro que ambos trabajos tienen por la ruta vieja', () => {
        // Mismo recurso en `corpusId` a los dos lados: ya está, no se ofrece.
        const vieja = { ...fuente('a'), sourceLibraryResourceId: null } as ProjectSource;
        const p = proponerCorpusHeredado(
            trabajo('jon3', 'serie-jonas', [vieja]),
            [trabajo('jon2', 'serie-jonas', [vieja])],
        );

        expect(p).toBeNull();
    });
});
