import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
const { GreekVerbFunctionBlock } = await import('../GreekVerbFunctionBlock');
const base = { text: 'x', semanticRange: 'a', syntacticFunction: 'b', translation: 'c' };

describe('la función del verbo en la ficha (G2)', () => {
    it('decidida por regla: «Regla» y por qué', () => {
        render(<GreekVerbFunctionBlock insight={{ ...base, verbFunction: 'periphrastic', verbRule: 'periphrastic', verbNote: 'ἦν + participio.' }} />);
        expect(screen.getByText('analyzer.verbFn.functions.periphrastic')).toBeInTheDocument();
        expect(screen.getByText('analyzer.verbFn.rule')).toBeInTheDocument();
        expect(screen.getByText('(analyzer.verbFn.rules.periphrastic)')).toBeInTheDocument();
        expect(screen.getByText('ἦν + participio.')).toBeInTheDocument();
    });

    it('el uso del tiempo lo elige el asistente: «Asistente» (Stg 2:7, presente habitual)', () => {
        render(<GreekVerbFunctionBlock insight={{ ...base, tenseUse: 'customary' }} />);
        expect(screen.getByText('analyzer.verbFn.tenseUses.customary')).toBeInTheDocument();
        expect(screen.getByText('analyzer.verbFn.assistant')).toBeInTheDocument();
        expect(screen.queryByText('analyzer.verbFn.rule')).toBeNull();
    });

    it('una palabra que no es verbo no muestra nada', () => {
        const { container } = render(<GreekVerbFunctionBlock insight={base} />);
        expect(container).toBeEmptyDOMElement();
    });
});
