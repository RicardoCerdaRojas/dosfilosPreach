import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

/**
 * Fase F, F2: la hoja expone su texto para seleccionarlo y citar. Lo que se
 * reporta es lo seleccionado DENTRO de la hoja, en un renglón corrido.
 */
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('@/lib/pdfWorker', () => ({ pdfjsLib: { getDocument: vi.fn(), Util: { transform: vi.fn() } } }));
const { PdfPageViewer } = await import('../PdfPageViewer');

function seleccionar(nodo: Node) {
    const rango = document.createRange();
    rango.selectNodeContents(nodo);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(rango);
}

describe('PdfPageViewer — texto seleccionable', () => {
    it('sin `selectable` no hay capa de texto', () => {
        render(<PdfPageViewer url={null} sheet={1} selected={false} />);
        expect(screen.queryByTestId('pdf-text-layer')).toBeNull();
    });

    it('reporta la frase seleccionada en la hoja, con los espacios y renglones juntados', () => {
        const onTextSelected = vi.fn();
        render(<PdfPageViewer url={null} sheet={1} selected={false} selectable onTextSelected={onTextSelected} />);
        const capa = screen.getByTestId('pdf-text-layer');
        const renglon = document.createElement('span');
        renglon.textContent = 'But this is   tautologous,\nand the simple dative';
        capa.appendChild(renglon);
        seleccionar(renglon);
        fireEvent.mouseUp(capa);
        expect(onTextSelected).toHaveBeenLastCalledWith('But this is tautologous, and the simple dative');
    });

    it('una selección fuera de la hoja o vacía no cuenta', () => {
        const onTextSelected = vi.fn();
        render(<div><p data-testid="afuera">texto del trabajo</p><PdfPageViewer url={null} sheet={1} selected={false} selectable onTextSelected={onTextSelected} /></div>);
        seleccionar(screen.getByTestId('afuera'));
        fireEvent.mouseUp(screen.getByTestId('pdf-text-layer'));
        expect(onTextSelected).toHaveBeenLastCalledWith(null);
        window.getSelection()!.removeAllRanges();
        fireEvent.mouseUp(screen.getByTestId('pdf-text-layer'));
        expect(onTextSelected).toHaveBeenLastCalledWith(null);
    });

    it('una selección que termina fuera de la hoja también se reporta; una de afuera no borra la que había', () => {
        const onTextSelected = vi.fn();
        render(<div><p data-testid="afuera">texto del trabajo</p><PdfPageViewer url={null} sheet={1} selected={false} selectable onTextSelected={onTextSelected} /></div>);
        const renglon = document.createElement('span');
        renglon.textContent = 'the simple dative rarely indicates agency';
        screen.getByTestId('pdf-text-layer').appendChild(renglon);
        seleccionar(renglon);
        fireEvent.mouseUp(document.body);
        expect(onTextSelected).toHaveBeenLastCalledWith('the simple dative rarely indicates agency');
        onTextSelected.mockClear();
        seleccionar(screen.getByTestId('afuera'));
        fireEvent.mouseUp(document.body);
        expect(onTextSelected).not.toHaveBeenCalled();
    });
});
