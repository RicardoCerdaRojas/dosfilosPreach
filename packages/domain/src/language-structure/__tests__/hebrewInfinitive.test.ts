import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ChapterStructure } from '../chapterStructure';
import {
    applyHebrewInfinitive, buildHebrewInfinitiveTask, HEBREW_INFINITIVE_RULES, hebrewInfinitiveCandidates,
    type HebrewInfinitiveFunction,
} from '../hebrewInfinitive';

/**
 * R4 — la función del infinitivo hebreo contra los EJEMPLOS DEL LIBRO (Arnold y
 * Choi §3.4.1–3.4.2, sacados en R1) y contra un CONTROL que la regla no vio al
 * ajustarse (§4.1, preposiciones).
 */
const BASE = fileURLToPath(new URL('../../../../web/public/language-data/v1/he/', import.meta.url));
const cap = (b: string, c: number): ChapterStructure => JSON.parse(readFileSync(`${BASE}${b}/${c}.json`, 'utf8'));
const fixture = (n: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${n}.json`, import.meta.url)), 'utf8'));

/** Etiqueta del libro → nuestra función. */
const MAPA: Record<string, Record<string, HebrewInfinitiveFunction>> = {
    '3.4.1': {
        'a.1': 'subject', 'a.2': 'genitive', 'a.3': 'object', 'b.1': 'temporalWhile', 'b.2': 'temporalAsSoonAs', 'b.3': 'temporalUntil',
        'b.4': 'temporalAfter', c: 'purpose', d: 'result', e: 'obligation', f: 'imminence', g: 'specification',
    },
    '3.4.2': { 'a.1': 'subject', 'a.2': 'genitive', 'a.3': 'object', b: 'emphatic', c: 'manner', d: 'verbalSubstitute' },
    // Control (§4.1): sólo las preposiciones que gobiernan infinitivos, puestas a mano (los títulos del
    // capítulo salen ilegibles en la capa; verificado por las categorías de cada sección).
    '4.1.1': { b: 'temporalAfter' }, '4.1.5': { b: 'temporalWhile', c: 'instrumental', f: 'causal' }, '4.1.9': { c: 'temporalAsSoonAs' },
    '4.1.10': { d: 'purpose', h: 'specification' }, '4.1.11': { a: 'purpose' }, '4.1.15': { b: 'temporalUntil' },
};
const REGLAS_DE: Record<string, readonly string[]> = {
    '4.1.1': ['achareInf'], '4.1.5': ['bInf'], '4.1.9': ['kInf'], '4.1.10': ['lemor', 'lComplemento', 'lInf'], '4.1.11': ['lemaanInf'], '4.1.15': ['adInf'],
};

const N = (t: string) => t.replace(/[\u0591-\u05AF\u05BD\u05C0\u05C3]/g, '').normalize('NFC');
/** Qué infinitivo del versículo cita el libro (R4, revisión: probar contra la PALABRA, no contra el versículo). */
const ANCLAS: { seccion: string; etiqueta: string; ref: string; palabras: string[] }[] = fixture('arnoldChoi-infinitivo-anclas').anclas;

/** Los ejemplos del libro, cada uno contra SU palabra. */
function medirAnclado() {
    const r = { decide: 0, acota: 0, sinInfinitivo: [] as string[], contradice: [] as string[] };
    for (const a of ANCLAS) {
        const esperado = MAPA[a.seccion]![a.etiqueta]!;
        if (!a.palabras.length) { r.sinInfinitivo.push(a.ref); continue; }
        const [libro, cv] = [a.ref.slice(0, a.ref.lastIndexOf(' ')), a.ref.slice(a.ref.lastIndexOf(' ') + 1)];
        const [c, v] = cv.split(':').map(Number) as [number, number];
        const cs = hebrewInfinitiveCandidates(cap(libro, c), v).filter(x => a.palabras.map(N).includes(N(x.text)));
        if (!cs.length) { r.contradice.push(`${a.seccion}(${a.etiqueta}) ${a.ref}: sin candidato para ${a.palabras.join(', ')}`); continue; }
        if (cs.some(x => x.allowed.length === 1 && x.allowed[0] === esperado)) r.decide++;
        else if (cs.some(x => x.allowed.includes(esperado))) r.acota++;
        else r.contradice.push(`${a.seccion}(${a.etiqueta}) ${a.ref} ${cs.map(x => `${x.text}→${x.rule}[${x.allowed}]`).join(' ')}`);
    }
    return r;
}

/** El control (§4.1): sin anclas; se mira el infinitivo regido por esa preposición. */
function medir(nombre: string, control: boolean) {
    const r = { decide: 0, acota: 0, sinInfinitivo: [] as string[], contradice: [] as string[] };
    for (const s of fixture(nombre).secciones) for (const sub of s.subcategorias) {
        const esperado = MAPA[s.seccion]?.[sub.etiqueta];
        if (!esperado) continue;
        const forma = s.seccion === '3.4.2' ? 'absolute' : 'construct';
        for (const e of sub.ejemplos) {
            let cs = hebrewInfinitiveCandidates(cap(e.libro, e.capitulo), e.versiculo).filter(c => c.form === forma);
            if (control) cs = cs.filter(c => REGLAS_DE[s.seccion]!.includes(c.rule));
            const ref = `${e.libro} ${e.capitulo}:${e.versiculo}`;
            if (!cs.length) r.sinInfinitivo.push(ref);
            else if (cs.some(c => c.allowed.length === 1 && c.allowed[0] === esperado)) r.decide++;
            else if (cs.some(c => c.allowed.includes(esperado))) r.acota++;
            else r.contradice.push(`${s.seccion}(${sub.etiqueta}) ${ref}`);
        }
    }
    return r;
}

describe('R4 — función del infinitivo hebreo (Arnold y Choi §3.4)', () => {
    it('los 76 ejemplos del libro, cada uno contra SU palabra: ninguno contradice; dos sin infinitivo en OSHB (Anexo A.2)', () => {
        expect(ANCLAS).toHaveLength(76);
        const r = medirAnclado();
        expect(r.contradice).toEqual([]);
        expect(r.sinInfinitivo.sort()).toEqual(['1Sam 5:9', 'Gen 40:10']);
        // Fijados: una regla que deja de decidir y pasa a ofrecer opciones también tiene que verse (revisión de R4).
        expect([r.decide, r.acota]).toEqual([24, 50]);
    });
    it('el control (§4.1, no usado para ajustar): ninguno contradice', () => {
        const r = medir('arnoldChoi-preposiciones', true);
        expect(r.contradice).toEqual([]);
        expect(r.decide + r.acota).toBeGreaterThanOrEqual(13);
    });
    it('בְּ + infinitivo NO decide: acota entre temporal, causal e instrumental (control 6/8 temporales, §4.1.5 f)', () => {
        const c = hebrewInfinitiveCandidates(cap('Exod', 16), 7).find(x => x.rule === 'bInf');
        expect(c?.allowed).toEqual(['temporalWhile', 'causal', 'instrumental']);
    });
    it('los verbos que piden complemento acotan entre complemento y propósito (1 R 5:17, Anexo A.1)', () => {
        expect(hebrewInfinitiveCandidates(cap('1Kgs', 5), 17).find(x => x.rule === 'lComplemento')?.allowed).toEqual(['object', 'purpose']);
    });
    it('todas las reglas se cumplen en el AT y todas están «medidas» (ninguna validada todavía)', () => {
        const usadas = new Set<string>();
        for (const lib of readdirSync(BASE)) for (const f of readdirSync(`${BASE}${lib}`)) {
            const ch: ChapterStructure = JSON.parse(readFileSync(`${BASE}${lib}/${f}`, 'utf8'));
            for (const v of new Set(ch.words.map(w => Number(w.r.split('!')[0])))) for (const c of hebrewInfinitiveCandidates(ch, v)) {
                usadas.add(c.rule);
                expect(c.status).toBe('medida');
            }
        }
        expect(HEBREW_INFINITIVE_RULES.map(r => r.rule).filter(r => !usadas.has(r))).toEqual([]);
    }, 120_000);
});

describe('R4 — regresiones de la revisión adversarial (versículos reales)', () => {
    const regla = (libro: string, c: number, v: number, palabra: string) =>
        hebrewInfinitiveCandidates(cap(libro, c), v).find(x => N(x.text) === N(palabra));
    it('«sin verbo» sube hasta el verbo: 1 Cr 21:30 «לִדְרֹשׁ» cuelga de «לָלֶכֶת» y de יָכֹל', () => {
        expect(regla('1Chr', 21, 30, 'לִדְרֹשׁ')?.allowed).not.toContain('obligation');
    });
    it('sin verbo, obligación sólo se OFRECE: Gn 24:23 «מָקוֹם לָנוּ לָלִין» e Is 5:22 no son obligación', () => {
        // La regla «sin verbo → obligación o inminencia» erraba 18 de 20 en una muestra al azar.
        for (const [l, c, v, p] of [['Gen', 24, 23, 'לָלִין'], ['Isa', 5, 22, 'לִשְׁתּוֹת']] as const) {
            const x = regla(l, c, v, p)!;
            expect(x.rule).toBe('lInf');
            expect(x.allowed).toEqual(expect.arrayContaining(['purpose', 'specification', 'obligation']));
        }
    });
    it('2 R 17:17 «לְהַכְעִיסוֹ», el ejemplo de resultado del libro (p. 71), admite resultado', () => {
        expect(regla('2Kgs', 17, 17, 'לְהַכְעִיסוֹ')?.allowed).toContain('result');
    });
    it('כְּ + infinitivo también compara (Sal 68:3 «כְּהִנְדֹּף»)', () => {
        expect(regla('Ps', 68, 3, 'כְּהִנְדֹּף')?.allowed).toEqual(['temporalAsSoonAs', 'temporalWhile', 'comparative']);
    });
    it('«אַחֲרָיו» con sufijo es espacial y «עַד לָמוּת» no es «hasta»: no deciden temporal', () => {
        expect(hebrewInfinitiveCandidates(cap('1Kgs', 15), 4).some(x => x.rule === 'achareInf')).toBe(false);
        expect(regla('2Chr', 32, 24, 'לָמוּת')?.rule).not.toBe('adInf');
    });
    it('tras «לִפְנֵי» no se dice nada (no es genitivo): Mal 3:23 «לִפְנֵי בּוֹא יוֹם יְהוָה»', () => {
        expect(regla('Mal', 3, 23, 'בּוֹא')).toBeUndefined();
    });
    it('verbo-sujeto-infinitivo: «וְלֹא אָבוּ עַבְדֵי הַמֶּלֶךְ לִשְׁלֹחַ» (1 S 22:17) ofrece complemento', () => {
        expect(regla('1Sam', 22, 17, 'לִשְׁלֹחַ')?.rule).toBe('lComplemento');
        expect(regla('Judg', 4, 1, 'לַעֲשׂוֹת')?.allowed).toEqual(['object', 'purpose']);
        // Coordinado con otro infinitivo: sigue colgando del verbo (Ec 8:16 «נָתַתִּי אֶת לִבִּי לָדַעַת חָכְמָה וְלִרְאוֹת»).
        expect(regla('Eccl', 8, 16, 'וְלִרְאוֹת')?.rule).toBe('lComplemento');
    });
    it('la aparición cuenta todas las palabras iguales del versículo, tengan regla o no', () => {
        const ch = cap('Neh', 9);
        const dos = hebrewInfinitiveCandidates(ch, 8).filter(x => N(x.text) === N('לָתֵת'));
        expect(dos.map(x => x.occurrence)).toEqual([{ n: 1, of: 2 }, { n: 2, of: 2 }]);
        expect(buildHebrewInfinitiveTask(dos)).toMatch(/\(2\.ª aparición de 2 en el versículo\)/);
        // Ez 33:22: «לִפְנֵי בּוֹא» (sin regla) y «עַד בּוֹא» (hasta): la con regla es la 2.ª, no la «1.ª».
        expect(hebrewInfinitiveCandidates(cap('Ezek', 33), 22).filter(x => N(x.text) === N('בּוֹא')).map(x => [x.rule, x.occurrence])).toEqual([['adInf', { n: 2, of: 2 }]]);
        // Una sola: sin etiqueta.
        expect(regla('1Sam', 22, 17, 'לִשְׁלֹחַ')?.occurrence).toBeUndefined();
    });
    it('לְמַעַן: propósito o resultado (2 R 22:17); בַּעֲבוּר: propósito (1 S 1:6)', () => {
        expect(hebrewInfinitiveCandidates(cap('2Kgs', 22), 17).find(x => x.rule === 'lemaanInf')?.allowed).toEqual(['purpose', 'result']);
        expect(hebrewInfinitiveCandidates(cap('1Sam', 1), 6).find(x => x.rule === 'baavurInf')?.allowed).toEqual(['purpose']);
    });
    it('el arameo (Dn 2:16) no recibe reglas de una gramática del hebreo', () => {
        expect(hebrewInfinitiveCandidates(cap('Dan', 2), 16)).toEqual([]);
    });
    it('«הַשְׁכֵּם וְדַבֵּר» (Jer 7:13) es manera, no enfático', () => {
        expect(regla('Jer', 7, 13, 'הַשְׁכֵּם')?.rule).toBe('absManera');
    });
});

describe('R4 — al mostrar y en el prompt', () => {
    const una = { ordinal: 3, text: 'בֹּאֲךָ', form: 'construct' as const, rule: 'adInf' as const, allowed: ['temporalUntil'] as const, status: 'medida' as const };
    const varias = { ordinal: 1, text: 'בְּשָׁמְעוֹ', form: 'construct' as const, rule: 'bInf' as const, allowed: ['temporalWhile', 'causal', 'instrumental'] as const, status: 'medida' as const };
    it('una opción la propone la regla; con varias vale la del asistente si está en la lista, y si no se muestra al lado', () => {
        // Una opción medida: se propone, y si el asistente lee otra se muestran las dos (no se impone lo no validado).
        expect(applyHebrewInfinitive(una, 'purpose')).toMatchObject({ fn: 'temporalUntil', by: 'rule', assistantReading: 'purpose' });
        expect(applyHebrewInfinitive(una, 'temporalUntil')).toEqual({ candidate: una, fn: 'temporalUntil', by: 'rule' });
        expect(applyHebrewInfinitive(una, 'inventada')).toEqual({ candidate: una, fn: 'temporalUntil', by: 'rule' });
        expect(applyHebrewInfinitive(varias, 'causal')).toMatchObject({ fn: 'causal', by: 'assistant' });
        // Fuera de la lista: no se elige, pero tampoco se descarta en silencio (1 S 22:17, revisión de R4).
        expect(applyHebrewInfinitive(varias, 'purpose')).toEqual({ candidate: varias, assistantReading: 'purpose' });
        expect(applyHebrewInfinitive(varias, 'inventada')).toEqual({ candidate: varias });
        expect(applyHebrewInfinitive(varias, undefined)).toEqual({ candidate: varias });
    });
    it('el prompt pide explicar la decidida y elegir de la lista', () => {
        const t = buildHebrewInfinitiveTask([una, varias]);
        expect(t).toMatch(/בֹּאֲךָ: infinitivo constructo; el texto propone temporalUntil = temporal «hasta» \(regla medida, todavía sin validar\)/);
        expect(t).toMatch(/si claramente es otra función, devuelve esa \(uno de: subject, .*verbalSubstitute\)/);
        expect(t).toMatch(/si ninguna encaja, devuelve la que corresponda/);
        expect(t).toMatch(/בְּשָׁמְעוֹ: infinitivo constructo, elige "infinitiveFunction" de: "temporalWhile"/);
        expect(buildHebrewInfinitiveTask([])).toBe('');
    });
});
