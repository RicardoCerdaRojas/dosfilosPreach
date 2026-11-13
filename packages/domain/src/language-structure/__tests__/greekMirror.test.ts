import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verseWords, type ChapterStructure } from '../chapterStructure';
import { greekMirrorCandidates, greekMirrorRepetition, mirrorPositionOf } from '../greekMirror';
import { MIRROR_LIST } from '../greekMirrorList';
import { formatCitation, MIRROR_LIST_SOURCES } from '../ruleSources';

/**
 * Revisión del profesor (2026-11, p. 15): la repetición en espejo de Stg 2:18. Se MUESTRA sólo la lista
 * curada (revisada una por una con Lund y Bullinger y cruzada con dos muestras clasificadas a ciegas); el
 * detector sólo propone candidatos.
 */
const RAIZ = fileURLToPath(new URL('../../../../web/public/language-data/v1/', import.meta.url));
const cargar = (rel: string): ChapterStructure => JSON.parse(readFileSync(`${RAIZ}${rel}`, 'utf8'));
const espejo = (rel: string, v: number) => {
    const ch = cargar(rel);
    const m = greekMirrorRepetition(ch, v);
    const ws = verseWords(ch, v);
    return m ? [m.a, m.b, m.b2, m.a2].map(o => ws[o]!.t.replace(/[,.·;]/g, '')) : undefined;
};

describe('repetición en espejo: la lista curada', () => {
    it('Stg 2:18: el espejo que marcó el profesor — πίστιν · ἔργων | ἔργων · πίστιν', () => {
        expect(espejo('gr/JAS/2.json', 18)).toEqual(['πίστιν', 'ἔργων', 'ἔργων', 'πίστιν']);
    });

    it('INVARIANTE: cada entrada de la lista encuentra sus cuatro palabras, en orden, en su versículo (74)', () => {
        const malas: string[] = [];
        for (const ref of Object.keys(MIRROR_LIST)) {
            const [l, cv] = ref.split(' ');
            const [c, v] = cv!.split(':').map(Number);
            if (!greekMirrorRepetition(cargar(`gr/${l}/${c}.json`), v!)) malas.push(ref);
        }
        expect(malas).toEqual([]);
        expect(Object.keys(MIRROR_LIST)).toHaveLength(74);
    });

    it('pares corregidos por la revisión: Lc 6:43 καλόν σαπρόν | σαπρόν καλόν (no καρπόν); Lc 6:42 κάρφος δοκόν | δοκόν κάρφος', () => {
        expect(espejo('gr/LUK/6.json', 43)).toEqual(['καλὸν', 'σαπρόν', 'σαπρὸν', 'καλόν']);
        expect(espejo('gr/LUK/6.json', 42)).toEqual(['κάρφος', 'δοκὸν', 'δοκὸν', 'κάρφος']);
    });

    it('agregado a mano lo que el detector no ve: Mt 13:15 (Is 6:10) ὠσὶν ὀφθαλμοὺς | ὀφθαλμοῖς ὠσὶν, con Lund', () => {
        expect(greekMirrorCandidates(cargar('gr/MAT/13.json'), 15)).toBeUndefined();
        expect(espejo('gr/MAT/13.json', 15)).toEqual(['ὠσὶν', 'ὀφθαλμοὺς', 'ὀφθαλμοῖς', 'ὠσὶν']);
    });

    it('NO se muestra lo que una revisión juzgó débil o paralelo (Jn 19:29, 1 Co 7:14, Ap 1:20) ni lo dudoso (Mc 6:28)', () => {
        expect(espejo('gr/JHN/19.json', 29)).toBeUndefined();
        expect(espejo('gr/1CO/7.json', 14)).toBeUndefined();
        expect(espejo('gr/REV/1.json', 20)).toBeUndefined();
        expect(espejo('gr/MRK/6.json', 28)).toBeUndefined();
        expect(greekMirrorRepetition(cargar('he/Ruth/1.json'), 1)).toBeUndefined();
    });

    it('fuentes: Mc 2:27 con Lund (quiasmo) y Bullinger (Antimetábole), con página; siempre la indicación del profesor', () => {
        const m = greekMirrorRepetition(cargar('gr/MRK/2.json'), 27)!;
        expect(m.sources!.map(s => s.work)).toEqual(['lund', 'bullinger', 'professor']);
        expect(MIRROR_LIST_SOURCES['MRK 2:27']!.map(s => formatCitation(s)).join(' | ')).toMatch(/Lund.*p\. 32.*Bullinger.*Antimetábole.*p\. 302/);
        expect(greekMirrorRepetition(cargar('gr/JAS/2.json'), 18)!.sources!.map(s => s.work)).toEqual(['professor']);
    });

    it('toda fuente de la lista es de un versículo de la lista', () => {
        expect(Object.keys(MIRROR_LIST_SOURCES).filter(r => !(r in MIRROR_LIST))).toEqual([]);
    });

    it('la posición de cada palabra; fuera del espejo, ninguna', () => {
        const m = greekMirrorRepetition(cargar('gr/JAS/2.json'), 18)!;
        expect([m.a, m.b, m.b2, m.a2].map(o => mirrorPositionOf(m, o))).toEqual(['A', 'B', 'B2', 'A2']);
        expect(mirrorPositionOf(m, 0)).toBeUndefined();
        expect(mirrorPositionOf(undefined, 0)).toBeUndefined();
    });
});

describe('repetición en espejo: el detector (sólo propone candidatos)', () => {
    it('descarta «Κύριε κύριε» (Mt 7:22), el paralelismo (Mt 25:20, 1 Co 14:15) y lo demasiado lejano (Jn 8:44)', () => {
        for (const [rel, v] of [['gr/MAT/7.json', 22], ['gr/MAT/25.json', 20], ['gr/1CO/14.json', 15], ['gr/JHN/8.json', 44]] as const) {
            expect(greekMirrorCandidates(cargar(rel), v), `${rel} ${v}`).toBeUndefined();
        }
    });

    it('propone 88 candidatos en el NT (de donde salió la lista; si cambia, revisar los nuevos antes de sumarlos)', () => {
        let n = 0;
        for (const libro of readdirSync(`${RAIZ}gr`)) for (const cap of readdirSync(`${RAIZ}gr/${libro}`)) {
            const ch = cargar(`gr/${libro}/${cap}`);
            for (const v of new Set(ch.words.map(w => Number(w.r.split('!')[0])))) if (greekMirrorCandidates(ch, v)) n++;
        }
        expect(n).toBe(88);
    }, 120_000);
});
