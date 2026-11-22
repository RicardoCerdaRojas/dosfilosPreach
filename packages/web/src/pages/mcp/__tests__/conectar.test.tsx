import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }) }));
vi.mock('@/components/auth/auth-layout', () => ({ AuthLayout: ({ title, subtitle, children }: { title: string; subtitle?: string; children: unknown }) => <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}{children as never}</div> }));
let usuario: unknown = null;
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: usuario, loading: false }) }));
const navegar = vi.fn();
vi.mock('react-router-dom', async orig => ({ ...(await orig<object>()), useNavigate: () => navegar }));
let solicitud: { isLoading: boolean; isError: boolean; data?: unknown } = { isLoading: false, isError: false };
const decidir = vi.fn(async (aprobar: boolean) => (aprobar ? 'https://claude.ai/api/mcp/auth_callback?code=c' : 'https://claude.ai/api/mcp/auth_callback?error=access_denied'));
vi.mock('@/hooks/mcp/useConexionesMcp', () => ({
    useSolicitudDeConexion: () => solicitud,
    useResolverSolicitud: () => ({ mutateAsync: decidir, isPending: false, isError: false }),
}));
const { ConectarPage } = await import('../ConectarPage');
const { destinoTrasEntrar, guardarSolicitudPendiente } = await import('@/lib/conexionMcp');

const pantalla = (q = '?solicitud=sol123456789') => render(<MemoryRouter initialEntries={[`/conectar${q}`]}><ConectarPage /></MemoryRouter>);
beforeEach(() => { cleanup(); usuario = null; solicitud = { isLoading: false, isError: false }; navegar.mockReset(); decidir.mockClear(); window.sessionStorage.clear(); });

describe('Conectar una aplicación por MCP (A9)', () => {
    it('sin sesión: recuerda la solicitud y lleva al login; al entrar, vuelve a ella', () => {
        pantalla();
        fireEvent.click(screen.getByText('mcp.consent.login'));
        expect(navegar).toHaveBeenCalledWith('/login');
        expect(destinoTrasEntrar()).toBe('/conectar?solicitud=sol123456789');
        // Una sola vez.
        expect(destinoTrasEntrar()).toBe('/dashboard');
    });

    it('una solicitud pendiente vencida no lleva a ningún lado', () => {
        guardarSolicitudPendiente('vieja', Date.now() - 11 * 60 * 1000);
        expect(destinoTrasEntrar()).toBe('/dashboard');
    });

    it('con sesión: muestra adónde vuelve y el aviso ANTES de decidir; permitir lleva al cliente', async () => {
        usuario = { uid: 'yo' };
        solicitud = { isLoading: false, isError: false, data: { cliente: 'Claude', destino: 'claude.ai', alcances: ['corpus:read'] } };
        const asignar = vi.spyOn(window.location, 'assign').mockImplementation(() => undefined);
        pantalla();
        const aviso = screen.getByText('mcp.consent.returnsTo {"destino":"claude.ai"}');
        const permitir = screen.getByText('mcp.consent.allow');
        expect(aviso.compareDocumentPosition(permitir) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.getByText('mcp.consent.warning {"cliente":"Claude","destino":"claude.ai"}')).toBeTruthy();
        fireEvent.click(permitir);
        await waitFor(() => expect(asignar).toHaveBeenCalledWith('https://claude.ai/api/mcp/auth_callback?code=c'));
        expect(decidir).toHaveBeenCalledWith(true);
        asignar.mockRestore();
    });

    it('una solicitud vencida lo dice; sin solicitud, también', () => {
        usuario = { uid: 'yo' };
        solicitud = { isLoading: false, isError: true };
        pantalla();
        expect(screen.getByText('mcp.consent.expired')).toBeTruthy();
        cleanup();
        pantalla('');
        expect(screen.getByText('mcp.consent.missing')).toBeTruthy();
    });
});
