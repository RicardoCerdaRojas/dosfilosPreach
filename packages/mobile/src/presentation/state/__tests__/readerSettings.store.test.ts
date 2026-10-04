import { beforeEach, describe, expect, it } from '@jest/globals';
import { useReaderSettingsStore } from '../readerSettings.store';

describe('ajustes del lector', () => {
    beforeEach(() => {
        useReaderSettingsStore.setState({ senseLines: false, gazeLine: false });
    });

    it('colometría y línea de mirada se excluyen: encender una apaga la otra', () => {
        const s = useReaderSettingsStore.getState();
        s.setGazeLine(true);
        s.setSenseLines(true);
        expect(useReaderSettingsStore.getState()).toMatchObject({ senseLines: true, gazeLine: false });
        useReaderSettingsStore.getState().setGazeLine(true);
        expect(useReaderSettingsStore.getState()).toMatchObject({ senseLines: false, gazeLine: true });
    });

    it('migración v0 → v1: el tablero apagado sigue apagado', () => {
        const migrate = useReaderSettingsStore.persist.getOptions().migrate!;
        expect(migrate({ instrumentPanel: false }, 0)).toMatchObject({ panelMode: 'off' });
        expect(migrate({ instrumentPanel: true }, 0)).toMatchObject({ panelMode: 'full' });
    });
});
