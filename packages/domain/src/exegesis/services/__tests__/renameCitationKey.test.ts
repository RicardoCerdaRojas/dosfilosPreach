import { describe, it, expect } from 'vitest';
import { guessSourceForOrphanKey, orphanCitationKeys, renameKeyInStep, renameKeyInText, renameKeyInValue } from '../renameCitationKey';

/** TP #6: la fuente se renombró «Aland» → «NA28» y lo generado siguió diciendo «Aland». */
describe('renombrar la clave en un texto', () => {
    it('REGRESIÓN: las formas reales del TP #6', () => {
        expect(renameKeyInText('expansión que facilitaría la transición (Aland, p. 722). Así', 'Aland', 'NA28'))
            .toBe('expansión que facilitaría la transición (NA28, p. 722). Así');
        expect(renameKeyInText('Se revisó el aparato NA28 provisto (Aland, 721–722).', 'Aland', 'NA28'))
            .toBe('Se revisó el aparato NA28 provisto (NA28, 721–722).');
        expect(renameKeyInText('depende del aparato de Aland y de la evidencia de Mayor', 'Aland', 'NA28'))
            .toBe('depende del aparato de NA28 y de la evidencia de Mayor');
    });

    it('si ya estaba la nueva al lado, queda una sola', () => {
        expect(renameKeyInText('Aland, NA28, p. 722, aparato de Santiago 3:2.', 'Aland', 'NA28')).toBe('NA28, p. 722, aparato de Santiago 3:2.');
    });

    it('sólo la palabra entera: no toca otra que la contenga', () => {
        expect(renameKeyInText('Alandia y Aland', 'Aland', 'NA28')).toBe('Alandia y NA28');
        expect(renameKeyInText('(Mayor, p. 14)', 'Aland', 'NA28')).toBe('(Mayor, p. 14)');
        expect(renameKeyInText('(Carson y Moo, p. 5)', 'Carson y Moo', 'Carson–Moo')).toBe('(Carson–Moo, p. 5)');
    });
});

describe('renombrar la clave en el análisis', () => {
    const analisis = {
        oldTestamentLinks: [{ sources: [{ sourceKey: 'Aland', page: 722 }, { sourceKey: 'Mayor', page: 14 }] }],
        textualCriticism: { note: 'registra dos variantes (Aland, 722).', variants: [{ apparatusReference: 'Aland, NA28, p. 722.' }] },
        fecha: new Date(2026, 9, 7),
        n: 3,
    };

    it('cambia los `sourceKey` y las menciones, sin tocar lo demás', () => {
        const r = renameKeyInValue(analisis, 'Aland', 'NA28');
        expect(r.oldTestamentLinks[0]!.sources.map(s => s.sourceKey)).toEqual(['NA28', 'Mayor']);
        expect(r.textualCriticism.note).toBe('registra dos variantes (NA28, 722).');
        expect(r.textualCriticism.variants[0]!.apparatusReference).toBe('NA28, p. 722.');
        expect(r.fecha).toBeInstanceOf(Date);
        expect(r.n).toBe(3);
    });

    it('las claves huérfanas: citadas y sin fuente en el corpus', () => {
        expect(orphanCitationKeys(analisis, [{ citationKey: 'NA28' }, { citationKey: 'Mayor' }])).toEqual(['Aland']);
        expect(orphanCitationKeys(renameKeyInValue(analisis, 'Aland', 'NA28'), [{ citationKey: 'NA28' }, { citationKey: 'Mayor' }])).toEqual([]);
    });
});

describe('renombrar la clave en un paso', () => {
    it('todas las versiones, y `current`/`accepted` apuntan a las renombradas', () => {
        const v1 = { id: 'v1', markdown: '(Aland, p. 722)', canonicalAnalysis: { claims: [{ sourceKey: 'Aland' }] } };
        const v2 = { id: 'v2', markdown: 'sin cita' };
        const step = { id: 's', versions: [v1, v2], current: v1, accepted: v1 } as never;
        const r = renameKeyInStep(step, 'Aland', 'NA28');
        expect(r.versions[0]!.markdown).toBe('(NA28, p. 722)');
        expect((r.versions[0]!.canonicalAnalysis as unknown as { claims: { sourceKey: string }[] }).claims[0]!.sourceKey).toBe('NA28');
        expect(r.current?.markdown).toBe('(NA28, p. 722)');
        expect(r.accepted).toBe(r.versions[0]);
        expect(r.versions[1]!.markdown).toBe('sin cita');
    });
});

describe('a qué fuente corresponde la clave huérfana', () => {
    const fuentes = [
        { citationKey: 'NA28', displayLabel: 'Novum Testamentum Graece -  Nestle-Aland (NA28)' },
        { citationKey: 'Mayor', displayLabel: 'The Epistle of James - the Greek text with Introduction' },
    ];
    it('REGRESIÓN (TP #6): «Aland» → la que dice «Nestle-Aland»', () => {
        expect(guessSourceForOrphanKey('Aland', fuentes)?.citationKey).toBe('NA28');
    });
    it('ninguna o varias: no adivina', () => {
        expect(guessSourceForOrphanKey('Ropes', fuentes)).toBeNull();
        expect(guessSourceForOrphanKey('James', [...fuentes, { citationKey: 'Moo', displayLabel: 'James (Pillar)' }])).toBeNull();
    });
});

