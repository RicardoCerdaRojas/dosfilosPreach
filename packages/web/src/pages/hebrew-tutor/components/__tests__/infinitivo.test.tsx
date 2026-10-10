import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HEBREW_INFINITIVE_SOURCES } from '@dosfilos/domain';
import es from '@/i18n/locales/es/hebrewTutor.json';
import en from '@/i18n/locales/en/hebrewTutor.json';

/** R4 — la función del infinitivo en la ficha: regla medida, elección del asistente u opciones. */
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}));
const { HebrewInfinitiveNote } = await import('../HebrewInfinitiveNote');

const hasta = { ordinal: 3, text: 'בֹּאֲךָ', form: 'construct' as const, rule: 'adInf' as const, allowed: ['temporalUntil'] as const, status: 'medida' as const };
const be = { ordinal: 1, text: 'בְּשָׁמְעוֹ', form: 'construct' as const, rule: 'bInf' as const, allowed: ['temporalWhile', 'causal', 'instrumental'] as const, status: 'medida' as const };

describe('R4 en la ficha', () => {
    it('una opción: la función, «Regla · medida» (no validada) y la cita verificada de Arnold y Choi', () => {
        render(<HebrewInfinitiveNote view={{ candidate: hasta, fn: 'temporalUntil', by: 'rule' }} />);
        const n = screen.getByTestId('infinitive-note').textContent!;
        expect(n).toContain('verseAnalyzer.infinitive.functions.temporalUntil');
        expect(n).toContain('verseAnalyzer.infinitive.ruleMeasured');
        expect(screen.getByTestId('source-toggle')).toBeInTheDocument();
    });
    it('varias y el asistente eligió: «Asistente»', () => {
        render(<HebrewInfinitiveNote view={{ candidate: be, fn: 'causal', by: 'assistant' }} />);
        expect(screen.getByTestId('infinitive-note').textContent).toContain('verseAnalyzer.infinitive.assistant');
    });
    it('varias sin elección (análisis anterior): dice las opciones, sin marca', () => {
        render(<HebrewInfinitiveNote view={{ candidate: be }} />);
        const n = screen.getByTestId('infinitive-note').textContent!;
        expect(n).toContain('verseAnalyzer.infinitive.options');
        expect(n).toContain('functions.causal');
        expect(n).not.toContain('ruleMeasured');
        expect(n).toContain('verseAnalyzer.infinitive.reanalyze');
    });
    it('varias y el asistente leyó una fuera de la lista: su lectura al lado, sin «re-analiza» (1 S 22:17)', () => {
        render(<HebrewInfinitiveNote view={{ candidate: be, assistantReading: 'object' }} />);
        const n = screen.getByTestId('infinitive-note').textContent!;
        expect(screen.getByTestId('infinitive-disagreement').textContent).toContain('functions.object');
        expect(n).toContain('verseAnalyzer.infinitive.options');
        expect(n).not.toContain('reanalyze');
    });
    it('la regla propone una y el asistente lee otra: se muestran las dos', () => {
        render(<HebrewInfinitiveNote view={{ candidate: hasta, fn: 'temporalUntil', by: 'rule', assistantReading: 'purpose' }} />);
        const d = screen.getByTestId('infinitive-disagreement').textContent!;
        expect(d).toContain('verseAnalyzer.infinitive.assistantReads');
        expect(d).toContain('functions.purpose');
    });
    it('sin desacuerdo, no hay línea del asistente', () => {
        render(<HebrewInfinitiveNote view={{ candidate: hasta, fn: 'temporalUntil', by: 'rule' }} />);
        expect(screen.queryByTestId('infinitive-disagreement')).toBeNull();
    });
    it('כְּ compara: «comparación» con su cita (§4.1.9)', () => {
        const ke = { ...be, text: 'כְּהִנְדֹּף', rule: 'kInf' as const, allowed: ['temporalAsSoonAs', 'temporalWhile', 'comparative'] as const };
        render(<HebrewInfinitiveNote view={{ candidate: ke, fn: 'comparative', by: 'assistant' }} />);
        expect(screen.getByTestId('infinitive-note').textContent).toContain('functions.comparative');
        expect(screen.getByTestId('source-toggle')).toBeInTheDocument();
    });
    it('cada función con fuente tiene nombre en los dos idiomas', () => {
        for (const loc of [es, en] as const) {
            const fns = (loc as { verseAnalyzer: { infinitive: { functions: Record<string, string> } } }).verseAnalyzer.infinitive.functions;
            for (const f of Object.keys(HEBREW_INFINITIVE_SOURCES)) expect(fns[f], f).toBeTruthy();
        }
    });
    it('sin vista, nada', () => {
        expect(render(<HebrewInfinitiveNote />).container).toBeEmptyDOMElement();
    });
});
