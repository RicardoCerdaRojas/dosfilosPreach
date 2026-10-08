import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

/** Bitácora del módulo de hebreo #2 y #4. */
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
const { ClausesSection } = await import('../ClausesSection');

const words = [{ hebrewText: 'עַמֵּךְ' }, { hebrewText: 'עַמִּי' }, { hebrewText: 'וֵאלֹהַיִךְ' }, { hebrewText: 'אֱלֹהָי' }] as never;

describe('la sección de cláusulas', () => {
    it('REGRESIÓN (Rut 1:16): nombra el asíndeton y la disyuntiva, con su texto', () => {
        render(<ClausesSection words={words} clauses={[
            { firstWord: 0, lastWord: 1, type: 'NOMINAL', connection: 'ASYNDETIC', connector: null, value: 'declaración solemne', explanation: 'Entra sin conjunción.', adjusted: true },
            { firstWord: 2, lastWord: 3, type: 'NOMINAL', connection: 'WAW_DISJUNCTIVE', connector: 'וְ', value: 'paralelismo', explanation: '' },
        ]} />);
        expect(screen.getByText('עַמֵּךְ עַמִּי')).toBeInTheDocument();
        expect(screen.getByText('verseAnalyzer.clauses.connections.ASYNDETIC')).toBeInTheDocument();
        expect(screen.getByText('verseAnalyzer.clauses.connections.WAW_DISJUNCTIVE')).toBeInTheDocument();
        expect(screen.getAllByText('verseAnalyzer.clauses.adjusted')).toHaveLength(1);
    });

    it('un análisis viejo sin cláusulas, sin poder re-analizar, no muestra la sección', () => {
        const { container } = render(<ClausesSection words={words} clauses={undefined} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('un análisis viejo sin cláusulas avisa por qué y ofrece re-analizar', () => {
        const onReanalyze = vi.fn();
        render(<ClausesSection words={words} clauses={[]} onReanalyze={onReanalyze} />);
        expect(screen.getByText('verseAnalyzer.clauses.missing')).toBeInTheDocument();
        fireEvent.click(screen.getByText('verseAnalyzer.clauses.reanalyze'));
        expect(onReanalyze).toHaveBeenCalled();
    });
});
