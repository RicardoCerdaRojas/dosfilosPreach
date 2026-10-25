import { BIBLE_CANON, getBookById, type BibleBookId, type BibliographyWarning, type ProjectBibliographyCriteria, type ProjectBibliographyEntry, type SourceType } from '@dosfilos/domain';
import { AlertTriangle, Pencil, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { campo } from './BibliographyEntryEditor';

interface BibliographyCriteriaPanelProps {
    isCourse: boolean;
    criteria: ProjectBibliographyCriteria;
    onChange: (patch: Partial<ProjectBibliographyCriteria>) => void;
    /** Los mínimos por tipo que piden las rúbricas de los tipos de trabajo. */
    requirements: ReadonlyArray<{ sourceType: SourceType; minimum: number; workType?: string }>;
    /** Los libros de los estudios: valen mientras el proyecto no elija los suyos. */
    studyBooks: ReadonlyArray<BibleBookId>;
    /**
     * Con encuadre, los libros se ven en solo lectura: estos (los guardados)
     * y un enlace a su diálogo. Sin encuadre, se eligen aquí como siempre.
     */
    framing?: { books: ReadonlyArray<BibleBookId>; href: string; /** Con cambios sin guardar, pregunta antes de salir. */ canLeave?: () => boolean };
}

interface BibleBooksPickerProps {
    books: ReadonlyArray<BibleBookId>;
    /** Sin él, los libros no se quitan (los de los estudios, o en solo lectura). */
    onRemove?: (book: BibleBookId) => void;
    /** Sin él, no hay selector para agregar. */
    onAdd?: (book: BibleBookId) => void;
    /** Nombre accesible de la lista. */
    listLabel: string;
    /** Rótulo del selector para agregar. */
    addLabel?: string;
    /** Texto cuando no hay libros. */
    emptyText?: string;
}

/**
 * Los libros bíblicos como fichas, con un selector del canon para agregar.
 * Lo comparten los requisitos del estado del arte y el diálogo del encuadre.
 */
export function BibleBooksPicker({ books, onRemove, onAdd, listLabel, addLabel, emptyText }: BibleBooksPickerProps) {
    const { t, i18n } = useTranslation('projects');
    const en = i18n.language?.startsWith('en');
    const nombre = (b: BibleBookId) => (en ? getBookById(b)?.nameEn : getBookById(b)?.nameEs) ?? b;
    return (
        <div className="space-y-1">
            {books.length === 0 ? (
                emptyText ? <p className="text-xs text-foreground">{emptyText}</p> : null
            ) : (
                <ul className="flex flex-wrap gap-1.5" aria-label={listLabel}>
                    {books.map(b => (
                        <li key={b} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-foreground">
                            {nombre(b)}
                            {onRemove && (
                                <button type="button" onClick={() => onRemove(b)} aria-label={t('stateOfArt.criteria.removeBook', { book: nombre(b) })} className="rounded-full p-0.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {onAdd && (
                <label className="block space-y-1 pt-1">
                    <span className="text-[11px] text-muted-foreground">{addLabel ?? t('stateOfArt.criteria.addBook')}</span>
                    <select
                        className={campo}
                        value=""
                        onChange={e => {
                            const b = e.target.value as BibleBookId;
                            if (b && !books.includes(b)) onAdd(b);
                        }}
                    >
                        <option value="">—</option>
                        {BIBLE_CANON.filter(b => !books.includes(b.id)).map(b => <option key={b.id} value={b.id}>{en ? b.nameEn : b.nameEs}</option>)}
                    </select>
                </label>
            )}
        </div>
    );
}

/**
 * Paso 1, requisitos. En un curso salen del sílabo y del profesor; en una
 * investigación son la pregunta y el alcance (Turabian, cap. 2; Kibbe,
 * cap. 1). Los criterios de inclusión y exclusión son los que Vyhmeister
 * (cap. 7) pide explicar en una bibliografía selectiva.
 */
export function BibliographyCriteriaPanel({ isCourse, criteria, onChange, requirements, studyBooks, framing }: BibliographyCriteriaPanelProps) {
    const { t } = useTranslation('projects');
    // Los libros del proyecto: los elegidos, o los de los estudios mientras no
    // se elija ninguno. Un proyecto sin estudios (una serie que empieza, una
    // investigación) los elige aquí: sin ellos no hay guía ni catálogo.
    const elegidos = criteria.bibleBooks ?? [];
    const libros = elegidos.length ? elegidos : studyBooks;
    const desdeEstudios = elegidos.length === 0 && studyBooks.length > 0;
    const fijar = (xs: BibleBookId[]) => onChange({ bibleBooks: xs });
    const { t: tx } = useTranslation('exegesis');
    const texto = (clave: 'requirements' | 'prohibitions' | 'inclusion' | 'exclusion', etiqueta: string, ayuda: string) => (
        <label className="block space-y-1">
            <span className="text-sm font-medium text-foreground">{etiqueta}</span>
            <span className="block text-xs text-muted-foreground">{ayuda}</span>
            <textarea className={campo} rows={3} value={criteria[clave] ?? ''} onChange={e => onChange({ [clave]: e.target.value })} />
        </label>
    );
    // Por tipo de trabajo: lo que pide el TP no es lo que pide la investigación.
    const porTipoDeTrabajo = new Map<string, Array<{ sourceType: SourceType; minimum: number }>>();
    for (const r of requirements) {
        if (r.minimum <= 0) continue;
        const clave = r.workType ?? '';
        porTipoDeTrabajo.set(clave, [...(porTipoDeTrabajo.get(clave) ?? []), r]);
    }

    return (
        <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
                {texto('requirements', t(isCourse ? 'stateOfArt.criteria.requirementsCourse' : 'stateOfArt.criteria.requirementsResearch'), t(isCourse ? 'stateOfArt.criteria.requirementsCourseHint' : 'stateOfArt.criteria.requirementsResearchHint'))}
                {texto('prohibitions', t('stateOfArt.criteria.prohibitions'), t('stateOfArt.criteria.prohibitionsHint'))}
                {texto('inclusion', t('stateOfArt.criteria.inclusion'), t('stateOfArt.criteria.inclusionHint'))}
                {texto('exclusion', t('stateOfArt.criteria.exclusion'), t('stateOfArt.criteria.exclusionHint'))}
            </div>
            <label className="flex items-start gap-2 text-sm text-foreground">
                <input type="checkbox" className="mt-1" checked={criteria.noRepeatSources ?? isCourse} onChange={e => onChange({ noRepeatSources: e.target.checked })} />
                <span>
                    {t('stateOfArt.criteria.noRepeat')}
                    <span className="block text-xs text-muted-foreground">{t('stateOfArt.criteria.noRepeatHint')}</span>
                </span>
            </label>
            <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-border p-3 space-y-1">
                    <p className="text-sm font-medium text-foreground">{t('stateOfArt.criteria.minimums')}</p>
                    {porTipoDeTrabajo.size === 0
                        ? <p className="text-xs text-muted-foreground">{t('stateOfArt.criteria.noMinimums')}</p>
                        : [...porTipoDeTrabajo].map(([trabajo, mins]) => (
                            <div key={trabajo} className="space-y-0.5">
                                {trabajo && <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">{trabajo}</p>}
                                <ul className="text-xs text-foreground space-y-0.5">{mins.map(m => <li key={m.sourceType}>{tx(`sourceTypes.${m.sourceType}.label`)} · ≥ {m.minimum}</li>)}</ul>
                            </div>
                        ))}
                    <p className="text-[11px] text-muted-foreground">{t('stateOfArt.criteria.minimumsHint')}</p>
                </div>
                <div className="rounded-lg border border-border p-3 space-y-1">
                    <p className="text-sm font-medium text-foreground">{t('stateOfArt.criteria.books')}</p>
                    {framing ? (
                        <>
                            <BibleBooksPicker books={framing.books} listLabel={t('stateOfArt.criteria.books')} emptyText={t('stateOfArt.criteria.noBooksFraming')} />
                            <p className="text-[11px] text-muted-foreground">{t('stateOfArt.criteria.booksFromFraming')}</p>
                            <Link
                                to={framing.href}
                                onClick={e => { if (framing.canLeave && !framing.canLeave()) e.preventDefault(); }}
                                className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                            >
                                <Pencil className="h-3 w-3" />{t('stateOfArt.criteria.changeInFraming')}
                            </Link>
                        </>
                    ) : (
                        <>
                            <BibleBooksPicker
                                books={libros}
                                listLabel={t('stateOfArt.criteria.books')}
                                emptyText={t('stateOfArt.criteria.noBooks')}
                                onRemove={desdeEstudios ? undefined : b => fijar(elegidos.filter(x => x !== b))}
                                // Al elegir el primero, los de los estudios se conservan.
                                onAdd={b => fijar([...libros, b])}
                            />
                            {desdeEstudios && <p className="text-[11px] text-muted-foreground">{t('stateOfArt.criteria.fromStudies')}</p>}
                            <p className="text-[11px] text-muted-foreground">{t('stateOfArt.criteria.booksHint')}</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

/** Los avisos de la bibliografía aprobada. Informan; no bloquean. */
export function BibliographyWarningsList({ warnings, entries }: { warnings: ReadonlyArray<BibliographyWarning>; entries: ReadonlyArray<ProjectBibliographyEntry> }) {
    const { t } = useTranslation('projects');
    const { t: tx } = useTranslation('exegesis');
    if (warnings.length === 0) return null;
    const titulo = (id: string) => entries.find(e => e.id === id)?.title || t('stateOfArt.untitled');
    const texto = (w: BibliographyWarning) => {
        switch (w.kind) {
            case 'missing-type': return t('stateOfArt.warning.missingType', { type: tx(`sourceTypes.${w.sourceType}.label`), minimum: w.minimum });
            case 'single-tradition': return t('stateOfArt.warning.singleTradition', { tradition: t(`stateOfArt.tradition.${w.tradition}`) });
            case 'required-to-acquire': return t('stateOfArt.warning.requiredToAcquire', { title: titulo(w.entryId) });
            case 'commentary-other-book': return t('stateOfArt.warning.commentaryOtherBook', { title: titulo(w.entryId) });
        }
    };
    return (
        <div className="rounded-lg border border-warning/40 bg-warning-subtle px-3 py-2" role="status">
            <ul className="space-y-1">
                {warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-warning-subtle-foreground">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{texto(w)}
                    </li>
                ))}
            </ul>
        </div>
    );
}
