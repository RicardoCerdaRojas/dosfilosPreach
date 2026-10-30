import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { SavedWordIbidReview } from '@dosfilos/domain';

/** «Revisar el Word guardado»: el «Ibid.» que abre página (fase «Lecciones del TI #2», etapa 2.3). */
let resultado: Promise<SavedWordIbidReview>;
vi.mock('@/lib/exegesis/readSavedWord', () => ({ readSavedWordIbid: () => resultado }));
vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}));
const { SavedWordIbidDialog } = await import('../SavedWordIbidDialog');

const ROSS = { author: 'Allen P. Ross', authorSorted: 'Ross, Allen P.', title: 'A Commentary on the Psalms', shortTitle: 'Commentary on the Psalms' };
const archivo = new File(['x'], 'TI.docx');
beforeEach(() => cleanup());

describe('SavedWordIbidDialog', () => {
    it('REGRESIÓN TI #1: la nota 40 «Ibid., 437.» abre la página 12; propone la forma abreviada de la obra', async () => {
        resultado = Promise.resolve({ paginated: true, pages: 15, notes: 49, findings: [
            { note: 40, page: 12, text: 'Ibid., 437.', previousNote: 39, workNote: 'Ross, Commentary on the Psalms, 436.', previousPage: '436' },
        ] });
        render(<SavedWordIbidDialog file={archivo} fichas={[ROSS]} onClose={vi.fn()} />);
        expect(await screen.findByText(/detail\.savedWord\.finding .*"note":40.*"page":12/)).toBeInTheDocument();
        // La forma, sin los asteriscos del markdown: el estudiante la escribe en Word.
        expect(screen.getByText(/detail\.savedWord\.replaceWith .*Ross, Commentary on the Psalms, 437\./)).toBeInTheDocument();
    });

    it('si la obra no está en las fichas, dice de qué nota sacar la forma', async () => {
        resultado = Promise.resolve({ paginated: true, pages: 3, notes: 2, findings: [
            { note: 2, page: 2, text: 'Ibid., 9.', previousNote: 1, workNote: 'Otro, Libro, 8.', previousPage: '8' },
        ] });
        render(<SavedWordIbidDialog file={archivo} fichas={[ROSS]} onClose={vi.fn()} />);
        expect(await screen.findByText(/detail\.savedWord\.noForm .*"previousNote":1/)).toBeInTheDocument();
    });

    it('sin «Ibid.» que abra página lo dice, con notas y páginas', async () => {
        resultado = Promise.resolve({ paginated: true, pages: 14, notes: 34, findings: [] });
        render(<SavedWordIbidDialog file={archivo} fichas={[]} onClose={vi.fn()} />);
        expect(await screen.findByText(/detail\.savedWord\.clean .*"notes":34.*"pages":14/)).toBeInTheDocument();
    });

    it('un Word sin páginas no se da por bueno', async () => {
        resultado = Promise.resolve({ paginated: false, pages: 1, notes: 5, findings: [] });
        render(<SavedWordIbidDialog file={archivo} fichas={[]} onClose={vi.fn()} />);
        expect(await screen.findByText('detail.savedWord.notPaginated')).toBeInTheDocument();
        expect(screen.queryByText(/detail\.savedWord\.clean/)).not.toBeInTheDocument();
    });

    it('si no se puede leer, lo dice', async () => {
        resultado = Promise.reject(new Error('no es docx'));
        render(<SavedWordIbidDialog file={archivo} fichas={[]} onClose={vi.fn()} />);
        expect(await screen.findByText('detail.savedWord.failed')).toBeInTheDocument();
    });
});
