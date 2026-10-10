import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ChapterStructure } from '../chapterStructure';
import { applyHebrewKi, buildHebrewKiTask, HEBREW_KI_RULES, hebrewKiCandidates, type HebrewKiFunction } from '../hebrewKi';

/**
 * R4 — la función de כִּי contra los EJEMPLOS DEL LIBRO (Arnold y Choi §4.3.4,
 * sacados con la herramienta de R1), cada uno contra EL כִּי citado.
 */
const BASE = fileURLToPath(new URL('../../../../web/public/language-data/v1/he/', import.meta.url));
const cap = (b: string, c: number): ChapterStructure => JSON.parse(readFileSync(`${BASE}${b}/${c}.json`, 'utf8'));
const fixture = (n: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${n}.json`, import.meta.url)), 'utf8'));

const MAPA: Record<string, HebrewKiFunction> = {
    a: 'causal', b: 'evidential', c: 'clarification', d: 'result', e: 'temporal', f: 'conditional', g: 'adversative',
    h: 'concessive', i: 'asseverative', j: 'perceptual', k: 'subject', l: 'recitative', m: 'exceptive', n: 'interrogative',
};
const ANCLAS: { etiqueta: string; ref: string; posiciones: number[] }[] = fixture('arnoldChoi-ki-anclas').anclas;

function medirAnclado() {
    const r = { decide: 0, acota: 0, sinKi: [] as string[], contradice: [] as string[] };
    for (const a of ANCLAS) {
        if (!a.posiciones.length) { r.sinKi.push(a.ref); continue; }
        const [libro, cv] = [a.ref.slice(0, a.ref.lastIndexOf(' ')), a.ref.slice(a.ref.lastIndexOf(' ') + 1)];
        const [c, v] = cv.split(':').map(Number) as [number, number];
        const cs = hebrewKiCandidates(cap(libro, c), v);
        for (const p of a.posiciones) {
            const x = cs.find(y => y.ordinal === p);
            const esperado = MAPA[a.etiqueta]!;
            if (!x) r.contradice.push(`${a.ref}[${p}] sin candidato`);
            else if (!x.allowed.includes(esperado)) r.contradice.push(`(${a.etiqueta}) ${a.ref}[${p}] → ${x.rule}[${x.allowed}]`);
            else if (x.allowed.length === 1) r.decide++;
            else r.acota++;
        }
    }
    return r;
}

describe('R4 — función de כִּי (Arnold y Choi §4.3.4)', () => {
    it('los 54 ejemplos del libro, cada כִּי citado: ninguno contradice', () => {
        expect(ANCLAS).toHaveLength(54);
        const r = medirAnclado();
        expect(r.contradice).toEqual([]);
        // 1 R 1:24 no tiene כִּי en OSHB: referencia a revisar en el libro.
        expect(r.sinKi).toEqual(['1Kgs 1:24']);
        expect([r.decide, r.acota]).toEqual([3, 51]);
    });

    it('todas las reglas se cumplen en el AT y todas están «medidas»; casi ninguna decide', () => {
        const usadas = new Set<string>();
        let total = 0, una = 0;
        for (const lib of readdirSync(BASE)) for (const f of readdirSync(`${BASE}${lib}`)) {
            const ch: ChapterStructure = JSON.parse(readFileSync(`${BASE}${lib}/${f}`, 'utf8'));
            for (const v of new Set(ch.words.map(w => Number(w.r.split('!')[0])))) for (const c of hebrewKiCandidates(ch, v)) {
                usadas.add(c.rule);
                expect(c.status).toBe('medida');
                total++;
                if (c.allowed.length === 1) una++;
            }
        }
        expect(HEBREW_KI_RULES.map(r => r.rule).filter(r => !usadas.has(r))).toEqual([]);
        // Sólo el juramento decide (16–18 casos): כִּי casi siempre lo elige el asistente entre las opciones.
        expect(total).toBeGreaterThan(4000);
        expect(una).toBeLessThan(30);
    }, 120_000);
});

describe('R4 — כִּי: lo que enseñaron las muestras al azar (versículos reales)', () => {
    const en = (libro: string, c: number, v: number, n = 1) => hebrewKiCandidates(cap(libro, c), v)[n - 1]!;

    it('juramento: «חַי יְהוָה כִּי» asevera (2 S 12:5); «חַיַּת הָאָרֶץ» (las bestias) no es juramento (1 S 17:46)', () => {
        expect(en('2Sam', 12, 5).allowed).toEqual(['asseverative']);
        expect(en('1Sam', 17, 46).rule).not.toBe('kiJuramento');
        // Sólo el primer כִּי tras el juramento: el segundo de 1 S 29:6 es causa.
        expect(en('1Sam', 29, 6, 2).rule).not.toBe('kiJuramento');
        // «כֹּה אֶעֱשֶׂה לְּךָ» (Am 4:12) no es la fórmula: falta «וְכֹה יֹסִיף».
        expect(en('Amos', 4, 12).rule).not.toBe('kiJuramento');
        expect(en('1Sam', 14, 44).rule).toBe('kiJuramento');
    });
    it('revisión: un אִם cierra el juramento (1 S 14:45, causa); con yiqtol después también condición (1 S 20:13)', () => {
        const pos = (libro: string, c: number, v: number, p: number) => hebrewKiCandidates(cap(libro, c), v).find(x => x.ordinal === p)!;
        expect(pos('1Sam', 14, 45, 20).rule).not.toBe('kiJuramento');
        expect(pos('1Sam', 20, 13, 6).allowed).toEqual(['asseverative', 'conditional']);
    });
    it('revisión: «perceptiva» tras ver, saber, oír o anunciar aunque MACULA no dé la cláusula (2 S 5:12, Gn 12:14, Jer 26:15, Gn 29:12)', () => {
        const pos = (libro: string, c: number, v: number, p: number) => hebrewKiCandidates(cap(libro, c), v).find(x => x.ordinal === p)!;
        expect(pos('2Sam', 5, 12, 2).allowed).toContain('perceptual');
        expect(pos('Gen', 12, 14, 8).allowed).toContain('perceptual');
        expect(pos('Jer', 26, 15, 3).allowed).toContain('perceptual');
        // La «o» está en la madre que coordina (CLaCL).
        expect(pos('Gen', 29, 12, 3).rule).toBe('kiObjeto');
        // Sin verbo de percepción cerca, no se agrega (Gn 3:19).
        expect(pos('Gen', 3, 19, 8).allowed).not.toContain('perceptual');
    });
    it('revisión: al abrir el versículo tras una negación, también «sino» (Gn 24:4); tras «decir» hasta 4 palabras (Jos 2:24)', () => {
        const pos = (libro: string, c: number, v: number, p: number) => hebrewKiCandidates(cap(libro, c), v).find(x => x.ordinal === p)!;
        expect(pos('Gen', 24, 4, 0).allowed).toContain('adversative');
        expect(pos('Ps', 37, 24, 0).allowed).not.toContain('adversative');
        expect(pos('Josh', 2, 24, 3).rule).toBe('kiTrasDecir');
    });
    it('la apódosis va antes que el juramento: «חַי הָאֱלֹהִים כִּי לוּלֵא… כִּי אָז» (2 S 2:27)', () => {
        expect(en('2Sam', 2, 27, 1).rule).toBe('kiJuramento');
        expect(en('2Sam', 2, 27, 2).allowed).toEqual(['conditional', 'asseverative']);
        // Con cualquier אִם cerca no: «כִּי פִּי יְהוָה דִּבֵּר» (Is 1:20) es causa.
        expect(en('Isa', 1, 20).rule).not.toBe('kiApodosis');
    });
    it('el rol de la cláusula es el de la propia del כִּי: «כִּי הִנְנִי מֵקִים» (Hab 1:6) no es sujeto', () => {
        expect(en('Hab', 1, 6).rule).not.toBe('kiSujeto');
        expect(en('2Sam', 18, 3, 3).allowed).toContain('subject');
        expect(en('Gen', 1, 10).allowed).toEqual(['perceptual', 'recitative']);
    });
    it('כִּי אִם sin negación antes también puede ser «porque si» (Éx 10:4)', () => {
        expect(en('Exod', 10, 4).allowed).toEqual(expect.arrayContaining(['causal', 'conditional']));
        // Con negación antes, sin «porque si» (con «יֵאָמֵר» cerca se agregan perceptiva y recitativa: sólo amplía).
        expect(en('Gen', 32, 29).allowed).toEqual(expect.arrayContaining(['adversative', 'exceptive', 'asseverative']));
        expect(en('Gen', 32, 29).allowed).not.toContain('conditional');
    });
    it('tras negación y sin verbo después: «sino», «excepto», causa o aseveración (Gn 17:15, 1 S 18:25, Is 7:9)', () => {
        expect(en('Gen', 17, 15).allowed).toContain('adversative');
        expect(en('1Sam', 18, 25).allowed).toContain('exceptive');
        expect(en('Isa', 7, 9).allowed).toContain('asseverative');
        // Con un predicado de enojo antes, también sujeto: «אַל יִחַר … כִּי» (Gn 31:35).
        expect(en('Gen', 31, 35).allowed).toContain('subject');
    });
    it('וַיְהִי / וְהָיָה כִּי: tiempo o condición (Gn 6:1, Éx 1:10)', () => {
        expect(en('Gen', 6, 1).allowed).toEqual(['temporal', 'conditional']);
        expect(en('Exod', 1, 10).allowed).toEqual(['temporal', 'conditional']);
    });
    it('sin regla «tras pregunta → resultado»: «כִּי תָבוֹא עָלָיו צָרָה» (Job 27:9) admite tiempo', () => {
        expect(en('Job', 27, 9).allowed).toContain('temporal');
        expect(en('Exod', 3, 11).allowed).toContain('result');
    });
});

describe('R4 — כִּי: al mostrar y en el prompt', () => {
    const jura = { ordinal: 3, text: 'כִּי', rule: 'kiJuramento' as const, allowed: ['asseverative'] as const, status: 'medida' as const };
    const varias = { ordinal: 1, text: 'כִּי', rule: 'kiVayehi' as const, allowed: ['temporal', 'conditional'] as const, status: 'medida' as const };
    it('una opción la propone la regla; con varias, la del asistente o al lado', () => {
        expect(applyHebrewKi(jura, undefined)).toEqual({ candidate: jura, fn: 'asseverative', by: 'rule' });
        expect(applyHebrewKi(varias, 'temporal')).toMatchObject({ fn: 'temporal', by: 'assistant' });
        expect(applyHebrewKi(varias, 'causal')).toEqual({ candidate: varias, assistantReading: 'causal' });
    });
    it('el prompt nombra cada כִּי por su aparición y da la lista de funciones', () => {
        const dos = hebrewKiCandidates(cap('Gen', 3), 19);
        expect(dos.map(x => x.occurrence)).toEqual([{ n: 1, of: 2 }, { n: 2, of: 2 }]);
        const t = buildHebrewKiTask(dos);
        expect(t).toContain('## כִּי: SU FUNCIÓN (campo "kiFunction"');
        expect(t).toMatch(/\(2\.ª aparición de 2 en el versículo\): כִּי, elige/);
        expect(t).toMatch(/uno de: causal, evidential, clarification/);
        expect(buildHebrewKiTask([])).toBe('');
    });
});
