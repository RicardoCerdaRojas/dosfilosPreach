import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { PaperStudyReference } from '@dosfilos/domain';
import { adaptedDiscoveryState } from '../wordStudy/adaptedDiscovery';
import { PaperStudyReferencePanel } from '../PaperStudyReferencePanel';

/**
 * La palabra del paper al estudio del pastor (#28 del ejercicio de Jonás).
 * El fundador: «que levante un modal para que el pastor adapte el texto y
 * sólo vaya su descubrimiento… No lo cortes».
 */
vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const EXPLICACION = '«planta de ricino» Rango: ricino, calabacera. Dios la prepara para enseñarle a Jonás algo sobre la compasión.';

const reference: PaperStudyReference = {
    paperTitle: 'Jonás 4',
    analyzedVerses: ['Jonás 4:6'],
    byStep: {
        wordStudies: [{
            label: 'קִיקָיוֹן (קִיקָיוֹן)',
            detail: EXPLICACION,
            verseLabel: 'Jonás 4:6',
            wordStudySeed: {
                word: 'קִיקָיוֹן', lemma: 'קִיקָיוֹן', reference: 'Jonás 4:6',
                language: 'hebrew', explanation: EXPLICACION,
            },
        }],
    },
} as unknown as PaperStudyReference;

describe('adaptedDiscoveryState', () => {
    it('el texto del paper tal cual no pasa, ni con otros espacios', () => {
        expect(adaptedDiscoveryState(EXPLICACION, EXPLICACION, 30)).toBe('unchanged');
        expect(adaptedDiscoveryState(EXPLICACION, `  ${EXPLICACION.replace(/ /g, '\n')}  `, 30)).toBe('unchanged');
    });
    it('quitar un punto o cambiar una palabra no lo hace suyo', () => {
        expect(adaptedDiscoveryState(EXPLICACION, EXPLICACION.replace(/\.$/, ''), 30)).toBe('unchanged');
        expect(adaptedDiscoveryState(EXPLICACION, EXPLICACION.replace('enseñarle', 'mostrarle'), 30)).toBe('unchanged');
    });
    it('quedarse con una parte sí: reutilizar es la idea', () => {
        expect(adaptedDiscoveryState(EXPLICACION, 'Dios la prepara para enseñarle a Jonás algo sobre la compasión.', 30)).toBe('ready');
    });
    it('lo adaptado pasa si llega al mínimo', () => {
        expect(adaptedDiscoveryState(EXPLICACION, 'Dios prepara la planta para enseñar compasión.', 30)).toBe('ready');
        expect(adaptedDiscoveryState(EXPLICACION, 'ricino', 30)).toBe('too-short');
    });
});

describe('PaperStudyReferencePanel — la palabra abre el modal', () => {
    function abrir(onAdd?: (s: unknown) => Promise<void>) {
        render(<PaperStudyReferencePanel reference={reference} stepKey="wordStudies" onAddWordStudy={onAdd} />);
        fireEvent.click(screen.getByRole('button', { name: /paperReference.title/ }));
    }

    it('el modal trae la explicación ENTERA y sólo agrega lo adaptado', async () => {
        const onAdd = vi.fn().mockResolvedValue(undefined);
        abrir(onAdd);
        fireEvent.click(screen.getByRole('button', { name: 'קִיקָיוֹן (קִיקָיוֹן)' }));

        const caja = screen.getByLabelText('fromPaper.discovery') as HTMLTextAreaElement;
        expect(caja.value).toBe(EXPLICACION);
        const agregar = screen.getByRole('button', { name: 'fromPaper.add' });
        expect(agregar).toBeDisabled();

        const mio = 'Dios prepara la planta: la compasión se enseña con algo que Jonás pierde.';
        fireEvent.change(caja, { target: { value: mio } });
        fireEvent.click(agregar);
        await waitFor(() => expect(onAdd).toHaveBeenCalledWith({
            word: 'קִיקָיוֹן', lemma: 'קִיקָיוֹן', reference: 'Jonás 4:6', language: 'hebrew', pastorDiscovery: mio,
        }));
    });

    it('sin onAddWordStudy la palabra es texto, no botón', () => {
        abrir(undefined);
        expect(screen.queryByRole('button', { name: 'קִיקָיוֹן (קִיקָיוֹן)' })).toBeNull();
        expect(screen.getByText('קִיקָיוֹן (קִיקָיוֹן)')).toBeTruthy();
    });
});
