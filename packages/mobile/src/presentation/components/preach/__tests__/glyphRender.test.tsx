import { describe, expect, it } from '@jest/globals';
import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { buildReadingBlocks } from '@dosfilos/domain';

import { READING_MODES } from '@/core/theme/readingModes';
import { PreachSectionBody } from '../PreachSectionBody';

const noop = () => undefined;

function render(glyphs: { id: string; glyph: 'pause' | 'look'; start: number }[]) {
    let renderer!: ReactTestRenderer;
    act(() => {
        renderer = create(
            <PreachSectionBody
                blocks={buildReadingBlocks('Jonás huyó a Tarsis.')}
                highlights={[]}
                glyphs={glyphs}
                fontSize={28}
                tokens={READING_MODES.claro}
                senseLines={false}
                face="lexend"
                hangingIndent={false}
                selection={null}
                onSelectionChange={noop}
                onSelectionEnd={noop}
                onTapAt={noop}
                onPressCitation={noop}
                onPressApparatus={noop}
            />,
        );
    });
    return renderer;
}

const glyphNodes = (r: ReactTestRenderer) =>
    r.root.findAllByType(Text).filter((n) => ['‖', '◉'].includes(String(n.props.children)));

describe('marca de predicador en el texto', () => {
    it('se dibuja sobre su palabra, en el color del acento y sin ocupar lugar', () => {
        const r = render([{ id: 'g', glyph: 'look', start: 6 }]);
        const [glyph] = glyphNodes(r);
        expect(glyph?.props.children).toBe('◉');
        expect(glyph?.props.style).toMatchObject({ position: 'absolute', color: READING_MODES.claro.accent });
        // Va dentro de la palabra «huyó», no de otra.
        const word = glyph!.parent!.findAllByType(Text).find((n) => n !== glyph)!;
        expect(word.props.children).toBe('huyó');
    });

    it('sin glifos no dibuja ninguno', () => {
        expect(glyphNodes(render([]))).toHaveLength(0);
    });
});
