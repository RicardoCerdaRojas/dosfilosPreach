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

describe('el versículo de una referencia del manuscrito (C7)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { verseTextFor } = require('../BibleVersionFactory');

    it.each(['Jonás 4:2', 'Jon 4:2', '1 Jn 3:16-18', 'Sal 103.8', 'Mt 5:3', 'Stg 1:19', 'Gén 1:1'])(
        'se lee: «%s»',
        (ref) => {
            expect(verseTextFor(ref)).toBeTruthy();
        },
    );

    it('una referencia que no existe da null (no inventa)', () => {
        expect(verseTextFor('Jonás 9:99')).toBeNull();
    });
});

describe('la página de Lectura (C7)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readingPassageFor } = require('../BibleVersionFactory');

    it('el pasaje del sermón con sus números de versículo', () => {
        const p = readingPassageFor(['Jonás 4:5-11']);
        expect(p.title).toBe('Jonás 4:5-11');
        expect(p.verses.map((v: { number: number }) => v.number)).toEqual([5, 6, 7, 8, 9, 10, 11]);
        expect(p.verses[0].text).toMatch(/^Y salió Jonás/);
    });

    it('salta las referencias que no se leen y toma la primera que sí', () => {
        expect(readingPassageFor(['texto libre', 'Salmo 23'])?.verses.length).toBe(6);
    });

    it('sin referencias legibles, no hay página de lectura', () => {
        expect(readingPassageFor([])).toBeNull();
        expect(readingPassageFor(['Jonás 9:1'])).toBeNull();
    });
});
