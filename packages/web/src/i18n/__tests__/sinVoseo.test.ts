import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Los textos en español de la app, sin voseo (regla del proyecto; fase H del
 * ejercicio de Jonás: «Podés corregirla», «Intentá de nuevo», «Vos escribís»).
 * «Lo escribí yo» es pretérito y no cuenta: no está en la lista.
 */
const VOSEO =
    /(?<![\wáéíóúñ])(sos|vos|podés|tenés|querés|sabés|escribís|intentá|revisá|volvé|andá|marcá|construí|decinos|hacé|decí|mirá|fijate|acá)(?![\wáéíóúñ])/i;

function* strings(value: unknown, path: string): Generator<[string, string]> {
    if (typeof value === 'string') yield [path, value];
    else if (value && typeof value === 'object')
        for (const [k, v] of Object.entries(value)) yield* strings(v, path ? `${path}.${k}` : k);
}

const DIR = join(__dirname, '..', 'locales', 'es');
// La app de tablet tiene sus propios textos; la misma regla (revisión adversarial de H).
const MOBILE = join(__dirname, '..', '..', '..', '..', 'mobile', 'src', 'core', 'i18n', 'locales', 'es');
const ARCHIVOS = [
    ...readdirSync(DIR).filter(f => f.endsWith('.json')).map(f => join(DIR, f)),
    ...readdirSync(MOBILE).filter(f => f.endsWith('.json')).map(f => join(MOBILE, f)),
];

describe('locales es sin voseo (web y tablet)', () => {
    it.each(ARCHIVOS)('%s', archivo => {
        const json = JSON.parse(readFileSync(archivo, 'utf8'));
        const hallazgos = [...strings(json, '')].filter(([, s]) => VOSEO.test(s)).map(([k, s]) => `${k}: ${s.slice(0, 80)}`);
        expect(hallazgos).toEqual([]);
    });
});
