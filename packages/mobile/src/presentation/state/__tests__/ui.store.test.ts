import { describe, expect, it, jest } from '@jest/globals';
import { useUIStore } from '../ui.store';

describe('aviso con acción', () => {
    it('«Deshacer» viaja con el aviso', () => {
        const deshacer = jest.fn();
        useUIStore.getState().showToast('Marcado como predicado.', 'success', 6000, { label: 'Deshacer', onPress: deshacer });
        const { toast } = useUIStore.getState();
        expect(toast?.action?.label).toBe('Deshacer');
        toast?.action?.onPress();
        expect(deshacer).toHaveBeenCalled();
        useUIStore.getState().hideToast();
    });
});
