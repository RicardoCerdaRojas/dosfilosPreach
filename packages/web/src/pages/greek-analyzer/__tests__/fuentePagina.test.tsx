import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { verseWords } from '@dosfilos/domain';

const archivo = (rel: string) => readFileSync(join(__dirname, '..', '..', '..', '..', 'public', 'language-data', 'v1', rel), 'utf8');
const cap = JSON.parse(archivo('gr/JAS/2.json'));
const tokens = verseWords(cap, 9).map(w => ({ text: w.t, lemma: w.l, pos: 'V', tag: {}, transliteration: '' }));
vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(archivo(String(url).replace('/language-data/v1/', '')), { status: 200, headers: { 'content-type': 'application/json' } })));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: null }) }));
vi.mock('../useGreekVerse', () => ({
    useGreekVerse: () => ({ book: 'JAS', chapter: 2, verse: 9, books: [{ id: 'JAS', nameEs: 'Santiago', nameEn: 'James' }], chapters: [1, 2], versesInChapter: 26,
        data: { tokens, text: '' }, previous: undefined, loading: false, error: null, goTo: vi.fn(), step: vi.fn(), provider: {}, lemmaCounts: {} }),
}));
vi.mock('../useGreekInsight', () => ({ useGreekInsight: () => ({ insight: null, checking: false, generating: false, error: null, cacheUnavailable: false, generate: vi.fn() }) }));
vi.mock('../GreekVerseBoard', () => ({ GreekVerseBoard: () => null, GreekWordTooltip: () => null }));
vi.mock('../GreekInsightBlocks', () => ({ GreekInsightBlocks: () => null }));
// La grilla y el panel, mínimos: alcanza con ver que tocar una tarjeta abre ESA ficha en el panel.
vi.mock('../FichasGriego', () => ({
    TarjetasResumenGriego: ({ onAbrir }: { onAbrir: (i: number) => void }) => <button type="button" data-testid="tarjeta-2" onClick={() => onAbrir(2)} />,
    FichaPanelGriego: ({ abierta, datos }: { abierta: number | null; datos: (i: number) => { token: { text: string } } | null }) =>
        abierta === null ? null : <div data-testid="panel-abierto">{datos(abierta)?.token.text}</div>,
}));
vi.mock('@dosfilos/infrastructure', async (orig) => ({ ...(await orig<object>()), FirestoreGreekFindingsRepository: class {} }));
const { GreekAnalyzerPage } = await import('../GreekAnalyzerPage');
const { TooltipProvider } = await import('@/components/ui/tooltip');

describe('«Fuente» en la página griega (Stg 2:9)', () => {
    it('se abre al tocarlo', async () => {
        render(<TooltipProvider><GreekAnalyzerPage /></TooltipProvider>);
        await waitFor(() => expect(screen.getAllByTestId('source-toggle').length).toBeGreaterThan(0));
        fireEvent.click(screen.getAllByTestId('source-toggle')[1]!);
        await waitFor(() => expect(screen.getByTestId('source-note').textContent).toContain('First Class Condition'));
    });
});

describe('la ficha en el panel lateral (página griega)', () => {
    it('tocar la tarjeta resumen abre la ficha de esa palabra', async () => {
        render(<TooltipProvider><GreekAnalyzerPage /></TooltipProvider>);
        expect(screen.queryByTestId('panel-abierto')).toBeNull();
        fireEvent.click(await screen.findByTestId('tarjeta-2'));
        expect(screen.getByTestId('panel-abierto').textContent).toBe(tokens[2]!.text);
    });
});
