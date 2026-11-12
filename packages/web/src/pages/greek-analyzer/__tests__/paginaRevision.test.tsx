import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { verseWords } from '@dosfilos/domain';

/**
 * Revisión del profesor (2026-11): de los datos de la página a la ficha. U9 (Stg 3:1): la señal de
 * apertura llega al VOCATIVO con el texto de su imperativo. U3c (Stg 2:10): el código de Louw-Nida llega a ἐν.
 */
const archivo = (rel: string) => readFileSync(join(__dirname, '..', '..', '..', '..', 'public', 'language-data', 'v1', rel), 'utf8');
const ref = { cap: 3, v: 1 };
const tokensDe = (c: number, v: number) => verseWords(JSON.parse(archivo(`gr/JAS/${c}.json`)), v).map(w => ({ text: w.t, lemma: w.l, pos: 'N', tag: {}, transliteration: '' }));
vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(archivo(String(url).replace('/language-data/v1/', '')), { status: 200, headers: { 'content-type': 'application/json' } })));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: null }) }));
vi.mock('../useGreekVerse', () => ({
    useGreekVerse: () => ({ book: 'JAS', chapter: ref.cap, verse: ref.v, books: [{ id: 'JAS', nameEs: 'Santiago', nameEn: 'James' }], chapters: [1, 2, 3], versesInChapter: 26,
        data: { tokens: tokensDe(ref.cap, ref.v), text: '' }, previous: undefined, loading: false, error: null, goTo: vi.fn(), step: vi.fn(), provider: {}, lemmaCounts: {} }),
}));
vi.mock('../useGreekInsight', () => ({ useGreekInsight: () => ({ insight: null, checking: false, generating: false, error: null, cacheUnavailable: false, generate: vi.fn() }) }));
vi.mock('../GreekVerseBoard', () => ({ GreekVerseBoard: () => null, GreekWordTooltip: () => null }));
vi.mock('../GreekInsightBlocks', () => ({ GreekInsightBlocks: () => null }));
vi.mock('../FichasGriego', () => ({
    TarjetasResumenGriego: ({ onAbrir, total }: { onAbrir: (i: number) => void; total: number }) => (
        <>{Array.from({ length: total }, (_, i) => <button key={i} type="button" data-testid={`tarjeta-${i}`} onClick={() => onAbrir(i)} />)}</>
    ),
    FichaPanelGriego: ({ abierta, datos }: { abierta: number | null; datos: (i: number) => { opening?: object; ln?: string } | null }) =>
        abierta === null ? null : <div data-testid="panel-datos">{JSON.stringify({ opening: datos(abierta)?.opening ?? null, ln: datos(abierta)?.ln ?? null })}</div>,
}));
vi.mock('@dosfilos/infrastructure', async (orig) => ({ ...(await orig<object>()), FirestoreGreekFindingsRepository: class {} }));
const { GreekAnalyzerPage } = await import('../GreekAnalyzerPage');
const { TooltipProvider } = await import('@/components/ui/tooltip');

const abrir = async (i: number) => {
    fireEvent.click(await screen.findByTestId(`tarjeta-${i}`));
    return JSON.parse(screen.getByTestId('panel-datos').textContent ?? '{}');
};

describe('de los datos a la ficha (página griega, revisión del profesor)', () => {
    it('Stg 3:1: el vocativo ἀδελφοί lleva la señal con su imperativo γίνεσθε; la palabra vecina, no', async () => {
        ref.cap = 3; ref.v = 1;
        render(<TooltipProvider><GreekAnalyzerPage /></TooltipProvider>);
        const i = tokensDe(3, 1).findIndex(t => t.text.startsWith('ἀδελφοί'));
        expect((await abrir(i)).opening).toEqual(expect.objectContaining({ question: false, imperative: expect.stringMatching(/^γίνεσθε/) }));
        expect((await abrir(i + 1)).opening).toBeNull();
    });

    it('Stg 2:10: ἐν lleva su código de Louw-Nida (89.5)', async () => {
        ref.cap = 2; ref.v = 10;
        render(<TooltipProvider><GreekAnalyzerPage /></TooltipProvider>);
        const i = tokensDe(2, 10).findIndex(t => t.text === 'ἐν');
        expect((await abrir(i)).ln).toBe('89.5');
    });
});
