import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ExegesisPaperSummary, ExegeticalPaper } from '@dosfilos/domain';

/**
 * TP #9 (Santiago 4:11-17, NT785): el profesor prohíbe repetir los
 * COMENTARIOS del TP anterior (Adamson, Mayor, Metzger); las gramáticas y el
 * texto base se repiten. La propuesta excluía a Wallace y no traía a Metzger
 * (B15, B16). Con la regla guardada en el tipo de trabajo, propone solo esos
 * tipos y dice por qué.
 */
let proyectos: unknown[] = [];
let resumenes: ExegesisPaperSummary[] = [];
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({ useFacultyProjects: () => ({ projects: proyectos }) }));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({
    useExegesisPapers: () => ({ papers: resumenes, updatePaperExcludedSources: { mutateAsync: vi.fn(), isPending: false } }),
}));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { ExcludedSourcesCard } = await import('../ExcludedSourcesCard');

const fuente = (citationKey: string, sourceType: string) => ({ citationKey, sourceType, corpusId: citationKey, sourceLibraryResourceId: null, displayLabel: citationKey });
const tp8 = {
    id: 'tp8', title: 'TP #8', passage: {}, createdAt: new Date(2026, 9, 21), projectId: 'nt785', projectWorkTypeId: 'tp',
    citedSourceKeys: ['Adamson', 'Metzger', 'NA28', 'Wallace'],
    sources: [fuente('Adamson', 'commentary-critical'), fuente('Metzger', 'textual-commentary'), fuente('NA28', 'critical-apparatus'), fuente('Wallace', 'grammar-syntax')],
} as unknown as ExegesisPaperSummary;
// Un ensayo del mismo curso entregado en medio: no es «la entrega anterior» del TP.
const ensayo = {
    id: 'ens', title: 'Ensayo', passage: {}, createdAt: new Date(2026, 9, 25), projectId: 'nt785', projectWorkTypeId: 'ens',
    citedSourceKeys: ['Moo'], sources: [fuente('Moo', 'commentary-critical')],
} as unknown as ExegesisPaperSummary;
const tp9 = { id: 'tp9', title: 'TP #9', passage: {}, createdAt: new Date(2026, 9, 28), projectId: 'nt785', projectWorkTypeId: 'tp', citedSourceKeys: [], sources: [] } as unknown as ExegesisPaperSummary;
const trabajo = { id: 'tp9', projectId: 'nt785', projectWorkTypeId: 'tp', displayLanguage: 'es', excludedSources: undefined } as unknown as ExegeticalPaper;
const comentarios = ['commentary-critical', 'commentary-expository', 'textual-commentary'];

beforeEach(() => {
    cleanup();
    resumenes = [tp8, ensayo, tp9];
});

describe('«no repetir» con la regla del tipo de trabajo', () => {
    it('propone Adamson y Metzger con su porqué; Wallace y NA28 quedan libres; no mira el ensayo', () => {
        proyectos = [{ id: 'nt785', type: 'course', workTypes: [{ id: 'tp', label: 'TP Semanal', noRepeatSourceTypes: comentarios }, { id: 'ens', label: 'Ensayo' }] }];
        render(<ExcludedSourcesCard paper={trabajo} />);
        expect(screen.getByLabelText('Adamson')).toBeChecked();
        expect(screen.getByLabelText('Metzger')).toHaveAccessibleDescription(/whyWorkType.*TP Semanal/);
        expect(screen.queryByLabelText('Wallace')).toBeNull();
        expect(screen.queryByLabelText('Moo')).toBeNull();
        expect(screen.getByText(/excluded\.freeByWorkType/)).toHaveTextContent('NA28, Wallace');
        expect(screen.queryByTestId('exclusion-default-rule')).toBeNull();
    });

    it('sin la regla en el tipo, rige la general y la tarjeta dice dónde fijarla', () => {
        proyectos = [{ id: 'nt785', type: 'course', workTypes: [{ id: 'tp', label: 'TP Semanal' }, { id: 'ens', label: 'Ensayo' }] }];
        render(<ExcludedSourcesCard paper={trabajo} />);
        expect(screen.getByLabelText('Metzger')).toBeChecked();
        expect(screen.getByLabelText('Wallace')).not.toBeChecked();
        expect(screen.getByTestId('exclusion-default-rule')).toHaveTextContent('TP Semanal');
    });
});
