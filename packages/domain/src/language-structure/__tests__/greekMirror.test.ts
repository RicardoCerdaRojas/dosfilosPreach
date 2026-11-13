import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verseWords, type ChapterStructure } from '../chapterStructure';
import { greekMirrorRepetition, mirrorPositionOf } from '../greekMirror';

/** Revisión del profesor (2026-11, p. 15): la repetición en espejo de Stg 2:18, como dato. */
const RAIZ = fileURLToPath(new URL('../../../../web/public/language-data/v1/', import.meta.url));
const cargar = (rel: string): ChapterStructure => JSON.parse(readFileSync(`${RAIZ}${rel}`, 'utf8'));
const espejo = (rel: string, v: number) => {
    const ch = cargar(rel);
    const m = greekMirrorRepetition(ch, v);
    const ws = verseWords(ch, v);
    return m ? [m.a, m.b, m.b2, m.a2].map(o => ws[o]!.t.replace(/[,.·;]/g, '')) : undefined;
};

describe('repetición en espejo (A B | B′ A′)', () => {
    it('Stg 2:18: el espejo que marcó el profesor — πίστιν · ἔργων | ἔργων · πίστιν (no «πίστιν ἔχεις | ἔχω πίστιν»)', () => {
        expect(espejo('gr/JAS/2.json', 18)).toEqual(['πίστιν', 'ἔργων', 'ἔργων', 'πίστιν']);
    });

    it('los conocidos: Mt 19:30 πρῶτοι ἔσχατοι | ἔσχατοι πρῶτοι; 2 P 3:8; Stg 2:13', () => {
        expect(espejo('gr/MAT/19.json', 30)).toEqual(['πρῶτοι', 'ἔσχατοι', 'ἔσχατοι', 'πρῶτοι']);
        // «ἡμέρα … χίλια ἔτη καὶ χίλια ἔτη ὡς ἡμέρα»: «χίλια ἔτη» se repite en paralelo; el espejo es ἡμέρα · ἔτη | ἔτη · ἡμέρα.
        expect(espejo('gr/2PE/3.json', 8)).toEqual(['ἡμέρα', 'ἔτη', 'ἔτη', 'ἡμέρα']);
        expect(espejo('gr/JAS/2.json', 13)).toEqual(['κρίσις', 'ἔλεος', 'ἔλεος', 'κρίσεως']);
    });

    it('NO (revisión adversarial): repetición pegada (Mt 7:22 «Κύριε κύριε»), paralelismo (Mt 25:20 «πέντε τάλαντα … πέντε τάλαντα»), demasiado lejos (Jn 8:44)', () => {
        expect(espejo('gr/MAT/7.json', 22)).toBeUndefined();
        expect(espejo('gr/MAT/25.json', 20)).toBeUndefined();
        expect(espejo('gr/JHN/8.json', 44)).toBeUndefined();
    });

    it('NO (muestra ciega): dos cláusulas paralelas cortadas por la mitad (1 Co 14:15 «προσεύξομαι τῷ πνεύματι … ψαλῶ τῷ πνεύματι», 1 Jn 5:6 «ὕδατος καὶ αἵματος» dos veces)', () => {
        expect(espejo('gr/1CO/14.json', 15)).toBeUndefined();
        expect(espejo('gr/1JN/5.json', 6)).toBeUndefined();
    });

    it('NO: nombres propios (Mt 1:12, la genealogía), sin espejo (Stg 2:10), hebreo', () => {
        expect(espejo('gr/MAT/1.json', 12)).toBeUndefined();
        expect(espejo('gr/JAS/2.json', 10)).toBeUndefined();
        expect(greekMirrorRepetition(cargar('he/Ruth/1.json'), 1)).toBeUndefined();
    });

    it('la posición de cada palabra; fuera del espejo, ninguna', () => {
        const m = greekMirrorRepetition(cargar('gr/JAS/2.json'), 18)!;
        expect([m.a, m.b, m.b2, m.a2].map(o => mirrorPositionOf(m, o))).toEqual(['A', 'B', 'B2', 'A2']);
        expect(mirrorPositionOf(m, 0)).toBeUndefined();
        expect(mirrorPositionOf(undefined, 0)).toBeUndefined();
    });

    it('medido en el NT: 88 versículos (si cambia, clasificar una muestra AL AZAR y a ciegas antes de aceptar la cifra nueva)', () => {
        let n = 0;
        for (const libro of readdirSync(`${RAIZ}gr`)) for (const cap of readdirSync(`${RAIZ}gr/${libro}`)) {
            const ch = cargar(`gr/${libro}/${cap}`);
            for (const v of new Set(ch.words.map(w => Number(w.r.split('!')[0])))) if (greekMirrorRepetition(ch, v)) n++;
        }
        expect(n).toBe(88);
    }, 120_000);
});
