import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { buildEmptyCanonicalVerseAnalysis, type DecisiveCriterion, type PassageReference } from '@dosfilos/domain';
import { CanonicalAnalysisStudyView } from '../CanonicalAnalysisStudyView';

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));

/** P2 (etapa 4): la vista de estudio separa lo que dicen las fuentes de lo que infiere el análisis. */
const REF = { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 12, verseEnd: 12 } as PassageReference;
const conCriterio = (decisiveCriterion: DecisiveCriterion) => ({
    ...buildEmptyCanonicalVerseAnalysis(REF),
    questionAnswers: [{ questionNumber: 1, directAnswer: 'apositiva', decision: 'apositiva', options: [], decisiveCriterion }],
});
const abrirRespuestas = () => {
    const boton = screen.queryAllByRole('button').find(b => /canonical\.study\.(answers|section\.answers|questionAnswers)/.test(b.textContent ?? ''));
    if (boton) fireEvent.click(boton);
};

beforeEach(() => cleanup());

describe('el criterio decisivo en la vista de estudio', () => {
    it('con premisas: cada premisa y, rotulada, la inferencia del análisis', () => {
        render(<CanonicalAnalysisStudyView analysis={conCriterio({
            text: 'El paralelo favorece la aposición.', inference: 'El paralelo favorece la aposición.', whyThisOverThat: 'w', sources: [],
            premises: [{ text: 'Robertson clasifica ὁ κρίνων como aposición.', sources: [{ sourceKey: 'Robertson', page: 778 }] as never }],
        })} />);
        abrirRespuestas();
        expect(screen.getByText('Robertson clasifica ὁ κρίνων como aposición.')).toBeInTheDocument();
        expect(screen.getByText('canonical.study.answerInference')).toBeInTheDocument();
        expect(screen.getByText(/El paralelo favorece la aposición\./)).toBeInTheDocument();
    });

    it('lo guardado antes de P2 se ve como siempre, sin el rótulo de inferencia', () => {
        render(<CanonicalAnalysisStudyView analysis={conCriterio({ text: 'El paralelo favorece la aposición.', whyThisOverThat: 'w', sources: [] })} />);
        abrirRespuestas();
        expect(screen.getByText('El paralelo favorece la aposición.')).toBeInTheDocument();
        expect(screen.queryByText('canonical.study.answerInference')).toBeNull();
    });
});
