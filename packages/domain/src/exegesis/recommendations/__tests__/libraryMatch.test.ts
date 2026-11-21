import { describe, it, expect } from 'vitest';
import {
    findLibraryResourceForRecommendation,
    matchRecommendationToResource,
    type LibraryResourceLike,
} from '../libraryMatch';
import type { SourceRecommendation } from '../types';

function makeRec(overrides: Partial<SourceRecommendation>): SourceRecommendation {
    return {
        author: 'Cockerill, Gareth Lee',
        title: 'The Epistle to the Hebrews',
        series: 'NICNT',
        publisher: 'Eerdmans',
        year: 2012,
        isbn: '9780802824929',
        tier: 'essential',
        languages: ['en'],
        ...overrides,
    };
}

function makeRes(overrides: Partial<LibraryResourceLike>): LibraryResourceLike {
    return {
        id: 'res-1',
        title: 'The Epistle to the Hebrews',
        author: 'Cockerill, Gareth',
        ...overrides,
    };
}

describe('matchRecommendationToResource — series acronym', () => {
    it('matches when the resource title contains the series acronym (WBC)', () => {
        const rec = makeRec({ author: 'Lane', title: 'Hebrews 1-8', series: 'WBC 47A' });
        const res = makeRes({ title: 'Hebrews WBC Lane', author: 'Lane' });
        expect(matchRecommendationToResource(rec, res)).toBe(true);
    });

    it('matches BDAG by acronym in user-uploaded title', () => {
        const rec = makeRec({
            author: 'Bauer; Danker; Arndt',
            title: 'A Greek-English Lexicon of the New Testament',
            series: 'BDAG',
            isbn: null,
        });
        const res = makeRes({ id: 'r-bdag', title: 'BDAG (3rd ed.)', author: '' });
        expect(matchRecommendationToResource(rec, res)).toBe(true);
    });

    it('does NOT match when acronym would be a substring (avoid AWBC false-positive)', () => {
        const rec = makeRec({ series: 'WBC' });
        const res = makeRes({ title: 'AWBC random title', author: '' });
        expect(matchRecommendationToResource(rec, res)).toBe(false);
    });

    it('extracts acronym from "Anchor Yale Bible 36" → "Anchor" (4 chars, accepted)', () => {
        const rec = makeRec({
            author: 'Koester',
            title: 'Hebrews',
            series: 'Anchor Yale Bible 36',
            isbn: null,
        });
        const res = makeRes({ title: 'Hebrews Anchor', author: 'Koester' });
        expect(matchRecommendationToResource(rec, res)).toBe(true);
    });

    it('skips acronyms shorter than 3 chars', () => {
        const rec = makeRec({ series: 'A' });
        const res = makeRes({ title: 'A book about A things', author: '' });
        expect(matchRecommendationToResource(rec, res)).toBe(false);
    });
});

describe('matchRecommendationToResource — title token overlap', () => {
    it('matches when titles overlap ≥70% AND surnames match', () => {
        const rec = makeRec({
            author: 'Cockerill, Gareth Lee',
            title: 'The Epistle to the Hebrews',
            series: null,
            isbn: null,
        });
        const res = makeRes({ title: 'Epistle Hebrews Commentary', author: 'Gareth Cockerill' });
        expect(matchRecommendationToResource(rec, res)).toBe(true);
    });

    it('rejects identical title with DIFFERENT author (Hebrews by Lane vs Hebrews by Cockerill)', () => {
        const rec = makeRec({
            author: 'Cockerill, Gareth Lee',
            title: 'The Epistle to the Hebrews',
            series: null,
            isbn: null,
        });
        const res = makeRes({ title: 'The Epistle to the Hebrews', author: 'Lane, William' });
        expect(matchRecommendationToResource(rec, res)).toBe(false);
    });

    it('accepts title-only match when resource has no author (user upload without metadata)', () => {
        const rec = makeRec({
            author: 'Cockerill, Gareth Lee',
            title: 'The Epistle to the Hebrews Commentary',
            series: null,
            isbn: null,
        });
        const res = makeRes({ title: 'Epistle Hebrews Commentary Volume', author: '' });
        expect(matchRecommendationToResource(rec, res)).toBe(true);
    });

    it('rejects when token overlap is below 70%', () => {
        const rec = makeRec({
            title: 'The Epistle to the Hebrews',
            series: null,
            isbn: null,
        });
        const res = makeRes({ title: 'Romans Commentary', author: '' });
        expect(matchRecommendationToResource(rec, res)).toBe(false);
    });

    it('case- and accent-insensitive', () => {
        const rec = makeRec({
            author: 'González, Juan',
            title: 'Análisis Exegético de Romanos',
            series: null,
            isbn: null,
        });
        const res = makeRes({ title: 'analisis exegetico de romanos', author: 'JUAN GONZALEZ' });
        expect(matchRecommendationToResource(rec, res)).toBe(true);
    });
});

describe('findLibraryResourceForRecommendation', () => {
    it('returns the first matching resource', () => {
        const rec = makeRec({ series: 'BDAG', author: '', title: 'Greek lexicon', isbn: null });
        const resources: LibraryResourceLike[] = [
            { id: 'r1', title: 'Random theology book', author: 'X' },
            { id: 'r2', title: 'BDAG Lexicon', author: 'Bauer' },
            { id: 'r3', title: 'Another BDAG copy', author: '' },
        ];
        const result = findLibraryResourceForRecommendation(rec, resources);
        expect(result?.id).toBe('r2');
    });

    it('returns null when no resource matches', () => {
        const rec = makeRec({ series: 'BDAG', author: '', title: 'Greek lexicon', isbn: null });
        const resources: LibraryResourceLike[] = [
            { id: 'r1', title: 'Romans Commentary', author: 'Moo' },
            { id: 'r2', title: 'Genesis Notes', author: 'Wenham' },
        ];
        expect(findLibraryResourceForRecommendation(rec, resources)).toBeNull();
    });

    it('returns null on empty resources array', () => {
        const rec = makeRec({});
        expect(findLibraryResourceForRecommendation(rec, [])).toBeNull();
    });
});

describe('apellidos, no nombres de pila (bandeja de A7, 2026-11-21)', () => {
    const dibelius = makeRec({ author: 'Dibelius, Martin', title: 'James: A Commentary on the Epistle of James', series: 'Hermeneia', year: 1976 });
    it('el WBC 48 de Ralph P. Martin no es el Hermeneia de Martin Dibelius', () => {
        expect(matchRecommendationToResource(dibelius, { id: 'm', title: 'James (Word Biblical Commentary 48)', author: 'Ralph P. Martin' })).toBe(false);
        expect(matchRecommendationToResource(dibelius, { id: 'd', title: 'James: A Commentary on the Epistle of James', author: 'Martin Dibelius' })).toBe(true);
    });
    it('una palabra repetida del título no cuenta dos veces', () => {
        // «james» dos veces en el título del catálogo: con el mismo autor, ya no llega al 70 %.
        expect(matchRecommendationToResource(makeRec({ author: 'Martin, Ralph P.', title: 'James: A Commentary on the Epistle of James' }), { id: 'x', title: 'James (Word Biblical Commentary 48)', author: 'Ralph P. Martin' })).toBe(false);
    });
    it('«Apellido, Nombre», varios autores, apellidos compuestos y de tres letras', () => {
        const titulo = 'The Letter of James';
        expect(matchRecommendationToResource(makeRec({ author: 'Moo, Douglas J.', title: titulo }), { id: 'a', title: titulo, author: 'Douglas J. Moo' })).toBe(true);
        expect(matchRecommendationToResource(makeRec({ author: 'Allison, Dale C., Jr.', title: titulo }), { id: 'b', title: titulo, author: 'Dale C. Allison Jr.' })).toBe(true);
        expect(matchRecommendationToResource(makeRec({ author: 'Hawthorne, Gerald F.; Martin, Ralph P. (eds.)', title: titulo }), { id: 'c', title: titulo, author: 'Ralph P. Martin' })).toBe(true);
        expect(matchRecommendationToResource(makeRec({ author: 'Cerda Rojas, Ricardo', title: titulo }), { id: 'e', title: titulo, author: 'Ricardo Cerda Rojas' })).toBe(true);
        // El nombre de pila compartido no basta.
        expect(matchRecommendationToResource(makeRec({ author: 'Johnson, Luke Timothy', title: titulo }), { id: 'f', title: titulo, author: 'Luke Timothy McCartney' })).toBe(false);
        expect(matchRecommendationToResource(makeRec({ author: 'Dibelius, Martin', title: titulo }), { id: 'g', title: titulo, author: 'Martin, Ralph P.' })).toBe(false);
        expect(matchRecommendationToResource(makeRec({ author: 'Martin, Ralph P.', title: titulo }), { id: 'h', title: titulo, author: 'Martin Dibelius' })).toBe(false);
    });
});

describe('la sigla de la serie, escrita o desplegada en el título', () => {
    it('BECNT en «Baker Exegetical Commentary on the New Testament»; WBC en «Word Biblical Commentary»', () => {
        const mcc = makeRec({ author: 'McCartney, Dan G.', title: 'James', series: 'BECNT' });
        expect(matchRecommendationToResource(mcc, { id: 'a', title: 'James — Baker Exegetical Commentary on the New Testament', author: 'McCartney, Dan G.' })).toBe(true);
        const martin = makeRec({ author: 'Martin, Ralph P.', title: 'James', series: 'WBC 48' });
        expect(matchRecommendationToResource(martin, { id: 'b', title: 'James (Word Biblical Commentary 48)', author: 'Ralph P. Martin' })).toBe(true);
        // Otro autor de la misma serie: no.
        expect(matchRecommendationToResource(martin, { id: 'c', title: 'Jude-2 Peter, Volume 50 (Word Biblical Commentary)', author: 'Richard Bauckham' })).toBe(false);
        // Iniciales que no van seguidas no forman la sigla.
        expect(matchRecommendationToResource(mcc, { id: 'd', title: 'Baker Commentary: Exegesis of the New Testament', author: 'McCartney' })).toBe(false);
    });
});
