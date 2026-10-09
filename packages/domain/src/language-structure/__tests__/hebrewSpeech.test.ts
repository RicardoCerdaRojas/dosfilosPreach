import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verseWords, type ChapterStructure } from '../chapterStructure';
import { buildSpeechFactsTask, hebrewSpeechFacts } from '../hebrewSpeech';

/** Quién habla y a quién (bitácora del módulo de hebreo, Rut 1:16). */
const BASE = fileURLToPath(new URL('../../../../web/public/language-data/v1/he/', import.meta.url));
/** El orden de dagesh y vocal varía en Unicode: se compara en NFC. */
const N = (t: string) => t.normalize('NFC');
const cargar = (rel: string): ChapterStructure => JSON.parse(readFileSync(`${BASE}${rel}`, 'utf8'));
const quita = (t: string) => t.replace(/[֑-ֽ֯׀׃]/g, '');
const hechos = (rel: string, v: number) => {
    const ch = cargar(rel);
    const ws = verseWords(ch, v);
    return hebrewSpeechFacts(ch, v).map(f => ({
        ...f, text: N(f.text), speaker: N(f.speaker), ...(f.addressee ? { addressee: N(f.addressee) } : {}), palabra: N(quita(ws[f.ordinal]!.t)),
    }));
};

describe('quién habla y a quién (hebreo)', () => {
    it('REGRESIÓN Rut 1:16: תֵּלְכִי es 2.ª persona del discurso de Rut — su sujeto es a quien Rut habla, no Rut', () => {
        const h = hechos('Ruth/1.json', 16);
        expect(h.find(x => x.palabra === N('תֵּלְכִי'))).toMatchObject({ kind: 'verb', speaker: N('רוּת'), text: N('תֵּלְכִי') });
        expect(h.find(x => x.palabra === N('לְעָזְבֵךְ'))).toMatchObject({ kind: 'suffix', speaker: N('רוּת') });
        expect(h.every(x => x.addressee === undefined)).toBe(true); // el destinatario no está escrito en 1:16
        expect(h.some(x => x.palabra === N('אֵלֵךְ'))).toBe(false); // 1.ª persona: la de Rut
    });
    it('con el destinatario escrito: Rut 1:8, Noemí a «sus dos nueras»', () => {
        expect(hechos('Ruth/1.json', 8).find(x => x.palabra === N('לֵכְנָה'))).toMatchObject({ speaker: N('נָעֳמִי'), addressee: N('לִשְׁתֵּי כַלֹּתֶיהָ') });
    });
    it('un אָמַר nuevo corta el discurso: 2 S 12:13, «לֹא תָמוּת» lo dice Natán a David', () => {
        expect(hechos('2Sam/12.json', 13).find(x => x.palabra === N('תָמוּת'))).toMatchObject({ speaker: N('נָתָן'), addressee: N('אֶל דָּוִד') });
    });
    it('«לֵאמֹר» tras un verbo que no es de decir calla: «הִתְאַנַּף יְהוָה … לֵאמֹר» (Dt 1:37, se enojó) — prudente a propósito', () => {
        expect(hechos('Deut/1.json', 37)).toEqual([]);
    });
    it('NO: sin hablante nombrado no se dice nada (Rut 1:15 «וַתֹּאמֶר … שׁוּבִי», sujeto implícito)', () => {
        expect(hechos('Ruth/1.json', 15)).toEqual([]);
    });
    it('NO: דִּבֶּר sin cita es narración (Dt 4:12 «וַיְדַבֵּר יְהוָה אֲלֵיכֶם»: el «ustedes» lo dice Moisés)', () => {
        expect(hechos('Deut/4.json', 12)).toEqual([]);
    });
    it('el destinatario es sólo la frase con אֶל / לְ («אֲלֵיכֶם», no «… מִתּוֹךְ הָאֵשׁ»)', () => {
        const h = hechos('2Chr/20.json', 15).find(x => x.palabra === N('תִּירְאוּ'));
        expect(h).toMatchObject({ speaker: N('יְהוָה'), addressee: N('לָכֶם') });
        // El «לָכֶם» de «כֹּה אָמַר יְהוָה לָכֶם» es el destinatario, no 2.ª persona del discurso: sólo cuenta el de después.
        expect(hechos('2Chr/20.json', 15).filter(x => x.palabra === N('לָכֶם'))).toHaveLength(1);
        // «וַיְהִי דְבַר־יְהוָה אֶל־אַבְרָם בַּמַּחֲזֶה לֵאמֹר»: el destinatario es «אֶל אַבְרָם», sin «בַּמַּחֲזֶה» (Gn 15:1).
        expect(hechos('Gen/15.json', 1).find(x => x.palabra === N('תִּירָא'))?.addressee).toBe(N('אֶל אַבְרָם'));
    });
    it('REGRESIÓN (revisión): participio, pasivo, subordinado y «se propuso» no abren discurso', () => {
        // «יְהוָה הָאֹמֵר אֵלַי שׁוּב» (Gn 32:10): habla Dios, no Jacob — el participio ya no hereda al hablante anterior.
        expect(hechos('Gen/32.json', 10).some(x => x.speaker === N('יַעֲקֹב'))).toBe(false);
        expect(hechos('Gen/32.json', 29)).toEqual([]);   // «לֹא יַעֲקֹב יֵאָמֵר עוֹד שִׁמְךָ»: nifal
        expect(hechos('Exod/32.json', 12)).toEqual([]);  // «לָמָּה יֹאמְרוּ מִצְרַיִם לֵאמֹר»
        expect(hechos('Deut/9.json', 25)).toEqual([]);   // «אָמַר יְהוָה לְהַשְׁמִיד» = se propuso
    });
    it('REGRESIÓN (revisión): «לֵאמֹר» cuelga de su cláusula madre y sólo tras un verbo de decir o mandar', () => {
        expect(hechos('Deut/15.json', 11)).toEqual([]);  // «אָנֹכִי מְצַוְּךָ לֵאמֹר»: el hablante es un pronombre (no «el pobre»)
        expect(hechos('Isa/30.json', 21)).toEqual([]);   // «וְאָזְנֶיךָ תִּשְׁמַעְנָה … לֵאמֹר»: oír no introduce
        expect(hechos('Exod/1.json', 22).find(x => x.palabra === N('תַּשְׁלִיכֻהוּ'))).toMatchObject({ speaker: N('פַּרְעֹה'), addressee: N('לְכָל עַמּוֹ') });
    });
    it('el hablante es la tira nominal con rol «s», sin la conjunción pegada (Rut 4:11, Gn 44:4)', () => {
        expect(hechos('Ruth/4.json', 11)[0]?.speaker).toBe(N('כָּל הָעָם'));
        expect(hechos('Gen/44.json', 4)[0]?.speaker).toBe(N('יוֹסֵף'));
    });
    it('el prompt da el hecho para explicarlo, no para decidirlo', () => {
        const t = buildSpeechFactsTask([{ ordinal: 11, text: 'תֵּלְכִי', kind: 'verb', speaker: 'רוּת', speakerOrdinals: [1] }]);
        expect(t).toMatch(/תֵּלְכִי: verbo en 2\.ª persona dentro del discurso de רוּת: se refiere a la persona a quien רוּת habla, NUNCA a רוּת/);
        expect(buildSpeechFactsTask([])).toBe('');
    });
});
