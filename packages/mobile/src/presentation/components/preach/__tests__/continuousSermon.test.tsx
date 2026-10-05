import { afterEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { buildReadingBlocks } from '@dosfilos/domain';

import { READING_MODES } from '@/core/theme/readingModes';
import { ContinuousSermon, type ContinuousSection } from '../ContinuousSermon';
import { PreachSectionBody } from '../PreachSectionBody';

const noop = () => undefined;
const A = { slug: 'huida', title: 'La huida', body: 'Jonás huyó a Tarsis. Dios no lo soltó.' };
const B = { slug: 'tormenta', title: 'La tormenta', body: 'Jehová hizo levantar un gran viento.\n\nY hubo en el mar una tempestad.' };

function sectionsOf(): ContinuousSection[] {
    const a = buildReadingBlocks(A.body);
    const b = buildReadingBlocks(B.body);
    return [
        { section: A, blocks: a, firstBlock: 0 },
        { section: B, blocks: b, firstBlock: a.length },
    ];
}

// Se desmonta todo al terminar: el cuerpo mide en el cuadro siguiente
// (requestAnimationFrame) y, montado, ese cuadro llegaba con jest ya cerrado.
const mounted: ReactTestRenderer[] = [];
afterEach(() => {
    mounted.splice(0).forEach((r) => act(() => r.unmount()));
});

function render(overrides: Partial<React.ComponentProps<typeof ContinuousSermon>> = {}) {
    let r!: ReactTestRenderer;
    act(() => {
        r = create(
            <ContinuousSermon
                sections={sectionsOf()}
                reading={null}
                headerFor={(i) => <Text>{`titulo-${i}`}</Text>}
                footer={null}
                outline={false}
                tokens={READING_MODES.claro}
                fontSize={30}
                face="lexend"
                senseLines={false}
                hangingIndent={false}
                collapseQuotes={false}
                highlights={{}}
                glyphs={{}}
                selection={null}
                onSelectionChange={noop}
                onSelectionEnd={noop}
                onTapAt={noop}
                onPressCitation={noop}
                onPressReference={noop}
                onPressApparatus={noop}
                onUnitLayout={noop}
                layoutKey="k"
                onSectionTop={noop}
                {...overrides}
            />,
        );
    });
    mounted.push(r);
    return r;
}
const bodies = (r: ReactTestRenderer) => r.root.findAllByType(PreachSectionBody);
const word = (r: ReactTestRenderer, w: string) => r.root.findAllByType(Text).find((n) => n.props.children === w);

describe('el sermón como un documento continuo', () => {
    it('todos los movimientos, uno debajo del otro, cada uno con su título', () => {
        const r = render();
        expect(bodies(r)).toHaveLength(2);
        expect(word(r, 'titulo-0')).toBeDefined();
        expect(word(r, 'titulo-1')).toBeDefined();
        expect(word(r, 'Tarsis.')).toBeDefined();
        expect(word(r, 'tempestad.')).toBeDefined();
    });

    it('la selección se pinta sólo en el movimiento donde se hizo', () => {
        const r = render({ selection: { slug: 'tormenta', range: { start: 0, end: 6 } } });
        expect(bodies(r)[0]!.props.selection).toBeNull();
        expect(bodies(r)[1]!.props.selection).toEqual({ start: 0, end: 6 });
    });

    it('lo que se marca o se ubica va con el movimiento que corresponde', () => {
        const onUnitLayout = jest.fn();
        const onSelectionEnd = jest.fn();
        const r = render({ onUnitLayout, onSelectionEnd });
        act(() => bodies(r)[1]!.props.onBlockLayout!(0, { x: 1, y: 2, height: 3 }));
        expect(onUnitLayout).toHaveBeenCalledWith('tormenta', 0, { x: 1, y: 2, height: 3 });
        act(() => bodies(r)[1]!.props.onSelectionEnd({ start: 0, end: 6 }, 50));
        expect(onSelectionEnd).toHaveBeenCalledWith('tormenta', { start: 0, end: 6 }, 50);
    });

    it('el foco cuenta los bloques del sermón entero', () => {
        const isBlockDimmed = jest.fn((i: number) => i !== 1);
        const r = render({ isBlockDimmed });
        // El primer bloque del segundo movimiento es el bloque 1 del sermón.
        expect(bodies(r)[1]!.props.isBlockDimmed!(0)).toBe(false);
        expect(isBlockDimmed).toHaveBeenLastCalledWith(1);
    });

    it('cada movimiento avisa dónde empieza', () => {
        const onSectionTop = jest.fn();
        const r = render({ onSectionTop });
        act(() =>
            r.root
                .findByProps({ testID: 'continuous-tormenta' })
                .props.onLayout({ nativeEvent: { layout: { x: 0, y: 840, width: 600, height: 300 } } }),
        );
        expect(onSectionTop).toHaveBeenCalledWith(1, 840);
    });

    it('cada bloque avisa dónde empieza, con su movimiento (para caer en un comienzo)', () => {
        const onBlockTop = jest.fn();
        const r = render({ onBlockTop });
        const body = bodies(r)[1]!;
        // El cuerpo envuelve cada bloque en una vista que se mide.
        const wrappers = body.findAll((n) => n.parent === body && typeof n.props.onLayout === 'function');
        expect(wrappers).toHaveLength(2);
        act(() => wrappers[1]!.props.onLayout({ nativeEvent: { layout: { x: 0, y: 220, width: 600, height: 90 } } }));
        expect(onBlockTop).toHaveBeenCalledWith('tormenta', 1, 220);
    });

    it('las marcas de cada movimiento son las suyas', () => {
        const mark = { id: 'h1', color: 'yellow' as const, style: 'highlight' as const, start: 0, end: 6 };
        const r = render({ highlights: { tormenta: [mark] } });
        expect(bodies(r)[0]!.props.highlights).toEqual([]);
        expect(bodies(r)[1]!.props.highlights).toEqual([mark]);
    });
});
