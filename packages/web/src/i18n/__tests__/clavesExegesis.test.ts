import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import es from '../locales/es/exegesis.json';
import en from '../locales/en/exegesis.json';

/**
 * Toda clave literal que pide un componente del namespace `exegesis` existe en
 * los dos idiomas.
 *
 * TP #8 (2026-10-21, #43): el aviso de bibliografía antes de exportar pedía
 * `detail.bibliography.gate.rubricTitle` y tres claves más que vivían en
 * `detail.bibliography.*`. i18next no falla: pinta la clave cruda, y el
 * fundador leyó «detail.bibliography.gate.rubricMissing» justo antes de
 * entregar. Las pruebas del componente no podían verlo porque simulan `t()` y
 * devuelven la clave tal cual.
 *
 * QUÉ CUBRE: las llamadas `t('clave')` y `t(cond ? 'a' : 'b')` con texto
 * literal, en los archivos que usan SÓLO el namespace `exegesis`.
 *
 * QUÉ NO CUBRE (revisión adversarial; medido el 2026-10-21):
 * - los archivos con más de un namespace (14, entre ellos `SourceViewerBody.tsx`);
 * - los que reciben `t` por props, sin `useTranslation` (36);
 * - los ternarios partidos en varias líneas o con paréntesis en la condición;
 * - `<Trans i18nKey>`, las claves de primer nivel sin punto y las armadas con
 *   plantillas (`t(\`sourceTypes.${x}.label\`)`), que no se resuelven leyendo
 *   el código.
 * Un verde aquí no garantiza que no falte ninguna clave: garantiza que no
 * falta ninguna de las que este escaneo ve.
 */
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../..'); // src/i18n/__tests__ → src
const SUFIJOS_PLURAL = ['', '_zero', '_one', '_two', '_few', '_many', '_other'];

function aplanar(obj: unknown, prefijo = '', fuera = new Set<string>()): Set<string> {
    if (obj && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
            const clave = prefijo ? `${prefijo}.${k}` : k;
            if (v && typeof v === 'object') aplanar(v, clave, fuera);
            else fuera.add(clave);
        }
    }
    return fuera;
}

function archivos(dir: string): string[] {
    return readdirSync(dir).flatMap(nombre => {
        const ruta = join(dir, nombre);
        if (statSync(ruta).isDirectory()) return nombre === '__tests__' || nombre === 'node_modules' ? [] : archivos(ruta);
        return /\.tsx?$/.test(nombre) && !/\.test\.tsx?$/.test(nombre) ? [ruta] : [];
    });
}

/** Las claves literales de un archivo que usa SOLO el namespace `exegesis`. */
export function clavesLiterales(fuente: string): string[] {
    const espacios = [...fuente.matchAll(/useTranslation\(\s*['"]([\w-]+)['"]/g)].map(m => m[1]);
    if (espacios.length === 0 || espacios.some(n => n !== 'exegesis')) return [];
    const claves = new Set<string>();
    for (const m of fuente.matchAll(/\bt\(\s*'([\w.:-]+)'/g)) claves.add(m[1]!);
    for (const m of fuente.matchAll(/\bt\(\s*[^'()\n]*?\?\s*'([\w.:-]+)'\s*:\s*'([\w.:-]+)'/g)) {
        claves.add(m[1]!);
        claves.add(m[2]!);
    }
    return [...claves]
        .map(c => (c.startsWith('exegesis:') ? c.slice('exegesis:'.length) : c))
        .filter(c => !c.includes(':') && c.includes('.'));
}

const existe = (claves: Set<string>, clave: string) => SUFIJOS_PLURAL.some(s => claves.has(clave + s));

describe('las claves de exegesis que pide el código existen', () => {
    it('reconoce una clave dentro de un ternario', () => {
        expect(clavesLiterales("const { t } = useTranslation('exegesis'); t(x ? 'a.b' : 'c.d');")).toEqual(['a.b', 'c.d']);
    });

    for (const [idioma, json] of Object.entries({ es, en })) {
        it(`${idioma}: ninguna clave literal falta`, () => {
            const claves = aplanar(json);
            const faltan = archivos(SRC).flatMap(ruta =>
                clavesLiterales(readFileSync(ruta, 'utf8'))
                    .filter(c => !existe(claves, c))
                    .map(c => `${relative(SRC, ruta)} → ${c}`));
            expect(faltan).toEqual([]);
        });
    }
});
