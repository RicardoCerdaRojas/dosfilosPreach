import { describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { buildReadingBlocks } from '@dosfilos/domain';

import { READING_MODES } from '@/core/theme/readingModes';
import { PreachSectionBody } from '../PreachSectionBody';

const noop = () => undefined;
const PUNTO = '> **Jonás 4:5-8** — 5 Y salió Jonás de la ciudad. 6 Y preparó Jehová Dios una calabacera.';

function render(collapseQuotes: boolean, onPressApparatus: (text: string) => void = noop, source = PUNTO) {
    let r!: ReactTestRenderer;
    act(() => {
        r = create(
            <PreachSectionBody
                blocks={buildReadingBlocks(source)}
                highlights={[]}
                fontSize={30}
                tokens={READING_MODES.claro}
                senseLines={false}
                face="lexend"
                hangingIndent={false}
                selection={null}
                onSelectionChange={noop}
                onSelectionEnd={noop}
                onTapAt={noop}
                onPressCitation={noop}
                onPressApparatus={onPressApparatus}
                collapseQuotes={collapseQuotes}
            />,
        );
    });
    return r;
}
const word = (r: ReactTestRenderer, w: string) => r.root.findAllByType(Text).find((n) => n.props.children === w);

describe('la Escritura del punto en el atril', () => {
    it('REGRESIÓN: se lee completa en la página, palabra por palabra (antes, plegada a un renglón)', () => {
        const r = render(false);
        expect(word(r, 'calabacera.')).toBeDefined();
        expect(r.root.findAllByType(TouchableOpacity)).toHaveLength(0);
    });

    it('los números de versículo van discretos: más chicos y atenuados', () => {
        const r = render(false);
        const five = word(r, '5')!.props.style as { fontSize: number; color: string };
        const salio = word(r, 'salió')!.props.style as { fontSize: number; color: string };
        expect(five.fontSize).toBeLessThan(salio.fontSize);
        expect(five.color).toBe(READING_MODES.claro.textSecondary);
    });

    it('REGRESIÓN: el «1» de «1 Juan» y un «40 días» se leen; no son números de versículo', () => {
        const r = render(false, noop, '> **1 Juan 3:16** — 16 En esto hemos conocido el amor. 17 Pero el que tiene 40 días…');
        const size = (w: string) => (word(r, w)!.props.style as { fontSize: number }).fontSize;
        expect(size('1')).toBe(size('Juan'));
        expect(size('40')).toBe(size('días…'));
        expect(size('16')).toBeLessThan(size('Juan'));
        expect(size('17')).toBeLessThan(size('Juan'));
    });

    it('con «citas plegadas», vuelve a un renglón que se abre tocándolo', () => {
        const open = jest.fn();
        const r = render(true, open);
        expect(word(r, 'calabacera.')).toBeUndefined();
        act(() => r.root.findByType(TouchableOpacity).props.onPress());
        expect(open).toHaveBeenCalledWith(expect.stringContaining('Y salió Jonás'));
    });
});
