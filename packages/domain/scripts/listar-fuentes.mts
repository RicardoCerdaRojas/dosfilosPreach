/**
 * Lista todas las fuentes del registro (`ruleSources.ts`) con dónde se usan.
 * Salida JSON para `cotejar-citas.py` y para la lista de verificación.
 *
 *   cd packages/domain && npx vite-node scripts/listar-fuentes.mts > /tmp/fuentes.json
 */
import * as RS from '../src/language-structure/ruleSources';

// TODAS las tablas «*_SOURCES», como la prueba de CI: una lista escrita a mano dejaba fuera las nuevas
// (TENSE_RULE_SOURCES de U7 y las de U5/U3a no se habían cotejado; revisión del profesor, 2026-11-12).
const TABLAS = Object.keys(RS).filter(k => k.endsWith('_SOURCES'));
const porFuente = new Map<string, { fuente: RS.RuleSource; usos: string[] }>();
const visitar = (x: unknown, ruta: string) => {
    if (Array.isArray(x)) x.forEach(y => visitar(y, ruta));
    else if (x && typeof x === 'object') {
        if ('work' in x && 'topic' in x) {
            const f = x as RS.RuleSource;
            const clave = `${f.work}|${f.section}`;
            const e = porFuente.get(clave) ?? { fuente: f, usos: [] };
            e.usos.push(ruta);
            porFuente.set(clave, e);
        } else for (const [k, v] of Object.entries(x)) visitar(v, ruta ? `${ruta}.${k}` : k);
    }
};
for (const t of TABLAS) visitar((RS as Record<string, unknown>)[t], t);
console.log(JSON.stringify([...porFuente.values()].map(e => ({ ...e.fuente, usos: e.usos })), null, 1));
