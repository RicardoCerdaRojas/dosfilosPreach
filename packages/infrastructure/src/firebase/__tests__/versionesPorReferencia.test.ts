import { describe, it, expect } from 'vitest';
import type { ExegeticalStep, ExegeticalStepVersion } from '@dosfilos/domain';
import { deserializeStep, serializeStep } from '../FirestoreExegeticalPaperRepository';

/**
 * `current` y `accepted` guardaban COPIAS ENTERAS de la versión —análisis
 * canónico incluido— de modo que cada versión podía quedar almacenada tres
 * veces.
 *
 * Medido sobre los 42 trabajos en producción: de 8.595 KB, 4.145 eran esa
 * duplicación. El trabajo más grande estaba en 932 KB contra el límite duro de
 * 1 MB por documento de Firestore —91%— y guardarlas por referencia lo deja
 * en 493.
 */
const version = (id: string, markdown = 'texto'): ExegeticalStepVersion =>
    ({ id, markdown, createdAt: new Date('2026-09-24') } as ExegeticalStepVersion);

const paso = (over: Partial<ExegeticalStep> = {}): ExegeticalStep => ({
    id: 's1', paperId: 'p1', kind: 'verse', verseRef: null, order: 1, state: 'accepted',
    versions: [version('v1'), version('v2')],
    current: version('v2'),
    accepted: version('v1'),
    createdAt: new Date(), updatedAt: new Date(),
    ...over,
} as ExegeticalStep);

describe('serializeStep', () => {
    it('guarda identificadores en vez de copias', () => {
        const out = serializeStep(paso());
        expect(out.currentId).toBe('v2');
        expect(out.acceptedId).toBe('v1');
        expect(out.current).toBeUndefined();
        expect(out.accepted).toBeUndefined();
        expect(out.versions).toHaveLength(2);
    });

    it('una referencia que no está en versions[] se agrega antes de referenciarla', () => {
        // Guardar sólo el identificador de algo que no está perdería el texto,
        // que es exactamente lo que este cambio no puede permitirse.
        const out = serializeStep(paso({ versions: [version('v2')], accepted: version('v9', 'texto perdido') }));
        expect((out.versions as ExegeticalStepVersion[]).map(v => v.id)).toEqual(['v2', 'v9']);
        expect(out.acceptedId).toBe('v9');
    });

    it('sin versión aceptada guarda null, no undefined', () => {
        // Firestore rechaza `undefined`.
        const out = serializeStep(paso({ accepted: null }));
        expect(out.acceptedId).toBeNull();
        expect(Object.values(out).some(v => v === undefined)).toBe(false);
    });
});

describe('deserializeStep', () => {
    it('resuelve las referencias contra versions[]', () => {
        const leido = deserializeStep(serializeStep(paso()));
        expect(leido.current?.id).toBe('v2');
        expect(leido.accepted?.id).toBe('v1');
        expect(leido.accepted?.markdown).toBe('texto');
    });

    it('la vuelta entera no pierde nada', () => {
        const antes = paso({ includeInDocument: false });
        const despues = deserializeStep(serializeStep(antes));
        expect(despues.includeInDocument).toBe(false);
        expect(despues.versions.map(v => v.id)).toEqual(['v1', 'v2']);
        expect(despues.current?.id).toBe(antes.current?.id);
    });

    it('un documento guardado ANTES del cambio se sigue leyendo', () => {
        // La forma vieja: objetos enteros, sin identificadores.
        const viejo = {
            id: 's1', kind: 'verse', order: 1, state: 'accepted',
            versions: [version('v1'), version('v2')],
            current: version('v2'),
            accepted: version('v1'),
        };
        const leido = deserializeStep(viejo);
        expect(leido.current?.id).toBe('v2');
        expect(leido.accepted?.id).toBe('v1');
    });

    it('una referencia rota cae a la copia vieja en vez de perder el texto', () => {
        const roto = {
            id: 's1', versions: [version('v2')],
            acceptedId: 'v9', accepted: version('v9', 'texto que no está en versions'),
        };
        expect(deserializeStep(roto).accepted?.markdown).toBe('texto que no está en versions');
    });

    it('un paso sin versiones no explota', () => {
        const leido = deserializeStep({ id: 's1' });
        expect(leido.current).toBeNull();
        expect(leido.accepted).toBeNull();
        expect(leido.versions).toEqual([]);
    });
});
