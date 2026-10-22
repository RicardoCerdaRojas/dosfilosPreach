import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

/** Revisión de la etapa 0: ahora que la bibliografía del sílabo llega, la tarjeta se ve de verdad. */
vi.mock('@/hooks/library', () => ({ useLibrary: () => ({ resources: [] }) }));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }) }));
const { CourseBibliographyCard } = await import('../CourseBibliographyCard');

afterEach(cleanup);
const trabajo = (courseBibliography: unknown[]) => ({ sources: [], rubric: { courseBibliography } }) as never;

describe('CourseBibliographyCard', () => {
    it('un sílabo que solo recomienda no dice «0 de 0 obligatorias»', () => {
        render(<CourseBibliographyCard paper={trabajo([{ title: 'Mayor', requirement: 'recommended' }, { title: 'Ropes', requirement: 'recommended' }])} onAddResource={vi.fn()} />);
        expect(screen.getByText(/courseBib\.onlyRecommended/).textContent).toContain('"count":2');
        expect(screen.queryByText(/courseBib\.coverage/)).toBeNull();
    });

    it('con obligatorias, la cobertura de siempre', () => {
        render(<CourseBibliographyCard paper={trabajo([{ title: 'Wallace', requirement: 'required' }])} onAddResource={vi.fn()} />);
        expect(screen.getByText(/courseBib\.coverage/).textContent).toContain('"required":1');
    });
});
