import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ketivQereOfVerse, type ChapterStructure } from '../chapterStructure';

/**
 * Ketiv y qere (revisión del profesor, 2026-11): en la BHS, Rut 2:1 מוֹדַע lleva
 * el círculo que remite al margen, donde está el ketiv מידע. Los datos lo
 * traían y la app sólo lo usaba para saltarlo.
 */
/** Sólo consonantes: el orden de los signos varía entre fuentes. */
const consonantes = (t: string) => t.normalize('NFD').replace(/[\u0591-\u05C7]/g, '');
const sinSignos = (fs: { ordinal: number; qere: string; ketiv?: string }[]) => fs.map(f => ({ ...f, qere: consonantes(f.qere) }));
const cargar = (rel: string): ChapterStructure =>
    JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../web/public/language-data/v1/he/${rel}`, import.meta.url)), 'utf8'));

describe('ketiv y qere del versículo', () => {
    it('Rut 2:1: se lee מוֹדַע (la 2.ª palabra) y está escrito מידע', () => {
        expect(sinSignos(ketivQereOfVerse(cargar('Ruth/2.json'), 1))).toEqual([{ ordinal: 1, qere: 'מודע', ketiv: 'מידע' }]);
    });

    it('Rut 3:3: dos en el mismo versículo (שמלתך y וירדתי, lo que marcó el profesor)', () => {
        expect(ketivQereOfVerse(cargar('Ruth/3.json'), 3).map(f => [f.ordinal, f.ketiv])).toEqual([[3, 'שמלתך'], [5, 'וירדתי']]);
    });

    it('un ketiv o un qere de dos palabras va junto (Job 38:1, Gn 30:11)', () => {
        expect(sinSignos(ketivQereOfVerse(cargar('Job/38.json'), 1))).toEqual([{ ordinal: 4, qere: 'מן הסערה', ketiv: 'מנ הסערה' }]);
        expect(sinSignos(ketivQereOfVerse(cargar('Gen/30.json'), 11))).toEqual([{ ordinal: 2, qere: 'בא גד', ketiv: 'בגד' }]);
    });

    it('qere sin ketiv: se lee una palabra que no está escrita (Rut 3:5 אֵלַי)', () => {
        expect(sinSignos(ketivQereOfVerse(cargar('Ruth/3.json'), 5))).toEqual([{ ordinal: 5, qere: 'אלי' }]);
    });

    it('ketiv sin qere: se escribe y no se lee, y no se le pega a la palabra siguiente (Rut 3:12 אם → גֹאֵל)', () => {
        expect(ketivQereOfVerse(cargar('Ruth/3.json'), 12)).toEqual([]);
    });

    it('un ketiv sin qere justo antes de otro par no se suma a su ketiv (caso armado: no ocurre en el AT, medido)', () => {
        const w = (r: string, t: string, x: object = {}) => ({ r, t, l: '', role: '', ...x });
        const ch: ChapterStructure = {
            lang: 'he', book: 'X', chapter: 1, clauses: [],
            words: [w('1!1', 'אם', { ketiv: true, sinQere: true }), w('1!2', 'ידרך', { ketiv: true }), w('1!3', 'הַדֹּרֵךְ', { qere: true })],
        };
        expect(ketivQereOfVerse(ch, 1)).toEqual([{ ordinal: 0, qere: 'הַדֹּרֵךְ', ketiv: 'ידרך' }]);
    });
});
