import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ChapterStructure } from '../chapterStructure';
import {
    applyHebrewParticiple, buildHebrewParticipleTask, HEBREW_PARTICIPLE_RULES, hebrewParticipleCandidates,
    type HebrewParticipleFunction,
} from '../hebrewParticiple';

/**
 * R4 — la función del participio hebreo contra los EJEMPLOS DEL LIBRO (Arnold y
 * Choi §3.4.3, sacados con la herramienta de R1), cada uno contra SU palabra, y
 * contra un CONTROL que las reglas no vieron al ajustarse (§4.5, הִנֵּה).
 */
const BASE = fileURLToPath(new URL('../../../../web/public/language-data/v1/he/', import.meta.url));
const cap = (b: string, c: number): ChapterStructure => JSON.parse(readFileSync(`${BASE}${b}/${c}.json`, 'utf8'));
const fixture = (n: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${n}.json`, import.meta.url)), 'utf8'));
const N = (t: string) => t.replace(/[֑-ֽ֯׀׃]/g, '').normalize('NFC');

const PREDICADO: HebrewParticipleFunction[] = ['predicatePresent', 'predicatePast', 'predicateFuture'];
/** Etiqueta del libro → funciones que la cumplen («(b) Predicate» sin tiempo: cualquiera de los tres). */
const MAPA: Record<string, HebrewParticipleFunction[]> = {
    a: ['attributive'], b: PREDICADO, 'b.1': ['predicatePresent'], 'b.2': ['predicatePast'], 'b.3': ['predicateFuture'], c: ['substantive'],
};
const ANCLAS: { etiqueta: string; ref: string; palabras: string[] }[] = fixture('arnoldChoi-participio-anclas').anclas;

function medirAnclado() {
    const r = { decide: 0, acota: 0, sinParticipio: [] as string[], contradice: [] as string[] };
    for (const a of ANCLAS) {
        if (!a.palabras.length) { r.sinParticipio.push(a.ref); continue; }
        const [libro, cv] = [a.ref.slice(0, a.ref.lastIndexOf(' ')), a.ref.slice(a.ref.lastIndexOf(' ') + 1)];
        const [c, v] = cv.split(':').map(Number) as [number, number];
        const cs = hebrewParticipleCandidates(cap(libro, c), v).filter(x => a.palabras.map(N).includes(N(x.text)));
        const esperado = MAPA[a.etiqueta]!;
        if (cs.length !== a.palabras.length) r.contradice.push(`${a.ref}: ${cs.length} de ${a.palabras.length} con candidato`);
        // Cada palabra citada, no «alguna del versículo» (lección del infinitivo).
        for (const x of cs) {
            if (!x.allowed.some(f => esperado.includes(f))) r.contradice.push(`(${a.etiqueta}) ${a.ref} ${x.text} → ${x.rule}[${x.allowed}]`);
            else if (x.allowed.every(f => esperado.includes(f))) r.decide++;
            else r.acota++;
        }
    }
    return r;
}

describe('R4 — función del participio hebreo (Arnold y Choi §3.4.3)', () => {
    it('los 48 ejemplos del libro, cada palabra citada: ninguno contradice', () => {
        expect(ANCLAS).toHaveLength(48);
        const r = medirAnclado();
        expect(r.contradice).toEqual([]);
        // Sal 19:1 es la numeración inglesa de 19:2 («Ps 19:2 [Eng Ps 19:1]»), no otro ejemplo.
        expect(r.sinParticipio).toEqual(['Ps 19:1']);
        // Fijados: una regla que deja de decidir también tiene que verse.
        expect([r.decide, r.acota]).toEqual([11, 40]);
    });

    it('el control (§4.5, הִנֵּה; no usado para ajustar): tras הִנֵּה, el participio sin artículo admite predicado', () => {
        let vistos = 0;
        for (const s of fixture('arnoldChoi-hinne').secciones) for (const sub of s.subcategorias) for (const e of sub.ejemplos) {
            const ch = cap(e.libro, e.capitulo);
            const ws = ch.words.filter(w => w.r.startsWith(`${e.versiculo}!`));
            const hinne = ws.map((w, i) => ((w.m ?? '').includes('Tm') ? i : -1)).filter(i => i >= 0);
            for (const c of hebrewParticipleCandidates(ch, e.versiculo)) {
                if (!hinne.some(h => c.ordinal > h && c.ordinal - h <= 3) || (ws[c.ordinal]!.m ?? '').includes('Td')) continue;
                vistos++;
                // La regla de הִנֵּה, no otra que también admita predicado (revisión: sin ptcHinne, el control pasaba igual).
                expect(c.rule, `${e.libro} ${e.capitulo}:${e.versiculo} ${c.text}`).toBe('ptcHinne');
                expect(c.allowed.some(f => PREDICADO.includes(f)), `${e.libro} ${e.capitulo}:${e.versiculo} ${c.text}`).toBe(true);
            }
        }
        expect(vistos).toBeGreaterThanOrEqual(9);
    });

    it('todas las reglas se cumplen en el AT y todas están «medidas»; el arameo no entra', () => {
        const usadas = new Set<string>();
        for (const lib of readdirSync(BASE)) for (const f of readdirSync(`${BASE}${lib}`)) {
            const ch: ChapterStructure = JSON.parse(readFileSync(`${BASE}${lib}/${f}`, 'utf8'));
            for (const v of new Set(ch.words.map(w => Number(w.r.split('!')[0])))) for (const c of hebrewParticipleCandidates(ch, v)) {
                usadas.add(c.rule);
                expect(c.status).toBe('medida');
            }
        }
        expect(HEBREW_PARTICIPLE_RULES.map(r => r.rule).filter(r => !usadas.has(r))).toEqual([]);
        // Dn 2:5–49 es arameo (decenas de participios): ninguno con regla. Dn 2:1–4a es hebreo y sí.
        const dn2 = cap('Dan', 2);
        expect(Array.from({ length: 45 }, (_, k) => hebrewParticipleCandidates(dn2, k + 5).length).reduce((a, b) => a + b, 0)).toBe(0);
        expect(dn2.words.filter(w => Number(w.r.split('!')[0]) >= 5 && /^A.*V.[rs]/.test(w.m ?? '')).length).toBeGreaterThan(20);
    }, 120_000);
});

describe('R4 — participio: lo que enseñaron las muestras al azar (versículos reales)', () => {
    const regla = (libro: string, c: number, v: number, palabra: string) =>
        hebrewParticipleCandidates(cap(libro, c), v).find(x => N(x.text) === N(palabra));

    it('הָיָה + participio da el tiempo pero NO decide: «וְלֹא הָיָה מַצִּיל» (Dn 8:7) es «no había quien librara»', () => {
        expect(regla('Dan', 8, 7, 'מַצִּיל')?.allowed).toEqual(['predicatePast', 'substantive', 'attributive']);
        expect(regla('Exod', 3, 1, 'רֹעֶה')?.allowed[0]).toBe('predicatePast');
        expect(regla('1Kgs', 2, 45, 'נָכוֹן')?.allowed[0]).toBe('predicateFuture');
    });
    it('הָיָה más lejos, saltando nombres, o después en la misma cláusula: «יְהִי שֵׁם יְהוָה מְבֹרָךְ» (Job 1:21), «גַּם בָּרוּךְ יִהְיֶה» (Gn 27:33)', () => {
        expect(regla('Job', 1, 21, 'מְבֹרָךְ')?.allowed[0]).toBe('predicateFuture');
        expect(regla('Gen', 27, 33, 'בָּרוּךְ')?.allowed[0]).toBe('predicateFuture');
        // Un הָיָה con «וְ» que abre otra cláusula no da el tiempo: «יוֹצְאִים וְהָיָה» (Ez 47:12).
        expect(regla('Ezek', 47, 12, 'יוֹצְאִים')?.allowed).toContain('predicatePresent');
        // Más de 2 palabras atrás, sólo si הָיָה está en la misma cláusula: «יִהְיֶה עֶלְיוֹן כָּל עֹבֵר» (1 R 9:8).
        expect(regla('1Kgs', 9, 8, 'עֹבֵר')?.allowed).toEqual(['substantive']);
    });
    it('«Tm» no es siempre הִנֵּה: יֵשׁ y כֵּן no hacen predicado («יֵשׁ גֹּאֵל», Rut 3:12; «עַל כֵּן רֹדְפַי», Jer 20:11)', () => {
        expect(regla('Ruth', 3, 12, 'גֹּאֵל')?.rule).not.toBe('ptcHinne');
        expect(regla('Jer', 20, 11, 'רֹדְפַי')?.rule).not.toBe('ptcHinne');
        // Tras הִנֵּה, de sujeto o predicado nominal, también nombre (Sal 92:10 «כִּי הִנֵּה אֹיְבֶיךָ»).
        expect(regla('Ps', 92, 10, 'אֹיְבֶיךָ')?.allowed).toContain('substantive');
        // …o atributo: «וְהִנֵּה מְגִלָּה עָפָה», un rollo que vuela (Zac 5:1).
        expect(regla('Zech', 5, 1, 'עָפָה')?.allowed).toContain('attributive');
        // Otro participio sin artículo en medio es otro predicado: «הִנֵּה אָנֹכִי מֵקִים רֹעֶה» (Zac 11:16).
        expect(regla('Zech', 11, 16, 'רֹעֶה')?.rule).not.toBe('ptcHinne');
    });
    it('preposición suelta que MACULA no trata como tal: también predicado («אֵת רֹכְבִים», 2 R 9:25)', () => {
        expect(regla('2Kgs', 9, 25, 'רֹכְבִים')?.allowed).toContain('predicatePast');
        expect(regla('Neh', 6, 13, 'שָׂכוּר')?.allowed).toContain('predicatePresent');
    });
    it('al comienzo del versículo, la palabra anterior es la última del versículo anterior (Lv 22:33 «הַמּוֹצִיא»)', () => {
        expect(regla('Lev', 22, 33, 'הַמּוֹצִיא')?.allowed).toEqual(['attributive', 'substantive']);
    });
    it('«וְ + qatal» de הָיָה que OSHB no marca weqatal: pasado o futuro (Zac 10:5)', () => {
        expect(regla('Zech', 10, 5, 'בּוֹסִים')?.allowed.slice(0, 2)).toEqual(['predicatePast', 'predicateFuture']);
    });
    it('הִנְנִי con lema 2005 también es הִנֵּה: «הִנְנִי נֹתְנוֹ» (1 R 20:13) es predicado, no sustantivo por el sufijo', () => {
        expect(regla('1Kgs', 20, 13, 'נֹתְנוֹ')?.rule).toBe('ptcHinne');
    });
    it('un participio con artículo entre הִנֵּה y el predicado no corta: «וְהִנֵּה הַגֹּאֵל עֹבֵר» (Rut 4:1)', () => {
        expect(regla('Ruth', 4, 1, 'עֹבֵר')?.rule).toBe('ptcHinne');
        expect(regla('Ruth', 4, 1, 'הַגֹּאֵל')?.allowed).toEqual(['substantive']);
    });
    it('con artículo tras un nombre (aun indefinido): atributivo o sustantivo (Éx 11:5, Ez 48:15)', () => {
        expect(regla('Exod', 11, 5, 'הַיֹּשֵׁב')?.allowed).toEqual(['attributive', 'substantive']);
        expect(regla('Ezek', 48, 15, 'הַנּוֹתָר')?.allowed).toEqual(['attributive', 'substantive']);
    });
    it('atributivo decide sólo si concuerda; coordinado con «וְ» o en constructo, también sustantivo', () => {
        expect(regla('1Kgs', 3, 9, 'שֹׁמֵעַ')?.allowed).toEqual(['attributive']);
        expect(regla('Ezek', 44, 22, 'וּגְרוּשָׁה')?.allowed).toContain('substantive');
        expect(regla('Exod', 2, 14, 'וְשֹׁפֵט')?.allowed).toContain('substantive');
        // Género distinto (Dt 32:25 «בְּתוּלָה יוֹנֵק», el lactante); nombre definido + participio sin artículo es
        // predicado o aposición (1 S 17:41 «וְהָאִישׁ נֹשֵׂא»); participio que funciona como nombre (Jer 31:16).
        expect(regla('Deut', 32, 25, 'יוֹנֵק')?.allowed).toContain('substantive');
        expect(regla('1Sam', 17, 41, 'נֹשֵׂא')?.allowed).toContain('predicatePast');
        expect(regla('Jer', 31, 16, 'אוֹיֵב')?.allowed).toContain('substantive');
        // Pr 15:31 «אֹזֶן שֹׁמַעַת» atributivo; Gn 14:19 «עֶלְיוֹן קֹנֵה» sustantivo para el libro.
        expect(regla('Gen', 14, 19, 'קֹנֵה')?.allowed).toEqual(['attributive', 'substantive']);
    });
    it('אִישׁ que OSHB pone en constructo no hace genitivo: «אִישׁ צָרוּעַ» (Lv 13:44) admite atributivo', () => {
        expect(regla('Lev', 13, 44, 'צָרוּעַ')?.allowed).toContain('attributive');
        expect(regla('Gen', 9, 10, 'יֹצְאֵי')?.allowed).toEqual(['substantive']);
    });
    it('sufijo de objeto en un predicado: «אַתָּה בוֹדָאם» (Neh 6:8) admite predicado; «שֹׁמְרֶךָ» (Sal 121:5), sustantivo', () => {
        expect(regla('Neh', 6, 8, 'בוֹדָאם')?.allowed).toContain('predicatePresent');
        expect(regla('Ps', 121, 5, 'שֹׁמְרֶךָ')?.allowed).toEqual(['substantive']);
    });
    it('preposición pegada o suelta, y הוֹי / אַשְׁרֵי: sustantivo (Sal 103:18, Zac 11:6, Jer 22:13, Sal 106:3)', () => {
        expect(regla('Ps', 103, 18, 'לְשֹׁמְרֵי')?.allowed).toEqual(['substantive']);
        expect(regla('Zech', 11, 6, 'יֹשְׁבֵי')?.allowed).toEqual(['substantive']);
        expect(regla('Jer', 22, 13, 'בֹּנֶה')?.rule).toBe('ptcExclamacion');
        expect(regla('Ps', 106, 3, 'שֹׁמְרֵי')?.rule).toBe('ptcExclamacion');
    });
    it('MACULA lo trata como verbo pero va tras un nombre sin sujeto: también atributivo (Éx 31:18 «כְּתֻבִים»)', () => {
        expect(regla('Exod', 31, 18, 'כְּתֻבִים')?.allowed).toEqual(['attributive', ...PREDICADO]);
        expect(regla('Gen', 2, 10, 'יֹצֵא')?.allowed).toEqual(PREDICADO);
    });
});

describe('R4 — participio: al mostrar y en el prompt', () => {
    const una = { ordinal: 0, text: 'לְשֹׁמְרֵי', rule: 'ptcPreposicion' as const, allowed: ['substantive'] as const, status: 'medida' as const };
    const varias = { ordinal: 2, text: 'מֵבִיא', rule: 'ptcHinne' as const, allowed: PREDICADO, status: 'medida' as const };
    it('una opción la propone la regla; con varias vale la del asistente si está en la lista, y si no se muestra al lado', () => {
        expect(applyHebrewParticiple(una, undefined)).toEqual({ candidate: una, fn: 'substantive', by: 'rule' });
        expect(applyHebrewParticiple(una, 'attributive')).toMatchObject({ fn: 'substantive', assistantReading: 'attributive' });
        expect(applyHebrewParticiple(varias, 'predicateFuture')).toMatchObject({ fn: 'predicateFuture', by: 'assistant' });
        expect(applyHebrewParticiple(varias, 'substantive')).toEqual({ candidate: varias, assistantReading: 'substantive' });
        expect(applyHebrewParticiple(varias, 'inventada')).toEqual({ candidate: varias });
    });
    it('el prompt nombra la palabra, propone o pide elegir, y da la lista de funciones válidas', () => {
        const t = buildHebrewParticipleTask([una, varias]);
        expect(t).toContain('## PARTICIPIOS: SU FUNCIÓN (campo "participleFunction"');
        expect(t).toMatch(/לְשֹׁמְרֵי: participio; el texto propone substantive = sustantivo/);
        expect(t).toMatch(/מֵבִיא: participio, elige "participleFunction" de: "predicatePresent"/);
        expect(t).toMatch(/uno de: attributive, predicatePresent, predicatePast, predicateFuture, substantive/);
        expect(buildHebrewParticipleTask([])).toBe('');
    });
    it('una forma repetida se nombra por su aparición (Gn 1:29, dos «זֹרֵעַ»)', () => {
        const dos = hebrewParticipleCandidates(cap('Gen', 1), 29).filter(x => N(x.text) === N('זֹרֵעַ'));
        expect(dos.map(x => x.occurrence)).toEqual([{ n: 1, of: 2 }, { n: 2, of: 2 }]);
        expect(buildHebrewParticipleTask(dos)).toMatch(/זֹרֵעַ \(2\.ª aparición de 2 en el versículo\)/);
    });
});
