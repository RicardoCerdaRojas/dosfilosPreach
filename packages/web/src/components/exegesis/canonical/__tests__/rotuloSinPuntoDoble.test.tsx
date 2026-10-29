import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { buildEmptyCanonicalVerseAnalysis, type PassageReference } from '@dosfilos/domain';
import { CanonicalAnalysisStudyView } from '../CanonicalAnalysisStudyView';

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));

/** TP #9 (Stg 4:12): el rótulo que ya cierra con punto salía «…legislador y juez..». */
const REF = { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 12, verseEnd: 12 } as PassageReference;

describe('la función sintáctica en negrita no lleva punto doble (B34)', () => {
    it('con punto propio queda uno; sin punto, se agrega', () => {
        const a = buildEmptyCanonicalVerseAnalysis(REF);
        const { container } = render(<CanonicalAnalysisStudyView analysis={{
            ...a,
            syntacticAnalysis: {
                ...a.syntacticAnalysis,
                keyConstructions: [
                    { text: 'ὁ δυνάμενος', morphology: 'participio', syntacticFunction: 'Participio sustantivado en aposición al referente único, caracterizado como legislador y juez.', interpretiveSignificance: 'Identifica.' },
                    { text: 'νομοθέτης καὶ κριτής', morphology: 'nominativos', syntacticFunction: 'Predicado nominal coordinado, según la lectura aquí propuesta del texto base', interpretiveSignificance: 'Precisa.' },
                ],
            },
        }} />);
        const texto = container.textContent ?? '';
        expect(texto).not.toContain('..');
        expect(texto).toContain('legislador y juez. Identifica.');
        expect(texto).toContain('del texto base. Precisa.');
    });
});
