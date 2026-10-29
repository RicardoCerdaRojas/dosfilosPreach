import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cartCanSave, type CartSaveMode } from './cartSaveMode';

const SAVE_LABEL: Record<CartSaveMode, string> = {
    saving: 'paperSetup.subSteps.corpus.picker.cart.saving',
    saved: 'paperSetup.subSteps.corpus.picker.cart.saved',
    resave: 'paperSetup.subSteps.corpus.picker.cart.resave',
    update: 'paperSetup.subSteps.corpus.picker.cart.update',
    clear: 'paperSetup.subSteps.corpus.picker.cart.clearSave',
    add: 'paperSetup.subSteps.corpus.picker.cart.confirm',
};

/**
 * El botón del carrito. Guardar sin páginas pide confirmación: la fuente
 * queda en el corpus, pero vacía (TP #9, B20).
 *
 * Guardar NO se bloquea por presupuesto. La única forma de bajarlo es guardar
 * una selección más chica, así que bloquearlo dejaba al usuario encerrado: no
 * podía arreglar lo que el aviso le pedía arreglar. Y si las otras fuentes ya
 * se pasan solas, esta fuente no se podría guardar nunca.
 */
export function CartSaveButton({ saveMode, sheetCount, overBudget, onConfirm }: {
    saveMode: CartSaveMode;
    sheetCount: number;
    overBudget: boolean;
    onConfirm: () => void;
}) {
    const { t } = useTranslation('exegesis');
    const [confirmando, setConfirmando] = useState(false);
    const base = 'paperSetup.subSteps.corpus.picker.cart.clearDialog';
    return (
        <>
            <Button
                type="button"
                className="w-full"
                variant={overBudget || saveMode === 'clear' ? 'outline' : 'default'}
                disabled={!cartCanSave(saveMode, sheetCount)}
                onClick={() => (saveMode === 'clear' ? setConfirmando(true) : onConfirm())}
            >
                {t(SAVE_LABEL[saveMode], { count: sheetCount })}
            </Button>
            <ConfirmDialog
                open={confirmando}
                onOpenChange={setConfirmando}
                title={t(`${base}.title`)}
                body={t(`${base}.body`)}
                confirmLabel={t(`${base}.confirm`)}
                cancelLabel={t(`${base}.cancel`)}
                destructive={false}
                onConfirm={() => {
                    setConfirmando(false);
                    onConfirm();
                }}
            />
        </>
    );
}
