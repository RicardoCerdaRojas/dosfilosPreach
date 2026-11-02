import { describe, expect, it } from 'vitest';
import {
    stepAfterVersionMove,
    stepHistoryMoves,
    stepVersionNumbers,
    swapPreviousProse,
    versionsToKeepOnAppend,
    withRecomposedProse,
    type ExegeticalStep,
    type ExegeticalStepVersion,
} from '../ExegeticalStep';

/** Deshacer «Regenerar» (decisión del fundador, 2026-11-02). */
const version = (id: string, over: Partial<ExegeticalStepVersion> = {}) =>
    ({ id, markdown: `prosa ${id}`, parentVersionId: null, origin: 'generated', ...over }) as ExegeticalStepVersion;
const paso = (over: Partial<ExegeticalStep>) => ({ state: 'accepted', current: null, accepted: null, versions: [], ...over }) as ExegeticalStep;

describe('recomponer guarda la prosa anterior', () => {
    const conVeredictos = version('v', {
        citationVerdicts: [{ origin: 'prose', raw: '(A, 1)' }, { origin: 'analysis', raw: 'b' }] as never,
        citationReviews: [{ path: 'prosa@5', note: 'de prosa' }, { path: 'commentatorEngagement[0]', note: 'del análisis' }] as never,
    });

    it('guarda el texto y sus revisiones, y deja solo lo del análisis en la versión', () => {
        const r = withRecomposedProse(conVeredictos, 'nueva');
        expect(r.markdown).toBe('nueva');
        expect(r.previousProse).toEqual({ markdown: 'prosa v', citationReviews: [{ path: 'prosa@5', note: 'de prosa' }] });
        expect(r.citationVerdicts!.map(v => v.origin)).toEqual(['analysis']);
        expect(r.citationReviews!.map(c => c.path)).toEqual(['commentatorEngagement[0]']);
    });

    it('la primera composición no guarda nada: no había prosa', () => {
        expect(withRecomposedProse(version('v', { markdown: '  ' }), 'nueva')).not.toHaveProperty('previousProse');
    });

    it('recomponer otra vez después de deshacer vuelve a ofrecer deshacer, no rehacer', () => {
        const deshecha = swapPreviousProse(withRecomposedProse(version('v'), 'nueva'));
        expect(deshecha.previousProse!.undone).toBe(true);
        expect(withRecomposedProse(deshecha, 'otra').previousProse!.undone).toBeUndefined();
    });
});

describe('intercambiar la prosa', () => {
    it('deshacer y rehacer devuelven exactamente cada texto, con sus revisiones', () => {
        const nueva = withRecomposedProse(version('v', { citationReviews: [{ path: 'prosa@5', note: 'vieja' }] as never }), 'nueva');
        const deshecha = swapPreviousProse(nueva);
        expect(deshecha.markdown).toBe('prosa v');
        expect(deshecha.citationReviews!.map(r => r.note)).toEqual(['vieja']);
        expect(deshecha.previousProse).toMatchObject({ markdown: 'nueva', undone: true });
        const rehecha = swapPreviousProse(deshecha);
        expect(rehecha.markdown).toBe('nueva');
        expect(rehecha.citationReviews).toEqual([]);
        expect(rehecha.previousProse).toMatchObject({ markdown: 'prosa v', undone: false });
    });

    it('los veredictos de la prosa saliente no pasan a la otra; los del análisis quedan', () => {
        const v = version('v', { previousProse: { markdown: 'x' }, citationVerdicts: [{ origin: 'prose' }, { origin: 'analysis' }] as never });
        expect(swapPreviousProse(v).citationVerdicts!.map(c => c.origin)).toEqual(['analysis']);
    });
});

describe('qué se puede deshacer', () => {
    const v1 = version('v1');
    const v2 = version('v2', { parentVersionId: 'v1' });

    it('recompuesto: deshace la prosa; una vez deshecho, rehace, y lo anterior del historial queda disponible', () => {
        const recompuesta = version('v2', { parentVersionId: 'v1', previousProse: { markdown: 'antes' } });
        expect(stepHistoryMoves(paso({ accepted: recompuesta, current: recompuesta, versions: [v1, recompuesta] }))).toMatchObject({
            undo: { kind: 'prose', versionId: 'v2' }, redo: null,
        });
        const deshecha = version('v2', { parentVersionId: 'v1', previousProse: { markdown: 'nueva', undone: true } });
        expect(stepHistoryMoves(paso({ accepted: deshecha, current: deshecha, versions: [v1, deshecha] }))).toMatchObject({
            undo: { kind: 'version', versionId: 'v2', targetVersionId: 'v1' }, redo: { kind: 'prose', versionId: 'v2' },
        });
    });

    it('regenerado en revisión: vuelve a la versión de la que salió', () => {
        const moves = stepHistoryMoves(paso({ state: 'awaiting-review', accepted: v1, current: v2, versions: [v1, v2] }));
        expect(moves.undo).toEqual({ kind: 'version', versionId: 'v2', targetVersionId: 'v1' });
        expect(moves.redo).toBeNull();
    });

    it('deshecho: ofrece la versión más reciente que salió de esta', () => {
        const v3 = version('v3', { parentVersionId: 'v1' });
        const moves = stepHistoryMoves(paso({ accepted: v1, current: v1, versions: [v1, v2, v3] }));
        expect(moves.undo).toBeNull();
        expect(moves.redo).toEqual({ kind: 'version', versionId: 'v1', targetVersionId: 'v3' });
    });

    it('nada si no hay anterior, si la anterior se recortó, o mientras genera', () => {
        expect(stepHistoryMoves(paso({ accepted: v1, current: v1, versions: [v1] }))).toEqual({ undo: null, redo: null, accepted: null });
        expect(stepHistoryMoves(paso({ accepted: v2, current: v2, versions: [v2] })).undo).toBeNull();
        expect(stepHistoryMoves(paso({ state: 'generating', current: v2, versions: [v1, v2] }))).toEqual({ undo: null, redo: null, accepted: null });
    });

    it('una prosa guardada vacía no se ofrece', () => {
        const v = version('v', { previousProse: { markdown: '  ' } });
        expect(stepHistoryMoves(paso({ accepted: v, current: v, versions: [v] })).undo).toBeNull();
    });
});

describe('los punteros al volver a otra versión', () => {
    const v1 = version('v1');
    const v2 = version('v2', { parentVersionId: 'v1' });

    it('volver a lo aceptado lo deja aceptado', () => {
        const r = stepAfterVersionMove(paso({ state: 'awaiting-review', accepted: v1, current: v2 }), v1);
        expect(r).toMatchObject({ state: 'accepted', accepted: v1, current: v1 });
    });

    it('sin aceptada sigue en revisión', () => {
        const r = stepAfterVersionMove(paso({ state: 'awaiting-review', accepted: null, current: v2 }), v1);
        expect(r).toMatchObject({ state: 'awaiting-review', accepted: null, current: v1 });
    });

    it('volver desde lo aceptado no acepta la anterior: queda en revisión y la aceptada no cambia', () => {
        expect(stepAfterVersionMove(paso({ accepted: v2, current: v2 }), v1)).toMatchObject({ state: 'awaiting-review', accepted: v2, current: v1 });
    });

    it('avanzar a otra tampoco', () => {
        expect(stepAfterVersionMove(paso({ accepted: v1, current: v1 }), v2)).toMatchObject({ state: 'awaiting-review', accepted: v1, current: v2 });
    });
});

describe('el recorte del historial', () => {
    it('no quita la versión anterior: es a la que se vuelve', () => {
        expect(versionsToKeepOnAppend(paso({ accepted: version('a') }), version('n', { parentVersionId: 'p' }))).toEqual(['a', undefined, 'n', 'p']);
    });
});

describe('rehacer devuelve lo último que se dejó atrás', () => {
    const dia = (n: number) => new Date(2026, 10, n);
    const conProsa = (undoneAt: Date) => version('v1', { previousProse: { markdown: 'Recompuesta.', undone: true, undoneAt } });

    it('una edición hecha después de deshacer la prosa va antes que esa prosa', () => {
        const v1 = conProsa(dia(2));
        const edicion = version('e', { parentVersionId: 'v1', createdAt: dia(3) });
        const m = stepHistoryMoves(paso({ current: v1, accepted: v1, versions: [v1, edicion] }));
        expect(m.redo).toEqual({ kind: 'version', versionId: 'v1', targetVersionId: 'e' });
    });

    it('una versión anterior a deshacer la prosa no le gana', () => {
        const v1 = conProsa(dia(4));
        const vieja = version('e', { parentVersionId: 'v1', createdAt: dia(3) });
        const m = stepHistoryMoves(paso({ current: v1, accepted: v1, versions: [v1, vieja] }));
        expect(m.redo).toEqual({ kind: 'prose', versionId: 'v1' });
    });

    it('deshacer guarda cuándo; rehacer no lo escribe', () => {
        const ahora = dia(5);
        const deshecha = swapPreviousProse(withRecomposedProse(version('v'), 'nueva'), ahora);
        expect(deshecha.previousProse!.undoneAt).toEqual(ahora);
        expect(swapPreviousProse(deshecha, ahora).previousProse).not.toHaveProperty('undoneAt');
    });
});

describe('saber cuál es la aceptada', () => {
    const v1 = version('v1');
    const v2 = version('v2', { parentVersionId: 'v1' });
    const v3 = version('v3', { parentVersionId: 'v2' });

    it('en revisión de otra versión, ofrece ir directo a la aceptada', () => {
        const m = stepHistoryMoves(paso({ state: 'awaiting-review', current: v3, accepted: v1, versions: [v1, v2, v3] }));
        expect(m.accepted).toEqual({ kind: 'version', versionId: 'v3', targetVersionId: 'v1' });
    });
    it('viendo la aceptada, no lo ofrece', () => {
        expect(stepHistoryMoves(paso({ current: v1, accepted: v1, versions: [v1, v2] })).accepted).toBeNull();
        expect(stepHistoryMoves(paso({ state: 'awaiting-review', current: v1, accepted: v1, versions: [v1] })).accepted).toBeNull();
    });
    it('sin aceptada, no lo ofrece', () => {
        expect(stepHistoryMoves(paso({ state: 'awaiting-review', current: v2, accepted: null, versions: [v1, v2] })).accepted).toBeNull();
    });
    it('generando, nada se ofrece', () => {
        expect(stepHistoryMoves(paso({ state: 'generating' as never, current: v2, accepted: v1, versions: [v1, v2] }))).toEqual({ undo: null, redo: null, accepted: null });
    });

    it('el número es el de la versión a la vista, no el total', () => {
        expect(stepVersionNumbers(paso({ state: 'awaiting-review', current: v2, accepted: v1, versions: [v1, v2, v3] }))).toEqual({ shown: 2, accepted: 1, total: 3 });
    });
    it('aceptada a la vista: los dos números coinciden', () => {
        expect(stepVersionNumbers(paso({ current: v3, accepted: v3, versions: [v1, v2, v3] }))).toEqual({ shown: 3, accepted: 3, total: 3 });
    });
    it('sin aceptada, ni versiones, no inventa números', () => {
        expect(stepVersionNumbers(paso({ state: 'awaiting-review', current: null, accepted: null, versions: [] }))).toEqual({ shown: null, accepted: null, total: 0 });
    });

    describe('después de devolver el paso a revisión', () => {
        const reabierto = { state: 'awaiting-review', accepted: null, lastAcceptedVersionId: 'v1' } as const;

        it('sigue diciendo cuál fue y ofrece volver', () => {
            const paso3 = paso({ ...reabierto, current: v3, versions: [v1, v2, v3] });
            expect(stepVersionNumbers(paso3)).toEqual({ shown: 3, accepted: 1, total: 3 });
            expect(stepHistoryMoves(paso3).accepted).toEqual({ kind: 'version', versionId: 'v3', targetVersionId: 'v1' });
        });
        it('volver la deja aceptada otra vez: nunca dejó de ser lo que el autor aceptó', () => {
            expect(stepAfterVersionMove(paso({ ...reabierto, current: v3 }), v1)).toMatchObject({ state: 'accepted', accepted: v1, current: v1 });
        });
        it('volver a otra sigue en revisión y sin aceptada', () => {
            expect(stepAfterVersionMove(paso({ ...reabierto, current: v3 }), v2)).toMatchObject({ state: 'awaiting-review', accepted: null, current: v2 });
        });
        it('con otra aceptada después, la marca vieja no cuenta', () => {
            const conOtra = paso({ state: 'awaiting-review', accepted: v2, lastAcceptedVersionId: 'v1', current: v3, versions: [v1, v2, v3] });
            expect(stepVersionNumbers(conOtra).accepted).toBe(2);
            expect(stepAfterVersionMove(conOtra, v1)).toMatchObject({ state: 'awaiting-review', accepted: v2 });
        });
        it('si ya está a la vista, no ofrece el salto', () => {
            expect(stepHistoryMoves(paso({ ...reabierto, current: v1, versions: [v1, v2] })).accepted).toBeNull();
        });
        it('una marca que no está en la lista no inventa número', () => {
            expect(stepVersionNumbers(paso({ ...reabierto, lastAcceptedVersionId: 'ya-no', current: v2, versions: [v2] })).accepted).toBeNull();
        });
        it('el recorte la conserva', () => {
            expect(versionsToKeepOnAppend(paso({ accepted: null, lastAcceptedVersionId: 'v1' }), version('n', { parentVersionId: 'p' }))).toContain('v1');
        });
    });
});
