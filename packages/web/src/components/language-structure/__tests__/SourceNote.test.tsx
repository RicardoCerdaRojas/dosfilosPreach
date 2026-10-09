import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { formatCitation, STRUCTURE_RULE_SOURCES, VERB_RULE_SOURCES, type RuleSource } from '@dosfilos/domain';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
const { SourceNote } = await import('../SourceNote');

describe('la fuente de una regla, para citar', () => {
    it('a la vista, autor y sección; al copiar, con obra y año; la página sólo si está verificada', () => {
        // R0: sin verificar, sólo obra y tema — nada que parezca una cita textual.
        const sin: RuleSource = { work: 'runge', section: 'Development (δέ)', topic: 'los conectores' };
        expect(formatCitation(sin)).toBe('Runge, sobre los conectores');
        expect(formatCitation(sin, 'full')).toBe('Runge, Discourse Grammar of the Greek New Testament (2010), sobre los conectores');
        const ver: RuleSource = { work: 'wallace', section: 'Dependent Verbal Participles › Periphrastic', topic: 'el participio', verified: { page: '647', method: 'pdf', on: '2026-10-09' } };
        expect(formatCitation(ver)).toBe('Wallace, «Dependent Verbal Participles › Periphrastic», p. 647');
        expect(formatCitation(ver, 'full')).toBe('Wallace, Greek Grammar Beyond the Basics: An Exegetical Syntax of the New Testament (1996), «Dependent Verbal Participles › Periphrastic», p. 647');
        expect(formatCitation({ work: 'professor', section: 'x', topic: 'indicación docente', note: '2026-10-07 · Stg 2:7' })).toBe('Revisión docente de Dos Filos Preach (2026-10-07 · Stg 2:7)');
    });

    it('a la vista en la ficha; compacta en «Estructura» hasta tocarla', () => {
        const { unmount } = render(<SourceNote sources={VERB_RULE_SOURCES.periphrastic} />);
        expect(screen.getByTestId('source-note').textContent).toContain('Periphrastic», p. 647');
        unmount();
        render(<SourceNote sources={STRUCTURE_RULE_SOURCES.class1} compact />);
        expect(screen.queryByTestId('source-note')).toBeNull();
        fireEvent.click(screen.getByTestId('source-toggle'));
        expect(screen.getByTestId('source-note').textContent).toContain('First Class Condition');
    });

    it('dos fuentes sin verificar del mismo tema no se repiten («fronted», revisión de R0)', () => {
        render(<SourceNote sources={STRUCTURE_RULE_SOURCES.fronted} />);
        expect(screen.getByTestId('source-note').textContent!.match(/Runge, sobre el énfasis y el foco/g)).toHaveLength(1);
    });
    it('sin fuentes no muestra nada', () => {
        const { container } = render(<SourceNote sources={[]} />);
        expect(container).toBeEmptyDOMElement();
    });
});
