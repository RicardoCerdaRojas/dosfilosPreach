import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verseWords, type ChapterStructure } from '../chapterStructure';
import { applyVerbRules, buildVerbFunctionTask, greekVerbCandidates, readVerbFunction, VERB_RULES, type VerbCandidate } from '../verbFunctions';

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
        // Sin sustantivo del que predicar (el sujeto va en ἐργάζεσθε), «predicativo» no se ofrece.
        expect(c.allowed).not.toContain('predicate');
    });

    it('circunstancia concomitante sólo con los criterios de Wallace: aoristo antes de un verbo aoristo (Mt 28:19)', () => {
        expect(verbo('MAT/28.json', 19, 'πορευθέντες').allowed).toContain('attendantCircumstance');
        expect(verbo('MAT/28.json', 19, 'βαπτίζοντες').allowed).not.toContain('attendantCircumstance');
        // Stg 2:9 (prueba del fundador): presente y después de ἐργάζεσθε; el asistente la había elegido.
        expect(verbo('JAS/2.json', 9, 'ἐλεγχόμενοι').allowed).not.toContain('attendantCircumstance');
        // Aoristo pero DESPUÉS del verbo: Hch 10:39 «ἀνεῖλαν κρεμάσαντες», el participio de medio de Wallace.
        const kremasantes = verbo('ACT/10.json', 39, 'κρεμάσαντες');
        expect(kremasantes.allowed).not.toContain('attendantCircumstance');
        expect(kremasantes.allowed).toContain('means');
    });

    it('«predicativo» sí, si hay un sustantivo que concuerda (1 Co 1:23 «Χριστὸν ἐσταυρωμένον»)', () => {
        expect(verbo('1CO/1.json', 23, 'ἐσταυρωμένον').allowed).toContain('predicate');
    });
    it('presente indicativo: el uso del tiempo incluye el habitual (Stg 2:7 βλασφημοῦσιν, profesor #G2)', () => {
        const c = verbo('JAS/2.json', 7, 'βλασφημοῦσιν');
        expect(c.form).toBe('indicative');
        expect(c.allowed).toEqual([]);
        expect(c.tenseUses).toContain('customary');
    });
});

describe('G2 — sobre todo el NT', () => {
    it('los genitivos absolutos rondan los ~313 que cuenta Wallace, cada regla se usa alguna vez, y nada falla', () => {
        const usos = new Map<string, number>();
        for (const libro of readdirSync(BASE)) for (const f of readdirSync(`${BASE}${libro}`)) {
            const ch = cargar(`${libro}/${f}`);
            for (const v of new Set(ch.words.map(w => Number(w.r.split('!')[0]))))
                for (const c of greekVerbCandidates(ch, v)) if (c.rule) usos.set(c.rule, (usos.get(c.rule) ?? 0) + 1);
        }
        expect(usos.get('genitiveAbsolute')).toBeGreaterThan(280);
        expect(usos.get('genitiveAbsolute')).toBeLessThan(340);
        // Una regla que nunca se cumple en el NT está muerta o mal escrita (o tapada por otra anterior).
        expect(VERB_RULES.map(r => r.rule).filter(r => !usos.get(r))).toEqual([]);
        expect(new Set(VERB_RULES.map(r => r.rule)).size).toBe(VERB_RULES.length);
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

describe('G2 — las reglas se aplican al mostrar (análisis ya guardados)', () => {
    const cands: VerbCandidate[] = [
        { ordinal: 0, form: 'participle', allowed: ['periphrastic'], decided: 'periphrastic', rule: 'periphrastic', tenseUses: [] },
        { ordinal: 1, form: 'participle', allowed: ['manner', 'cause'], tenseUses: [] },
        { ordinal: 2, form: 'indicative', allowed: [], tenseUses: ['customary'] },
    ];
    const palabra = (x: object) => ({ text: 't', ...x }) as { text: string; verbFunction?: never };

    it('una regla nueva corrige lo guardado; lo que la regla de hoy no permite se quita, con su nota', () => {
        const out = applyVerbRules([
            palabra({ verbFunction: 'manner', verbNote: 'a' }),
            palabra({ verbFunction: 'substantival', verbNote: 'b' }),
            palabra({ tenseUse: 'customary', verbNote: 'c' }),
            palabra({ verbFunction: 'command', verbNote: 'd' }),
        ], cands);
        expect(out[0]).toMatchObject({ verbFunction: 'periphrastic', verbRule: 'periphrastic', verbNote: 'a' });
        expect(out[1]).toEqual({ text: 't' });
        expect(out[2]).toEqual({ text: 't', tenseUse: 'customary', verbNote: 'c' });
        // Ya no es verbo (o el dato cambió): nada.
        expect(out[3]).toEqual({ text: 't' });
    });
});
