import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { derivePaperUnits, paperInputStatuses, paperRequirements, requirementWarnings } from '@dosfilos/domain';

vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { PaperInputsList } = await import('../PaperInputsList');
const { PaperRequirementsCard } = await import('../PaperRequirementsCard');
const { CourseRulesCard } = await import('../CourseRulesCard');

const statuses = paperInputStatuses({
    profileKind: 'tp-por-pregunta',
    assignmentBrief: 'Preguntas: [PEGAR LAS PREGUNTAS DEL PROFESOR]',
    rubric: { provenance: 'extracted-from-text' },
    styleGuide: { id: 'g' },
    scheduleEntry: { dueDate: '2026-11-25' },
    previousEntry: { delivered: true, feedback: 'recorded', pendingPatterns: 2 },
    previousDeliveryFound: true,
    assignedReadings: 0,
    courseGrammar: { grammarSources: 1, ignoredCategories: 0 },
});

beforeEach(() => cleanup());

describe('Entradas (A5)', () => {
    it('el plazo va primero con su fecha legible; cada estado se dice con texto, no solo color', () => {
        render(<PaperInputsList statuses={statuses} marks={{}} saving={false} onSaveMarks={vi.fn()} />);
        const filas = screen.getAllByRole('listitem');
        expect(filas[0]!.textContent).toContain('inputs.kind.plazo');
        expect(filas[0]!.textContent).toContain('25 de noviembre de 2026');
        expect(screen.getByTestId('entrada-devolucion').textContent).toContain('inputs.state.revisar');
        expect(screen.getByTestId('entrada-devolucion').textContent).toContain('"count":2');
    });

    it('«no aplica» y «ya la revisé» guardan la marca; «deshacer» la quita', async () => {
        const guardar = vi.fn().mockResolvedValue(undefined);
        render(<PaperInputsList statuses={statuses} marks={{}} saving={false} onSaveMarks={guardar} />);
        fireEvent.click(screen.getByTestId('entrada-lectura-asignada').querySelector('button')!);
        await waitFor(() => expect(guardar).toHaveBeenCalledWith({ 'lectura-asignada': expect.objectContaining({ mark: 'no-aplica' }) }));
        fireEvent.click(screen.getByTestId('entrada-enunciado').querySelector('button')!);
        await waitFor(() => expect(guardar).toHaveBeenLastCalledWith({ enunciado: expect.objectContaining({ mark: 'leida' }) }));

        cleanup();
        const marcadas = paperInputStatuses({ profileKind: 'tp-por-pregunta', assignmentBrief: null, rubric: null, styleGuide: { id: null }, assignedReadings: 0, courseGrammar: { grammarSources: 0, ignoredCategories: 0 }, marks: { rubrica: { mark: 'no-aplica', at: 'x' } } });
        const quitar = vi.fn().mockResolvedValue(undefined);
        render(<PaperInputsList statuses={marcadas} marks={{ rubrica: { mark: 'no-aplica', at: 'x' } }} saving={false} onSaveMarks={quitar} />);
        fireEvent.click(screen.getByText('inputs.action.undo'));
        await waitFor(() => expect(quitar).toHaveBeenCalledWith({}));
    });

    it('la nota de clase se guarda como marca con su texto', async () => {
        const inv = paperInputStatuses({ profileKind: 'investigacion-tematica', assignmentBrief: 'x', rubric: null, styleGuide: { id: null }, assignedReadings: 0, courseGrammar: { grammarSources: 0, ignoredCategories: 0 } });
        const guardar = vi.fn().mockResolvedValue(undefined);
        render(<PaperInputsList statuses={inv} marks={{}} saving={false} onSaveMarks={guardar} />);
        fireEvent.change(screen.getByLabelText('inputs.classNote.label'), { target: { value: ' Voces antiguas y actuales. ' } });
        fireEvent.click(screen.getByText('inputs.classNote.save'));
        await waitFor(() => expect(guardar).toHaveBeenCalledWith({ clase: expect.objectContaining({ mark: 'leida', note: 'Voces antiguas y actuales.' }) }));
    });
});

describe('Requisitos (A5)', () => {
    const units = derivePaperUnits({ kind: 'tp-por-pregunta', passage: { chapterStart: 5, chapterEnd: 5, verseStart: 1, verseEnd: 6 }, assignmentBrief: '1. ¿Qué es ὀλολύζοντες (Stg. 5:1)?' });
    const rubric = { expectedLength: { unit: 'pages' as const, min: 2, max: 3 }, sourceRequirements: [{ sourceType: 'lexicon-technical' as const, minimum: 2, maximum: null, justification: '' }], qualityCriteria: [], courseBibliography: [] };
    const montar = (marks = {}, onSave = vi.fn().mockResolvedValue(undefined)) => {
        const reqs = paperRequirements({ profileKind: 'tp-por-pregunta', rubric, units, marks });
        render(<PaperRequirementsCard requirements={reqs} warnings={requirementWarnings(reqs)} units={units} marks={marks} manual={[]} saving={false} onSave={onSave} />);
        return onSave;
    };

    it('cada pregunta se cumple en su sección; las fuentes van en plural con el nombre del tipo', () => {
        montar();
        const pregunta = screen.getByTestId('requisito-enunciado:pregunta:1');
        expect((pregunta.querySelector('select') as HTMLSelectElement).value).toBe('pregunta-1');
        expect(screen.getByTestId('requisito-rubrica:fuente:lexicon-technical').textContent).toContain('"count":2');
        expect(screen.getByTestId('requisito-rubrica:fuente:lexicon-technical').textContent).toContain('sourceTypes.lexicon-technical.label');
    });

    it('«solo en un apéndice» se guarda y avisa la regla del cuerpo', async () => {
        const onSave = montar();
        fireEvent.click(screen.getByTestId('requisito-rubrica:extension').querySelectorAll('input[type=checkbox]')[1]!);
        await waitFor(() => expect(onSave).toHaveBeenCalledWith({ requirementMarks: { 'rubrica:extension': { inBody: false } } }));
        cleanup();
        montar({ 'rubrica:extension': { inBody: false } });
        expect(screen.getByTestId('requisito-rubrica:extension').textContent).toContain('inputs.requirements.warning.appendix-only');
    });

    it('agrega un requisito propio', async () => {
        const onSave = montar();
        fireEvent.change(screen.getByLabelText('inputs.requirements.addLabel'), { target: { value: 'Citar la NA28' } });
        fireEvent.click(screen.getByText('inputs.requirements.add'));
        await waitFor(() => expect(onSave).toHaveBeenCalledWith({ manualRequirements: [expect.objectContaining({ text: 'Citar la NA28', unitId: null, inBody: true })] }));
    });
});

describe('Reglas del curso (A5)', () => {
    it('las categorías vetadas se pegan una por línea y se guardan limpias', async () => {
        const guardar = vi.fn().mockResolvedValue(undefined);
        render(<MemoryRouter><CourseRulesCard guideRules={['Raya corta en los rangos']} ignored={[]} projectId="nt785" saving={false} onSaveIgnored={guardar} /></MemoryRouter>);
        expect(screen.getByTestId('reglas-de-la-guia').textContent).toContain('Raya corta en los rangos');
        fireEvent.change(screen.getByLabelText('inputs.rules.ignoredHeading'), { target: { value: 'Genitivo de producción\n\ngenitivo de produccion; Genitivo de contenido' } });
        fireEvent.click(screen.getByText('inputs.rules.ignoredSave'));
        await waitFor(() => expect(guardar).toHaveBeenCalledWith(['Genitivo de producción', 'Genitivo de contenido']));
    });
});
