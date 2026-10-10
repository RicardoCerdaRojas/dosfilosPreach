import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HEBREW_KI_SOURCES } from '@dosfilos/domain';
import es from '@/i18n/locales/es/hebrewTutor.json';
import en from '@/i18n/locales/en/hebrewTutor.json';

/** R4 — la función de כִּי en la ficha (Arnold y Choi §4.3.4). */
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}));
const { HebrewKiNote } = await import('../HebrewKiNote');

const jura = { ordinal: 3, text: 'כִּי', rule: 'kiJuramento' as const, allowed: ['asseverative'] as const, status: 'medida' as const };
const vayehi = { ordinal: 1, text: 'כִּי', rule: 'kiVayehi' as const, allowed: ['temporal', 'conditional'] as const, status: 'medida' as const };

describe('R4 — כִּי en la ficha', () => {
    it('tras juramento: «aseverativa», «Regla · medida» y la cita verificada (§4.3.4 i)', () => {
        render(<HebrewKiNote view={{ candidate: jura, fn: 'asseverative', by: 'rule' }} />);
        const n = screen.getByTestId('ki-note').textContent!;
        expect(n).toContain('verseAnalyzer.ki.title');
        expect(n).toContain('verseAnalyzer.ki.functions.asseverative');
        expect(n).toContain('verseAnalyzer.ruleChoice.ruleMeasured');
        expect(screen.getByTestId('source-toggle')).toBeInTheDocument();
    });
    it('וַיְהִי כִּי: el asistente elige entre tiempo y condición', () => {
        render(<HebrewKiNote view={{ candidate: vayehi, fn: 'temporal', by: 'assistant' }} />);
        expect(screen.getByTestId('ki-note').textContent).toContain('verseAnalyzer.ruleChoice.assistant');
    });
    it('el asistente lee otra: se muestran las dos', () => {
        render(<HebrewKiNote view={{ candidate: vayehi, assistantReading: 'causal' }} />);
        expect(screen.getByTestId('ki-disagreement').textContent).toContain('functions.causal');
    });
    it('cada función de כִּי tiene nombre en los dos idiomas', () => {
        for (const loc of [es, en] as const) {
            const fns = (loc as { verseAnalyzer: { ki: { functions: Record<string, string> } } }).verseAnalyzer.ki.functions;
            for (const f of Object.keys(HEBREW_KI_SOURCES)) expect(fns[f], f).toBeTruthy();
        }
    });
    it('sin vista, nada', () => {
        expect(render(<HebrewKiNote />).container).toBeEmptyDOMElement();
    });
});
