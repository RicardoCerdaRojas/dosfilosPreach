import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ConsultaGuardada } from '@dosfilos/infrastructure';

/** Fase «biblioteca consultable», U3: la pestaña «Consultar». */
const open = vi.fn();
const consultar = vi.fn();
let alCambiar: ((c: ConsultaGuardada[]) => void) | null = null;
vi.mock('@/components/exegesis/citation/SourceViewerProvider', () => ({ useSourceViewer: () => ({ open, close: vi.fn() }) }));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: { count?: number }) => (o?.count !== undefined ? `${k}:${o.count}` : k) }) }));
vi.mock('@dosfilos/infrastructure', () => ({
    consultarBiblioteca: (...a: unknown[]) => consultar(...a),
    escucharConsultas: (_u: string, cb: (c: ConsultaGuardada[]) => void) => { alCambiar = cb; cb([]); return () => {}; },
    borrarConsulta: vi.fn(),
}));
const { ConsultarBiblioteca } = await import('../ConsultarBiblioteca');

const varner = {
    id: 'v', title: 'The Book of James—A New Perspective', author: 'William Varner',
    pageNumbering: { segments: [{ fromSheet: 5, toSheet: 244, offset: -4 }], origin: 'confirmed' },
};
const guardada: ConsultaGuardada = {
    id: 'c1', titulo: '¿Qué dice de 5:12?', alcance: { tipo: 'libros', ids: ['v'] }, actualizada: new Date(),
    turnos: [{
        pregunta: '¿Qué dice de 5:12?',
        respuesta: 'Es el logion más explícito de Jesús en la carta [F2].',
        fuentes: [{ n: 2, resourceId: 'v', titulo: varner.title, autor: 'Varner', hoja: 190, seccion: '', extracto: 'There is a distinctly new note…' }],
        creado: new Date(),
    }],
};

beforeEach(() => { open.mockClear(); consultar.mockReset(); });

describe('Consultar la biblioteca', () => {
    it('una consulta guardada muestra la cita con la página impresa y abre el visor en su hoja', async () => {
        render(<ConsultarBiblioteca resources={[varner] as never} indexStatus={{ v: 'indexed' }} />);
        act(() => alCambiar!([guardada]));
        fireEvent.click(screen.getByText('¿Qué dice de 5:12?', { selector: 'span' }));
        const cita = await screen.findByTestId('cita-de-consulta');
        expect(cita.textContent).toBe('(Varner, p. 186)');
        fireEvent.click(cita);
        expect(open).toHaveBeenCalledWith({ paperId: null, citation: { sourceKey: 'Varner', page: 190, resourceId: 'v', label: varner.title } }, 'full');
    });

    it('una pregunta nueva viaja con el alcance elegido y se abre al responder', async () => {
        consultar.mockResolvedValue({ consultaId: 'c9', turno: { ...guardada.turnos[0]!, pregunta: '¿Qué es la sabiduría?' } });
        render(<ConsultarBiblioteca resources={[varner] as never} indexStatus={{ v: 'indexed' }} />);
        fireEvent.change(screen.getByLabelText('consult.placeholder'), { target: { value: '¿Qué es la sabiduría?' } });
        fireEvent.click(screen.getByLabelText('consult.send'));
        await waitFor(() => expect(consultar).toHaveBeenCalledWith({ pregunta: '¿Qué es la sabiduría?', alcance: { tipo: 'todo' } }));
        expect(await screen.findByText('¿Qué es la sabiduría?', { selector: 'h3' })).toBeTruthy();
    });

    it('si falla, el error del servidor se muestra y la pregunta vuelve a la caja', async () => {
        consultar.mockRejectedValue(new Error('Alcanzaste tu límite de 50 consultas este mes.'));
        render(<ConsultarBiblioteca resources={[varner] as never} indexStatus={{ v: 'indexed' }} />);
        const caja = screen.getByLabelText('consult.placeholder') as HTMLTextAreaElement;
        fireEvent.change(caja, { target: { value: 'Una pregunta' } });
        fireEvent.click(screen.getByLabelText('consult.send'));
        expect((await screen.findByRole('alert')).textContent).toContain('límite de 50');
        expect(caja.value).toBe('Una pregunta');
    });
});
