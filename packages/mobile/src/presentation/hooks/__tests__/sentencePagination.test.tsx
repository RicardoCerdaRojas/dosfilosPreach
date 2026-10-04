import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { Text, View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { buildReadingBlocks, type UnitMetric } from '@dosfilos/domain';

import { usePagination, type Pagination } from '../usePagination';

const LINE = 40;
const sentences = (n: number, tag: string) => Array.from({ length: n }, (_, i) => `${tag}${i + 1} dice algo.`).join(' ');
const BLOCKS = buildReadingBlocks(`${sentences(3, 'A')}\n\n${sentences(10, 'B')}`);

/** La medición nativa, a mano: cada oración un renglón de 40, 20 de margen. */
function Sonda({ onResult, reportUnits }: { onResult: (p: Pagination) => void; reportUnits: boolean }) {
    const result = usePagination({
        blocks: BLOCKS,
        availableHeight: 400,
        layoutKey: 'k',
        renderBlock: (block, _i, onUnitMetrics) => (
            <View testID="medida" onLayout={() => undefined}>
                <Text>{block.text}</Text>
                {reportUnits ? (
                    <View
                        testID="oraciones"
                        onLayout={() =>
                            onUnitMetrics(block.units.map((_, u): UnitMetric => ({ top: u * LINE, bottom: (u + 1) * LINE })))
                        }
                    />
                ) : null}
            </View>
        ),
    });
    onResult(result);
    return <>{result.probe}</>;
}

/** Dispara los `onLayout` del probe: alto de cada bloque y, si hay, sus oraciones. */
function measure(renderer: ReactTestRenderer) {
    const wrappers = renderer.root.findAll((n) => typeof n.props.onLayout === 'function' && n.props.testID === undefined && n.type === View);
    wrappers.forEach((w, i) => {
        const block = BLOCKS[i];
        if (!block) return;
        w.props.onLayout({ nativeEvent: { layout: { height: block.units.length * LINE + 20 } } });
    });
    renderer.root.findAll((n) => n.props.testID === 'oraciones').forEach((n) => n.props.onLayout());
}

let renderer: ReactTestRenderer;
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
    act(() => renderer.unmount());
    jest.useRealTimers();
});

describe('paginación por oración en el atril', () => {
    it('REGRESIÓN: con las oraciones medidas, el párrafo largo llena la primera página', () => {
        let last: Pagination | undefined;
        act(() => {
            renderer = create(<Sonda onResult={(p) => (last = p)} reportUnits />);
        });
        act(() => measure(renderer));
        expect(last?.measuring).toBe(false);
        expect(last?.pages.map((p) => p.map((f) => `${f.block}:${f.from}-${f.to}`))).toEqual([
            ['0:0-3', '1:0-6'],
            ['1:6-10'],
        ]);
    });

    it('si las oraciones nunca se miden, la página aparece igual (sin partir el párrafo)', () => {
        let last: Pagination | undefined;
        act(() => {
            renderer = create(<Sonda onResult={(p) => (last = p)} reportUnits={false} />);
        });
        act(() => measure(renderer));
        expect(last?.measuring).toBe(true);
        act(() => jest.advanceTimersByTime(500));
        expect(last?.measuring).toBe(false);
        expect(last?.pages.map((p) => p.map((f) => `${f.block}:${f.from}-${f.to}`))).toEqual([['0:0-3'], ['1:0-10']]);
    });
});
