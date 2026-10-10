/**
 * Lista todas las fuentes del registro (`ruleSources.ts`) con dónde se usan.
 * Salida JSON para `cotejar-citas.py` y para la lista de verificación.
 *
 *   cd packages/domain && npx vite-node scripts/listar-fuentes.mts > /tmp/fuentes.json
 */
import * as RS from '../src/language-structure/ruleSources';

const TABLAS = ['VERB_RULE_SOURCES', 'VERB_FUNCTION_SOURCES', 'TENSE_USE_SOURCES', 'DISCOURSE_RULE_SOURCES', 'NOMINAL_RULE_SOURCES', 'STRUCTURE_RULE_SOURCES', 'HEBREW_INFINITIVE_SOURCES'] as const;
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
