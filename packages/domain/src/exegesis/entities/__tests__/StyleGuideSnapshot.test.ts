import { describe, it, expect } from 'vitest';
import { resolveStyleGuide, type StyleGuideSnapshot } from '../StyleGuideSnapshot';
import type { StyleGuideManifest } from '../StyleGuideManifest';

const manifiesto = (marca: string) => ({ citationTemplates: { full: marca } } as unknown as StyleGuideManifest);

const copia: StyleGuideSnapshot = {
    sourceGuideId: 'guia-tms',
    displayName: 'TMS 2024-25',
    version: '2024-25',
    manifest: manifiesto('original'),
    capturedAt: new Date('2026-09-01T10:00:00Z'),
};

describe('resolveStyleGuide', () => {
    it('la copia del trabajo manda sobre la guía viva', () => {
        // Es el punto entero: un paper entregado no cambia de reglas
        // porque alguien corrigió la plantilla después.
        const r = resolveStyleGuide(copia, { displayName: 'TMS 2025-26', manifest: manifiesto('editado') });
        expect(r.manifest).toEqual(manifiesto('original'));
        expect(r.displayName).toBe('TMS 2024-25');
        expect(r.origin).toBe('snapshot');
    });

    it('avisa cuando la guía viva cambió, sin cambiar nada', () => {
        const r = resolveStyleGuide(copia, { displayName: 'TMS', manifest: manifiesto('editado') });
        expect(r.liveGuideDiffers).toBe(true);
    });

    it('no avisa cuando la guía viva es idéntica', () => {
        const r = resolveStyleGuide(copia, { displayName: 'TMS', manifest: manifiesto('original') });
        expect(r.liveGuideDiffers).toBe(false);
    });

    it('los papers anteriores a la copia siguen resolviendo contra la guía viva', () => {
        const r = resolveStyleGuide(null, { displayName: 'TMS', manifest: manifiesto('viva') });
        expect(r.origin).toBe('live');
        expect(r.manifest).toEqual(manifiesto('viva'));
        expect(r.liveGuideDiffers).toBe(false);
    });

    it('sin guía de ninguna clase, no hay reglas y se dice', () => {
        expect(resolveStyleGuide(null, null)).toEqual({
            manifest: null, displayName: null, origin: 'none', liveGuideDiffers: false,
        });
    });

    it('una copia sin manifiesto sigue siendo la copia, no un hueco', () => {
        // Se adjuntó una guía cuya extracción no había terminado: la
        // composición cae a su comportamiento sin manifiesto, pero el
        // trabajo NO vuelve a mirar la guía viva por su cuenta.
        const sinManifiesto = { ...copia, manifest: null };
        const r = resolveStyleGuide(sinManifiesto, { displayName: 'TMS', manifest: manifiesto('viva') });
        expect(r.origin).toBe('snapshot');
        expect(r.manifest).toBeNull();
        expect(r.liveGuideDiffers).toBe(true);
    });
});

/**
 * El aviso «la guía cambió desde que se adjuntó» salía siempre, aun con la
 * copia tomada ese día: Firestore devuelve las claves en otro orden y las
 * fechas como Timestamp (TP Santiago 2:14-26).
 */
describe('resolveStyleGuide — la misma guía no «cambió»', () => {
    const base = { citationStyleLabel: 'TMS 2024-25', extractedAt: new Date('2026-09-30T12:00:00Z'), footnotes: { ibid: true, short: 'x' } };
    const snapshot = { manifest: base, displayName: 'TMS', guideId: 'g', attachedAt: new Date() } as never;

    it('claves en otro orden y la fecha como Timestamp: igual', () => {
        const releida = {
            footnotes: { short: 'x', ibid: true },
            extractedAt: { seconds: Date.parse('2026-09-30T12:00:00Z') / 1000, nanoseconds: 0 },
            citationStyleLabel: 'TMS 2024-25',
        };
        expect(resolveStyleGuide(snapshot, { displayName: 'TMS', manifest: releida as never }).liveGuideDiffers).toBe(false);
    });

    it('la fecha como texto ISO: igual', () => {
        const releida = { ...base, extractedAt: '2026-09-30T12:00:00.000Z' };
        expect(resolveStyleGuide(snapshot, { displayName: 'TMS', manifest: releida as never }).liveGuideDiffers).toBe(false);
    });

    it('un cambio de verdad sí se avisa', () => {
        const otra = { ...base, citationStyleLabel: 'SBL 2' };
        expect(resolveStyleGuide(snapshot, { displayName: 'TMS', manifest: otra as never }).liveGuideDiffers).toBe(true);
    });
});
