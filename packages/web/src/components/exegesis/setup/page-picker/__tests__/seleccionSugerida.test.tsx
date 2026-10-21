import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

/**
 * TP #8 (2026-10-21, fase 8a, A2): la entrada de μέλος en Tuggy es 584–585.
 * La selección sugerida tiene que llevarse las dos hojas, no sólo la primera.
 */
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o?.number ? `${k}:${o.number}` : k), i18n: { language: 'es' } }) }));
const { SuggestedSelection } = await import('../SuggestedSelection');

describe('SuggestedSelection · entradas de varias hojas', () => {
    it('agrega todas las hojas de la entrada y dice qué pregunta la pide', () => {
        const onAdd = vi.fn();
        render(<SuggestedSelection
            suggestion={{
                picked: [
                    { sheet: 584, endSheet: 585, lemmas: ['μέλος'], reasons: [{ kind: 'question', number: 1 }] },
                    { sheet: 938, lemmas: ['φονεύω'], reasons: [] },
                ],
                leftOut: [],
                notFound: [],
            }}
            numbering={null}
            printedPageOffset={null}
            onReplace={vi.fn()}
            onAdd={onAdd}
        />);
        fireEvent.click(screen.getByText('paperSetup.subSteps.corpus.suggestion.cta'));
        expect(screen.getByText('paperSetup.subSteps.corpus.suggestion.reason.question:1')).toBeInTheDocument();
        fireEvent.click(screen.getByText('paperSetup.subSteps.corpus.suggestion.add'));
        expect(onAdd).toHaveBeenCalledWith([584, 585, 938]);
    });
});
