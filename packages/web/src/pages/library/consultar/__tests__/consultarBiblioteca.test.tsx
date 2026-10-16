import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ConsultaGuardada } from '@dosfilos/infrastructure';

/** Fase «biblioteca consultable», U3: la pestaña «Consultar». */
const open = vi.fn();
const consultar = vi.fn();
const temas = vi.fn();
let alCambiar: ((c: ConsultaGuardada[]) => void) | null = null;
vi.mock('@/components/exegesis/citation/SourceViewerProvider', () => ({ useSourceViewer: () => ({ open, close: vi.fn() }) }));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: { count?: number }) => (o?.count !== undefined ? `${k}:${o.count}` : k) }) }));
vi.mock('@dosfilos/infrastructure', () => ({
    consultarBiblioteca: (...a: unknown[]) => consultar(...a),
    escucharConsultas: (_u: string, cb: (c: ConsultaGuardada[]) => void) => { alCambiar = cb; cb([]); return () => {}; },
    borrarConsulta: vi.fn(),
    buscarTemasEnBiblioteca: (...a: unknown[]) => temas(...a),
}));
const { ConsultarBiblioteca } = await import('../ConsultarBiblioteca');

const varner = {
    id: 'v', title: 'The Book of James—A New Perspective', author: 'William Varner',
    pageNumbering: { segments: [{ fromSheet: 5, toSheet: 244, offset: -4 }], origin: 'confirmed' },
};
const guardada: ConsultaGuardada = {
    id: 'c1', tipo: 'preguntar', titulo: '¿Qué dice de 5:12?', alcance: { tipo: 'libros', ids: ['v'] }, actualizada: new Date(),
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

    it('«Buscar temas» busca con el alcance elegido, agrupa por libro y cada hoja abre el visor', async () => {
        temas.mockResolvedValue({ consultaId: 't9', reordenado: false, libros: [{ resourceId: 'v', titulo: varner.title, autor: 'William Varner', hojas: [{ hoja: 192, seccion: 'Paragraph 22', extracto: 'Diaspora encyclical…', score: 0.8 }] }] });
        render(<ConsultarBiblioteca resources={[varner] as never} indexStatus={{ v: 'indexed' }} />);
        fireEvent.click(screen.getByText('consult.modeTopics'));
        expect(screen.queryByLabelText('consult.placeholder')).toBeNull();
        fireEvent.change(screen.getByLabelText('consult.topicPlaceholder'), { target: { value: 'la oración' } });
        fireEvent.click(screen.getByText('consult.topicSearch'));
        await waitFor(() => expect(temas).toHaveBeenCalledWith('la oración', { tipo: 'todo' }));
        // En la ficha del libro, la página en grande (el autor ya está en la cabecera).
        const hoja = await screen.findByText('p. 188');
        // Si no se pudo ordenar por pertinencia, se dice.
        expect(screen.getByText('consult.topicApproximate')).toBeTruthy();
        fireEvent.click(hoja);
        expect(open).toHaveBeenCalledWith({ paperId: null, citation: { sourceKey: 'Varner', page: 192, resourceId: 'v', label: varner.title } }, 'full');
        // Queda marcada en el historial cuando el listener la trae.
        act(() => alCambiar!([{ id: 't9', tipo: 'temas', titulo: 'la oración', alcance: { tipo: 'todo' }, turnos: [], actualizada: new Date() }]));
        expect(screen.getByText('la oración', { selector: 'span' }).closest('button')!.getAttribute('aria-current')).toBe('true');
    });

    it('si abre otra consulta mientras responde, la respuesta no lo saca de ahí', async () => {
        let responder!: (v: unknown) => void;
        consultar.mockReturnValue(new Promise(r => { responder = r; }));
        const otra: ConsultaGuardada = { ...guardada, id: 'c2', titulo: 'Otra consulta', turnos: [{ ...guardada.turnos[0]!, pregunta: 'Otra consulta' }] };
        render(<ConsultarBiblioteca resources={[varner] as never} indexStatus={{ v: 'indexed' }} />);
        act(() => alCambiar!([guardada, otra]));
        fireEvent.click(screen.getByText('¿Qué dice de 5:12?', { selector: 'span' }));
        fireEvent.change(screen.getByLabelText('consult.placeholder'), { target: { value: '¿Y 5:13?' } });
        fireEvent.click(screen.getByLabelText('consult.send'));
        fireEvent.click(screen.getByText('Otra consulta', { selector: 'span' }));
        await act(async () => { responder({ consultaId: 'c1', turno: guardada.turnos[0] }); });
        expect(screen.getByText('Otra consulta', { selector: 'span' }).closest('button')!.getAttribute('aria-current')).toBe('true');
    });

    it('una búsqueda de temas guardada se abre desde el historial, sin caja para preguntar', async () => {
        const tema: ConsultaGuardada = {
            id: 't1', tipo: 'temas', titulo: 'la oración por los enfermos', alcance: { tipo: 'todo' }, turnos: [], actualizada: new Date(),
            temas: { consulta: 'la oración por los enfermos', reordenado: true, libros: [{ resourceId: 'v', titulo: varner.title, autor: 'William Varner', hojas: [{ hoja: 191, seccion: '', extracto: '¹³Κακοπαθεῖ τις', score: 0.8 }] }] },
        };
        render(<ConsultarBiblioteca resources={[varner] as never} indexStatus={{ v: 'indexed' }} />);
        act(() => alCambiar!([tema]));
        fireEvent.click(screen.getByText('la oración por los enfermos', { selector: 'span' }));
        expect(screen.getByTestId('temas-guardados')).toBeTruthy();
        expect(screen.queryByLabelText('consult.placeholder')).toBeNull();
        fireEvent.click(screen.getByText('p. 187'));
        expect(open).toHaveBeenCalledWith({ paperId: null, citation: { sourceKey: 'Varner', page: 191, resourceId: 'v', label: varner.title } }, 'full');
    });

    it('una conversación muestra el riel de fuentes con sus páginas, y el griego va en su fuente', async () => {
        const conGriego: ConsultaGuardada = {
            ...guardada,
            turnos: [{ ...guardada.turnos[0]!, respuesta: 'Dice ἡ εὐχή τῆς πίστεως [F2].' }],
        };
        render(<ConsultarBiblioteca resources={[varner] as never} indexStatus={{ v: 'indexed' }} />);
        act(() => alCambiar!([conGriego]));
        fireEvent.click(screen.getByText('¿Qué dice de 5:12?', { selector: 'span' }));
        const rail = await screen.findByTestId('fuentes-de-la-consulta');
        fireEvent.click(within(rail).getByText('p. 186'));
        expect(open).toHaveBeenCalledWith({ paperId: null, citation: { sourceKey: 'Varner', page: 190, resourceId: 'v', label: varner.title } }, 'full');
        const griego = screen.getByText('ἡ εὐχή τῆς πίστεως');
        expect(griego.getAttribute('lang')).toBe('grc');
        expect(griego.className).toContain('font-greek');
    });

    it('el filtro por libro no pasa de una búsqueda guardada a otra', async () => {
        const libro = (rid: string, titulo: string) => ({ resourceId: rid, titulo, autor: `Autor ${rid}`, hojas: [{ hoja: 1, seccion: '', extracto: titulo, score: 0.8, pertinencia: 9 }] });
        const a: ConsultaGuardada = { id: 'ta', tipo: 'temas', titulo: 'Tema A', alcance: { tipo: 'todo' }, turnos: [], actualizada: new Date(), temas: { consulta: 'Tema A', reordenado: true, libros: [libro('x', 'Libro X'), libro('y', 'Libro Y')] } };
        const b: ConsultaGuardada = { id: 'tb', tipo: 'temas', titulo: 'Tema B', alcance: { tipo: 'todo' }, turnos: [], actualizada: new Date(), temas: { consulta: 'Tema B', reordenado: true, libros: [libro('z', 'Libro Z'), libro('w', 'Libro W')] } };
        render(<ConsultarBiblioteca resources={[] as never} indexStatus={{}} />);
        act(() => alCambiar!([a, b]));
        fireEvent.click(screen.getByText('Tema A', { selector: 'span' }));
        fireEvent.click(screen.getByText('x · 1'));
        expect(screen.queryByText('Libro Y', { selector: 'h3' })).toBeNull();
        fireEvent.click(screen.getByText('Tema B', { selector: 'span' }));
        expect(screen.getByText('Libro Z', { selector: 'h3' })).toBeTruthy();
        expect(screen.getByText('Libro W', { selector: 'h3' })).toBeTruthy();
    });
});

