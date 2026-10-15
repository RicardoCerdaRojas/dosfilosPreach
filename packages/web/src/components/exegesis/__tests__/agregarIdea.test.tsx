import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * «Agregar una idea» (TP #6, #22): el estudiante ve la oración resaltada en
 * su párrafo y sólo al insertar se guarda.
 */
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o?.citations ? `${k}:${o.citations}` : k) }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const mutateAsync = vi.fn();
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({ useExegesisPapers: () => ({ placeIdeaInSection: { mutateAsync, isPending: false } }) }));
const { AgregarIdeaDialog } = await import('../AgregarIdeaDialog');

const abrir = (onInsert = vi.fn().mockResolvedValue(undefined)) => {
    render(<AgregarIdeaDialog open onOpenChange={vi.fn()} paperId="p" stepId="s" sectionLabel="3:7" onInsert={onInsert} onQuotaError={() => false} />);
    fireEvent.change(screen.getByLabelText('detail.steps.addIdea.label'), { target: { value: 'Wallace lo trae como ejemplo (Wallace, 165)' } });
    return onInsert;
};

describe('Agregar una idea', () => {
    it('propone, muestra la oración resaltada y sólo guarda al insertar', async () => {
        mutateAsync.mockResolvedValueOnce({
            markdown: 'A. Wallace lo da como ejemplo claro (Wallace, 165). B.', sentence: 'Wallace lo da como ejemplo claro (Wallace, 165).',
            paragraph: 'A. Wallace lo da como ejemplo claro (Wallace, 165). B.', anchored: true, lostCitations: [],
        });
        const onInsert = abrir();
        fireEvent.click(screen.getByText('detail.steps.addIdea.propose'));
        expect(await screen.findByText('Wallace lo da como ejemplo claro (Wallace, 165).')).toHaveProperty('tagName', 'MARK');
        expect(onInsert).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText('detail.steps.addIdea.insert'));
        await waitFor(() => expect(onInsert).toHaveBeenCalledWith('A. Wallace lo da como ejemplo claro (Wallace, 165). B.'));
    });

    it('si la redacción perdió la cita, lo avisa', async () => {
        mutateAsync.mockResolvedValueOnce({ markdown: 'x', sentence: 'Wallace lo trae.', paragraph: 'Wallace lo trae.', anchored: false, lostCitations: ['(Wallace, 165)'] });
        abrir();
        fireEvent.click(screen.getByText('detail.steps.addIdea.propose'));
        expect(await screen.findByText('detail.steps.addIdea.lostCitations:(Wallace, 165)')).toBeInTheDocument();
        expect(screen.getByText('detail.steps.addIdea.atParagraphEnd')).toBeInTheDocument();
    });
});
