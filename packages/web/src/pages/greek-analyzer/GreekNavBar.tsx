import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { VersePicker } from '@/components/bible-nav/VersePicker';
import type { BibleBookId } from '@dosfilos/domain';

interface Libro {
    id: BibleBookId;
    nameEs: string;
    nameEn: string;
}

interface Props {
    books: Libro[];
    book: BibleBookId;
    chapter: number;
    verse: number;
    chapters: number[];
    versesInChapter: number;
    nombre: (b: Libro) => string;
    onGoTo: (b: BibleBookId, c: number, v: number) => void;
    onStep: (delta: 1 | -1) => void;
    vista: 'verse' | 'passage';
    onVista: (v: 'verse' | 'passage') => void;
    /** Mientras carga el libro nuevo, capítulo y versículo esperan (si no, ofrecen los del libro anterior). */
    loading?: boolean;
}

/**
 * Dónde estoy y a dónde voy: libro, capítulo, versículo, paso a paso, y si se
 * lee un versículo o la perícopa. Extraída de la página, que ya sólo orquesta
 * — cada revisión con un profesor agrega una capa, y el archivo que las
 * coordina no puede crecer con cada una.
 */
export function GreekNavBar({
    books, book, chapter, verse, chapters, versesInChapter,
    nombre, onGoTo, onStep, vista, onVista, loading = false,
}: Props) {
    const { t } = useTranslation('greekTutor');

    return (
        <div className="flex flex-wrap items-center gap-2">
            <VersePicker
                books={books.map((b) => ({ key: b.id, name: nombre(b) }))}
                book={book}
                chapter={chapter}
                verse={verse}
                chapters={chapters}
                versesInChapter={versesInChapter}
                onNavigate={(b, c, v) => onGoTo(b as BibleBookId, c, v)}
                onPrev={() => onStep(-1)}
                onNext={() => onStep(1)}
                canPrev={!(chapter === chapters[0] && verse === 1)}
                canNext={!(chapter === chapters[chapters.length - 1] && verse === versesInChapter)}
                loadingIndex={loading}
            />

            <div className="ml-auto flex items-center gap-1">
                {(['verse', 'passage'] as const).map((v) => (
                    <button
                        key={v}
                        type="button"
                        onClick={() => onVista(v)}
                        className={cn(
                            'rounded-md border px-3 py-1.5 text-sm transition-colors',
                            vista === v
                                ? 'bg-background text-foreground border-border/60 shadow-sm'
                                : 'border-transparent text-muted-foreground hover:bg-muted/60',
                        )}
                    >
                        {t(`analyzer.view.${v}`)}
                    </button>
                ))}
            </div>
        </div>
    );
}
