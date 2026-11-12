import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ChapterStructure } from '../chapterStructure';
import { verseWords } from '../chapterStructure';
import { hebrewArticleAntecedents, hebrewRoleConflict } from '../hebrewArticle';

const cargar = (rel: string): ChapterStructure =>
    JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../web/public/language-data/v1/${rel}`, import.meta.url)), 'utf8'));
const consonantes = (s: string) => s.normalize('NFD').replace(/[^א-ת]/g, '');
/** El hecho de la palabra cuyo texto (sin vocales) es `cons`. */
function hecho(rel: string, verse: number, cons: string) {
    const ch = cargar(rel);
    const ws = verseWords(ch, verse);
    const i = ws.findIndex(w => consonantes(w.t) === cons);
    expect(i, `${cons} en ${rel} ${verse}`).toBeGreaterThanOrEqual(0);
    return hebrewArticleAntecedents(ch, verse).find(f => f.ordinal === i);
}

describe('el antecedente del artículo hebreo (U4, revisión del profesor)', () => {
    it('Rut 3:6 הַגֹּרֶן: la era ya se nombró en 3:3 (a tres versículos)', () => {
        expect(hecho('he/Ruth/3.json', 6, 'הגרן')?.antecedent).toEqual({ text: 'הַגֹּרֶן', verse: 3 });
    });

    it('el caso clásico: «אִישׁ … הָאִישׁ» (Nm 15:32 → 15:35) y «בִּבְהֵמָה … הַבְּהֵמָה» en el mismo versículo (Lv 20:15)', () => {
        expect(hecho('he/Num/15.json', 35, 'האיש')?.antecedent.verse).toBe(32);
        expect(hecho('he/Lev/20.json', 15, 'הבהמה')?.antecedent.verse).toBe(15);
    });

    it('NO: un ordinal detrás es OTRA de la serie (Jue 20:39 כַּמִּלְחָמָה הָרִאשֹׁנָה)', () => {
        expect(hecho('he/Judg/20.json', 39, 'כמלחמה')).toBeUndefined();
    });

    it('NO: tiempo (Éx 40:17 «el primero del mes») y distributivo (Éx 26:13 «הָאַמָּה מִזֶּה וְהָאַמָּה מִזֶּה»)', () => {
        expect(hecho('he/Exod/40.json', 17, 'לחדש')).toBeUndefined();
        expect(hecho('he/Exod/26.json', 13, 'והאמה')).toBeUndefined();
    });

    it('NO: título tras un nombre propio (2 Cr 17:15 «יְהוֹחָנָן הַשָּׂר», otro jefe que el de 17:14)', () => {
        expect(hecho('he/2Chr/17.json', 15, 'השר')).toBeUndefined();
    });

    it('NO: otro número (Gn 1:16 הַמָּאוֹר «la lumbrera mayor» no retoma הַמְּאֹרֹת «las lumbreras») ni כֹּל (Ec 3:20)', () => {
        expect(hecho('he/Gen/1.json', 16, 'המאור')).toBeUndefined();
        expect(hecho('he/Eccl/3.json', 20, 'הכל')).toBeUndefined();
    });

    it('NO: lo arameo (Dn 2:8 מִלְּתָא: estado enfático, no artículo)', () => {
        expect(hebrewArticleAntecedents(cargar('he/Dan/2.json'), 8)).toEqual([]);
    });

    it('sólo hebreo, y no busca más de cinco versículos atrás', () => {
        expect(hebrewArticleAntecedents(cargar('gr/JAS/2.json'), 14)).toEqual([]);
        for (const v of [6, 7, 8, 9, 10, 14]) {
            for (const f of hebrewArticleAntecedents(cargar('he/Ruth/3.json'), v)) expect(v - f.antecedent.verse).toBeLessThanOrEqual(5);
        }
    });
});

describe('el rol de MACULA contra la función que dijo el asistente', () => {
    it('Rut 3:6: «objeto directo» para un complemento adverbial (MACULA adv) choca', () => {
        expect(hebrewRoleConflict('adv', 'Objeto directo del verbo וַתֵּרֶד')).toBe(true);
        expect(hebrewRoleConflict('adv', 'Complemento adverbial de dirección: «a la era»')).toBe(false);
    });

    it('objeto llamado sujeto, y sujeto llamado objeto o complemento, chocan', () => {
        expect(hebrewRoleConflict('o', 'Sujeto de la oración')).toBe(true);
        expect(hebrewRoleConflict('s', 'Objeto directo de וַיִּשְׁמַע')).toBe(true);
        expect(hebrewRoleConflict('s', 'Sujeto del verbo')).toBe(false);
    });

    it('sin rol, sin texto o con texto que no se puede juzgar: no choca', () => {
        expect(hebrewRoleConflict(undefined, 'Objeto directo')).toBe(false);
        expect(hebrewRoleConflict('adv', undefined)).toBe(false);
        expect(hebrewRoleConflict('o', 'Núcleo de la frase; recibe la acción')).toBe(false);
        // «sujeto» dentro de la frase, no como función: no se juzga.
        expect(hebrewRoleConflict('o', 'Objeto directo; su sujeto es Booz')).toBe(false);
        expect(hebrewRoleConflict('o', 'Complemento del verbo cuyo sujeto es Booz')).toBe(false);
    });
});
