import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

/**
 * TP #8 (2026-10-21, fase 8a, A5): con 407–418 en el carrito no se podía fijar
 * sólo la 411, la nota de Mayor sobre 4:3. «Fijar» comparaba el tramo exacto.
 */
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k),
        i18n: { language: 'es' },
    }),
}));
const { SelectionCart } = await import('../SelectionCart');
const { PageRail } = await import('../PageRail');

afterEach(cleanup);

const huella = { excerptChars: 0, admittedChars: 0, pinnedChars: 0, wholeDocuments: 0, perStepChars: 0, pending: false };

const carrito = (pinnedRanges: Array<{ start: number; end: number }>, onTogglePinned = vi.fn()) => render(
    <SelectionCart
        ranges={[{ start: 407, end: 418 }]}
        sections={[]}
        printedPageOffset={null}
        otherSources={huella}
        selectedChars={1000}
        sheetCount={12}
        onRemoveRange={vi.fn()}
        onClear={vi.fn()}
        pinnedRanges={pinnedRanges}
        onTogglePinned={onTogglePinned}
        pinnedChars={0}
        onConfirm={vi.fn()}
        saveMode="add"
        numbering={null}
    />,
);

const botonDeFijar = () => screen.getByRole('button', { name: /picker\.cart\.(un)?pin / });

describe('el carrito con hojas fijadas sueltas', () => {
    it('dice cuántas hojas del tramo están fijadas y marca el botón a medias', () => {
        carrito([{ start: 411, end: 411 }]);
        expect(screen.getByText(/cart\.pinnedSome/).textContent).toContain('"count":1,"total":12');
        expect(botonDeFijar()).toHaveAttribute('aria-pressed', 'mixed');
    });

    it('un tramo fijado entero sigue fijado aunque el carrito lo haya agrandado por otra hoja', () => {
        carrito([{ start: 407, end: 418 }]);
        expect(botonDeFijar()).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByText(/cart\.pinnedSome/)).toBeNull();
    });

    it('sin nada fijado, el botón está suelto', () => {
        carrito([]);
        expect(botonDeFijar()).toHaveAttribute('aria-pressed', 'false');
    });
});

describe('el riel fija hoja por hoja', () => {
    const paginas = [410, 411, 412].map(sheet => ({ sheet, chunkIndices: [sheet], charCount: 100, section: null, firstLine: '' }));
    const riel = (onTogglePinned = vi.fn()) => render(
        <PageRail
            pages={paginas as never}
            printedPageOffset={null}
            numbering={null}
            selected={new Set([410, 411])}
            proposed={new Set()}
            anchor={null}
            currentSheet={410}
            onGoToSheet={vi.fn()}
            onToggleSheet={vi.fn()}
            pinned={new Set([411])}
            onTogglePinned={onTogglePinned}
        />,
    );

    it('ofrece fijar sólo las hojas elegidas, y la 411 aparece fijada', () => {
        const onTogglePinned = vi.fn();
        riel(onTogglePinned);
        expect(screen.getByRole('button', { name: /rail\.unpinSheet.*411/ })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByRole('button', { name: /rail\.pinSheet.*410/ }));
        expect(onTogglePinned).toHaveBeenCalledWith(410);
        // La 412 no está elegida: no se fija lo que no entra al corpus.
        expect(screen.queryByRole('button', { name: /rail\.pinSheet.*412/ })).toBeNull();
    });
});
