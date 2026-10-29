import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { PageNumbering } from '@dosfilos/domain';

/**
 * TP #9, B27: en el NA28 la hoja 803 lleva impresa la p. 692. El fundador
 * escribió 803 en «Ir a p.» queriendo la hoja y fue a la p. 803; y una página
 * que no existía se tomaba en silencio como hoja.
 */
vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}));
const { IrAPagina } = await import('../IrAPagina');

afterEach(cleanup);

const NA28: PageNumbering = { origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 1000, offset: -111 }] };

const montar = (numbering: PageNumbering | null, offset: number | null = null) => {
    const onGo = vi.fn();
    render(<IrAPagina numbering={numbering} printedPageOffset={offset} totalSheets={1000} onGo={onGo} />);
    return onGo;
};
const ir = (label: string, valor: string) => {
    const campo = screen.getByLabelText(label);
    fireEvent.change(campo, { target: { value: valor } });
    fireEvent.submit(campo.closest('form')!);
};

describe('IrAPagina — libro con numeración impresa', () => {
    it('pide la página impresa por defecto: 692 es la hoja 803', () => {
        const onGo = montar(NA28);
        expect(screen.getByRole('button', { name: 'citationViewer.jump.mode.printed' })).toHaveAttribute('aria-pressed', 'true');
        ir('citationViewer.jump.printedAria', '692');
        expect(onGo).toHaveBeenCalledWith(803);
    });

    it('con el conmutador en «hoja», 803 es la hoja 803', () => {
        const onGo = montar(NA28);
        fireEvent.click(screen.getByRole('button', { name: 'citationViewer.jump.mode.sheet' }));
        ir('citationViewer.jump.sheetAria', '803');
        expect(onGo).toHaveBeenCalledWith(803);
    });

    it('«h. 803» va a la hoja sin tocar el conmutador', () => {
        const onGo = montar(NA28);
        ir('citationViewer.jump.printedAria', 'h. 803');
        expect(onGo).toHaveBeenCalledWith(803);
    });

    it('una página que el libro no tiene avisa en línea y no salta', () => {
        const onGo = montar(NA28);
        ir('citationViewer.jump.printedAria', '950');
        expect(onGo).not.toHaveBeenCalled();
        expect(screen.getByTestId('ir-a-aviso').textContent)
            .toBe('citationViewer.jump.printedOutOfBook {"page":"950","first":"1","last":"889"}');
        expect(screen.getByLabelText('citationViewer.jump.printedAria')).toHaveAttribute('aria-invalid', 'true');
    });

    it('una página en láminas sin numerar lo dice', () => {
        const conLaminas: PageNumbering = { origin: 'confirmed', segments: [
            { fromSheet: 1, toSheet: 40, offset: 0 },
            { fromSheet: 41, toSheet: 44, offset: null },
            { fromSheet: 45, toSheet: 1000, offset: 0 },
        ] };
        const onGo = montar(conLaminas);
        ir('citationViewer.jump.printedAria', '42');
        expect(onGo).not.toHaveBeenCalled();
        expect(screen.getByTestId('ir-a-aviso').textContent).toBe('citationViewer.jump.printedUnnumbered {"page":"42"}');
    });
});

describe('IrAPagina — libro sin numeración conocida', () => {
    it('pide la hoja y lo dice', () => {
        const onGo = montar(null);
        expect(screen.queryByRole('button', { name: 'citationViewer.jump.mode.printed' })).toBeNull();
        expect(screen.getByTestId('ir-a-sin-numeracion').textContent).toBe('citationViewer.jump.noNumberingHint');
        ir('citationViewer.jump.sheetAria', '12');
        expect(onGo).toHaveBeenCalledWith(12);
    });

    it('una hoja que el archivo no tiene avisa', () => {
        const onGo = montar(null);
        ir('citationViewer.jump.sheetAria', '1200');
        expect(onGo).not.toHaveBeenCalled();
        expect(screen.getByTestId('ir-a-aviso').textContent).toBe('citationViewer.jump.sheetOutOfBook {"total":1000}');
    });
});
