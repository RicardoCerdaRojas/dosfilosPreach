import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { formatCitation, STRUCTURE_RULE_SOURCES, VERB_RULE_SOURCES, type RuleSource } from '@dosfilos/domain';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
const { SourceNote } = await import('../SourceNote');

describe('la fuente de una regla, para citar', () => {
    it('a la vista, autor y sección; al copiar, con obra y año; la página sólo si está verificada', () => {
        const sin: RuleSource = { work: 'wallace', section: 'Periphrastic Participle' };
        expect(formatCitation(sin)).toBe('Wallace, «Periphrastic Participle»');
        expect(formatCitation(sin, 'full')).toBe('Wallace, Greek Grammar Beyond the Basics: An Exegetical Syntax of the New Testament (1996), «Periphrastic Participle»');
        expect(formatCitation({ ...sin, pages: '647' })).toBe('Wallace, «Periphrastic Participle», p. 647');
        expect(formatCitation({ work: 'arnoldChoi', section: 'Waw disjunctive' })).toBe('Arnold y Choi, «Waw disjunctive»');
        expect(formatCitation({ work: 'professor', section: 'x', note: '2026-10-07 · Stg 2:7' })).toBe('Revisión docente de Dos Filos Preach (2026-10-07 · Stg 2:7)');
    });

    it('a la vista en la ficha; compacta en «Estructura» hasta tocarla', () => {
        const { unmount } = render(<SourceNote sources={VERB_RULE_SOURCES.periphrastic} />);
        expect(screen.getByTestId('source-note').textContent).toContain('Periphrastic Participle');
        unmount();
        render(<SourceNote sources={STRUCTURE_RULE_SOURCES.class1} compact />);
        expect(screen.queryByTestId('source-note')).toBeNull();
        fireEvent.click(screen.getByTestId('source-toggle'));
        expect(screen.getByTestId('source-note').textContent).toContain('First Class Condition');
    });

    it('sin fuentes no muestra nada', () => {
        const { container } = render(<SourceNote sources={[]} />);
        expect(container).toBeEmptyDOMElement();
    });
});
