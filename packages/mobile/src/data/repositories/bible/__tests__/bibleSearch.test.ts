import { describe, expect, it } from '@jest/globals';
import { matchRanges } from '@dosfilos/domain';

import { RVR1960Repository } from '../RVR1960Repository';

/**
 * La búsqueda con índice (C1) tiene que dar EXACTAMENTE lo mismo que
 * recorrer los versículos uno por uno, que es lo que hacía antes.
 */
function aMano(repo: RVR1960Repository, query: string, limit: number) {
    const out: string[] = [];
    for (const book of repo.getBooks()) {
        for (let c = 1; c <= book.chapters; c++) {
            const verses = repo.getChapterContent(book.id, c) ?? [];
            for (let v = 0; v < verses.length; v++) {
                if (matchRanges(verses[v]!, query).length) out.push(`${book.name} ${c}:${v + 1}`);
                if (out.length >= limit) return out;
            }
        }
    }
    return out;
}

describe('búsqueda en la Biblia (C1)', () => {
    const repo = new RVR1960Repository();

    it.each(['ninive', 'Jonás Nínive', 'misericordia', 'calabacera', 'xyzq', 'amor de Dios'])(
        'el índice da lo mismo que recorrer todo: «%s»',
        (q) => {
            expect(repo.search(q, 40).map((r) => r.reference)).toEqual(aMano(repo, q, 40));
        },
    );

    it('los rangos para resaltar caen sobre el texto que se muestra', () => {
        const [primero] = repo.search('ninive', 1);
        const { start, end } = primero!.ranges![0]!;
        expect(primero!.text.slice(start, end).toLowerCase()).toBe('nínive');
    });

    it('el ámbito limita a los libros pedidos', () => {
        const jonas = repo.search('ninive', 100, ['jn']);
        expect(jonas.length).toBeGreaterThan(0);
        expect(jonas.every((r) => r.bookId === 'jn')).toBe(true);
    });
});

describe('libros entre versiones y abreviaturas (C1)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BibleVersionFactory, bookIdInVersion } = require('../BibleVersionFactory');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { parseBibleReferenceParts } = require('@dosfilos/domain');
    const rvr = BibleVersionFactory.getByVersion('rvr1960');
    const asv = BibleVersionFactory.getByVersion('asv');
    const nombre = (repo: any, id: string | null) => repo.getBooks().find((b: any) => b.id === id)?.name;
    const abrir = (ref: string) => nombre(rvr, rvr.resolveBookId(parseBibleReferenceParts(ref).bookKey));

    it('REGRESIÓN: con Jonás abierto, pasar a la ASV muestra Jonah (mostraba Juan)', () => {
        expect(nombre(asv, bookIdInVersion('rvr1960', 'asv', 'jn'))).toBe('Jonah');
        expect(nombre(asv, bookIdInVersion('rvr1960', 'asv', 'jo'))).toBe('John');
    });

    it('REGRESIÓN: «Jud 1:3» es Judas, no Jueces; el id del dato sigue mandando', () => {
        expect(abrir('Jud 1:3')).toBe('Judas');
        expect(abrir('Jueces 6:12')).toBe('Jueces');
        expect(nombre(rvr, rvr.resolveBookId('jn'))).toBe('Jonás');
        expect(nombre(rvr, rvr.resolveBookId('Jn'))).toBe('Juan');
    });

    it('la ASV nombra Hebrews en inglés', () => {
        expect(nombre(asv, '58')).toBe('Hebrews');
    });
});
