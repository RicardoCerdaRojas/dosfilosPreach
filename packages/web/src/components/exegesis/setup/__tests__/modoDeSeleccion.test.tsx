import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

/**
 * TP #8 (2026-10-21, fase 8a, A4): las hojas por pasaje y las elegidas a mano
 * salían con «Coincidencia aproximada», el rótulo de la selección menos
 * confiable.
 */
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
const { SourceSelectionModeBadge } = await import('../SourceSelectionModeBadge');

afterEach(cleanup);

describe('el rótulo de cómo se eligieron las páginas', () => {
    it.each([
        ['structural', 'structural'],
        ['passage', 'passage'],
        ['manual', 'manual'],
        ['semantic', 'semantic'],
    ] as const)('%s → %s', (mode, clave) => {
        render(<SourceSelectionModeBadge mode={mode} />);
        expect(screen.getByText(`paperSetup.subSteps.corpus.list.selectionMode.${clave}`))
            .toHaveAttribute('title', `paperSetup.subSteps.corpus.list.selectionMode.${clave}Hint`);
    });

    it('sin modo registrado no afirma nada', () => {
        const { container } = render(<SourceSelectionModeBadge mode={null} />);
        expect(container).toBeEmptyDOMElement();
    });
});
