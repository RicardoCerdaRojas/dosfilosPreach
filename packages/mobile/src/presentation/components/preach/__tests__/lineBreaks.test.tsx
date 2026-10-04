import { describe, expect, it } from '@jest/globals';
import React from 'react';
import { Text, View } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { LINE_BREAK_FIXTURES, buildReadingBlocks } from '@dosfilos/domain';

import { READING_MODES } from '@/core/theme/readingModes';
import { PreachSectionBody } from '../PreachSectionBody';

const noop = () => undefined;

function render(markdown: string, hangingIndent: boolean) {
    let r!: ReactTestRenderer;
    act(() => {
        r = create(
            <PreachSectionBody
                blocks={buildReadingBlocks(markdown)}
                highlights={[]}
                fontSize={30}
                tokens={READING_MODES.claro}
                senseLines={false}
                face="lexend"
                hangingIndent={hangingIndent}
                selection={null}
                onSelectionChange={noop}
                onSelectionEnd={noop}
                onTapAt={noop}
                onPressCitation={noop}
                onPressApparatus={noop}
            />,
        );
    });
    return r;
}

/** La vista de la palabra (el padre de su Text). */
const wordView = (r: ReactTestRenderer, word: string) =>
    r.root.findAllByType(Text).find((n) => n.props.children === word)!.parent!;
const isBreak = (n: { type: unknown; props: { style?: { width?: string; height?: number } } }) =>
    n.type === View && n.props.style?.width === '100%' && n.props.style?.height === 0;

describe('saltos de línea en el atril (LINE_BREAK_RULE)', () => {
    it('REGRESIÓN: «A nivel institucional» ↵ texto se ve en dos renglones (antes, pegado)', () => {
        const r = render(LINE_BREAK_FIXTURES[0]!.markdown, false);
        const breaks = r.root.findAll((n) => isBreak(n as never));
        expect(breaks).toHaveLength(1);
        // El salto va justo antes de la primera palabra del renglón nuevo.
        const row = breaks[0]!.parent!;
        const children = row.children.filter((c): c is ReactTestInstance => typeof c !== 'string');
        const at = children.indexOf(breaks[0]!);
        const next = children[at + 1]!;
        const wordsIn = (n: ReactTestInstance) => n.findAllByType(Text).map((t) => t.props.children);
        expect(wordsIn(next)).toEqual(['Hace']);
        // Y lo de antes del salto es el final de la etiqueta.
        expect(wordsIn(children[at - 1]!)).toEqual(['institucional']);
    });

    it('con sangría francesa, el renglón cortado a mano empieza en el margen', () => {
        const r = render(LINE_BREAK_FIXTURES[0]!.markdown, true);
        const style = wordView(r, 'Hace').props.style as { marginLeft: number };
        expect(style.marginLeft).toBeLessThan(0);
        // Una palabra cualquiera del medio no sale.
        expect((wordView(r, 'muchos').props.style as { marginLeft: number }).marginLeft).toBe(0);
    });

    it('un párrafo sin saltos no tiene ninguno', () => {
        const r = render('Un párrafo de una sola línea.', false);
        expect(r.root.findAll((n) => isBreak(n as never))).toHaveLength(0);
    });
});
