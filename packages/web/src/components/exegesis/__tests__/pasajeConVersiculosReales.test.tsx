import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

/**
 * TP #9 (B1): el selector de pasaje aceptó «Santiago 4:11-19» y la grilla
 * mostraba 50 versículos; Santiago 4 tiene 17.
 */
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, p?: Record<string, unknown>) => (p ? `${k} ${JSON.stringify(p)}` : k), i18n: { language: 'es' } }) }));
const { PassagePicker } = await import('../PassagePicker');
const { BiblePassageBuilder } = await import('../BiblePassageBuilder');

beforeEach(cleanup);

describe('el pasaje solo admite versículos que existen', () => {
    it('rechaza Santiago 4:11-19 y dice cuántos versículos tiene el capítulo', () => {
        const onChange = vi.fn();
        render(<PassagePicker value={null} onChange={onChange} />);
        fireEvent.change(screen.getByPlaceholderText('setup.passage.inputPlaceholder'), { target: { value: 'Santiago 4:11-19' } });
        expect(screen.getAllByRole('alert')[0]).toHaveTextContent('setup.passage.errorVerseOutOfRange {"book":"Santiago","chapter":4,"count":17,"verse":19}');
        expect(onChange).toHaveBeenLastCalledWith(null, expect.objectContaining({ code: 'verse-out-of-range' }));
    });

    it('la grilla de Santiago 4 tiene 17 versículos', () => {
        const t = (k: string, p?: Record<string, unknown>) => (p ? `${k} ${JSON.stringify(p)}` : k);
        render(<BiblePassageBuilder value={{ bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 11, verseEnd: 17 }} onResult={vi.fn()} displayLanguage="es" t={t} />);
        expect(screen.getByRole('button', { name: '17' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '18' })).toBeNull();
        expect(screen.getByTestId('verse-count')).toHaveTextContent('"count":17');
    });

    it('el selector por etapas tampoco entrega un versículo que no existe (lo que llega de un dato viejo)', () => {
        const t = (k: string) => k;
        const onResult = vi.fn();
        render(<BiblePassageBuilder value={{ bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 11, verseEnd: 19 }} onResult={onResult} displayLanguage="es" t={t} />);
        expect(onResult).toHaveBeenLastCalledWith(expect.objectContaining({ ok: false, error: 'verse-out-of-range' }));
    });
});
