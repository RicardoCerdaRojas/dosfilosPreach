import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, o?: { n?: number }) => (o?.n !== undefined ? `${k}:${o.n}` : k) }),
}));
const { VersePicker } = await import('../VersePicker');

const LIBROS = [
    { key: 'MRK', name: 'Marcos' },
    { key: 'JAS', name: 'Santiago' },
];
const base = {
    books: LIBROS,
    book: 'MRK',
    chapter: 15,
    verse: 1,
    chapters: Array.from({ length: 16 }, (_, i) => i + 1),
    versesInChapter: 47,
    onPrev: vi.fn(),
    onNext: vi.fn(),
};

describe('VersePicker (hebreo y griego)', () => {
    it('Mc 15 (47 versículos): la grilla los ofrece todos dentro de una caja con altura máxima y scroll', () => {
        const onNavigate = vi.fn();
        render(<VersePicker {...base} onNavigate={onNavigate} />);
        fireEvent.click(screen.getByTestId('picker-verse'));
        const grilla = screen.getByTestId('number-picker');
        expect(grilla.className).toContain('max-h-[260px]');
        expect(grilla.className).toContain('overflow-y-auto');
        fireEvent.click(screen.getByText('47'));
        expect(onNavigate).toHaveBeenCalledWith('MRK', 15, 47);
        expect(screen.queryByTestId('number-picker')).toBeNull();
    });

    it('elegir capítulo va al versículo 1; elegir libro, al 1:1', () => {
        const onNavigate = vi.fn();
        render(<VersePicker {...base} onNavigate={onNavigate} />);
        fireEvent.click(screen.getByTestId('picker-chapter'));
        fireEvent.click(screen.getByText('3'));
        expect(onNavigate).toHaveBeenLastCalledWith('MRK', 3, 1);
        fireEvent.click(screen.getByTestId('picker-book'));
        fireEvent.change(screen.getByPlaceholderText('versePicker.searchBook'), { target: { value: 'sant' } });
        expect(screen.queryByText('Marcos', { selector: 'button span' })).toBeNull();
        fireEvent.click(screen.getByText('Santiago', { selector: 'button span' }));
        expect(onNavigate).toHaveBeenLastCalledWith('JAS', 1, 1);
    });

    it('◀ ▶ respetan los extremos y esperan el índice del libro', () => {
        const { rerender } = render(<VersePicker {...base} onNavigate={vi.fn()} canPrev={false} />);
        expect(screen.getByLabelText('versePicker.prevVerse')).toBeDisabled();
        expect(screen.getByLabelText('versePicker.nextVerse')).not.toBeDisabled();
        rerender(<VersePicker {...base} onNavigate={vi.fn()} chapters={[]} />);
        expect(screen.getByLabelText('versePicker.nextVerse')).toBeDisabled();
        expect(screen.getByTestId('picker-verse')).toBeDisabled();
    });
});
