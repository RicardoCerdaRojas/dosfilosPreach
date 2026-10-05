import { afterEach, describe, expect, it } from '@jest/globals';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { buildReadingBlocks } from '@dosfilos/domain';
import type { DeliveryFace } from '@/core/theme/typography';

import { READING_MODES } from '@/core/theme/readingModes';
import { PreachSectionBody, type ResolvedHighlight } from '../PreachSectionBody';

/**
 * INLINE_FORMAT_RULE en el atril: lo que el pastor marcó en el editor se ve.
 * Caso del fundador (Jonás): «<u>Dios es misericordia:</u>» salía con las
 * etiquetas a la vista, y la negrita de «Éxodo 34:6:» como texto común.
 */
const noop = () => undefined;
const BODY = '<u>Dios es misericordia:</u>\n**Éxodo 34:6:** "Y pasando *Jehová* por delante."';

const mounted: ReactTestRenderer[] = [];
afterEach(() => {
    mounted.splice(0).forEach((r) => act(() => r.unmount()));
});

function render(face: DeliveryFace = 'literata', highlights: ResolvedHighlight[] = [], body = BODY) {
    let r!: ReactTestRenderer;
    act(() => {
        r = create(
            <PreachSectionBody
                blocks={buildReadingBlocks(body)}
                highlights={highlights}
                fontSize={30}
                tokens={READING_MODES.claro}
                senseLines={false}
                face={face}
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
    mounted.push(r);
    return r;
}
const styleOf = (r: ReactTestRenderer, w: string) =>
    StyleSheet.flatten(r.root.findAllByType(Text).find((n) => n.props.children === w)!.props.style) as {
        fontFamily?: string;
        fontStyle?: string;
        transform?: unknown;
        backgroundColor?: string;
        textDecorationLine?: string;
    };

describe('el formato del editor en el atril', () => {
    it('REGRESIÓN: el subrayado se subraya y no se leen las etiquetas', () => {
        const r = render();
        expect(r.root.findAllByType(Text).some((n) => typeof n.props.children === 'string' && /<\/?u>/.test(n.props.children))).toBe(false);
        expect(styleOf(r, 'Dios').textDecorationLine).toBe('underline');
        expect(styleOf(r, 'misericordia:').textDecorationLine).toBe('underline');
        expect(styleOf(r, 'pasando').textDecorationLine).toBe('none');
    });

    it('la negrita va en seminegrita y la cursiva en la cursiva de la letra elegida', () => {
        const r = render('literata');
        expect(styleOf(r, 'Éxodo').fontFamily).toBe('Literata-SemiBold');
        expect(styleOf(r, 'Jehová').fontFamily).toBe('Literata-Italic');
        expect(styleOf(r, 'pasando').fontFamily).toBeUndefined();
    });

    it('Lexend no tiene cursiva: la palabra se inclina (iOS no la inclina sola)', () => {
        const r = render('lexend');
        expect(styleOf(r, 'Jehová')).toMatchObject({ fontFamily: 'Lexend', transform: [{ skewX: '-10deg' }] });
    });

    it('REGRESIÓN: la cursiva entre comillas se dibuja (el formato es el de la primera letra)', () => {
        const r = render('literata', [], 'Dijo «*Jehová*» y (<u>Dios</u>) calló.');
        expect(styleOf(r, '«Jehová»').fontFamily).toBe('Literata-Italic');
        expect(styleOf(r, '(Dios)').textDecorationLine).toBe('underline');
    });

    it('REGRESIÓN: una palabra después de una etiqueta recibe SU marca, no la de al lado', () => {
        const body = 'Fue el profeta: <u>Dios es misericordia</u> y vino a Nínive.';
        const start = body.indexOf('vino');
        const r = render('literata', [{ id: 'h', color: 'yellow', style: 'highlight', start, end: start + 4 }], body);
        const highlighted = (w: string) =>
            (StyleSheet.flatten(r.root.findAllByType(Text).find((n) => n.props.children === w)!.parent!.props.style) as {
                backgroundColor?: string;
            }).backgroundColor !== 'transparent';
        expect(highlighted('vino')).toBe(true);
        expect(highlighted('Nínive.')).toBe(false);
        expect(highlighted('y')).toBe(false);
    });

    it('el subrayado del editor convive con la marca de tachado del pastor', () => {
        const r = render('literata', [{ id: 'h', color: 'yellow', style: 'strike', start: 3, end: 7 }]);
        expect(styleOf(r, 'Dios').textDecorationLine).toBe('underline line-through');
    });
});
