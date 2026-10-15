import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * TP #7 (#26): las fichas del plan mostraban el título cortado («James (Baker
 * Exegetical Commentary on th…») y el fundador no sabía de quién era cada una.
 */
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
const { PinnedSourcesPicker } = await import('../PinnedSourcesPicker');

const fuente = (id: string, displayLabel: string, citationKey: string | null) =>
    ({ id, displayLabel, citationKey }) as never;

describe('la ficha del plan dice de quién es', () => {
    it('muestra la clave de cita y deja el título en el tooltip', () => {
        render(<PinnedSourcesPicker
            sources={[fuente('m', 'James (Baker Exegetical Commentary on the New Testament)', 'McCartney')]}
            selected={['m']} onChange={vi.fn()} />);
        const ficha = screen.getByText('McCartney');
        expect(ficha.closest('[role="listitem"]')).toHaveAttribute('title', 'James (Baker Exegetical Commentary on the New Testament)');
    });

    it('sin clave, el título', () => {
        render(<PinnedSourcesPicker sources={[fuente('n', 'NA28', null)]} selected={['n']} onChange={vi.fn()} />);
        expect(screen.getAllByText('NA28').length).toBeGreaterThan(0);
    });
});
