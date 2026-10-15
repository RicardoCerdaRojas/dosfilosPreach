import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/** Fase «biblioteca consultable», U4: «Preguntar a este libro» en el visor. */
const consultar = vi.fn();
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('@dosfilos/infrastructure', () => ({ consultarBiblioteca: (...a: unknown[]) => consultar(...a) }));
const { PreguntarAlLibro } = await import('../PreguntarAlLibro');

const turno = (pregunta: string) => ({
    pregunta,
    respuesta: 'Es el logion más explícito [F1].',
    fuentes: [{ n: 1, resourceId: 'v', titulo: 'Varner', autor: 'Varner', hoja: 190, seccion: '', extracto: '' }],
    creado: new Date(),
});

beforeEach(() => consultar.mockReset());

describe('Preguntar a este libro', () => {
    it('la primera pregunta va con el libro como alcance; la siguiente sigue la misma consulta', async () => {
        consultar.mockResolvedValueOnce({ consultaId: 'c1', turno: turno('¿Qué dice de 5:12?') })
            .mockResolvedValueOnce({ consultaId: 'c1', turno: turno('¿Y de 5:13?') });
        render(<PreguntarAlLibro resourceId="v" etiquetar={() => '(Varner, p. 186)'} onIrAHoja={vi.fn()} />);
        const caja = screen.getByLabelText('consult.placeholderBook');
        fireEvent.change(caja, { target: { value: '¿Qué dice de 5:12?' } });
        fireEvent.click(screen.getByLabelText('consult.send'));
        await waitFor(() => expect(consultar).toHaveBeenCalledWith({ pregunta: '¿Qué dice de 5:12?', alcance: { tipo: 'libros', ids: ['v'] } }));
        await screen.findByText('¿Qué dice de 5:12?');
        fireEvent.change(screen.getByLabelText('consult.placeholderBook'), { target: { value: '¿Y de 5:13?' } });
        fireEvent.click(screen.getByLabelText('consult.send'));
        await waitFor(() => expect(consultar).toHaveBeenLastCalledWith({ pregunta: '¿Y de 5:13?', consultaId: 'c1' }));
    });

    it('una cita lleva el visor a su hoja', async () => {
        consultar.mockResolvedValue({ consultaId: 'c1', turno: turno('¿Qué dice?') });
        const ir = vi.fn();
        render(<PreguntarAlLibro resourceId="v" etiquetar={() => '(Varner, p. 186)'} onIrAHoja={ir} />);
        fireEvent.change(screen.getByLabelText('consult.placeholderBook'), { target: { value: '¿Qué dice?' } });
        fireEvent.click(screen.getByLabelText('consult.send'));
        fireEvent.click(await screen.findByTestId('cita-de-consulta'));
        expect(ir).toHaveBeenCalledWith(190);
    });
});
