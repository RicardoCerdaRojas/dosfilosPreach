import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
const { GreekAgencyBlock, GreekAnaphoraRuleNote } = await import('../GreekNominalRuleBlock');
const base = { text: 'x', semanticRange: 'a', syntacticFunction: 'b', translation: 'c' };

describe('G3 en la ficha', () => {
    it('agencia: tipo, «Regla», por qué y fuente (Stg 2:9 ὑπό)', () => {
        render(<GreekAgencyBlock insight={{ ...base, agency: 'ultimate', nominalRule: 'agentHypo' }} />);
        expect(screen.getByText('analyzer.agency.ultimate')).toBeInTheDocument();
        expect(screen.getByText('analyzer.verbFn.rule')).toBeInTheDocument();
        expect(screen.getByText('(analyzer.agency.ruleAgentHypo)')).toBeInTheDocument();
        expect(screen.getByTestId('source-note').textContent).toContain('Ultimate Agent');
    });
    it('artículo anafórico por regla: «Regla» y fuente; si lo eligió el asistente, nada de esto', () => {
        const { unmount } = render(<GreekAnaphoraRuleNote insight={{ ...base, articleUse: 'anaphoric', nominalRule: 'anaphoraLemma' }} />);
        expect(screen.getByTestId('source-note').textContent).toContain('Anaphoric (Previous Reference)');
        unmount();
        const { container } = render(<GreekAnaphoraRuleNote insight={{ ...base, articleUse: 'anaphoric' }} />);
        expect(container).toBeEmptyDOMElement();
    });
});
