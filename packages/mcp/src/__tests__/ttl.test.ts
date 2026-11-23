import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Cada colección donde el almacén escribe `expiraEn` tiene su política de TTL
 * declarada en `firestore.indexes.json`; si no, lo vencido se acumula para siempre.
 */
const raiz = join(__dirname, '..', '..', '..', '..');
const almacen = readFileSync(join(__dirname, '..', 'oauth', 'almacen.ts'), 'utf8');
const indices = JSON.parse(readFileSync(join(raiz, 'firestore.indexes.json'), 'utf8')) as {
    fieldOverrides: Array<{ collectionGroup: string; fieldPath: string; ttl?: boolean }>;
};

describe('TTL de lo vencido', () => {
    it('toda colección que guarda `expiraEn` tiene TTL sobre ese campo', () => {
        // Las colecciones del almacén cuya escritura lleva `expiraEn`.
        const conExpira = new Set<string>();
        for (const m of almacen.matchAll(/collection\('(mcp_[a-z_]+)'\)[^;]*?expiraEn/gs)) conExpira.add(m[1]!);
        expect([...conExpira].sort()).toEqual(['mcp_auth_requests', 'mcp_codes', 'mcp_tokens']);
        const conTtl = new Set(indices.fieldOverrides.filter(f => f.fieldPath === 'expiraEn' && f.ttl === true).map(f => f.collectionGroup));
        for (const c of conExpira) expect(conTtl.has(c), c).toBe(true);
    });
});
