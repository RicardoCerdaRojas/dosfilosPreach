import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { prosePathOf, type VerifiedCitation } from '@dosfilos/domain';
import { enlazarVeredictos } from '../enlazarVeredictos';
import { ProsaConVeredictos } from '../ProsaConVeredictos';

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

/**
 * TP #9 (B41): «es confuso porque pedí revisar la prosa». La página de
 * revisión mostraba solo el análisis; la prosa (Stg 4:15, leída en
 * producción) se verifica y no se veía.
 */
const PROSA = 'Robertson clasifica expresamente esta construcción como infinitivo en genitivo regido por preposición (Robertson, 1060).\n\nTuggy incluye este empleo de ἀντί entre los que expresan sustitución, mientras Robertson lo describe como sustitución de perspectivas (Tuggy, 90; Robertson, 574).';
const veredicto = (raw: string, status: VerifiedCitation['status'], desde = 0): VerifiedCitation => ({
    raw, author: raw.replace(/^[(;]\s*/, '').split(',')[0]!, title: '', pages: raw.split(', ')[1]!, offset: PROSA.indexOf(raw, desde),
    evidence: '', evidenceIsQuoted: false, status, matchedCorpusId: null, matchedSourceLabel: null, similarityScore: null, matchedPage: null, note: null, origin: 'prose',
} as VerifiedCitation);
const V = [veredicto('(Robertson, 1060', 'verified'), veredicto('(Tuggy, 90', 'page-mismatch'), veredicto('; Robertson, 574', 'not-found')];
const mapa = () => new Map(V.map(v => [prosePathOf(v), v] as const));

beforeEach(() => cleanup());

describe('enlazarVeredictos', () => {
    it('marca cada cita de la prosa, sin el «(» ni el «; » de la forma, incluida la segunda de un paréntesis', () => {
        const { markdown, paths } = enlazarVeredictos(PROSA, mapa());
        expect(markdown).toContain('([Robertson, 1060](#veredicto-0)).');
        expect(markdown).toContain('([Tuggy, 90](#veredicto-1); [Robertson, 574](#veredicto-2)).');
        expect(paths).toEqual(V.map(prosePathOf));
    });

    it('si la prosa cambió de lugar la cita, la busca; si ya no está, no la marca', () => {
        const corrido = new Map([[prosePathOf(V[0]!), { ...V[0]!, offset: 3 }], ['prosa@999', { ...V[1]!, raw: '(Varner, 160' }]]);
        const { markdown, paths } = enlazarVeredictos(PROSA, corrido);
        expect(markdown).toContain('[Robertson, 1060](#veredicto-0)');
        expect(paths).toEqual([prosePathOf(V[0]!)]);
    });

    it('las del análisis (sin ruta de prosa) no se marcan en la prosa', () => {
        expect(enlazarVeredictos(PROSA, new Map([['questionAnswers[0].decisiveCriterion.sources[0]', V[0]!]])).paths).toEqual([]);
    });
});

describe('ProsaConVeredictos', () => {
    it('cada cita es un botón con su veredicto que la elige', () => {
        const onSelect = vi.fn();
        render(<ProsaConVeredictos markdown={PROSA} verdicts={mapa()} reviewed={new Set()} selectedPath={prosePathOf(V[1]!)} onSelect={onSelect} />);
        const botones = screen.getAllByTestId('cita-con-veredicto');
        expect(botones.map(b => b.textContent)).toEqual([
            'Robertson, 1060 · canonical.verify.status.verified',
            'Tuggy, 90 · canonical.verify.status.page-mismatch',
            'Robertson, 574 · canonical.verify.status.not-found',
        ]);
        expect(botones[1]).toHaveAttribute('aria-pressed', 'true');
        // El estado se lee como parte del nombre del botón.
        expect(screen.getByRole('button', { name: /Robertson, 574 · canonical\.verify\.status\.not-found/ })).toBeInTheDocument();
        fireEvent.click(botones[2]!);
        expect(onSelect).toHaveBeenCalledWith(prosePathOf(V[2]!));
        // El mismo id que usa la lista lateral para traerla a la vista.
        expect(botones[2]).toHaveAttribute('id', `cita-${prosePathOf(V[2]!)}`);
    });

    it('revisada a mano, lo dice', () => {
        render(<ProsaConVeredictos markdown={PROSA} verdicts={mapa()} reviewed={new Set([prosePathOf(V[2]!)])} selectedPath={null} onSelect={vi.fn()} />);
        expect(screen.getByRole('button', { name: /Robertson, 574 · canonical\.review\.status\.reviewed/ })).toBeInTheDocument();
    });
});
