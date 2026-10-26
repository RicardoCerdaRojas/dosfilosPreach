import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { deskSourcesSummary, type ProjectRequirement, type RequirementMeasure } from '@dosfilos/domain';

/**
 * «Dar por cumplido» en los requisitos medibles (escritorio, cabo suelto de
 * W2-D): marca `done: true`, que el escritorio lee como aceptado a propósito
 * aunque la medida no llegue (el profesor aceptó 2 comentarios en vez de 3).
 * Deshacerlo QUITA el campo (Firestore no acepta `undefined`). Lo que ya se
 * cumple no lo ofrece; `rule`/`other` siguen con su casilla «Cumplido».
 */
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }) }));
const { RequirementsEditor } = await import('../stateOfArt/RequirementsEditor');

const comentarios: ProjectRequirement = { id: 'c', kind: 'minimum-type', text: 'Tres comentarios críticos', origin: 'syllabus', sourceType: 'commentary-critical', minimum: 3 };
const lexico: ProjectRequirement = { id: 'l', kind: 'minimum-type', text: 'Un léxico', origin: 'syllabus', sourceType: 'lexicon-technical', minimum: 1 };
const sinCifra: ProjectRequirement = { id: 'q', kind: 'quantity', text: 'Artículos', origin: 'syllabus', minimum: null };
const aMano: ProjectRequirement = { id: 'o', kind: 'other', text: 'Una obra en alemán', origin: 'manual' };
const medida = (status: RequirementMeasure['status'], value = 0, target = 1): RequirementMeasure => ({ status, value, target, unmeasurable: [] });

let onChange = vi.fn();
const montar = (items: Array<[ProjectRequirement, RequirementMeasure]>) => render(
    <RequirementsEditor measures={items.map(([requirement, measure]) => ({ requirement, measure }))} onChange={onChange} onShowUnmeasurable={vi.fn()} />,
);
const fila = (texto: string) => screen.getByText(texto).closest('li') as HTMLElement;
const aceptar = (texto: string) => `stateOfArt.requirement.acceptLabel:${JSON.stringify({ text: texto })}`;

beforeEach(() => { cleanup(); onChange = vi.fn(); });

describe('«Dar por cumplido» en los requisitos medibles', () => {
    it('se ofrece en lo medible que no llega (también sin cifra), no en lo cumplido ni en lo que se marca a mano', () => {
        montar([[comentarios, medida('unmet', 2, 3)], [lexico, medida('met', 1, 1)], [sinCifra, medida('incomplete')], [aMano, medida('manual')]]);
        expect(within(fila('Tres comentarios críticos')).getByRole('button', { name: aceptar('Tres comentarios críticos') })).toBeInTheDocument();
        expect(within(fila('Artículos')).getByRole('button', { name: aceptar('Artículos') })).toBeInTheDocument();
        expect(within(fila('Un léxico')).queryByRole('button', { name: aceptar('Un léxico') })).toBeNull();
        expect(within(fila('Una obra en alemán')).queryByRole('button', { name: aceptar('Una obra en alemán') })).toBeNull();
        // La casilla de siempre sigue en `other`.
        expect(within(fila('Una obra en alemán')).getByLabelText('stateOfArt.requirement.done')).toBeInTheDocument();
    });

    it('marca `done: true` solo en ese requisito, y el escritorio lo cuenta como aceptado a propósito', () => {
        montar([[comentarios, medida('unmet', 2, 3)], [lexico, medida('met', 1, 1)]]);
        fireEvent.click(screen.getByRole('button', { name: aceptar('Tres comentarios críticos') }));
        expect(onChange).toHaveBeenCalledTimes(1);
        const items = onChange.mock.calls[0]![0] as ProjectRequirement[];
        expect(items.find(r => r.id === 'c')).toMatchObject({ done: true, minimum: 3 });
        expect(items.find(r => r.id === 'l')).not.toHaveProperty('done');
        // El modelo del escritorio: sin ninguna obra aprobada, el léxico no llega y el de comentarios cuenta aceptado.
        const resumen = deskSourcesSummary({ bibliography: [], sourceIds: [], bibliographyCriteria: { requirementItems: items } } as never);
        expect(resumen.requirements).toMatchObject({ total: 2, met: 1, accepted: 1 });
    });

    it('aceptado: lo dice, ya no ofrece aceptar y «Deshacer» QUITA el campo', () => {
        montar([[{ ...comentarios, done: true }, medida('unmet', 2, 3)]]);
        const f = fila('Tres comentarios críticos');
        expect(within(f).getByText('stateOfArt.requirement.accepted')).toBeInTheDocument();
        expect(within(f).queryByRole('button', { name: aceptar('Tres comentarios críticos') })).toBeNull();
        // La medida honesta sigue a la vista: 2 de 3.
        expect(within(f).getByText(/stateOfArt\.requirement\.measure/)).toHaveTextContent('"value":2');
        fireEvent.click(within(f).getByRole('button', { name: `stateOfArt.requirement.undoAcceptLabel:${JSON.stringify({ text: 'Tres comentarios críticos' })}` }));
        const [item] = onChange.mock.calls[0]![0] as ProjectRequirement[];
        expect('done' in item!).toBe(false);
        expect(item).toMatchObject({ id: 'c', minimum: 3, sourceType: 'commentary-critical' });
    });
});
