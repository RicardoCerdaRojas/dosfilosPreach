import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verseWords, type ChapterStructure } from '../chapterStructure';
import { verseStructure, type StructureNode } from '../verseStructure';

/**
 * La vista «Estructura» (G1 + G5) sobre los datos GENERADOS: los casos del
 * profesor y uno por cada regla que decide (clase de condicional, waw
 * disyuntiva, asíndeton, discurso, envoltorios de MACULA).
 */
const cargar = (rel: string): ChapterStructure =>
    JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../web/public/language-data/v1/${rel}`, import.meta.url)), 'utf8'));
/** Sin puntuación; en hebreo, sólo consonantes (el orden de los signos varía). */
const limpio = (t: string) => t.normalize('NFC').replace(/[,.;\u00B7\u0387\u2019\u0591-\u05C7]/g, '');
const texto = (n: StructureNode) => n.words.map(w => limpio(w.t)).join(' ');
const fila = (ns: readonly StructureNode[], inicio: string) => {
    const n = ns.find(x => texto(x).startsWith(limpio(inicio)));
    if (!n) throw new Error(`sin fila «${inicio}»: ${ns.map(texto).join(' | ')}`);
    return n;
};
const conector = (n: StructureNode) => n.words.find(w => w.r === n.connector)?.t ?? null;

describe('verseStructure — griego', () => {
    const stg1 = cargar('gr/JAS/1.json');
    const stg2 = cargar('gr/JAS/2.json');

    it('Stg 2:9: δέ abre la oración; prótasis de 1.ª clase; apódosis con el objeto adelantado', () => {
        const ns = verseStructure(stg2, 9);
        expect(texto(ns[0]!)).toBe('δὲ');
        expect(ns[0]).toMatchObject({ relation: 'development' });
        const prot = fila(ns, 'εἰ');
        expect(prot).toMatchObject({ relation: 'condition', conditionalClass: 1, isApodosis: false });
        expect(texto(prot)).toBe('εἰ προσωπολημπτεῖτε');
        const apo = fila(ns, 'ἁμαρτίαν');
        expect(apo).toMatchObject({ relation: 'main', isApodosis: true });
        expect(apo.fronted.map(f => f.role)).toEqual(['o']);
        expect(fila(ns, 'ἐλεγχόμενοι')).toMatchObject({ relation: 'participial', depth: apo.depth + 1 });
        expect(fila(ns, 'ὡς')).toMatchObject({ relation: 'comparison', verbless: true });
    });

    it('Stg 2:7: οὐκ y τό se funden en su cláusula; sólo el sujeto cuenta como adelantado (no la negación)', () => {
        const ns = verseStructure(stg2, 7);
        expect(ns.map(texto)).toEqual(['οὐκ αὐτοὶ βλασφημοῦσιν τὸ καλὸν ὄνομα', 'τὸ ἐπικληθὲν ἐφ ὑμᾶς']);
        expect(ns[0]!.fronted.map(f => f.role)).toEqual(['s']);
        expect(ns[1]).toMatchObject({ relation: 'participial', depth: ns[0]!.depth + 1 });
    });

    it('Stg 1:5: Εἰ se funde con su verbo (la clase se mira en la hija); δέ queda como fila propia; καί coordina dentro de la apódosis', () => {
        const ns = verseStructure(stg1, 5);
        expect(texto(ns[0]!)).toBe('δέ');
        const prot = fila(ns, 'Εἰ');
        expect(texto(prot)).toBe('Εἰ τις ὑμῶν λείπεται σοφίας');
        expect(prot).toMatchObject({ relation: 'condition', conditionalClass: 1 });
        expect(fila(ns, 'αἰτείτω')).toMatchObject({ isApodosis: true });
        expect(fila(ns, 'καὶ δοθήσεται')).toMatchObject({ relation: 'addition', isApodosis: true });
        expect(fila(ns, 'καὶ μὴ')).toMatchObject({ relation: 'addition', isApodosis: false });
    });

    it('clases de condicional: 2.ª (Jn 11:21, ἄν), 3.ª (1 Jn 1:9, subjuntivo), 4.ª (1 P 3:14, optativo)', () => {
        const jn = verseStructure(cargar('gr/JHN/11.json'), 21);
        expect(fila(jn, 'εἰ')).toMatchObject({ conditionalClass: 2 });
        expect(fila(jn, 'οὐκ ἂν')).toMatchObject({ isApodosis: true });
        expect(fila(verseStructure(cargar('gr/1JN/1.json'), 9), 'ἐὰν')).toMatchObject({ conditionalClass: 3 });
        const pe = verseStructure(cargar('gr/1PE/3.json'), 14);
        const prot = fila(pe, 'εἰ');
        expect(prot).toMatchObject({ conditionalClass: 4, relation: 'condition' });
        expect(texto(prot)).toBe('εἰ καὶ πάσχοιτε διὰ δικαιοσύνην');
        // καί adverbial («aun si»): ni conector ni adelantado.
        expect(conector(prot)).toBe('εἰ');
        expect(prot.fronted).toEqual([]);
        expect(fila(pe, 'μηδὲ')).toMatchObject({ relation: 'addition' });
    });

    it('Jn 3:16: γάρ, ὥστε y ἵνA (propósito o resultado: ambiguo, nombrado)', () => {
        const ns = verseStructure(cargar('gr/JHN/3.json'), 16);
        expect(fila(ns, 'Οὕτως')).toMatchObject({ relation: 'ground' });
        expect(fila(ns, 'ὥστε')).toMatchObject({ relation: 'result' });
        expect(fila(ns, 'ἵνα')).toMatchObject({ relation: 'purposeOrResult' });
        expect(fila(ns, 'ἀλλὰ')).toMatchObject({ relation: 'contrast' });
    });
});

describe('verseStructure — revisión adversarial de G1 + G5', () => {
    it('εἰ interrogativo (MACULA PtclCL) es pregunta, no condición, y su madre no es apódosis (Mc 15:44)', () => {
        const ns = verseStructure(cargar('gr/MRK/15.json'), 44);
        expect(ns.filter(n => n.relation === 'question')).toHaveLength(2);
        expect(ns.some(n => n.relation === 'condition' || n.isApodosis)).toBe(false);
    });

    it('«ὃ ἐάν» es relativo indefinido, en una sola fila (1 Jn 3:22)', () => {
        const ns = verseStructure(cargar('gr/1JN/3.json'), 22);
        expect(fila(ns, 'ὃ ἐὰν')).toMatchObject({ relation: 'relative' });
        expect(ns.some(n => n.relation === 'condition')).toBe(false);
    });

    it('«εἰ μή» sin verbo es excepción (Mt 12:4); con verbo sigue siendo condición (2 Co 13:5)', () => {
        expect(fila(verseStructure(cargar('gr/MAT/12.json'), 4), 'εἰ μὴ')).toMatchObject({ relation: 'exception', isApodosis: false });
        expect(fila(verseStructure(cargar('gr/2CO/13.json'), 5), 'εἰ μήτι')).toMatchObject({ relation: 'condition', conditionalClass: 1 });
    });

    it('relativo tras preposición (Ef 1:7 «ἐν ᾧ») y participio copulativo (Ro 8:28 «οὖσιν»)', () => {
        expect(fila(verseStructure(cargar('gr/EPH/1.json'), 7), 'ἐν ᾧ')).toMatchObject({ relation: 'relative' });
        expect(fila(verseStructure(cargar('gr/ROM/8.json'), 28), 'τοῖς κατὰ')).toMatchObject({ relation: 'participial' });
        expect(fila(verseStructure(cargar('gr/EPH/1.json'), 4), 'εἶναι')).toMatchObject({ relation: 'infinitival' });
    });

    it('un καί con rol dentro de la frase no es conector (1 Co 11:19 «ἵνα καὶ οἱ δόκιμοι»)', () => {
        expect(fila(verseStructure(cargar('gr/1CO/11.json'), 19), 'ἵνα')).toMatchObject({ relation: 'purposeOrResult' });
    });

    it('palabras fuera de toda cláusula: cada verbo suelto en su fila (1 Co 16:13); לָכֵן conecta (1 R 14:10)', () => {
        expect(verseStructure(cargar('gr/1CO/16.json'), 13).map(texto)).toEqual(['Γρηγορεῖτε', 'στήκετε ἐν τῇ πίστει', 'ἀνδρίζεσθε', 'κραταιοῦσθε']);
        const lakhen = fila(verseStructure(cargar('he/1Kgs/14.json'), 10), 'לָכֵן');
        expect(lakhen).toMatchObject({ relation: 'inference' });
        // Sin verbo, va con la cláusula que sigue (no en una fila sola).
        expect(texto(lakhen)).toBe(limpio('לָכֵן הִנְנִי'));
    });

    it('כֵּן solo («así») no es inferencia (1 R 1:30)', () => {
        const ns = verseStructure(cargar('he/1Kgs/1.json'), 30);
        expect(ns.some(n => n.relation === 'inference')).toBe(false);
    });

    it('sólo cuenta lo antepuesto a un verbo FINITO: el saludo de Stg 1:1 (… χαίρειν) no marca nada', () => {
        expect(verseStructure(cargar('gr/JAS/1.json'), 1).flatMap(n => n.fronted)).toEqual([]);
    });

    it('el relativo y su preposición van primero por gramática: no son «antepuesto» (1 Co 1:9 «δι’ οὗ», Ef 1:7 «ἐν ᾧ»); el τις indefinido sí (Stg 1:5)', () => {
        expect(verseStructure(cargar('gr/1CO/1.json'), 9).flatMap(n => n.fronted)).toEqual([]);
        expect(verseStructure(cargar('gr/EPH/1.json'), 7).flatMap(n => n.fronted)).toEqual([]);
        expect(fila(verseStructure(cargar('gr/JAS/1.json'), 5), 'Εἰ').fronted.map(f => f.role)).toEqual(['s']);
    });

    it('en hebreo lo antepuesto lleva la waw: Gn 1:2 וְהָאָרֶץ, Sal 1:2 וּבְתוֹרָתוֹ', () => {
        expect(fila(verseStructure(cargar('he/Gen/1.json'), 2), 'וְהָאָרֶץ').fronted.map(f => f.role)).toEqual(['s']);
        expect(fila(verseStructure(cargar('he/Ps/1.json'), 2), 'וּבְתוֹרָתוֹ').fronted.map(f => f.role)).toEqual(['pp']);
    });

    it('cada palabra del versículo una sola vez: Is 6:8 הִנְנִי (en dos hermanas) y Esd 4:11 (la conjunción del versículo anterior)', () => {
        for (const [rel, v] of [['he/Isa/6.json', 8], ['he/Ezra/4.json', 11], ['he/Gen/49.json', 15], ['gr/1JN/5.json', 6]] as const) {
            const ch = cargar(rel);
            const vista = verseStructure(ch, v).flatMap(n => n.words.map(w => w.r));
            expect(vista.slice().sort()).toEqual(verseWords(ch, v).map(w => w.r).sort());
        }
    });
});

describe('verseStructure — hebreo', () => {
    const rut1 = cargar('he/Ruth/1.json');
    const rut3 = cargar('he/Ruth/3.json');

    it('Rut 1:14: wayyiqtol encadenados y וְ + sujeto = disyuntiva (comentario del profesor)', () => {
        const ns = verseStructure(rut1, 14);
        expect(ns.slice(0, 3).map(n => n.relation)).toEqual(['chain', 'chain', 'chain']);
        // La waw de וַתִּבְכֶּינָה está en otra cláusula de MACULA: una sola fila.
        expect(ns.filter(n => texto(n).startsWith(limpio('וַתִּבְכֶּינָה')))).toHaveLength(1);
        expect(ns[ns.length - 1]).toMatchObject({ relation: 'disjunctive' });
        expect(texto(ns[ns.length - 1]!)).toMatch(/^ורות/);
    });

    it('Rut 1:16: discurso tras «dijo», כִּי suelta como conector, relativa tras אֲשֶׁר, asíndeton nominal', () => {
        const ns = verseStructure(rut1, 16);
        expect(fila(ns, 'אַל')).toMatchObject({ relation: 'speech' });
        expect(texto(fila(ns, 'אַל'))).toBe(limpio('אַל תִּפְגְּעִי בִי'));
        expect(fila(ns, 'לְעָזְבֵךְ')).toMatchObject({ relation: 'infinitival' });
        const ki = fila(ns, 'כִּי');
        expect(ki).toMatchObject({ relation: 'groundOrContent' });
        expect(limpio(conector(ki) ?? '')).toBe('כי');
        expect(fila(ns, 'תֵּלְכִי')).toMatchObject({ relation: 'relative', depth: ki.depth + 1 });
        expect(fila(ns, 'עַמֵּךְ')).toMatchObject({ relation: 'asyndetic', verbless: true });
        expect(fila(ns, 'וֵאלֹהַיִךְ')).toMatchObject({ relation: 'disjunctive', verbless: true });
    });

    it('Rut 1:17: la madre de una relativa no es relativa; כֹּה adelantado en la fórmula', () => {
        const ns = verseStructure(rut1, 17);
        expect(fila(ns, 'בַּאֲשֶׁר')).toMatchObject({ relation: 'asyndetic' });
        expect(fila(ns, 'תָּמוּתִי')).toMatchObject({ relation: 'relative' });
        expect(fila(ns, 'כֹּה').fronted.map(f => f.role)).toEqual(['adv']);
    });

    it('Rut 2:8: el discurso pasa del envoltorio הֲלוֹא a su cláusula; אַל + yusivo no es infinitival aunque lleve un infinitivo', () => {
        const ns = verseStructure(cargar('he/Ruth/2.json'), 8);
        expect(fila(ns, 'הֲלוֹא')).toMatchObject({ relation: 'speech' });
        expect(texto(fila(ns, 'אַל'))).toBe(limpio('אַל תֵּלְכִי'));
        expect(fila(ns, 'אַל')).toMatchObject({ relation: 'asyndetic' });
        expect(fila(ns, 'לִלְקֹט')).toMatchObject({ relation: 'infinitival' });
    });

    it('Rut 3:18: כִּי אִם es «sino / excepto», no causa', () => {
        const ns = verseStructure(rut3, 18);
        expect(fila(ns, 'כִּי אִם')).toMatchObject({ relation: 'contrast' });
    });

    it('Rut 3:13: אִם (que OSHB marca «C», como la waw) es condición; la apódosis está en las hermanas', () => {
        const ns = verseStructure(rut3, 13);
        expect(fila(ns, 'אִם')).toMatchObject({ relation: 'condition', isApodosis: false });
        expect(fila(ns, 'טוֹב')).toMatchObject({ isApodosis: true });
        expect(fila(ns, 'יִגְאָל')).toMatchObject({ isApodosis: true });
        expect(fila(ns, 'וְאִם')).toMatchObject({ relation: 'condition' });
        expect(fila(ns, 'וּגְאַלְתִּיךְ')).toMatchObject({ relation: 'conjunctive', isApodosis: true });
        expect(fila(ns, 'לִינִי')).toMatchObject({ isApodosis: false });
    });
});
