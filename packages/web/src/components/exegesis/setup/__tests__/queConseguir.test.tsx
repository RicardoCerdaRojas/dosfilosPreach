import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { corpusNeeds, type NeedLibraryBook, type SourceRecommendation } from '@dosfilos/domain';

vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}));

const { CorpusNeedRow } = await import('../CorpusNeedRow');

const rec = (over: Partial<SourceRecommendation>): SourceRecommendation => ({ author: 'Joseph B. Mayor', title: 'The Epistle of St. James', series: null, publisher: 'Macmillan', year: 1910, isbn: null, tier: 'essential', languages: ['en'], ...over });
const library: NeedLibraryBook[] = [
    { id: 'mayor', title: 'The Epistle of St. James', author: 'Joseph B. Mayor', sourceType: 'commentary-critical', year: '1910', inCorpus: true },
    { id: 'martin', title: 'James (Word Biblical Commentary 48)', author: 'Ralph P. Martin', sourceType: 'commentary-critical', year: '1985' },
];
const [need] = corpusNeeds({
    rubric: { sourceRequirements: [{ sourceType: 'commentary-critical', minimum: 2, maximum: null, justification: '' }], courseBibliography: [] },
    corpusTypes: ['commentary-critical'],
    library,
    recommendationsFor: () => [rec({}), rec({ author: 'Ralph P. Martin', title: 'James', series: 'Word Biblical Commentary 48', publisher: 'Word', year: 1988 }), rec({ author: 'Martin Dibelius', title: 'James', series: 'Hermeneia', publisher: 'Fortress', year: 1976, rationale: 'Clásico de la crítica de formas.' }), rec({ author: 'Sophie Laws', title: 'The Epistle of James', publisher: 'Harper', year: 1980, tier: 'recommended' })],
});

beforeEach(() => cleanup());

describe('Qué conseguir (A6)', () => {
    const acciones = () => ({ onAddResource: vi.fn(), onPickType: vi.fn(), onMark: vi.fn(), busy: false });

    it('una necesidad sin cubrir se abre sola y dice cuánto hay, cuánto pide y qué está al alcance', () => {
        render(<ul><CorpusNeedRow need={need!} actions={acciones()} /></ul>);
        const fila = screen.getByTestId('necesidad-tipo:commentary-critical');
        expect(fila.textContent).toContain('corpusNeeds.count {"have":1,"required":2}');
        expect(fila.textContent).toContain('corpusNeeds.withinReach {"count":1}');
        expect(screen.getAllByRole('listitem').length).toBeGreaterThan(1);
    });

    it('la copia de otra edición se agrega con el aviso de paginación (Martin 1985 contra 1988)', () => {
        const a = acciones();
        render(<ul><CorpusNeedRow need={need!} actions={a} /></ul>);
        const martin = screen.getByTestId('candidata-rec:ralphpmartin__james');
        expect(martin.textContent).toContain('corpusNeeds.status.edicion-distinta');
        expect(martin.textContent).toContain('"copy":"1985","cited":1988');
        fireEvent.click(screen.getAllByText('corpusNeeds.action.add')[0]!);
        expect(a.onAddResource).toHaveBeenCalledWith('martin');
    });

    it('una sugerida se marca por conseguir, o se descarta con razón obligatoria', () => {
        const a = acciones();
        render(<ul><CorpusNeedRow need={need!} actions={a} /></ul>);
        const dibelius = screen.getByTestId('candidata-rec:martindibelius__james');
        fireEvent.click(dibelius.querySelector('button')!);
        expect(a.onMark).toHaveBeenCalledWith('rec:martindibelius__james', { status: 'por-conseguir' });
        fireEvent.click(within(dibelius).getByText('corpusNeeds.action.discard'));
        const confirmar = screen.getByText('corpusNeeds.action.confirmDiscard');
        expect(confirmar).toBeDisabled();
        fireEvent.change(screen.getByLabelText('corpusNeeds.reasonLabel'), { target: { value: 'Muy técnico para el TP' } });
        fireEvent.click(confirmar);
        expect(a.onMark).toHaveBeenLastCalledWith('rec:martindibelius__james', { status: 'descartada', reason: 'Muy técnico para el TP' });
    });

    it('lo esencial lleva su etiqueta y el porqué del catálogo; lo recomendado, no', () => {
        render(<ul><CorpusNeedRow need={need!} actions={acciones()} /></ul>);
        const dibelius = screen.getByTestId('candidata-rec:martindibelius__james');
        expect(dibelius.textContent).toContain('corpusNeeds.essential');
        expect(dibelius.textContent).toContain('Clásico de la crítica de formas.');
        expect(screen.getByTestId('candidata-rec:sophielaws__theepistleofjames').textContent).not.toContain('corpusNeeds.essential');
    });

    it('con más de lo pedido no dice «2 de 1»', () => {
        render(<ul><CorpusNeedRow need={{ ...need!, have: 2, required: 1, covered: true }} actions={acciones()} /></ul>);
        const fila = screen.getByTestId('necesidad-tipo:commentary-critical');
        expect(fila.textContent).toContain('corpusNeeds.countOver {"have":2,"required":1}');
        expect(fila.textContent).not.toContain('corpusNeeds.count {');
        cleanup();
        // Justo lo pedido sí se lee «1 de 1».
        render(<ul><CorpusNeedRow need={{ ...need!, have: 1, required: 1, covered: true }} actions={acciones()} /></ul>);
        expect(screen.getByTestId('necesidad-tipo:commentary-critical').textContent).toContain('corpusNeeds.count {"have":1,"required":1}');
    });

    it('«Buscar» abre la biblioteca filtrada al tipo', () => {
        const a = acciones();
        render(<ul><CorpusNeedRow need={need!} actions={a} /></ul>);
        fireEvent.click(screen.getByText('corpusNeeds.search'));
        expect(a.onPickType).toHaveBeenCalledWith('commentary-critical');
    });
});
