import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { CourseScheduleEntry, FeedbackPattern } from '@dosfilos/domain';

/**
 * «Ver la devolución» abría el editor: no había una vista que resumiera la
 * entrega (fundador, 2026-10-29, TI #1 del Salmo 23).
 */
const tr = (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k);
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: tr, i18n: { language: 'es' } }) }));

const { CourseFeedbackSummary, byPage } = await import('../CourseFeedbackSummary');

beforeEach(() => cleanup());

const patrones: FeedbackPattern[] = [
    { id: 'esp', name: 'Espaciado de títulos', decision: 'pending' },
    { id: 'apo', name: 'Apóstrofo tipográfico', decision: 'pending' },
    { id: 'tes', name: 'Tesis verificable', kind: 'strength', decision: 'pending' },
    { id: 'cie', name: 'Cierre que vuelve a la tesis', kind: 'strength', decision: 'pending' },
];
const entrada: CourseScheduleEntry = {
    id: 'e1', workTypeId: 'ti', label: 'Salmos 23:1-3', paperId: 'paper1',
    deliveredAt: '2026-09-17T20:00:00.000Z',
    feedback: {
        receivedAt: '2026-10-20T15:00:00.000Z', text: 'Muy buen trabajo.', grade: '98/100',
        corrections: [
            { id: 'c4', patternId: 'cie', note: 'Excelente cierre', anchor: { page: '12', quote: 'lo que hace con ella.' } },
            { id: 'c2', patternId: 'apo', note: 'Este apóstrofe no es de redacción, sino de programación.', anchor: { page: '6', quote: "Waltke y O'Connor" } },
            { id: 'c3', patternId: 'tes', note: 'Muy buena tesis', anchor: { page: '1', quote: 'actúa ese pastor.' } },
            { id: 'c1', patternId: 'esp', note: 'Revisa el espaciado', anchor: { page: '1' } },
        ],
    },
};

function montar(onEdit = vi.fn()) {
    render(<MemoryRouter><CourseFeedbackSummary entry={entrada} patterns={patrones} projectId="p" open onOpenChange={vi.fn()} onEdit={onEdit} /></MemoryRouter>);
    return onEdit;
}

describe('el resumen de la devolución', () => {
    it('REGRESIÓN: separa lo que corrigió de lo que hay que mantener, por página, con su ancla', () => {
        montar();
        const corr = within(screen.getByTestId('feedback-summary-corrections')).getAllByRole('listitem');
        expect(corr.map(li => li.textContent)).toEqual([
            expect.stringContaining('Revisa el espaciado'),
            expect.stringContaining('Este apóstrofe'),
        ]);
        expect(corr[1]!.textContent).toContain("Waltke y O'Connor");
        const fort = within(screen.getByTestId('feedback-summary-strengths')).getAllByRole('listitem');
        expect(fort.map(li => li.textContent)).toEqual([expect.stringContaining('Muy buena tesis'), expect.stringContaining('Excelente cierre')]);
    });

    it('muestra la nota y lo que escribió el profesor; «Editar» abre el editor', () => {
        const onEdit = montar();
        expect(screen.getByText(/98\/100/)).toBeInTheDocument();
        expect(screen.getByText('Muy buen trabajo.')).toBeInTheDocument();
        fireEvent.click(screen.getByText('feedbackSummary.edit'));
        expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it('ordena por página: números en orden, la hoja sin número por su número, sin página al final', () => {
        const c = (id: string, page?: string) => ({ id, patternId: 'x', ...(page ? { anchor: { page } } : {}) });
        expect([c('a'), c('b', '10'), c('c', 'h. 3'), c('d', '2')].sort(byPage).map(x => x.id)).toEqual(['d', 'c', 'b', 'a']);
    });
});
