import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verseWords, type ChapterStructure } from '../chapterStructure';
import { greekMirrorRepetition, hebrewMirrorCandidates, mirrorRepetition } from '../greekMirror';
import { MIRROR_LIST_HE } from '../hebrewMirrorList';
import { formatCitation, MIRROR_LIST_SOURCES } from '../ruleSources';

/**
 * La repetición en espejo en el hebreo del AT (pendientes de la revisión del profesor, 2026-11-13): como en
 * el griego, se MUESTRA sólo la lista curada; el detector propone.
 */
const RAIZ = fileURLToPath(new URL('../../../../web/public/language-data/v1/', import.meta.url));
const cargar = (rel: string): ChapterStructure => JSON.parse(readFileSync(`${RAIZ}${rel}`, 'utf8'));
const sinAcentos = (t: string) => t.normalize('NFD').replace(/[\u0591-\u05AF\u05BD\u05C0\u05C3]/g, '').normalize('NFC');
const espejo = (rel: string, v: number) => {
    const ch = cargar(rel);
    const m = mirrorRepetition(ch, v);
    const ws = verseWords(ch, v);
    return m ? [m.a, m.b, m.b2, m.a2].map(o => sinAcentos(ws[o]!.t)) : undefined;
};

describe('repetición en espejo en hebreo: la lista curada', () => {
    it('2 R 5:18 es el único que pasa de 15 palabras: el marco «לַדָּבָר … יִסְלַח | יִסְלַח … בַּדָּבָר» lo eligió la revisión, a propósito', () => {
        const m = mirrorRepetition(cargar('he/2Kgs/5.json'), 18)!;
        expect(m.a2 - m.a).toBeGreaterThan(15);
        const largos = Object.keys(MIRROR_LIST_HE).filter(ref => {
            const [l, cv] = ref.split(' ');
            const [c, v] = cv!.split(':').map(Number);
            const x = mirrorRepetition(cargar(`he/${l}/${c}.json`), v!)!;
            return x.a2 - x.a > 15;
        });
        expect(largos).toEqual(['2Kgs 5:18']);
    });

    it('Gn 9:6, el ejemplo de manual: שֹׁפֵךְ דַּם | דָּמוֹ יִשָּׁפֵךְ', () => {
        expect(espejo('he/Gen/9.json', 6)).toEqual(['שֹׁפֵךְ', 'דַּם', 'דָּמוֹ', 'יִשָּׁפֵךְ']);
    });

    it('INVARIANTE: cada entrada encuentra sus cuatro palabras, en orden, en su versículo (77)', () => {
        const malas = Object.keys(MIRROR_LIST_HE).filter(ref => {
            const [l, cv] = ref.split(' ');
            const [c, v] = cv!.split(':').map(Number);
            return !mirrorRepetition(cargar(`he/${l}/${c}.json`), v!);
        });
        expect(malas).toEqual([]);
        expect(Object.keys(MIRROR_LIST_HE)).toHaveLength(77);
    });

    it('agregados a mano con Bullinger, que el detector no ve: Is 5:20 (B y B′ juntas), Éx 9:31, Is 6:10', () => {
        expect(hebrewMirrorCandidates(cargar('he/Isa/5.json'), 20)).toBeUndefined();
        expect(espejo('he/Isa/5.json', 20)).toEqual(['לָרַע', 'טוֹב', 'וְלַטּוֹב', 'רָע']);
        expect(MIRROR_LIST_SOURCES['Isa 5:20']!.map(s => formatCitation(s)).join(' ')).toMatch(/Bullinger.*Antimetábole.*p\. 301/);
        expect(espejo('he/Exod/9.json', 31)).toBeDefined();
        expect(mirrorRepetition(cargar('he/Isa/6.json'), 10)!.sources!.map(s => s.work)).toEqual(['bullinger', 'professor']);
    });

    it('NO se muestra lo que la revisión a ciegas rechazó (fórmula legal, Lv 18:7; respuesta que repite la pregunta, 1 R 10:3) ni lo que es lista', () => {
        expect(mirrorRepetition(cargar('he/Lev/18.json'), 7)).toBeUndefined();
        expect(mirrorRepetition(cargar('he/1Kgs/10.json'), 3)).toBeUndefined();
        expect(mirrorRepetition(cargar('he/Ezek/40.json'), 12)).toBeUndefined();
    });

    it('el griego sigue igual, y la función griega no ve el hebreo', () => {
        expect(greekMirrorRepetition(cargar('he/Gen/9.json'), 6)).toBeUndefined();
        expect(mirrorRepetition(cargar('gr/JAS/2.json'), 18)).toBeDefined();
    });

    it('fuentes: 4 versículos con Bullinger; el resto lleva el juicio de los revisores, no la nota griega sola', () => {
        expect(Object.keys(MIRROR_LIST_SOURCES).filter(r => r in MIRROR_LIST_HE).sort()).toEqual(['Exod 9:31', 'Isa 50:1', 'Isa 5:20', 'Isa 6:10']);
        const nota = mirrorRepetition(cargar('he/Gen/9.json'), 6)!.sources!.map(s => s.note).join(' ');
        expect(nota).toMatch(/llevado al hebreo.*revisores/);
    });

    it('las 77 posiciones fijas (A, B, B′, A′): un cambio en cómo se comparan las palabras no las mueve en silencio (Ez 34:8, Jue 5:30)', () => {
        const pos = Object.fromEntries(Object.keys(MIRROR_LIST_HE).map(ref => {
            const [l, cv] = ref.split(' ');
            const [c, v] = cv!.split(':').map(Number);
            const m = mirrorRepetition(cargar(`he/${l}/${c}.json`), v!)!;
            return [ref, [m.a, m.b, m.b2, m.a2]];
        }));
        expect(pos).toMatchSnapshot();
    });
});

describe('repetición en espejo en hebreo: el detector (sólo propone)', () => {
    it('propone 284 candidatos en el AT (de donde salió la lista; si cambia, revisar los nuevos antes de sumarlos)', () => {
        let n = 0;
        for (const libro of readdirSync(`${RAIZ}he`)) for (const cap of readdirSync(`${RAIZ}he/${libro}`)) {
            const ch = cargar(`he/${libro}/${cap}`);
            for (const v of new Set(ch.words.map(w => Number(w.r.split('!')[0])))) if (hebrewMirrorCandidates(ch, v)) n++;
        }
        expect(n).toBe(284);
    }, 240_000);
});
