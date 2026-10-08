import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, string>) => (o ? `${k}:${JSON.stringify(o)}` : k) }),
}));
const { FrontedNote } = await import('../FrontedNote');

describe('la posición en la ficha de la palabra', () => {
    it('una palabra antepuesta al verbo lo dice con su función', () => {
        render(<FrontedNote fronted={{ role: "o" }} />);
        expect(screen.getByTestId('fronted-note').textContent).toContain('cardFronted:{"role":"roleNames.o"}');
    });
    it('con la lectura del asistente dice si es foco o marco', () => {
        render(<FrontedNote fronted={{ role: 'o', fronting: 'focus' }} />);
        expect(screen.getByTestId('fronted-note').textContent).toContain('cardFrontedChosen:{"role":"roleNames.o","fronting":"fronting.focus"}');
    });

    it('una palabra en su lugar no muestra nada', () => {
        const { container } = render(<FrontedNote />);
        expect(container).toBeEmptyDOMElement();
    });
});
