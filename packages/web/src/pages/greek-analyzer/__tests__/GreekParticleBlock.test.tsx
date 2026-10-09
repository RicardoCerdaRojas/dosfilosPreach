import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, string>) => (o?.verb ? `${k}:${o.verb}` : k) }) }));
const { GreekParticleBlock } = await import('../GreekParticleBlock');
const base = { text: 'x', semanticRange: 'a', syntacticFunction: 'b', translation: 'c' };

describe('G4 en la ficha', () => {
    it('pronombre explícito (Stg 2:7): explica que el verbo ya marca la persona, «Asistente» y fuente', () => {
        render(<GreekParticleBlock insight={{ ...base, discourseFunction: 'emphasis', discourseRule: 'overtPronoun', overtPronounVerbText: 'βλασφημοῦσιν' }} />);
        expect(screen.getByTestId('overt-pronoun').textContent).toBe('analyzer.discourse.overtPronoun:βλασφημοῦσιν');
        expect(screen.getByText('analyzer.verbFn.assistant')).toBeInTheDocument();
        expect(screen.getByTestId('source-note').textContent).toContain('Wallace, «Personal Pronouns › Nominative Uses › Emphasis», p. 321');
    });
    it('δέ decidida por regla: «Regla» y Runge', () => {
        render(<GreekParticleBlock insight={{ ...base, discourseFunction: 'development', discourseRule: 'deDevelopment' }} />);
        expect(screen.getByText('analyzer.verbFn.rule')).toBeInTheDocument();
        expect(screen.getByTestId('source-note').textContent).toContain('Runge, sobre los conectores'); // sin cotejar: sólo el tema (R0)
    });
    it('sin función devuelta, el pronombre explícito igual se explica (con su fuente)', () => {
        render(<GreekParticleBlock insight={{ ...base, discourseRule: 'overtPronoun', overtPronounVerbText: 'βλασφημοῦσιν' }} />);
        expect(screen.getByTestId('overt-pronoun')).toBeInTheDocument();
        expect(screen.getByTestId('source-note')).toBeInTheDocument();
    });
    it('sin función (ni regla, o una regla que deja elegir al asistente: οὖν), nada', () => {
        expect(render(<GreekParticleBlock insight={base} />).container.innerHTML).toBe('');
        expect(render(<GreekParticleBlock insight={{ ...base, discourseRule: 'ounInference' }} />).container.innerHTML).toBe('');
    });
});
