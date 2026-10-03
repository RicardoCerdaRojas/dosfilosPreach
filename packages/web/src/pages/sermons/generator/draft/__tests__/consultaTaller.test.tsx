import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StrictMode, useState } from 'react';

const generate = vi.hoisted(() => vi.fn());
vi.mock('@dosfilos/infrastructure', async importOriginal => ({
    ...(await importOriginal<object>()),
    createProxyLlmClient: () => ({ generate }),
}));
vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o?.returnObjects ? [] : o?.section ? `${k}:${o.section}` : k) }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

import { ConsultPanel } from '../ConsultPanel';
import { ExternalProposalsProvider } from '../externalProposals';
import { useArrivingProposals } from '../externalProposalsContext';

/**
 * Chat de consulta del Taller (hallazgo 32 del ejercicio de Jonás): el
 * versículo se muestra con el texto real; el que no existe se marca; la
 * respuesta llega a la sección como PROPUESTA.
 */
/** La sección recibe con el MISMO hook que `SectionElementsPanel`. */
function SeccionFalsa() {
    const [propuestas, setPropuestas] = useState<string[]>([]);
    useArrivingProposals('p3.ilustracion', llegadas => setPropuestas(p => [...p, ...llegadas.map(x => `${x.why}: ${x.text}`)]));
    return <ul>{propuestas.map(p => <li key={p}>{p}</li>)}</ul>;
}

function montar() {
    return render(
        <StrictMode>
        <ExternalProposalsProvider>
            <ConsultPanel
                open
                onOpenChange={() => {}}
                passage="Jonás 4:5-11"
                proposition="Dios se compadece de quienes no lo merecen."
                section={{ id: 'p3.ilustracion', label: 'Punto 3 — ilustración', pointTitle: 'III. La misericordia genuina' }}
            />
            <SeccionFalsa />
        </ExternalProposalsProvider>
        </StrictMode>,
    );
}

describe('ConsultPanel', () => {
    it('pregunta con el contexto de la sección y verifica los versículos', async () => {
        generate.mockResolvedValue('El hijo pródigo (Lucas 15:20) y Jonás 4:2. También Jonás 4:30.');
        montar();
        fireEvent.change(screen.getByLabelText('drafting.consult.placeholder'), { target: { value: '¿Qué personajes ilustran?' } });
        fireEvent.click(screen.getByRole('button', { name: /drafting.consult.send/ }));

        await screen.findByText(/El hijo pródigo/);
        const pedido = generate.mock.calls[0]![0] as { prompt: string; system: string };
        expect(pedido.prompt).toContain('Punto 3 — ilustración');
        expect(pedido.prompt).toContain('III. La misericordia genuina');
        expect(pedido.system).toMatch(/NO cites autores/);
        // Texto real de la Biblia, y la referencia inexistente marcada.
        expect(screen.getByText(/clemente y piadoso/i)).toBeInTheDocument();
        expect(screen.getAllByText('drafting.consult.verseMissing')).toHaveLength(1);
    });

    it('«Llevar a mis ideas» la deja como propuesta de la sección activa', async () => {
        generate.mockResolvedValue('La oveja perdida (Lucas 15:4).');
        montar();
        fireEvent.change(screen.getByLabelText('drafting.consult.placeholder'), { target: { value: 'otra' } });
        fireEvent.click(screen.getByRole('button', { name: /drafting.consult.send/ }));
        await screen.findByText(/La oveja perdida/);
        fireEvent.click(screen.getByRole('button', { name: 'drafting.consult.bringToIdeas' }));
        await waitFor(() => expect(screen.getByText('drafting.consult.proposalWhy: La oveja perdida (Lucas 15:4).')).toBeInTheDocument());
        // Una sola vez, aunque StrictMode duplique los efectos.
        expect(screen.getAllByRole('listitem', { hidden: true })).toHaveLength(1);
    });
});

describe('useArrivingProposals', () => {
    it('lo recibido se olvida: al volver a la sección no reaparece', async () => {
        const { useExternalProposals } = await import('../externalProposalsContext');
        let enviar: ((p: { text: string; why: string }) => void) | null = null;
        function Emisor() {
            const ext = useExternalProposals()!;
            enviar = p => ext.send('s1', p);
            return null;
        }
        function Seccion() {
            const [n, setN] = useState(0);
            useArrivingProposals('s1', l => setN(x => x + l.length));
            return <span data-testid="recibidas">{n}</span>;
        }
        const { rerender } = render(
            <ExternalProposalsProvider><Emisor /><Seccion key="a" /></ExternalProposalsProvider>,
        );
        enviar!({ text: 'una', why: 'w' });
        await waitFor(() => expect(screen.getByTestId('recibidas').textContent).toBe('1'));
        rerender(<ExternalProposalsProvider><Emisor /><Seccion key="b" /></ExternalProposalsProvider>);
        await new Promise(r => setTimeout(r, 20));
        expect(screen.getByTestId('recibidas').textContent).toBe('0');
    });
});
