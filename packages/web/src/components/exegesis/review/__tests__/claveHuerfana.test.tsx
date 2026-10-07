import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { ExegeticalPaper } from '@dosfilos/domain';

/** TP #6: el análisis citaba «Aland» con la fuente ya llamada «NA28». */
const renombrar = vi.fn().mockResolvedValue({});
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({
    useExegesisPapers: () => ({ renameCitationKey: { mutateAsync: renombrar, isPending: false } }),
}));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const { OrphanCitationKeysNotice } = await import('../OrphanCitationKeysNotice');

const paper = {
    id: 'p',
    sources: [
        { citationKey: 'Adamson', displayLabel: 'The Epistle of James (NICNT)' },
        { citationKey: 'NA28', displayLabel: 'Novum Testamentum Graece -  Nestle-Aland (NA28)' },
    ],
} as unknown as ExegeticalPaper;

beforeEach(() => { cleanup(); renombrar.mockClear(); });

describe('el aviso de clave huérfana', () => {
    it('REGRESIÓN: propone la fuente correcta y corrige en todo el trabajo', () => {
        render(<OrphanCitationKeysNotice paper={paper} analysis={{ links: [{ sourceKey: 'Aland' }, { sourceKey: 'Adamson' }] }} />);
        expect(screen.getByLabelText(/orphanKeys\.pick/)).toHaveValue('NA28');
        fireEvent.click(screen.getByText('canonical.review.orphanKeys.fix'));
        expect(renombrar).toHaveBeenCalledWith({ paperId: 'p', from: 'Aland', to: 'NA28' });
    });

    it('sin claves huérfanas no aparece', () => {
        const { container } = render(<OrphanCitationKeysNotice paper={paper} analysis={{ links: [{ sourceKey: 'NA28' }] }} />);
        expect(container).toBeEmptyDOMElement();
    });
});
