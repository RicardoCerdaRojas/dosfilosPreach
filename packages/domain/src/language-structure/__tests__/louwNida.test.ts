import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LOUW_NIDA_DOMAINS, LOUW_NIDA_SUBDOMAINS, louwNidaSense, louwNidaSenses } from '../louwNida';
import { formatCitation, louwNidaSources } from '../ruleSources';
import { verseWords, type ChapterStructure } from '../chapterStructure';

const cargar = (rel: string): ChapterStructure =>
    JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../web/public/language-data/v1/${rel}`, import.meta.url)), 'utf8'));

describe('Louw-Nida (U3c, revisión del profesor)', () => {
    it('Stg 2:10 ἐν ἑνί: el dato trae 89.5, y 89.5 es Relaciones › Especificación', () => {
        const ws = verseWords(cargar('gr/JAS/2.json'), 10);
        expect(ws.find(w => w.l === 'ἐν')?.ln).toBe('89.5');
        const s = louwNidaSense('89.5')!;
        expect([s.domain.n, s.domain.en, s.subdomain?.en]).toEqual([89, 'Relations', 'Specification']);
        expect(formatCitation(louwNidaSources(s)[0]!)).toBe('Louw y Nida, «89 Relations › Specification (89.4-89.7)», p. 777');
    });

    it('Stg 2:16 ἐξ ὑμῶν: 63.20, Todo y parte › Parte (respalda el partitivo de U3b)', () => {
        expect(louwNidaSense('63.20')!.subdomain?.en).toBe('Part');
    });

    it('dos códigos son dos lecturas (Stg 2:21 «89.25 89.77»: causa y medio); lo ilegible se descarta', () => {
        expect(louwNidaSenses('89.25 89.77').map(s => s.subdomain?.en)).toEqual(['Cause and/or Reason', 'Means']);
        expect(louwNidaSenses('basura 99.1')).toEqual([]);
        expect(louwNidaSenses(undefined)).toEqual([]);
    });

    it('un dominio sin subdominios cargados se cita por el dominio (37 Control, Rule)', () => {
        const s = louwNidaSense('37.10')!;
        expect(s.subdomain).toBeUndefined();
        expect(formatCitation(louwNidaSources(s)[0]!)).toBe('Louw y Nida, «37 Control, Rule», p. 472');
    });

    it('la tabla está completa y sin huecos: 93 dominios en orden; los subdominios de cada dominio no se pisan', () => {
        expect(LOUW_NIDA_DOMAINS.map(d => d.n)).toEqual(Array.from({ length: 93 }, (_, i) => i + 1));
        for (const d of new Set(LOUW_NIDA_SUBDOMAINS.map(s => s.domain))) {
            const ss = LOUW_NIDA_SUBDOMAINS.filter(s => s.domain === d);
            for (let k = 1; k < ss.length; k++) expect(ss[k]!.from, `${d}`).toBeGreaterThan(ss[k - 1]!.to);
        }
    });

    it('en todo el NT, los códigos de las preposiciones se entienden (dominio conocido)', () => {
        for (const libro of ['JAS', 'ROM', 'JHN']) {
            for (let c = 1; c <= 3; c++) {
                for (const w of cargar(`gr/${libro}/${c}.json`).words) {
                    if (!w.ln) continue;
                    for (const code of w.ln.split(/\s+/)) expect(louwNidaSense(code), `${libro} ${w.r} ${code}`).toBeDefined();
                }
            }
        }
    });
});
