import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NOT_PERSONAL, OWNED_BY_DOC_ID, OWNED_BY_EMAIL, OWNED_BY_FIELD } from '../ownedData';

/**
 * Invariante del borrado de cuenta: TODA colección de `firestore.rules` está
 * clasificada — del usuario (por campo o por id), por email, o no personal con
 * su motivo. Una colección nueva con datos de usuario que nadie agregue a la
 * lista hace fallar esto, en vez de sobrevivir al borrado sin que nadie se
 * entere.
 */
const RULES = readFileSync(join(__dirname, '../../../../../firestore.rules'), 'utf8');

interface RuleBlock {
    collection: string;
    variable: string;
    body: string;
}

function topLevelBlocks(): RuleBlock[] {
    const lines = RULES.split('\n');
    const blocks: RuleBlock[] = [];
    for (let i = 0; i < lines.length; i++) {
        const m = /^ {4}match \/([A-Za-z_]+)\/\{([A-Za-z_=*]+)\}/.exec(lines[i]!);
        if (!m) continue;
        let depth = 0;
        const body: string[] = [];
        for (let j = i; j < lines.length; j++) {
            body.push(lines[j]!);
            depth += (lines[j]!.match(/\{/g) ?? []).length - (lines[j]!.match(/\}/g) ?? []).length;
            if (depth <= 0 && j > i) break;
        }
        blocks.push({ collection: m[1]!, variable: m[2]!, body: body.join('\n') });
    }
    return blocks;
}

const byField = new Map(OWNED_BY_FIELD.map((o) => [o.collection, o.field]));
const byEmail = new Set(OWNED_BY_EMAIL.map((o) => o.collection));
const byDocId = new Set(OWNED_BY_DOC_ID);

describe('borrado de cuenta ↔ firestore.rules', () => {
    const blocks = topLevelBlocks();

    it('el parseo encuentra las colecciones', () => {
        expect(blocks.length).toBeGreaterThan(40);
        expect(blocks.map((b) => b.collection)).toContain('sermons');
    });

    it('toda colección está clasificada (del usuario, por email o no personal con motivo)', () => {
        const sinClasificar = [...new Set(blocks.map((b) => b.collection))].filter(
            (c) => !byField.has(c) && !byDocId.has(c) && !byEmail.has(c) && !(c in NOT_PERSONAL),
        );
        expect(sinClasificar, `Clasificar en account/ownedData.ts: ${sinClasificar.join(', ')}`).toEqual([]);
    });

    it('si la regla nombra un dueño por campo, el borrado usa ESE campo', () => {
        const mal: string[] = [];
        for (const b of blocks) {
            for (const field of ['userId', 'ownerId']) {
                if (!new RegExp(`resource\\.data\\.${field}\\b`).test(b.body)) continue;
                if (byDocId.has(b.collection)) continue;
                if (byField.get(b.collection) !== field) mal.push(`${b.collection}.${field}`);
            }
        }
        expect(mal).toEqual([]);
    });

    it('si el id del documento es el dueño, se borra por id', () => {
        const esc = (v: string) => v.replace(/[.*+?^${}()|[\]\\=]/g, '\\$&');
        const mal = blocks
            .filter((b) => !b.variable.includes('='))
            .filter((b) => new RegExp(`isOwner\\(${esc(b.variable)}\\)|request\\.auth\\.uid == ${esc(b.variable)}\\b`).test(b.body))
            .map((b) => b.collection)
            .filter((c) => !byDocId.has(c));
        expect([...new Set(mal)]).toEqual([]);
    });

    it('nada está en dos listas a la vez', () => {
        const personales = [...byField.keys(), ...byDocId, ...byEmail];
        expect(personales.filter((c) => c in NOT_PERSONAL)).toEqual([]);
    });
});
