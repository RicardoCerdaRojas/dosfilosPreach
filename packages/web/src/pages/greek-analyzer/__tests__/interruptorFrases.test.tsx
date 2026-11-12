import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
const { GreekVerseTools } = await import('../GreekVerseTools');

/** U11b (revisión del profesor, Stg 2:21 «¿un interruptor para marcarlas?»): «Frases» en la barra del versículo. */
const base = { colorMode: 'off' as const, onColorMode: vi.fn(), fontScale: 1 as const, onFontScale: vi.fn(), showTranslit: true, onToggleTranslit: vi.fn(), greekText: '', translitText: '' };

describe('interruptor «Frases»', () => {
    it('aparece con datos de estructura, dice si está prendido y alterna', () => {
        const alternar = vi.fn();
        render(<GreekVerseTools {...base} showPhrases={false} onTogglePhrases={alternar} />);
        const b = screen.getByText('analyzer.tools.phrases').closest('button')!;
        expect(b.getAttribute('aria-pressed')).toBe('false');
        fireEvent.click(b);
        expect(alternar).toHaveBeenCalledOnce();
    });

    it('sin datos de estructura (palabras que no calzan), no se ofrece', () => {
        render(<GreekVerseTools {...base} />);
        expect(screen.queryByText('analyzer.tools.phrases')).toBeNull();
    });
});
