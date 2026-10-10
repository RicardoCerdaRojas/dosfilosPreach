import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HEBREW_PARTICIPLE_SOURCES } from '@dosfilos/domain';
import es from '@/i18n/locales/es/hebrewTutor.json';
import en from '@/i18n/locales/en/hebrewTutor.json';

/** R4 — la función del participio en la ficha (Arnold y Choi §3.4.3). */
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}));
const { HebrewParticipleNote } = await import('../HebrewParticipleNote');

const conPrep = { ordinal: 0, text: 'לְשֹׁמְרֵי', rule: 'ptcPreposicion' as const, allowed: ['substantive'] as const, status: 'medida' as const };
const trasHinne = { ordinal: 2, text: 'מֵבִיא', rule: 'ptcHinne' as const, allowed: ['predicatePresent', 'predicatePast', 'predicateFuture'] as const, status: 'medida' as const };

describe('R4 — el participio en la ficha', () => {
    it('una opción: la función, «Regla · medida» y la cita verificada (§3.4.3 c)', () => {
        render(<HebrewParticipleNote view={{ candidate: conPrep, fn: 'substantive', by: 'rule' }} />);
        const n = screen.getByTestId('participle-note').textContent!;
        expect(n).toContain('verseAnalyzer.participle.title');
        expect(n).toContain('verseAnalyzer.participle.functions.substantive');
        expect(n).toContain('verseAnalyzer.ruleChoice.ruleMeasured');
        expect(screen.getByTestId('source-toggle')).toBeInTheDocument();
    });
    it('tras הִנֵּה, el asistente elige el tiempo: «Asistente»', () => {
        render(<HebrewParticipleNote view={{ candidate: trasHinne, fn: 'predicateFuture', by: 'assistant' }} />);
        const n = screen.getByTestId('participle-note').textContent!;
        expect(n).toContain('functions.predicateFuture');
        expect(n).toContain('verseAnalyzer.ruleChoice.assistant');
    });
    it('el asistente lee otra: se muestran las dos, sin «re-analiza»', () => {
        render(<HebrewParticipleNote view={{ candidate: trasHinne, assistantReading: 'substantive' }} />);
        expect(screen.getByTestId('participle-disagreement').textContent).toContain('functions.substantive');
        expect(screen.getByTestId('participle-note').textContent).not.toContain('reanalyze');
    });
    it('cada función del participio tiene nombre en los dos idiomas', () => {
        for (const loc of [es, en] as const) {
            const fns = (loc as { verseAnalyzer: { participle: { functions: Record<string, string> } } }).verseAnalyzer.participle.functions;
            for (const f of Object.keys(HEBREW_PARTICIPLE_SOURCES)) expect(fns[f], f).toBeTruthy();
        }
    });
    it('sin vista, nada', () => {
        expect(render(<HebrewParticipleNote />).container).toBeEmptyDOMElement();
    });
});
