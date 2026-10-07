import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { CitationReview, VerifiedCitation } from '@dosfilos/domain';
import { nextPendingCitation, selectionAfterReview } from '../nextPendingCitation';

/**
 * TP #6 (2026-10-07): después de «Marcar como revisada» el panel se quedaba
 * en la misma cita, seguía ofreciendo «marcar» y el aviso de página seguía
 * a la vista. Parecía que no había pasado nada.
 */
vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (k: string) => k }),
}));
const { CitationEvidencePanel } = await import('../CitationEvidencePanel');

beforeEach(() => cleanup());

describe('la cita que sigue', () => {
    it('REGRESIÓN: después de revisar una, la siguiente sin revisar', () => {
        expect(nextPendingCitation(['a', 'b', 'c'], new Set(), 'a')).toBe('b');
        // Hacia ADELANTE desde la actual, no la primera de la lista.
        expect(nextPendingCitation(['a', 'b', 'c'], new Set(), 'b')).toBe('c');
        // «b» ya estaba revisada: se salta.
        expect(nextPendingCitation(['a', 'b', 'c'], new Set(['b']), 'a')).toBe('c');
    });

    it('al llegar al final vuelve al principio; sin pendientes, ninguna', () => {
        expect(nextPendingCitation(['a', 'b', 'c'], new Set(), 'c')).toBe('a');
        expect(nextPendingCitation(['a', 'b'], new Set(['b']), 'a')).toBeNull();
    });

    it('la recién revisada se excluye aunque la lista de revisiones no la traiga todavía', () => {
        expect(nextPendingCitation(['a'], new Set(), 'a')).toBeNull();
    });
});

describe('cuándo avanza después de guardar', () => {
    const base = { listed: ['a', 'b', 'c'], reviewed: new Set<string>(), path: 'a', note: 'la p. 140 lo dice' };

    it('primera revisión, todavía en la misma cita: pasa a la siguiente', () => {
        expect(selectionAfterReview({ ...base, wasNew: true })('a')).toBe('b');
    });

    it('actualizar una nota ya guardada no la saca de la cita', () => {
        expect(selectionAfterReview({ ...base, wasNew: false })('a')).toBe('a');
    });

    it('si mientras se guardaba ya abrió otra, se queda en ésa', () => {
        expect(selectionAfterReview({ ...base, wasNew: true })('c')).toBe('c');
    });

    it('quitar la revisión (nota vacía) no mueve nada', () => {
        expect(selectionAfterReview({ ...base, note: '  ', wasNew: true })('a')).toBe('a');
    });
});

const verdict = {
    raw: 'Adamson, p. 140', author: 'Adamson', title: '', pages: '140', offset: 0,
    evidence: 'x', evidenceIsQuoted: false, status: 'page-mismatch',
    matchedCorpusId: 'r', matchedSourceLabel: 'Adamson', similarityScore: 0.9,
    matchedPage: '141', matchedPageLabel: 'p. 141', note: 'Citaste p. 140 pero el pasaje está en 141.',
} as unknown as VerifiedCitation;
const revisada = { path: 'p1', note: 'p. 140 lo dice', reviewedAt: new Date('2026-10-07') } as unknown as CitationReview;

const panel = (review: CitationReview | null, calibrationPath: string | null = null) => render(
    <MemoryRouter>
        <CitationEvidencePanel path="p1" verdict={verdict} claim={null} review={review} isReviewing={false}
            onReview={vi.fn()} onOpenSource={vi.fn()} noteFromView={null} viewed={null} onCorrect={vi.fn()} calibrationPath={calibrationPath} />
    </MemoryRouter>,
);

describe('una cita ya revisada no sigue pidiendo revisión', () => {
    it('sin revisar: aviso de página y «Marcar como revisada»', () => {
        panel(null);
        // 140 citada, «p. 141» hallada: desfase de uno, se ofrece calibrar.
        expect(screen.getByText('canonical.review.panel.pageHintCalibration')).toBeInTheDocument();
        expect(screen.getByText('canonical.review.panel.save')).toBeInTheDocument();
    });

    it('REGRESIÓN: revisada, sin aviso de página y con «Actualizar la nota» apagado hasta que la nota cambie', () => {
        panel(revisada);
        expect(screen.queryByText('canonical.review.panel.pageHintCalibration')).not.toBeInTheDocument();
        expect(screen.queryByText('canonical.review.panel.save')).not.toBeInTheDocument();
        expect(screen.getByText('canonical.review.panel.update').closest('button')).toBeDisabled();
    });

    it('revisada, el desfase del libro sigue ofreciendo calibrar: afecta a las demás citas', () => {
        panel(revisada, '/biblioteca/r/numeracion');
        expect(screen.queryByText('canonical.review.panel.pageHintCalibration')).not.toBeInTheDocument();
        expect(screen.getByText('canonical.review.panel.pageHintCalibrate')).toBeInTheDocument();
    });

    it('una HOJA hallada no es desfase de página impresa: aviso común, sin calibrar', () => {
        render(
            <MemoryRouter>
                <CitationEvidencePanel path="p1" verdict={{ ...verdict, matchedPageLabel: 'hoja 141' } as VerifiedCitation} claim={null} review={null}
                    isReviewing={false} onReview={vi.fn()} onOpenSource={vi.fn()} noteFromView={null} viewed={null} onCorrect={vi.fn()} calibrationPath="/cal" />
            </MemoryRouter>,
        );
        expect(screen.getByText('canonical.review.panel.pageHint')).toBeInTheDocument();
        expect(screen.queryByText('canonical.review.panel.pageHintCalibrate')).not.toBeInTheDocument();
    });
});
