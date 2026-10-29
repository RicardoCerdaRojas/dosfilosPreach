import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { PageNumbering } from '@dosfilos/domain';

/**
 * TP #9, B27, en el selector entero: la cabecera de la hoja dice «Hoja 803 ·
 * p. 692» con la numeración del libro, y «Ir a» toma la página impresa y la
 * lleva a su hoja.
 */
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}));
vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}));
vi.mock('sonner', () => ({ toast: vi.fn() }));
vi.mock('@/hooks/exegesis/useDocumentPageIndex', () => ({ useDocumentPdfUrl: () => ({ data: { url: 'https://pdf' } }) }));
vi.mock('@/hooks/exegesis/useDocumentTextSearch', () => ({ useDocumentTextSearch: () => ({ data: undefined, isLoading: false, isError: false }) }));
vi.mock('../PdfPageViewer', () => ({ PdfPageViewer: ({ sheet }: { sheet: number }) => <span data-testid="hoja-visible">{sheet}</span> }));
const { SourcePagesWorkspace } = await import('../SourcePagesWorkspace');

afterEach(cleanup);

const NA28: PageNumbering = { origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 1000, offset: -111 }] };
const pages = Array.from({ length: 1000 }, (_, i) => ({ sheet: i + 1, chars: 100, firstLine: '', section: null }));
const huella = { excerptChars: 0, admittedChars: 0, pinnedChars: 0, wholeDocuments: 0, perStepChars: 0, pending: false };

const montar = () => render(
    <SourcePagesWorkspace
        pages={pages as never}
        printedPageOffset={null}
        resourceId="res-na28"
        proposedRanges={[]}
        proposalKind="none"
        proposalPending={false}
        initialRanges={[{ start: 803, end: 803 }]}
        initialPinned={[]}
        otherSources={huella as never}
        onConfirm={vi.fn()}
        isSaving={false}
        numbering={NA28}
    />,
);

describe('Selector de páginas — cabecera de la hoja e «Ir a»', () => {
    it('dice la hoja y la página impresa', () => {
        montar();
        const cabecera = screen.getByTestId('hoja-actual').textContent;
        expect(cabecera).toContain('paperSetup.subSteps.corpus.picker.viewer.sheet {"sheet":803}');
        expect(cabecera).toContain('paperSetup.subSteps.corpus.picker.viewer.printed {"printed":"692"}');
    });

    it('«Ir a» 692 lleva a la hoja 803; una hoja fuera del archivo avisa', () => {
        montar();
        fireEvent.click(screen.getByTestId('hoja-actual').querySelectorAll('button')[1]!);
        expect(screen.getByTestId('hoja-visible').textContent).toBe('804');
        const campo = screen.getByLabelText('citationViewer.jump.printedAria');
        fireEvent.change(campo, { target: { value: '692' } });
        fireEvent.submit(campo.closest('form')!);
        expect(screen.getByTestId('hoja-visible').textContent).toBe('803');

        fireEvent.change(campo, { target: { value: 'h. 1200' } });
        fireEvent.submit(campo.closest('form')!);
        expect(screen.getByTestId('ir-a-aviso').textContent).toBe('citationViewer.jump.sheetOutOfBook {"total":1000}');
        expect(screen.getByTestId('hoja-visible').textContent).toBe('803');
    });
});
