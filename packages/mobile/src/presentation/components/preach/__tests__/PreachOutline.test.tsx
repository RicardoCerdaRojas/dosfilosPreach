import { describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { buildOutline } from '@dosfilos/domain';

import { READING_MODES } from '@/core/theme/readingModes';
import { PreachOutline } from '../PreachOutline';

const MANUSCRITO = [
    '### Ilustración',
    'Jonás huyó a Tarsis. **Dios no lo soltó.** Y el mar se encrespó.',
    '',
    'Un párrafo sin negritas que sigue largo. Esta segunda oración no va.',
    '',
    '1. Primero, Dios llama',
    '2. Después, Dios persigue',
    '',
    '> Levántate y ve a Nínive',
].join('\n');

function textos(renderer: ReactTestRenderer): string[] {
    return renderer.root.findAllByType(Text).map((n) => [n.props.children].flat().join(''));
}

describe('bosquejo en el atril', () => {
    it('muestra lo que no se puede olvidar, y no el resto del manuscrito', () => {
        let renderer!: ReactTestRenderer;
        act(() => {
            renderer = create(
                <PreachOutline items={buildOutline(MANUSCRITO)} tokens={READING_MODES.claro} fontSize={28} face="lexend" onTapAt={() => undefined} />,
            );
        });
        const t = textos(renderer);
        expect(t).toEqual(
            expect.arrayContaining([
                'Ilustración',
                'Dios no lo soltó.',
                'Un párrafo sin negritas que sigue largo.',
                '1.',
                'Primero, Dios llama',
                '2.',
                'Levántate y ve a Nínive',
            ]),
        );
        expect(t.join(' ')).not.toContain('Tarsis');
        expect(t.join(' ')).not.toContain('segunda oración');

        // Jerarquía: lo que se dice, pleno; el pie que sólo ubica, atenuado y más chico.
        const estilo = (texto: string) =>
            renderer.root.findAllByType(Text).find((n) => n.props.children === texto)!.props.style as {
                color: string;
                fontSize: number;
            };
        expect(estilo('Dios no lo soltó.').color).toBe(READING_MODES.claro.textPrimary);
        expect(estilo('Un párrafo sin negritas que sigue largo.').color).toBe(READING_MODES.claro.textSecondary);
        expect(estilo('Un párrafo sin negritas que sigue largo.').fontSize).toBeLessThan(28);
        expect(estilo('Ilustración').color).toBe(READING_MODES.claro.accent);
    });

    it('un toque sobre el texto pasa página, como en el manuscrito', () => {
        const onTapAt = jest.fn();
        let renderer!: ReactTestRenderer;
        act(() => {
            renderer = create(
                <PreachOutline items={buildOutline('**Idea**')} tokens={READING_MODES.claro} fontSize={28} face="lexend" onTapAt={onTapAt} />,
            );
        });
        const idea = renderer.root.findAllByType(Text).find((n) => n.props.children === 'Idea')!;
        act(() => idea.props.onPress({ nativeEvent: { pageX: 900 } }));
        expect(onTapAt).toHaveBeenCalledWith(900);
        // Sin esto el toque sobre el texto no llega al atril (RN no lo burbujea).
    });
});
