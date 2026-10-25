import { useState } from 'react';
import { BookOpenText } from 'lucide-react';
import { FRAMING_TEXT_MAX, FRAMING_TITLE_MAX, getBookById, type BibleBookId } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { CHAPTERS_COLLAPSE_OVER, CHAPTERS_PREVIEW, chaptersToTitle, droppedTitleBooks } from './ProjectFramingForm';
import { Aviso, ayuda, campo, etiqueta, legend, type SectionProps } from './ProjectFramingFields';

/**
 * «Leer el libro entero» (Traina; Jensen): un título por capítulo de CADA
 * libro marcado (o de los del tramo) y las repeticiones. Con muchos
 * capítulos se ven los primeros y «Mostrar todos»: Esdras y Nehemías suman
 * 23, Isaías 66.
 */
export function ProjectFramingReadingSection({ form, set }: SectionProps) {
    const { t, i18n } = useTranslation('projects');
    const lang: 'es' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'es';
    const [todos, setTodos] = useState(false);
    const nombre = (b: BibleBookId) => (lang === 'en' ? getBookById(b)?.nameEn : getBookById(b)?.nameEs) ?? b;

    const grupos = chaptersToTitle(form);
    const total = grupos.reduce((n, g) => n + g.chapters.length, 0);
    const plegado = total > CHAPTERS_COLLAPSE_OVER && !todos;
    // Plegado, se ven los primeros 12 en el orden del canon, cruzando libros.
    let quedan = plegado ? CHAPTERS_PREVIEW : Infinity;
    const visibles = grupos.map(g => {
        const chapters = g.chapters.slice(0, Math.max(0, quedan));
        quedan -= chapters.length;
        return { ...g, chapters };
    }).filter(g => g.chapters.length > 0);
    const perdidos = droppedTitleBooks(form);

    const titular = (b: BibleBookId, c: number, v: string) => set('chapterTitles', { ...form.chapterTitles, [b]: { ...(form.chapterTitles[b] ?? {}), [c]: v } });

    return (
        <fieldset className="space-y-3">
            <legend className={legend}>{t('framing.dialog.sections.reading')}</legend>
            <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                <BookOpenText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                {t('framing.dialog.readFirst')}
            </p>
            {total > 0 && (
                <div className="space-y-2">
                    <span className={etiqueta}>{t('framing.dialog.chapterTitles')}</span>
                    <span className={ayuda}>{t('framing.dialog.chapterTitlesHint')}</span>
                    <div className="space-y-3" data-testid="framing-chapter-titles">
                        {visibles.map(g => (
                            <section key={g.book} className="space-y-1.5" aria-label={nombre(g.book)}>
                                {grupos.length > 1 && <h4 className="text-xs font-semibold text-foreground">{nombre(g.book)}</h4>}
                                <ol className="grid gap-1.5 sm:grid-cols-2">
                                    {g.chapters.map(c => (
                                        <li key={c} className="flex items-center gap-2">
                                            <span className="w-7 shrink-0 text-right font-mono text-xs text-muted-foreground" aria-hidden>{c}</span>
                                            <input
                                                className={campo}
                                                maxLength={FRAMING_TITLE_MAX}
                                                aria-label={t('framing.dialog.chapter', { number: c, book: nombre(g.book) })}
                                                value={form.chapterTitles[g.book]?.[c] ?? ''}
                                                onChange={e => titular(g.book, c, e.target.value)}
                                            />
                                        </li>
                                    ))}
                                </ol>
                            </section>
                        ))}
                    </div>
                    {total > CHAPTERS_COLLAPSE_OVER && (
                        <Button type="button" size="sm" variant="ghost" className="min-h-11 sm:min-h-0" aria-expanded={todos} onClick={() => setTodos(v => !v)}>
                            {todos ? t('framing.dialog.showFewerChapters') : t('framing.dialog.showAllChapters', { n: total })}
                        </Button>
                    )}
                </div>
            )}
            {perdidos.length > 0 && (
                <Aviso role="status">{t('framing.dialog.droppedTitles', { books: perdidos.map(nombre).join(', ') })}</Aviso>
            )}
            <label className="block space-y-1">
                <span className={etiqueta}>{t('framing.dialog.repetitions')}</span>
                <span className={ayuda}>{t('framing.dialog.repetitionsHint')}</span>
                <textarea rows={2} maxLength={FRAMING_TEXT_MAX} className={campo} value={form.repetitions} onChange={e => set('repetitions', e.target.value)} />
            </label>
        </fieldset>
    );
}
