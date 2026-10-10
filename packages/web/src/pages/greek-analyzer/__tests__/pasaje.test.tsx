import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

/**
 * El pasaje (revisión de la ficha): su tooltip promete «clic para ver la ficha
 * completa», así que tocar una palabra tiene que abrirla — antes el pasaje
 * mostraba la ficha entera en el popover y el rediseño la había dejado sin camino.
 */
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));
vi.mock('@dosfilos/infrastructure', () => ({ FirestoreGreekInsightRepository: class { get = async () => null; }, SBLGNTBibleProvider: class {} }));
vi.mock('../FichasGriego', () => ({
    FichaPanelGriego: ({ abierta, datos, titulo }: { abierta: number | null; titulo: string; datos: (i: number) => { token: { text: string } } | null }) =>
        abierta === null ? null : <div data-testid="panel-abierto">{titulo} · {datos(abierta)?.token.text}</div>,
}));
const { GreekPassageView } = await import('../GreekPassageView');
const { TooltipProvider } = await import('@/components/ui/tooltip');

const tok = (text: string) => ({ text, lemma: text, pos: 'N', tag: {}, transliteration: `tr-${text}` });
const provider = { getVerseTokens: async (_b: string, _c: number, v: number) => ({ reference: { chapter: 1, verse: v }, text: '', tokens: [tok(`α${v}`), tok(`β${v}`)] }) };

describe('el pasaje griego', () => {
    it('tocar una palabra abre su ficha completa en el panel', async () => {
        render(<TooltipProvider><GreekPassageView provider={provider as never} book={'JAS' as never} bookName="Santiago" chapter={1} versesInChapter={2} onOpenVerse={() => {}} /></TooltipProvider>);
        fireEvent.click(await screen.findByText('β2'));
        expect(screen.getByTestId('panel-abierto').textContent).toBe('Santiago 1:2 · β2');
    });
});
