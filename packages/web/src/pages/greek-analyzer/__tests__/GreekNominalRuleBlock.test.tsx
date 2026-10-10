import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, string>) => (o?.tr ? `${k}:${o.tr}|${o.own}` : o?.own ? `${k}:${o.own}` : o?.head ? `${k}:${o.head}` : k) }),
}));
const { GreekAgencyBlock, GreekAnaphoraRuleNote, GreekAutosBlock } = await import('../GreekNominalRuleBlock');
const base = { text: 'x', semanticRange: 'a', syntacticFunction: 'b', translation: 'c' };

describe('G3 en la ficha', () => {
    it('agencia: tipo, «Regla», por qué y fuente (Stg 2:9 ὑπό)', () => {
        render(<GreekAgencyBlock insight={{ ...base, agency: 'ultimate', nominalRule: 'agentHypo' }} />);
        expect(screen.getByText('analyzer.agency.ultimate')).toBeInTheDocument();
        expect(screen.getByText('wordFicha.origin.rule')).toBeInTheDocument();
        expect(screen.getByText('(analyzer.agency.ruleAgentHypo)')).toBeInTheDocument();
        expect(screen.getByTestId('source-note').textContent).toContain('Ultimate Agent», p. 433');
    });
    it('artículo anafórico por regla: «Regla» y fuente; si lo eligió el asistente, nada de esto', () => {
        const { unmount } = render(<GreekAnaphoraRuleNote insight={{ ...base, articleUse: 'anaphoric', nominalRule: 'anaphoraLemma' }} />);
        expect(screen.getByTestId('source-note').textContent).toContain('Anaphoric (Previous Reference)», p. 217');
        unmount();
        const { container } = render(<GreekAnaphoraRuleNote insight={{ ...base, articleUse: 'anaphoric' }} />);
        expect(container).toBeEmptyDOMElement();
    });
    it('αὐτός intensivo (1 Ts 4:16): uso, «Regla», qué realza y Wallace; identificador sin sustantivo; «ἐπὶ τὸ αὐτό»', () => {
        const { unmount } = render(<GreekAutosBlock insight={{ ...base, autosUse: 'intensive', nominalRule: 'autosIntensive', autosHeadText: 'κύριος' }} />);
        expect(screen.getByText('analyzer.autos.intensive')).toBeInTheDocument();
        expect(screen.getByText('wordFicha.origin.rule')).toBeInTheDocument();
        expect(screen.getByText('analyzer.autos.intensiveHintNoHead')).toBeInTheDocument(); // sin traducción de κύριος
        expect(screen.getByTestId('source-note').textContent).toContain('As an Intensive Pronoun», p. 349');
        unmount();
        const r2 = render(<GreekAutosBlock insight={{ ...base, autosUse: 'identical', nominalRule: 'autosIdentical' }} />);
        expect(screen.getByText('analyzer.autos.identicalHintNoHead')).toBeInTheDocument();
        r2.unmount();
        render(<GreekAutosBlock insight={{ ...base, autosUse: 'identical', nominalRule: 'autosIdentical', autosTogether: true }} />);
        expect(screen.getByText('analyzer.autos.together')).toBeInTheDocument();
    });
    it('la concordancia la pone la traducción española del propio αὐτός, no el género griego (revisión de #757)', () => {
        const r1 = render(<GreekAutosBlock insight={{ ...base, translation: 'misma', autosUse: 'intensive', nominalRule: 'autosIntensive', autosHeadText: 'φύσις', autosHeadTranslation: 'la naturaleza' }} />);
        expect(screen.getByText('analyzer.autos.intensiveHintTr:la naturaleza|misma')).toBeInTheDocument();
        r1.unmount();
        // «τὴν αὐτὴν ἀγάπην» (Flp 2:2): femenino en griego, «el mismo amor» en español.
        const r2 = render(<GreekAutosBlock insight={{ ...base, translation: 'el mismo', autosUse: 'identical', nominalRule: 'autosIdentical', autosHeadText: 'ἀγάπην', autosHeadTranslation: 'el amor' }} />);
        expect(screen.getByText('analyzer.autos.identicalHintTr:amor|el mismo')).toBeInTheDocument();
        r2.unmount();
        // Sin «mismo» con artículo, no se arma la frase.
        const r3 = render(<GreekAutosBlock insight={{ ...base, translation: 'mismo', autosUse: 'identical', nominalRule: 'autosIdentical', autosHeadText: 'κύριος', autosHeadTranslation: 'Señor' }} />);
        expect(screen.getByText('analyzer.autos.identicalHint:Señor|mismo')).toBeInTheDocument();
        expect(screen.queryByTestId('autos-stale')).toBeNull();
        r3.unmount();
    });
    it('análisis guardado antes de la regla que tradujo «él»: no se arma la frase y se avisa', () => {
        render(<GreekAutosBlock insight={{ ...base, translation: 'él', autosUse: 'intensive', nominalRule: 'autosIntensive', autosHeadText: 'κύριος', autosHeadTranslation: 'Señor' }} />);
        expect(screen.getByText('analyzer.autos.intensiveHint:Señor|él')).toBeInTheDocument();
        expect(screen.getByTestId('autos-stale').textContent).toBe('analyzer.autos.staleTranslation:él');
    });
    it('sin uso decidido, nada', () => {
        expect(render(<GreekAutosBlock insight={base} />).container).toBeEmptyDOMElement();
    });
});
