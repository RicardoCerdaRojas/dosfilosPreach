import { describe, expect, it, jest } from '@jest/globals';

import { INK_HISTORY_LIMIT, emptyInkHistory, recordInk, redoInk, undoInk, type InkAction } from '../useInkHistory';

const action = (name: string, log: string[]): InkAction => ({
    undo: () => log.push(`undo ${name}`),
    redo: () => log.push(`redo ${name}`),
});

describe('deshacer y rehacer la tinta', () => {
    it('deshace en orden inverso y rehace en el orden original', () => {
        const log: string[] = [];
        let h = recordInk(recordInk(emptyInkHistory, action('a', log)), action('b', log));
        let r = undoInk(h);
        r.action?.undo();
        h = r.state;
        r = undoInk(h);
        r.action?.undo();
        h = r.state;
        r = redoInk(h);
        r.action?.redo();
        expect(log).toEqual(['undo b', 'undo a', 'redo a']);
    });

    it('algo nuevo después de deshacer borra lo que se podía rehacer', () => {
        const log: string[] = [];
        let h = recordInk(emptyInkHistory, action('a', log));
        h = undoInk(h).state;
        expect(h.future).toHaveLength(1);
        h = recordInk(h, action('b', log));
        expect(h.future).toHaveLength(0);
        expect(redoInk(h).action).toBeNull();
    });

    it('sin nada que deshacer no pasa nada', () => {
        expect(undoInk(emptyInkHistory).action).toBeNull();
    });

    it('el historial no crece sin fin', () => {
        let h = emptyInkHistory;
        for (let i = 0; i < INK_HISTORY_LIMIT + 10; i += 1) h = recordInk(h, { undo: jest.fn(), redo: jest.fn() });
        expect(h.past).toHaveLength(INK_HISTORY_LIMIT);
    });
});
