import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
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
        // El οὖν va en su fila, tras la palabra que lo precede (pendientes de «Estructura», 2026-11-13).
        expect(fila(ns, 'Οἱ οὖν ἐν ὑμῖν').isApodosis).toBe(true);
        expect(ns.some(n => texto(n).startsWith('φησίν'))).toBe(true);
    });

    it('revisión adversarial: en el grupo no entra lo que no coordina («ἄρα», 1 Co 15:14) ni lo que va antes de la condición (2 S 14:32); 1 S 17:9 «וְהִכָּנִי» es miembro, no apódosis', () => {
        expect(fila(filas('gr/1CO/15.json', 14), 'κενὸν ἄρα').conditionGroup).toBeUndefined();
        expect(filas('he/2Sam/14.json', 32).some(n => n.conditionGroup !== undefined)).toBe(false);
        const s = filas('he/1Sam/17.json', 9);
        const miembro = s.find(n => n.conditionGroup !== undefined && n.relation !== 'condition')!;
        expect(miembro.isApodosis).toBe(false);
    });

    it('pendientes: ἐάν PARTÍCULA no es condición — Mc 6:23 «Ὅ ἐάν με αἰτήσῃς» relativa, 2 Co 3:16 «ἡνίκα ἐάν» temporal; sin fila de sólo «ἐάν»', () => {
        const mc = filas('gr/MRK/6.json', 23);
        expect(fila(mc, 'Ὅ ἐάν').relation).toBe('relative');
        expect(mc.some(n => n.relation === 'condition')).toBe(false);
        expect(fila(filas('gr/2CO/3.json', 16), 'ἡνίκα δὲ ἐὰν').relation).toBe('time');
        // 1 Co 11:26 «ὁσάκις γὰρ ἐὰν ἐσθίητε»: ya no es condición; la fila lleva la relación de su γάρ.
        expect(fila(filas('gr/1CO/11.json', 26), 'ὁσάκις').relation).toBe('ground');
        expect(filas('gr/COL/3.json', 17).some(n => texto(n) === 'ἐὰν')).toBe(false);
    });

    it('pendientes: una coordinación de varios conectores pone cada uno en su cláusula, en el orden del texto (Mc 12:19, Mt 1:13, Jn 10:28)', () => {
        expect(filas('gr/MRK/12.json', 19).filter(n => n.conditionGroup !== undefined).map(texto))
            .toEqual(['ὅτι ἐάν τινος ἀδελφὸς ἀποθάνῃ', 'καὶ καταλίπῃ γυναῖκα', 'καὶ μὴ ἀφῇ τέκνον,']);
        expect(filas('gr/MAT/1.json', 13).map(texto)).toEqual([
            'Ζοροβαβὲλ δὲ ἐγέννησεν τὸν Ἀβιούδ,', 'Ἀβιοὺδ δὲ ἐγέννησεν τὸν Ἐλιακίμ,', 'Ἐλιακὶμ δὲ ἐγέννησεν τὸν Ἀζώρ,',
        ]);
        expect(filas('gr/JHN/10.json', 28).every(n => !texto(n).startsWith('καὶ καὶ'))).toBe(true);
        // La palabra que sigue al καί está en una NIETA, el participio sujeto (Lc 11:10): el καί va con él, en el
        // orden del texto, y la relación «adición» a su verbo, que es la oración que une.
        const lc = filas('gr/LUK/11.json', 10);
        expect(lc.filter(n => n.relation === 'addition').map(texto)).toEqual(['εὑρίσκει,', 'ἀνοιγήσεται.']);
        expect(lc.filter(n => n.relation === 'participial').map(texto)).toEqual(['ὁ αἰτῶν', 'καὶ ὁ ζητῶν', 'καὶ τῷ κρούοντι']);
    });

    it('hebreo: אִם puede envolver la oración entera — la apódosis no entra al grupo (Am 9:3); Lv 13:28, prótasis de tres', () => {
        expect(filas('he/Amos/9.json', 3).some(n => n.conditionGroup !== undefined)).toBe(false);
        const lv = filas('he/Lev/13.json', 28);
        expect(lv.filter(n => n.conditionGroup !== undefined)).toHaveLength(3);
        expect(lv.filter(n => n.conditionGroup !== undefined).some(n => n.isApodosis)).toBe(false);
    });
});

/**
 * Pendientes de «Estructura» (2026-11-13). El conector va en la fila donde sigue el texto (o, si es
 * pospositivo, en la de la palabra que lo precede), y su relación va a la oración que une. Antes quedaban
 * 2.612 filas griegas de sólo conector («καὶ» sobre 1 Co 10:3, «γὰρ» sobre Mt 6:24) y 17 con la conjunción
 * repetida («καὶ καὶ καὶ ἀποκτενοῦσιν»).
 */
describe('pendientes de «Estructura»: el conector en su fila, en el orden del texto', () => {
    it('el conector se funde aunque MACULA ponga un nodo vacío en medio (1 Co 10:3) o la palabra esté en una nieta (1 Co 11:3)', () => {
        expect(filas('gr/1CO/10.json', 3).map(texto)).toEqual(['καὶ πάντες τὸ αὐτὸ πνευματικὸν βρῶμα ἔφαγον']);
        expect(fila(filas('gr/1CO/11.json', 3), 'θέλω δὲ').relation).toBe('development');
    });

    it('la prótasis antepuesta recibe el conector y sigue siendo condición; la relación va a la apódosis (Mc 3:24, 1 Co 14:6)', () => {
        const mc = filas('gr/MRK/3.json', 24);
        expect(mc.map(texto)).toEqual(['καὶ ἐὰν βασιλεία ἐφ’ ἑαυτὴν μερισθῇ,', 'οὐ δύναται σταθῆναι ἡ βασιλεία ἐκείνη·']);
        expect(mc[0]).toMatchObject({ relation: 'condition', conditionalClass: 3 });
        expect(mc[1]).toMatchObject({ relation: 'addition', isApodosis: true });
        // El δέ de «Νῦν δέ» no le quita a la prótasis su ἐάν: primero se funden los que subordinan.
        expect(fila(filas('gr/1CO/14.json', 6), 'Νῦν δέ')).toMatchObject({ relation: 'condition' });
        // Un γάρ no entra antes de que el εἰ se funda (Ro 11:24), y el εἰ pasa por encima del καί que MACULA
        // dejó en el primer miembro (Hch 25:11 «εἰ μὲν οὖν ἀδικῶ καὶ…»).
        expect(fila(filas('gr/ROM/11.json', 24), 'εἰ γὰρ σὺ')).toMatchObject({ relation: 'condition', conditionalClass: 1 });
        expect(fila(filas('gr/ACT/25.json', 11), 'εἰ μὲν οὖν')).toMatchObject({ relation: 'condition' });
        // Lo mismo el ὡς temporal sobre el καί «también» de su fila (Hch 16:15 «ὡς δὲ ἐβαπτίσθη καὶ ὁ οἶκος»).
        expect(fila(filas('gr/ACT/16.json', 15), 'ὡς δὲ').relation).toBe('comparison');
    });

    it('el pospositivo ESPERA a que se funda lo que hay en el camino: va con su palabra (Hch 8:35 «ἀνοίξας δὲ»), y su relación a la principal (1 Co 12:12 «οὕτως καὶ ὁ Χριστός», Ro 11:12)', () => {
        const hch = filas('gr/ACT/8.json', 35);
        expect(hch.map(texto).slice(0, 2)).toEqual(['ἀνοίξας δὲ τὸ στόμα αὐτοῦ', 'ὁ Φίλιππος εὐηγγελίσατο αὐτῷ τὸν Ἰησοῦν.']);
        expect(hch[1]!.relation).toBe('development');
        expect(fila(filas('gr/1CO/12.json', 12), 'οὕτως').relation).toBe('ground');
        expect(fila(filas('gr/ROM/11.json', 12), 'πόσῳ')).toMatchObject({ relation: 'development', isApodosis: true });
    });

    it('dos conectores en una fila, como en el texto: «ἢ γὰρ τὸν ἕνα μισήσει» (Mt 6:24), «ὃς γὰρ ἐὰν ἐπαισχυνθῇ» (Mc 8:38)', () => {
        const mt = filas('gr/MAT/6.json', 24);
        expect(mt.some(n => texto(n) === 'γὰρ')).toBe(false);
        expect(fila(mt, 'ἢ γὰρ τὸν ἕνα')).toMatchObject({ relation: 'alternative' });
        expect(texto(filas('gr/MRK/8.json', 38)[0]!)).toMatch(/^ὃς γὰρ ἐὰν ἐπαισχυνθῇ/);
    });

    it('NO: lo que trae palabras no se pega («οὐδὲ τοῖς μετ’ αὐτοῦ», Mt 12:4; «πρὸς δὲ τὸν υἱόν», Heb 1:8) ni el εἰ deja a su vocativo (Hch 1:6)', () => {
        expect(fila(filas('gr/MAT/12.json', 4), 'εἰ μὴ').relation).toBe('exception');
        expect(filas('gr/HEB/1.json', 8).map(texto)[0]).toBe('πρὸς δὲ τὸν υἱόν·');
        expect(fila(filas('gr/ACT/1.json', 6), 'Κύριε, εἰ').relation).toBe('condition');
    });

    it('«μέν … δέ»: cada uno con su miembro (1 Co 1:23 «Ἰουδαίοις μὲν σκάνδαλον, ἔθνεσιν δὲ μωρίαν»)', () => {
        const ns = filas('gr/1CO/1.json', 23);
        expect(ns.map(texto)).toContain('Ἰουδαίοις μὲν σκάνδαλον');
        expect(fila(ns, 'ἔθνεσιν δὲ').relation).toBe('development');
    });

    it('sin la conjunción repetida: cada καί va a su miembro (Mc 10:34, Mt 13:15) y la coordinada que sigue queda a su nivel (2 Co 4:9)', () => {
        expect(filas('gr/MRK/10.json', 34).map(texto)).toEqual([
            'καὶ ἐμπαίξουσιν αὐτῷ', 'καὶ ἐμπτύσουσιν αὐτῷ', 'καὶ μαστιγώσουσιν αὐτὸν', 'καὶ ἀποκτενοῦσιν,', 'καὶ μετὰ τρεῖς ἡμέρας ἀναστήσεται.',
        ]);
        expect(filas('gr/MAT/13.json', 15).map(texto)).toContain('καὶ τῇ καρδίᾳ συνῶσιν');
        const co = filas('gr/2CO/4.json', 9);
        expect(co.map(n => [texto(n), n.relation, n.depth])).toEqual([
            ['διωκόμενοι', 'participial', 0], ['ἀλλ’ οὐκ ἐγκαταλειπόμενοι,', 'contrast', 0],
            ['καταβαλλόμενοι', 'participial', 0], ['ἀλλ’ οὐκ ἀπολλύμενοι,', 'contrast', 0],
        ]);
    });

    it('Stg 2:18, como el profesor: «κἀγώ σοι δείξω» al margen, coordinada de «δεῖξόν μοι»; «κἀγὼ ἔργα ἔχω» sigue en la cita', () => {
        const ns = filas('gr/JAS/2.json', 18);
        expect(fila(ns, 'κἀγώ σοι')).toMatchObject({ relation: 'addition', depth: fila(ns, 'δεῖξόν').depth });
        expect(fila(ns, 'κἀγὼ ἔργα')).toMatchObject({ relation: 'speech', depth: fila(ns, 'Σὺ').depth });
        // Tras καθώς, κἀγώ abre la principal del correlativo (Jn 10:15): no es «adición».
        expect(fila(filas('gr/JHN/10.json', 15), 'κἀγὼ').relation).toBe('main');
    });

    it('revisión adversarial: un conector rotula UNA fila (Mc 16:16); el pospositivo del reparto se queda con su palabra (Lc 11:35); la crasis no le gana a un δέ (Mt 16:18)', () => {
        const mc = filas('gr/MRK/16.json', 16);
        expect(mc.filter(n => n.connector).map(n => n.relation)).toEqual(['addition', 'development']);
        expect(fila(mc, 'σωθήσεται').relation).toBe('main');
        expect(texto(filas('gr/LUK/11.json', 35)[0]!)).toBe('σκόπει οὖν');
        expect(fila(filas('gr/MAT/16.json', 18), 'κἀγὼ δέ').relation).toBe('development');
        // Si la madre se queda con otro conector, toma SU relación (1 Co 14:33 «οὐ γάρ … ἀλλὰ εἰρήνης»).
        const co = fila(filas('gr/1CO/14.json', 33), 'οὐ γάρ');
        const par = [co.words.find(w => w.r === co.connector)?.t, co.relation];
        expect([['γάρ', 'ground'], ['ἀλλὰ', 'contrast']]).toContainEqual(par);
    });

    it('revisión adversarial: la prótasis conserva su sangría junto a una crasis (2 Ti 2:12); el participio no se lleva el «δέ» de una prótasis (Gá 2:17); nada queda huérfano (Ro 4:23, Hch 4:32)', () => {
        const ti = filas('gr/2TI/2.json', 12);
        const conds = ti.filter(n => n.relation === 'condition');
        expect(new Set(conds.map(n => n.depth)).size).toBe(1);
        expect(fila(ti, 'κἀκεῖνος').depth).toBe(conds[0]!.depth - 1);
        expect(fila(filas('gr/GAL/2.json', 17), 'εἰ δὲ ζητοῦντες').relation).toBe('participial');
        expect(texto(filas('gr/ROM/4.json', 23)[0]!)).toBe('Οὐκ ἐγράφη δὲ δι’ αὐτὸν μόνον');
        expect(filas('gr/ACT/4.json', 32).some(n => texto(n) === 'δὲ')).toBe(false);
    });

    it('INVARIANTE en el NT: sin conjunción repetida al comienzo; filas de sólo conector, a lo sumo 15 (correlativos que abarcan dos cláusulas); un conector, una fila; ninguna fila pasa de 5 niveles', () => {
        const CON = new Set(['καί', 'δέ', 'ἀλλά', 'γάρ', 'οὖν', 'ἤ', 'τε', 'ἵνα', 'ὅτι', 'εἰ', 'ἐάν', 'ὅπως', 'ὥστε', 'ὡς', 'καθώς', 'ὅτε', 'ὅταν', 'οὐδέ', 'μηδέ', 'διό', 'πλήν', 'ἄρα', 'διότι', 'ἐπεί', 'μέν']);
        const raiz = fileURLToPath(new URL('../../../../web/public/language-data/v1/gr/', import.meta.url));
        let solas = 0;
        const repetidas: string[] = [];
        let hondo = 0;
        const dobles: string[] = [];
        for (const libro of readdirSync(raiz)) for (const cap of readdirSync(`${raiz}${libro}`)) {
            const ch = cargar(`gr/${libro}/${cap}`);
            const lema = new Map(ch.words.map(w => [w.r, w.l]));
            for (const v of new Set(ch.words.map(w => Number(w.r.split('!')[0])))) {
                const ns = verseStructure(ch, v);
                const base = Math.min(...ns.map(n => n.depth));
                for (const n of ns) {
                    const ls = n.words.map(w => lema.get(w.r) ?? '');
                    if (ls.length && ls.every(l => CON.has(l))) solas++;
                    if (ls.length > 1 && !n.words[0]!.role && !n.words[1]!.role && CON.has(ls[0]!) && ls[0] === ls[1]) repetidas.push(`${libro} ${cap} ${v}`);
                    hondo = Math.max(hondo, n.depth - base);
                }
                const cs = ns.map(n => n.connector).filter(Boolean);
                if (new Set(cs).size !== cs.length) dobles.push(`${libro} ${cap} ${v}`);
            }
        }
        expect(repetidas).toEqual([]);
        // Un mismo conector no rotula dos filas (revisión adversarial: 202 versículos lo hacían).
        expect(dobles).toEqual([]);
        expect(solas).toBeLessThanOrEqual(15);
        expect(hondo).toBeLessThanOrEqual(5);
    }, 120_000);
});
