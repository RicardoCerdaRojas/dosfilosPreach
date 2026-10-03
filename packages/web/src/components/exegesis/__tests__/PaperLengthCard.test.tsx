import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { buildDefaultRubric, buildPreachingStudyRubric, type ExegeticalPaper } from '@dosfilos/domain';
import { PaperLengthCard } from '../PaperLengthCard';

vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k) }),
}));

/**
 * Jonás 4:5-11: el panel decía 590 palabras —casi todas del ENCUADRE— y
 * «Faltan ~2 páginas» en un estudio para predicar; los versículos sin prosa
 * salían con «≈ 0 p.».
 */
const prosa = (n: number) => Array.from({ length: n }, () => 'palabra').join(' ');
function trabajo(rubric: ExegeticalPaper['rubric']): ExegeticalPaper {
    const verso = (v: number, markdown: string) => ({
        id: `s${v}`, kind: 'verse', order: v, state: 'accepted',
        verseRef: { bookId: 'JON', chapterStart: 4, chapterEnd: 4, verseStart: v, verseEnd: v },
        accepted: { id: `v${v}`, markdown, createdAt: new Date() }, current: null, versions: [],
    });
    return {
        id: 'p', title: 'Jonás 4', displayLanguage: 'es', passage: { bookId: 'JON', chapterStart: 4, chapterEnd: 4, verseStart: 5, verseEnd: 11 },
        assignmentBrief: prosa(500), rubric, assembledMarkdown: null,
        steps: [verso(5, prosa(150)), verso(6, '')],
        sources: [],
    } as unknown as ExegeticalPaper;
}

beforeEach(() => cleanup());

describe('PaperLengthCard', () => {
    it('no cuenta el encuadre como texto del trabajo', () => {
        render(<PaperLengthCard paper={trabajo(buildPreachingStudyRubric())} language="es" />);
        const estimado = screen.getByText(/detail\.length\.estimate/).textContent!;
        const palabras = JSON.parse(estimado.slice(estimado.indexOf(':') + 1)).words as number;
        expect(palabras).toBeLessThan(300);
    });

    it('en un estudio para predicar orienta y no avisa', () => {
        render(<PaperLengthCard paper={trabajo(buildPreachingStudyRubric())} language="es" />);
        expect(screen.getByText(/detail\.length\.orientative/)).toBeInTheDocument();
        expect(screen.queryByText(/detail\.length\.short/)).toBeNull();
    });

    it('en un trabajo que se entrega, sí avisa lo que falta', () => {
        render(<PaperLengthCard paper={trabajo(buildDefaultRubric())} language="es" />);
        expect(screen.getByText(/detail\.length\.short/)).toBeInTheDocument();
    });

    it('un versículo sin prosa dice «sin prosa», no «≈ 0 p.»', () => {
        render(<PaperLengthCard paper={trabajo(buildPreachingStudyRubric())} language="es" />);
        expect(screen.getByText('detail.length.noProse')).toBeInTheDocument();
    });
});
