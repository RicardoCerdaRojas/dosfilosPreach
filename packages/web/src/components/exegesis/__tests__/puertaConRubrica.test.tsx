import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * TP #7 (#30): el documento citó 5 de 7 fuentes. Con la bibliografía de sólo
 * lo citado, el aparato que pedía la rúbrica (NA28) salía del documento sin
 * aviso.
 */
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o?.sources ? `${k}:${o.sources}` : k) }) }));
vi.mock('@/hooks/exegesis/usePaperBibliography', () => ({ usePaperBibliography: () => [] }));
vi.mock('../BibliographyEditDialog', () => ({ BibliographyEditDialog: () => null }));
const { IncompleteBibliographyGate } = await import('../IncompleteBibliographyGate');

describe('la puerta de exportar avisa los requisitos sin cita', () => {
    it('nombra la fuente del corpus que cubriría el requisito', () => {
        const paper = {
            steps: [],
            assembledMarkdown: 'La lectura epexegética (McCartney, 203).',
            sources: [
                { citationKey: 'McCartney', displayLabel: 'McCartney', sourceType: 'commentary-expository' },
                { citationKey: 'NA28', displayLabel: 'NA28', sourceType: 'critical-apparatus' },
            ],
            rubric: { sourceRequirements: [{ sourceType: 'critical-apparatus', minimum: 1 }] },
        };
        render(<IncompleteBibliographyGate paper={paper as never} entries={[]} open onCancel={vi.fn()} onExport={vi.fn()} />);
        expect(screen.getByText('detail.bibliography.gate.rubricTitle')).toBeInTheDocument();
        expect(screen.getByText('detail.bibliography.gate.rubricUncited:NA28')).toBeInTheDocument();
        expect(screen.getByText('detail.bibliography.gate.exportAnyway')).toBeInTheDocument();
    });
});
