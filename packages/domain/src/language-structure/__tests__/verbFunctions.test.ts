import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verseWords, type ChapterStructure } from '../chapterStructure';
import { buildVerbFunctionTask, greekVerbCandidates, readVerbFunction, type VerbCandidate } from '../verbFunctions';

/** G2 — la función de cada verbo (Wallace): lo que decide el texto y lo que acota. */
const BASE = fileURLToPath(new URL('../../../../web/public/language-data/v1/gr/', import.meta.url));
const cargar = (rel: string): ChapterStructure => JSON.parse(readFileSync(`${BASE}${rel}`, 'utf8'));
const verbo = (rel: string, v: number, texto: string): VerbCandidate => {
    const ch = cargar(rel);
    const ws = verseWords(ch, v);
    const c = greekVerbCandidates(ch, v).find(x => ws[x.ordinal]!.t.replace(/[,.;·]/g, '') === texto);
    if (!c) throw new Error(`sin verbo ${texto}`);
    return c;
};

describe('G2 — lo que decide el texto (regla)', () => {
    it('perifrástico: εἰμί + participio en la misma cláusula (Lc 5:17 «ἦν διδάσκων»)', () => {
        expect(verbo('LUK/5.json', 17, 'διδάσκων')).toMatchObject({ decided: 'periphrastic', rule: 'periphrastic' });
    });
    it('genitivo absoluto (Mc 15:42 «ὀψίας γενομένης»)', () => {
        expect(verbo('MRK/15.json', 42, 'γενομένης')).toMatchObject({ decided: 'genitiveAbsolute' });
    });
    it('εἰς τό + infinitivo: propósito o resultado (Lc 5:17 «εἰς τὸ ἰᾶσθαι»)', () => {
        expect(verbo('LUK/5.json', 17, 'ἰᾶσθαι')).toMatchObject({ rule: 'eisTo', allowed: ['purpose', 'result'] });
    });
    it('subjuntivo bajo ἵνa, también el coordinado (Jn 3:16 ἀπόληται y ἔχῃ)', () => {
        expect(verbo('JHN/3.json', 16, 'ἀπόληται')).toMatchObject({ decided: 'inaClause' });
        expect(verbo('JHN/3.json', 16, 'ἔχῃ')).toMatchObject({ decided: 'inaClause' });
    });
    it('ἐάν condicional (1 Jn 1:9), ἕως ἄν indefinido y οὐ μή enfático (Mt 5:18), μὴ γένοιτο (Ro 6:2)', () => {
        expect(verbo('1JN/1.json', 9, 'ὁμολογῶμεν')).toMatchObject({ decided: 'conditional' });
        const mt = cargar('MAT/5.json');
        const ws = verseWords(mt, 18);
        const c = greekVerbCandidates(mt, 18).filter(x => ws[x.ordinal]!.t.startsWith('παρέλθ'));
        expect(c.map(x => x.decided)).toEqual(['indefinite', 'emphaticNegation']);
        expect(verbo('ROM/6.json', 2, 'γένοιτο')).toMatchObject({ decided: 'volitive', rule: 'meGenoito' });
    });
});

describe('G2 — lo que el texto acota (el asistente elige)', () => {
    it('participio con artículo: sólo adjetival o sustantival (Jn 3:16 «ὁ πιστεύων», Ro 8:28 «τοῖς ἀγαπῶσι»)', () => {
        expect(verbo('JHN/3.json', 16, 'πιστεύων')).toMatchObject({ rule: 'articular', allowed: ['attributive', 'substantival'] });
        expect(verbo('ROM/8.json', 28, 'ἀγαπῶσι')).toMatchObject({ rule: 'articular' });
    });
    it('el artículo puede estar separado (Jn 1:15 «ὁ ὀπίσω μου ἐρχόμενος») pero no DESPUÉS (Jn 1:38 «στραφεὶς δὲ ὁ Ἰησοῦς»)', () => {
        expect(verbo('JHN/1.json', 15, 'ἐρχόμενος')).toMatchObject({ rule: 'articular' });
        expect(verbo('JHN/1.json', 38, 'στραφεὶς').rule).toBeUndefined();
        // «ὁ Ἰωάννης λέγων» (Jn 1:26): el artículo es de Ἰωάννης; λέγων es el redundante de Wallace.
        const legon = verbo('JHN/1.json', 26, 'λέγων');
        expect(legon.rule).toBeUndefined();
        expect(legon.allowed).toContain('redundant');
    });

    it('participio sin artículo: los adverbiales, no los adjetivales (Stg 2:9 ἐλεγχόμενοι)', () => {
        const c = verbo('JAS/2.json', 9, 'ἐλεγχόμενοι');
        expect(c.decided).toBeUndefined();
        expect(c.allowed).toContain('manner');
        expect(c.allowed).not.toContain('substantival');
    });
    it('presente indicativo: el uso del tiempo incluye el habitual (Stg 2:7 βλασφημοῦσιν, profesor #G2)', () => {
        const c = verbo('JAS/2.json', 7, 'βλασφημοῦσιν');
        expect(c.form).toBe('indicative');
        expect(c.allowed).toEqual([]);
        expect(c.tenseUses).toContain('customary');
    });
});

describe('G2 — sobre todo el NT', () => {
    it('los genitivos absolutos rondan los ~313 que cuenta Wallace, y nada falla', () => {
        let ga = 0;
        for (const libro of readdirSync(BASE)) for (const f of readdirSync(`${BASE}${libro}`)) {
            const ch = cargar(`${libro}/${f}`);
            for (const v of new Set(ch.words.map(w => Number(w.r.split('!')[0])))) ga += greekVerbCandidates(ch, v).filter(c => c.decided === 'genitiveAbsolute').length;
        }
        expect(ga).toBeGreaterThan(280);
        expect(ga).toBeLessThan(340);
    }, 60_000);
});

describe('G2 — validación de lo que devuelve el asistente', () => {
    const libre: VerbCandidate = { ordinal: 2, form: 'participle', allowed: ['manner', 'cause'], tenseUses: [] };
    const decidido: VerbCandidate = { ordinal: 0, form: 'participle', allowed: ['periphrastic'], decided: 'periphrastic', rule: 'periphrastic', tenseUses: [] };
    const indicativo: VerbCandidate = { ordinal: 1, form: 'indicative', allowed: [], tenseUses: ['progressive', 'customary'] };

    it('acepta un id de la lista; descarta uno fuera de ella (y su nota, si no queda nada)', () => {
        expect(readVerbFunction({ verbFunction: 'cause', verbNote: 'por ser…' }, libre)).toEqual({ verbFunction: 'cause', verbNote: 'por ser…' });
        expect(readVerbFunction({ verbFunction: 'substantival', verbNote: 'x' }, libre)).toEqual({});
    });
    it('lo decidido por regla manda aunque el asistente diga otra cosa', () => {
        expect(readVerbFunction({ verbFunction: 'manner', verbNote: 'y' }, decidido)).toEqual({ verbFunction: 'periphrastic', verbRule: 'periphrastic', verbNote: 'y' });
    });
    it('el uso del tiempo sólo de la lista del tiempo', () => {
        expect(readVerbFunction({ tenseUse: 'customary' }, indicativo)).toEqual({ tenseUse: 'customary' });
        expect(readVerbFunction({ tenseUse: 'ingressive' }, indicativo)).toEqual({});
    });
    it('el prompt pide elegir donde hay lista y explicar donde ya está decidido', () => {
        const tarea = buildVerbFunctionTask([libre, decidido, indicativo], ['ἦν', 'λέγει', 'ἐλεγχόμενοι']);
        expect(tarea).toMatch(/2\. ἐλεγχόμενοι — participio — "verbFunction", elige de: "manner"/);
        expect(tarea).toMatch(/0\. ἦν — participio — FUNCIÓN YA DECIDIDA por regla \(εἰμί \+ participio/);
        expect(tarea).toMatch(/1\. λέγει — indicativo — "tenseUse", elige de: "progressive".*"customary" \(habitual/);
        expect(buildVerbFunctionTask([], [])).toBe('');
    });
});
