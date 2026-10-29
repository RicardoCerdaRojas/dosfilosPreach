import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

/**
 * TP #9, B27: la cabecera del selector tiene que decir cuál número es la hoja
 * del archivo y cuál la página impresa (NA28: hoja 803 = p. 692).
 */
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}));
const { HojaActual } = await import('../HojaActual');

afterEach(cleanup);
const V = 'paperSetup.subSteps.corpus.picker.viewer';

describe('HojaActual', () => {
    it('nombra la hoja y la página impresa', () => {
        render(<HojaActual sheet={803} printed="692" numberingKnown onStep={vi.fn()} />);
        const cabecera = screen.getByTestId('hoja-actual').textContent;
        expect(cabecera).toContain(`${V}.sheet {"sheet":803}`);
        expect(cabecera).toContain(`${V}.printed {"printed":"692"}`);
    });

    it('una hoja sin folio en un libro numerado no se confunde con «sin detectar»', () => {
        render(<HojaActual sheet={42} printed={null} numberingKnown onStep={vi.fn()} />);
        expect(screen.getByTestId('hoja-actual').textContent).toContain(`${V}.unnumbered`);
        expect(screen.getByTestId('hoja-actual').textContent).not.toContain(`${V}.noPrinted`);
    });

    it('sin numeración conocida lo dice', () => {
        render(<HojaActual sheet={42} printed={null} numberingKnown={false} onStep={vi.fn()} />);
        expect(screen.getByTestId('hoja-actual').textContent).toContain(`${V}.noPrinted`);
    });

    it('las flechas hojean', () => {
        const onStep = vi.fn();
        render(<HojaActual sheet={42} printed={null} numberingKnown={false} onStep={onStep} />);
        fireEvent.click(screen.getByRole('button', { name: `${V}.next` }));
        fireEvent.click(screen.getByRole('button', { name: `${V}.previous` }));
        expect(onStep.mock.calls).toEqual([[1], [-1]]);
    });
});
