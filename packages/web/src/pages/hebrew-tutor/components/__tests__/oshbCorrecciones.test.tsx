import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/** Rut 1:13 (bitácora del módulo de hebreo #1): OSHB corrigió 3FP → 2FP. */
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}));
const { OshbCorrectionsList } = await import('../OshbCorrectionsList');
const { OshbValidationBadge } = await import('../OshbValidationBadge');

const corregida = { morphCode: 'HVNi2fp', strongNumber: '5702', agreesWithAnalysis: false, corrections: [{ field: 'person' as const, analysis: '3', oshb: '2' }] };

describe('lo que OSHB corrigió en el verbo', () => {
    it('REGRESIÓN: dice qué cambió y avisa de la traducción', () => {
        render(<OshbCorrectionsList oshb={corregida} />);
        expect(screen.getByText(/verseAnalyzer\.oshb\.correction/)).toHaveTextContent('"analysis":"3","oshb":"2"');
        expect(screen.getByText('verseAnalyzer.oshb.translationNote')).toBeInTheDocument();
        expect(screen.getByText('HVNi2fp')).toBeInTheDocument();
    });

    it('sin correcciones no muestra nada; la insignia dice si coincide', () => {
        const { container } = render(<OshbCorrectionsList oshb={{ ...corregida, agreesWithAnalysis: true, corrections: [] }} />);
        expect(container).toBeEmptyDOMElement();
        render(<OshbValidationBadge oshb={corregida} />);
        expect(screen.getByTitle('verseAnalyzer.oshb.differs')).toBeInTheDocument();
    });
});
