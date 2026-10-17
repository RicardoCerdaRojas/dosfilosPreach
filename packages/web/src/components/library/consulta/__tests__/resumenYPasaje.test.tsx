import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/** Fase «biblioteca consultable», etapa 2: U7 (resúmenes breves) y U6 (pasajes por autor). */
const resumir = vi.fn();
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }));
vi.mock('@dosfilos/infrastructure', () => ({ resumirEnBiblioteca: (...a: unknown[]) => resumir(...a), consultarBiblioteca: vi.fn() }));
const { ResumenDelLibro } = await import('../ResumenDelLibro');
const { RespuestaConCitas } = await import('../RespuestaConCitas');
const { autoresDelPasaje } = await import('../autoresDelPasaje');
const { PreguntarAlLibro } = await import('../PreguntarAlLibro');

const resumen = (extra: Record<string, unknown> = {}) => ({
    tipo: 'mapa', desde: null, hasta: null, titulo: null,
    resumen: 'Santiago trata la fe que obra.',
    puntos: [{ texto: 'La lengua', hojas: [120, 122] }],
    guardado: false,
    ...extra,
});

beforeEach(() => resumir.mockReset());

describe('U7 — ResumenDelLibro', () => {
    it('pide el resumen al montarse, lo muestra y cada página lleva al libro', async () => {
        resumir.mockResolvedValue(resumen());
        const ir = vi.fn();
        render(<ResumenDelLibro pedido={{ resourceId: 'v', tipo: 'mapa' }} paginaDeHoja={h => `p. ${h - 2}`} onIrAHoja={ir} />);
        expect(resumir).toHaveBeenCalledWith({ resourceId: 'v', tipo: 'mapa' });
        await screen.findByText('Santiago trata la fe que obra.');
        fireEvent.click(screen.getByText('p. 118'));
        expect(ir).toHaveBeenCalledWith(120);
        expect(screen.getByText('consult.summary.counted')).toBeTruthy();
    });

    it('uno guardado dice que no contó', async () => {
        resumir.mockResolvedValue(resumen({ guardado: true }));
        render(<ResumenDelLibro pedido={{ resourceId: 'v', tipo: 'mapa' }} paginaDeHoja={String} onIrAHoja={vi.fn()} />);
        await screen.findByText('consult.summary.saved');
    });

    it('el capítulo lleva su título; el error del servidor se muestra tal cual', async () => {
        resumir.mockResolvedValueOnce(resumen({ tipo: 'seccion', titulo: 'Capítulo 3', desde: 40, hasta: 52 }));
        const { unmount } = render(<ResumenDelLibro pedido={{ resourceId: 'v', tipo: 'seccion', hoja: 45 }} paginaDeHoja={String} onIrAHoja={vi.fn()} />);
        await screen.findByText(/consult.summary.sectionTitle.*Capítulo 3/);
        unmount();
        resumir.mockRejectedValueOnce(new Error('Alcanzaste tu límite de 20 consultas este mes.'));
        render(<ResumenDelLibro pedido={{ resourceId: 'v', tipo: 'mapa' }} paginaDeHoja={String} onIrAHoja={vi.fn()} />);
        expect((await screen.findByRole('alert')).textContent).toContain('Alcanzaste tu límite');
    });
});

describe('U7 — en el visor', () => {
    it('«Resumir este capítulo» pide la sección de la hoja que se está leyendo', async () => {
        resumir.mockResolvedValue(resumen({ tipo: 'seccion', titulo: 'Cap', desde: 40, hasta: 52 }));
        render(<PreguntarAlLibro resourceId="v" etiquetar={() => '(Varner, p. 1)'} onIrAHoja={vi.fn()} hojaActual={45} paginaImpresa={h => h - 2} />);
        fireEvent.click(screen.getByText('consult.summary.section'));
        await waitFor(() => expect(resumir).toHaveBeenCalledWith({ resourceId: 'v', tipo: 'seccion', hoja: 45 }));
        fireEvent.click(screen.getByText('consult.summary.map'));
        await waitFor(() => expect(resumir).toHaveBeenLastCalledWith({ resourceId: 'v', tipo: 'mapa' }));
    });
});

describe('U6 — la respuesta sobre un pasaje', () => {
    const fuente = (n: number, autor: string, hoja: number, resourceId = autor) => ({ n, resourceId, titulo: `Libro de ${autor}`, autor, hoja, seccion: '', extracto: '' });
    const etiquetar = (f: { autor: string; hoja: number | null }) => `(${f.autor}, p. ${f.hoja})`;

    it('agrupa por autor, en el orden de las citas y sin repetir páginas', () => {
        const a = autoresDelPasaje([fuente(2, 'Moo', 50), fuente(1, 'Varner', 120), fuente(3, 'Varner', 122), fuente(4, 'Varner', 120)], etiquetar);
        expect(a.map(x => [x.autor, x.paginas.map(p => p.etiqueta)])).toEqual([['Varner', ['p. 120', 'p. 122']], ['Moo', ['p. 50']]]);
    });

    it('con pasaje: el encabezado y los autores, cada página abre su fuente; sin pasaje, nada', () => {
        const abrir = vi.fn();
        const turno = { pregunta: '¿Qué dicen sobre Santiago 3:13?', respuesta: '**Varner** entiende… [F1]', fuentes: [fuente(1, 'Varner', 120)], creado: new Date(), pasaje: 'Santiago 3:13' };
        const { rerender } = render(<RespuestaConCitas turno={turno} etiquetar={etiquetar} onAbrirFuente={abrir} />);
        expect(screen.getByTestId('pasaje-de-la-respuesta').textContent).toContain('Santiago 3:13');
        fireEvent.click(screen.getByText('p. 120'));
        expect(abrir).toHaveBeenCalledWith(turno.fuentes[0]);
        rerender(<RespuestaConCitas turno={{ ...turno, pasaje: undefined }} etiquetar={etiquetar} onAbrirFuente={abrir} />);
        expect(screen.queryByTestId('pasaje-de-la-respuesta')).toBeNull();
    });
});
