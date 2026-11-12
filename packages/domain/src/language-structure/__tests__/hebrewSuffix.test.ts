import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verseWords, type ChapterStructure } from '../chapterStructure';
import { hebrewSuffix } from '../hebrewMorph';

/**
 * El sufijo pronominal desde OSHB (revisión del profesor, 2026-11, Rut 3:3
 * כַּלֹּתוֹ): la ficha nunca lo mostraba como dato de la forma. Putnam §1.5.1b y
 * §2.2.6a: en un infinitivo constructo el sufijo es su sujeto u objeto.
 */
const cargar = (rel: string): ChapterStructure =>
    JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../web/public/language-data/v1/he/${rel}`, import.meta.url)), 'utf8'));

describe('el sufijo pronominal (OSHB)', () => {
    it('Rut 3:3 כַּלֹּתוֹ: 3.ª masculina singular pegada a un infinitivo («hasta que él termine»)', () => {
        const w = verseWords(cargar('Ruth/3.json'), 3).find(x => x.m === 'HVpc/Sp3ms')!;
        expect(hebrewSuffix(w.m)).toEqual({ person: '3', gender: 'm', number: 's', host: 'infinitive' });
    });

    it('a qué va pegado: sustantivo, preposición, verbo finito, אֵת', () => {
        expect(hebrewSuffix('HR/Ncmsc/Sp3fs')?.host).toBe('noun'); // לְאִישָׁהּ, Rut 2:1
        expect(hebrewSuffix('HR/Sp1cs')?.host).toBe('preposition'); // אֵלַי
        expect(hebrewSuffix('HVqp3ms/Sp1cs')?.host).toBe('verb');
        expect(hebrewSuffix('HTo/Sp3ms')?.host).toBe('objectMarker');
    });

    it('lo que no es pronombre no cuenta: ה direccional, ה y נ paragógicas (Rut 3:4 תַּעַשִׂין)', () => {
        expect(hebrewSuffix('HNcmsa/Sd')).toBeUndefined();
        expect(hebrewSuffix('HVqi2fs/Sn')).toBeUndefined();
        expect(hebrewSuffix('HVqi1cs/Sh')).toBeUndefined();
        expect(hebrewSuffix('HNcmsa')).toBeUndefined();
        expect(hebrewSuffix(undefined)).toBeUndefined();
    });

    it('«b» (ambos géneros) se muestra como común', () => {
        expect(hebrewSuffix('HR/Sp1bs')?.gender).toBe('c');
    });
});
