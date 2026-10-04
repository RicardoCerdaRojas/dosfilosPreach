import { describe, expect, it } from '@jest/globals';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Cada texto de la app existe en los dos idiomas (C5). Una clave que falta en
 * inglés no rompe nada en la prueba en español: se ve recién cuando un pastor
 * con el teléfono en inglés abre esa pantalla y lee la clave cruda.
 */
const LOCALES = join(__dirname, '../locales');

const keysOf = (value: unknown, prefix = ''): string[] =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? Object.entries(value).flatMap(([k, v]) => keysOf(v, prefix ? `${prefix}.${k}` : k))
        : [prefix];

const placeholders = (text: unknown) => [...String(text).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

describe('textos de la app en español e inglés', () => {
    const namespaces = readdirSync(join(LOCALES, 'es')).filter((f) => f.endsWith('.json'));

    it('los dos idiomas tienen los mismos archivos', () => {
        expect(readdirSync(join(LOCALES, 'en')).filter((f) => f.endsWith('.json')).sort()).toEqual([...namespaces].sort());
    });

    it.each(namespaces)('%s: mismas claves y mismas variables', (file) => {
        const es = JSON.parse(readFileSync(join(LOCALES, 'es', file), 'utf8')) as Record<string, unknown>;
        const en = JSON.parse(readFileSync(join(LOCALES, 'en', file), 'utf8')) as Record<string, unknown>;
        expect(keysOf(en).sort()).toEqual(keysOf(es).sort());
        const get = (obj: Record<string, unknown>, key: string) =>
            key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], obj);
        for (const key of keysOf(es)) {
            expect([key, placeholders(get(en, key))]).toEqual([key, placeholders(get(es, key))]);
        }
    });
});
