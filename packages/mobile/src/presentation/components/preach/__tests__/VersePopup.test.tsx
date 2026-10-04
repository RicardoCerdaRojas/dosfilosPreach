import { describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { READING_MODES } from '@/core/theme/readingModes';
import { VersePopup } from '../VersePopup';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

const PASSAGE = {
    title: 'Jonás 4:5-6',
    verses: [
        { number: 5, text: 'Y salió Jonás de la ciudad.' },
        { number: 6, text: 'Y preparó Jehová Dios una calabacera.' },
    ],
};

function render(passage: typeof PASSAGE | null) {
    let r!: ReactTestRenderer;
    act(() => {
        r = create(
            <VersePopup
                reference="Jonás 4:5-6"
                passage={passage}
                tokens={READING_MODES.claro}
                fontSize={30}
                face="literata"
                onOpenInBible={jest.fn()}
                onClose={jest.fn()}
            />,
        );
    });
    return r;
}

describe('versículo tocado en el atril', () => {
    it('REGRESIÓN: un versículo por bloque, con su número, a cuerpo de lectura y con interlineado de lectura', () => {
        const r = render(PASSAGE);
        const verse = r.root.findAllByType(Text).find((n) => [n.props.children].flat().includes('Y salió Jonás de la ciudad.'))!;
        const style = verse.props.style as { fontSize: number; lineHeight: number; fontFamily: string };
        expect(style.fontSize).toBe(27);
        expect(style.lineHeight / style.fontSize).toBeGreaterThanOrEqual(1.55);
        // La familia va por estilo (no por clase de NativeWind).
        expect(style.fontFamily).toBe('Literata');
        const numbers = r.root.findAllByType(Text).map((n) => n.props.children).filter((c) => c === '5  ' || c === '6  ');
        expect(numbers).toEqual(['5  ', '6  ']);
    });

    it('sin pasaje, lo dice', () => {
        const r = render(null);
        expect(r.root.findAllByType(Text).some((n) => n.props.children === 'preach:verse_unreadable')).toBe(true);
    });
});
