import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ChapterStructure } from '../chapterStructure';
import { verseStructure, type StructureNode } from '../verseStructure';

/**
 * U11a (revisión del profesor 2026-11, p. 15, 16 y 27): «Estructura» por frases, como el profesor
 * estructura Stg 2:14, 2:18 y 2:19. Cada caso del corpus que se rompía al medir las reglas va como
 * contraejemplo.
 */
const cargar = (rel: string): ChapterStructure =>
    JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../web/public/language-data/v1/${rel}`, import.meta.url)), 'utf8'));
const filas = (rel: string, v: number) => verseStructure(cargar(rel), v);
const texto = (n: StructureNode) => n.words.map(w => w.t).join(' ');
const fila = (ns: readonly StructureNode[], empieza: string) => ns.find(n => texto(n).startsWith(empieza))!;

describe('Estructura por frases (U11a, revisión del profesor)', () => {
    it('Stg 2:14: sin fila de sólo «ἐάν»; el infinitivo discontinuo va en línea; la prótasis es UN grupo de dos miembros', () => {
        const ns = filas('gr/JAS/2.json', 14);
        expect(ns.map(texto)).toEqual(['Τί ὄφελος, ἀδελφοί μου,', 'ἐὰν πίστιν λέγῃ τις ἔχειν', 'ἔργα δὲ μὴ ἔχῃ;', 'μὴ δύναται ἡ πίστις', 'σῶσαι αὐτόν;']);
        const [apodosis, p1, p2] = ns;
        expect(p1).toMatchObject({ relation: 'condition', conditionalClass: 3, depth: apodosis!.depth + 1 });
        expect(p2!.depth).toBe(p1!.depth);
        expect(p2!.conditionGroup).toBe(p1!.conditionGroup);
        expect(p1!.conditionGroup).toBeDefined();
        expect([p1!.isApodosis, p2!.isApodosis, apodosis!.isApodosis]).toEqual([false, false, true]);
    });

    it('Stg 2:19: las coordinadas al mismo nivel («καὶ τὰ δαιμόνια πιστεύουσιν» no cuelga de «καὶ φρίσσουσιν»)', () => {
        const ns = filas('gr/JAS/2.json', 19);
        const niveles = ['καλῶς', 'καὶ τὰ δαιμόνια', 'καὶ φρίσσουσιν'].map(x => fila(ns, x).depth);
        expect(new Set(niveles).size).toBe(1);
        expect(fila(ns, 'ὅτι').depth).toBe(fila(ns, 'σὺ').depth + 1);
    });

    it('Stg 2:18 y 2:16: lo que se dice después de un verbo de decir es «discurso directo», no «Principal»', () => {
        const ns = filas('gr/JAS/2.json', 18);
        expect(['Σὺ', 'κἀγὼ ἔργα'].map(x => fila(ns, x).relation)).toEqual(['speech', 'speech']);
        expect(fila(ns, 'δεῖξόν').relation).toBe('main');
        expect(fila(filas('gr/JAS/2.json', 16), 'Ὑπάγετε').relation).toBe('speech');
    });

    it('NO: la madre que es una relativa («ὅ σοι λέγομεν», Hch 21:23) no hace discurso a su objeto', () => {
        expect(fila(filas('gr/ACT/21.json', 23), 'τοῦτο').relation).not.toBe('speech');
    });

    it('NO en línea: lo que interrumpe a la hija es un vocativo (Heb 1:8) o el δέ pospositivo de la madre (Jn 5:7)', () => {
        expect(filas('gr/HEB/1.json', 8).some(n => texto(n).startsWith('Ὁ θρόνος'))).toBe(true);
        expect(filas('gr/JHN/5.json', 7).some(n => texto(n).startsWith('Κύριε, ἐν'))).toBe(false);
    });

    it('en línea también en hebreo, sin repetir la palabra de dos piezas (Nm 23:12 «הֲלֹא אֹתוֹ אֶשְׁמֹר לְדַבֵּר»)', () => {
        const ns = filas('he/Num/23.json', 12);
        const f = ns.find(n => n.relation === 'speech')!;
        expect(f.words.map(w => w.r)).toEqual([...new Set(f.words.map(w => w.r))]);
        expect(f.words.length).toBe(4);
    });

    it('griego: lo que está dentro de ἐάν es prótasis (Ap 3:20 «καὶ ἀνοίξῃ», Mc 12:19 «καταλίπῃ») — ya no «apódosis»', () => {
        const ap = filas('gr/REV/3.json', 20);
        expect(fila(ap, 'καὶ ἀνοίξῃ')).toMatchObject({ isApodosis: false, conditionGroup: fila(ap, 'ἐάν').conditionGroup });
        expect(fila(ap, 'καὶ εἰσελεύσομαι').isApodosis).toBe(true);
        expect(fila(filas('gr/MRK/12.json', 19), 'καὶ καταλίπῃ').isApodosis).toBe(false);
    });

    it('revisión adversarial: la cita alrededor de un «φησίν» parentético sigue en su fila, con su apódosis (Hch 25:5)', () => {
        const ns = filas('gr/ACT/25.json', 5);
        expect(fila(ns, 'Οἱ ἐν ὑμῖν').isApodosis).toBe(true);
        expect(ns.some(n => texto(n).startsWith('φησίν'))).toBe(true);
    });

    it('revisión adversarial: en el grupo no entra lo que no coordina («ἄρα», 1 Co 15:14) ni lo que va antes de la condición (2 S 14:32); 1 S 17:9 «וְהִכָּנִי» es miembro, no apódosis', () => {
        expect(fila(filas('gr/1CO/15.json', 14), 'ἄρα').conditionGroup).toBeUndefined();
        expect(filas('he/2Sam/14.json', 32).some(n => n.conditionGroup !== undefined)).toBe(false);
        const s = filas('he/1Sam/17.json', 9);
        const miembro = s.find(n => n.conditionGroup !== undefined && n.relation !== 'condition')!;
        expect(miembro.isApodosis).toBe(false);
    });

    it('pendientes: ἐάν PARTÍCULA no es condición — Mc 6:23 «Ὅ ἐάν με αἰτήσῃς» relativa, 2 Co 3:16 «ἡνίκα ἐάν» temporal; sin fila de sólo «ἐάν»', () => {
        const mc = filas('gr/MRK/6.json', 23);
        expect(fila(mc, 'Ὅ ἐάν').relation).toBe('relative');
        expect(mc.some(n => n.relation === 'condition')).toBe(false);
        expect(fila(filas('gr/2CO/3.json', 16), 'ἡνίκα ἐὰν').relation).toBe('time');
        // 1 Co 11:26 «ὁσάκις γὰρ ἐὰν ἐσθίητε»: ya no es condición; la fila lleva la relación de su γάρ.
        expect(fila(filas('gr/1CO/11.json', 26), 'ὁσάκις').relation).toBe('ground');
        expect(filas('gr/COL/3.json', 17).some(n => texto(n) === 'ἐὰν')).toBe(false);
    });

    it('pendientes: una coordinación de varios conectores pone cada uno en su cláusula, en el orden del texto (Mc 12:19, Mt 1:13, Jn 10:28)', () => {
        expect(filas('gr/MRK/12.json', 19).filter(n => n.conditionGroup !== undefined).map(texto))
            .toEqual(['ἐάν τινος ἀδελφὸς ἀποθάνῃ', 'καὶ καταλίπῃ γυναῖκα', 'καὶ μὴ ἀφῇ τέκνον,']);
        expect(filas('gr/MAT/1.json', 13).map(texto)).toEqual([
            'Ζοροβαβὲλ δὲ ἐγέννησεν τὸν Ἀβιούδ,', 'Ἀβιοὺδ δὲ ἐγέννησεν τὸν Ἐλιακίμ,', 'Ἐλιακὶμ δὲ ἐγέννησεν τὸν Ἀζώρ,',
        ]);
        expect(filas('gr/JHN/10.json', 28).every(n => !texto(n).startsWith('καὶ καὶ'))).toBe(true);
        // Revisión adversarial: la palabra que sigue al καί está en una NIETA (el participio sujeto, Lc 11:10).
        expect(filas('gr/LUK/11.json', 10).filter(n => n.relation === 'addition').map(texto)).toEqual(['καὶ εὑρίσκει,', 'καὶ ἀνοιγήσεται.']);
    });

    it('hebreo: אִם puede envolver la oración entera — la apódosis no entra al grupo (Am 9:3); Lv 13:28, prótasis de tres', () => {
        expect(filas('he/Amos/9.json', 3).some(n => n.conditionGroup !== undefined)).toBe(false);
        const lv = filas('he/Lev/13.json', 28);
        expect(lv.filter(n => n.conditionGroup !== undefined)).toHaveLength(3);
        expect(lv.filter(n => n.conditionGroup !== undefined).some(n => n.isApodosis)).toBe(false);
    });
});
