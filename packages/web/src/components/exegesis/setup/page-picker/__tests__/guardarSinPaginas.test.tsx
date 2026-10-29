import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { CartSaveMode } from '../cartSaveMode';

/**
 * TP #9 (Santiago 4:11-17, B20): quitar TODAS las páginas de Tuggy dejaba el
 * botón apagado y no había forma de guardar. Ahora se guarda «sin páginas»,
 * con una confirmación que dice lo que implica.
 */
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k),
        i18n: { language: 'es' },
    }),
}));
const { SelectionCart } = await import('../SelectionCart');

afterEach(cleanup);

const huella = { excerptChars: 0, admittedChars: 0, pinnedChars: 0, wholeDocuments: 0, perStepChars: 0, pending: false };

const carrito = (saveMode: CartSaveMode, onConfirm = vi.fn()) => render(
    <SelectionCart
        ranges={[]}
        sections={[]}
        printedPageOffset={null}
        otherSources={huella}
        selectedChars={0}
        sheetCount={0}
        onRemoveRange={vi.fn()}
        onClear={vi.fn()}
        pinnedRanges={[]}
        onTogglePinned={vi.fn()}
        pinnedChars={0}
        onConfirm={onConfirm}
        saveMode={saveMode}
        numbering={null}
    />,
);

const boton = () => screen.getByRole('button', { name: /picker\.cart\.(clearSave|confirm)/ });

describe('guardar una fuente sin páginas', () => {
    it('con todo quitado, el botón se pulsa, avisa, y guarda sólo tras confirmar', () => {
        const onConfirm = vi.fn();
        carrito('clear', onConfirm);
        expect(screen.getByTestId('carrito-vaciar-aviso')).toBeInTheDocument();
        expect(boton()).toBeEnabled();
        fireEvent.click(boton());
        // Primero la confirmación, que dice qué implica.
        expect(onConfirm).not.toHaveBeenCalled();
        expect(screen.getByText('paperSetup.subSteps.corpus.picker.cart.clearDialog.body')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'paperSetup.subSteps.corpus.picker.cart.clearDialog.confirm' }));
        expect(onConfirm).toHaveBeenCalledOnce();
    });

    it('cancelar no guarda', () => {
        const onConfirm = vi.fn();
        carrito('clear', onConfirm);
        fireEvent.click(boton());
        fireEvent.click(screen.getByRole('button', { name: 'paperSetup.subSteps.corpus.picker.cart.clearDialog.cancel' }));
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('una primera selección vacía sigue sin poder guardarse', () => {
        carrito('add');
        expect(boton()).toBeDisabled();
        expect(screen.queryByTestId('carrito-vaciar-aviso')).toBeNull();
    });
});
