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

    it('sin premisas lo dice, con el rótulo de la inferencia', () => {
        render(<CanonicalAnalysisStudyView analysis={conCriterio({ text: 'Sólo inferencia.', inference: 'Sólo inferencia.', whyThisOverThat: 'w', sources: [], premises: [] })} />);
        abrirRespuestas();
        expect(screen.getByText('canonical.study.answerNoSources')).toBeInTheDocument();
        expect(screen.getByText('canonical.study.answerInference')).toBeInTheDocument();
    });

    it('una premisa sin su última cita no se muestra: nadie la respalda', () => {
        render(<CanonicalAnalysisStudyView analysis={conCriterio({ text: 'x', inference: 'x', whyThisOverThat: 'w', sources: [], premises: [{ text: 'Sin cita.', sources: [] }, { text: 'Dice Mayor.', sources: [{ sourceKey: 'Mayor', page: 5 }] }] } as never)} />);
        abrirRespuestas();
        expect(screen.queryByText('Sin cita.')).toBeNull();
        expect(screen.getByText('Dice Mayor.')).toBeInTheDocument();
    });

    it('una inferencia vacía no deja el rótulo solo', () => {
        render(<CanonicalAnalysisStudyView analysis={conCriterio({ text: '', inference: '', whyThisOverThat: 'w', sources: [], premises: [{ text: 'Dice Mayor.', sources: [{ sourceKey: 'Mayor', page: 5 }] }] } as never)} />);
        abrirRespuestas();
        expect(screen.queryByText('canonical.study.answerInference')).toBeNull();
    });

    it('al revisar citas la sección viene abierta: el chip tiene que estar para llegar a él', () => {
        render(<CanonicalAnalysisStudyView marks={{ verdicts: new Map(), reviewed: new Set(), selectedPath: null, onSelect: () => undefined }} analysis={conCriterio({ text: 'x', inference: 'x', whyThisOverThat: 'w', sources: [], premises: [{ text: 'Dice Mayor.', sources: [{ sourceKey: 'Mayor', page: 5 }] }] })} />);
        expect(screen.getByText('Dice Mayor.')).toBeInTheDocument();
    });
});
