import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MaterialReadNotice } from '../MaterialReadNotice';

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));

beforeEach(() => cleanup());

describe('lo que leyó el análisis', () => {
    it('muestra por fuente las hojas que llegaron y si el reparto cortó', () => {
        render(<MaterialReadNotice materialRead={[
            { sourceKey: 'Mayor', label: 'Mayor', read: 'p. 155–157', truncated: false, pinnedCut: false },
            { sourceKey: 'Wallace', label: 'Wallace', read: 'p. 628', truncated: true, pinnedCut: false },
            { sourceKey: 'Robertson', label: 'Robertson', read: 'p. 778', truncated: true, pinnedCut: true },
            { sourceKey: null, label: 'Apuntes', read: null, truncated: false, pinnedCut: false },
        ]} />);
        expect(screen.getByText('p. 155–157')).toBeInTheDocument();
        expect(screen.getByText('(materialRead.truncated)')).toBeInTheDocument();
        expect(screen.getByText('(materialRead.pinnedCut)')).toBeInTheDocument();
        expect(screen.getByText('Apuntes')).toBeInTheDocument();
        expect(screen.getByText('materialRead.noAnchors')).toBeInTheDocument();
    });

    it('sin registro (versiones anteriores), no se muestra nada', () => {
        const { container } = render(<MaterialReadNotice materialRead={undefined} />);
        expect(container).toBeEmptyDOMElement();
    });
});
