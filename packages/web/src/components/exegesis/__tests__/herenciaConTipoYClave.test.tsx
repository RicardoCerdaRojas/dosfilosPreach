import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

/**
 * TP #9 (B13, B14): una obra aprobada traída al curso llegaba al trabajo
 * nuevo sin tipo de fuente («otro») y sin clave de cita, aunque el TP #8 la
 * había usado como comentario con la clave «Adamson».
 */
let recursos: unknown[] = [];
let resumenes: unknown[] = [];
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, p?: Record<string, unknown>) => (p ? `${k} ${JSON.stringify(p)}` : k) }) }));
vi.mock('@/hooks/library', () => ({ useLibrary: () => ({ resources: recursos }) }));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({ useExegesisPapers: () => ({ papers: resumenes }) }));
const { ProjectBibliographyOffer } = await import('../ProjectBibliographyOffer');

const curso = {
    id: 'nt785', type: 'course',
    bibliography: [{ id: 'b1', title: 'The Epistle of James', author: null, resourceId: 'r-adamson', weight: 'recommended', decision: 'approved', origins: ['studies'] }],
};

beforeEach(() => {
    cleanup();
    recursos = [{ id: 'r-adamson', title: 'The Epistle of James', author: 'James B. Adamson', exegeticalType: null, coversBibleBooks: ['JAS'] }];
    resumenes = [{
        id: 'tp8', createdAt: new Date(2026, 9, 21), projectId: 'nt785', citedSourceKeys: ['Adamson'],
        sources: [{ sourceLibraryResourceId: 'r-adamson', corpusId: 'r-adamson', sourceType: 'commentary-critical', citationKey: 'Adamson', displayLabel: 'Adamson' }],
    }];
});

describe('las fuentes heredadas del estado del arte', () => {
    it('llegan con el tipo y la clave con que las usó el curso', async () => {
        const onChange = vi.fn();
        render(<ProjectBibliographyOffer project={curso as never} bookId="JAS" onChange={onChange} />);
        expect(screen.getByTestId('project-source-type')).toHaveTextContent('sourceTypes.commentary-critical.label');
        await waitFor(() => expect(onChange).toHaveBeenCalled());
        expect(onChange.mock.lastCall![0][0]).toMatchObject({ sourceType: 'commentary-critical', citationKey: 'Adamson' });
    });

    it('sin uso anterior, la clave sale del autor del libro', async () => {
        resumenes = [];
        const onChange = vi.fn();
        render(<ProjectBibliographyOffer project={curso as never} bookId="JAS" onChange={onChange} />);
        await waitFor(() => expect(onChange).toHaveBeenCalled());
        expect(onChange.mock.lastCall![0][0]).toMatchObject({ sourceType: 'other', citationKey: 'Adamson' });
    });
});
