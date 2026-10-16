import { useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { FuenteDeConsulta, LibroDelTema } from '@dosfilos/infrastructure';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { apellidoDelAutor } from '@/components/library/apellidoDelAutor';
import { TextoConEscrituras } from '@/components/library/consulta/TextoConEscrituras';
import { barrasDePertinencia, inicialDe, paginaDeCita, seccionCorta } from './presentacion';

/** Una hoja del resultado, con la forma de una fuente para citarla y abrirla igual. */
const comoFuente = (libro: LibroDelTema, h: LibroDelTema['hojas'][number]): FuenteDeConsulta => ({
    n: 0, resourceId: libro.resourceId, titulo: libro.titulo, autor: libro.autor, hoja: h.hoja, seccion: h.seccion, extracto: h.extracto,
});

/** Libros que se muestran de entrada; el resto, con «Ver más». */
const LIBROS_A_LA_VISTA = 4;

/**
 * Los resultados de una búsqueda de temas como fichas de libro (rediseño,
 * 2026-10-17): un resumen, un filtro por libro y, por libro, cada pasaje con
 * su página en grande, su pertinencia en barras, la sección corta y el
 * extracto en la serif de estudio (el griego y el hebreo en su fuente).
 */
export function ResultadosDeTemas({ libros, etiquetar, onAbrir, aproximado = false }: {
    libros: ReadonlyArray<LibroDelTema>;
    etiquetar: (fuente: FuenteDeConsulta) => string;
    onAbrir: (fuente: FuenteDeConsulta) => void;
    /** No se pudo ordenar por pertinencia: el orden es el de los vectores. */
    aproximado?: boolean;
}) {
    const { t } = useTranslation('library');
    const [filtro, setFiltro] = useState<string | null>(null);
    const [todos, setTodos] = useState(false);
    const pasajes = useMemo(() => libros.reduce((n, l) => n + l.hojas.length, 0), [libros]);
    const visibles = filtro ? libros.filter(l => l.resourceId === filtro) : todos ? libros : libros.slice(0, LIBROS_A_LA_VISTA);
    const clave = (l: LibroDelTema) => apellidoDelAutor(l.autor) || l.titulo;

    return (
        <div className="flex flex-col gap-5" data-testid="temas-por-libro">
            <div className="flex flex-col gap-3">
                <p className="m-0 text-[15px] text-foreground/80">
                    {t('consult.topicSummary', { pasajes, libros: libros.length })}
                    <span className="text-muted-foreground"> · {aproximado ? t('consult.topicOrderApprox') : t('consult.topicOrderRelevance')}</span>
                </p>
                {libros.length > 1 && (
                    <div className="flex flex-wrap gap-2" role="group" aria-label={t('consult.topicFilter')}>
                        <button type="button" aria-pressed={filtro === null} onClick={() => setFiltro(null)} className={chip(filtro === null)}>
                            {t('consult.topicAll', { count: pasajes })}
                        </button>
                        {libros.map(l => (
                            <button key={l.resourceId} type="button" aria-pressed={filtro === l.resourceId} onClick={() => setFiltro(filtro === l.resourceId ? null : l.resourceId)} className={chip(filtro === l.resourceId)}>
                                {clave(l)} · {l.hojas.length}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {visibles.map((libro, i) => (
                <section
                    key={libro.resourceId}
                    className="overflow-hidden rounded-2xl border border-border bg-card motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300"
                    style={{ animationDelay: `${Math.min(i, 6) * 50}ms`, animationFillMode: 'both' }}
                >
                    <header className="flex flex-wrap items-center gap-3.5 border-b border-border/60 px-5 py-4">
                        <span aria-hidden="true" className="flex w-10 flex-none items-center justify-center rounded-[4px_8px_8px_4px] bg-foreground font-serif text-[15px] font-bold text-secondary dark:bg-muted shadow-[inset_4px_0_0_rgba(0,0,0,0.18)]" style={{ height: '3.25rem' }}>
                            {inicialDe(apellidoDelAutor(libro.autor), libro.titulo)}
                        </span>
                        <div className="flex min-w-[12rem] flex-1 flex-col gap-0.5">
                            <h3 className="m-0 font-serif text-[17px] font-bold leading-snug text-foreground">{libro.titulo}</h3>
                            <span className="text-[13px] text-muted-foreground">{[libro.autor, t('consult.topicPassages', { count: libro.hojas.length })].filter(Boolean).join(' · ')}</span>
                        </div>
                    </header>
                    <ol className="m-0 list-none divide-y divide-border/60 p-0">
                        {libro.hojas.map(h => {
                            const fuente = comoFuente(libro, h);
                            const barras = barrasDePertinencia(h.pertinencia);
                            const seccion = seccionCorta(h.seccion, libro.titulo);
                            return (
                                <li key={`${libro.resourceId}-${h.hoja}`}>
                                    <button
                                        type="button"
                                        onClick={() => onAbrir(fuente)}
                                        className="group grid w-full grid-cols-[5.5rem_minmax(0,1fr)] gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[6.5rem_minmax(0,1fr)]"
                                    >
                                        <span className="flex flex-col gap-2">
                                            <span className="font-bible text-[22px] font-semibold leading-none text-foreground">{paginaDeCita(etiquetar(fuente))}</span>
                                            {barras > 0 && (
                                                <span role="img" aria-label={t(`consult.relevance${barras}`)} className="flex gap-[3px]">
                                                    {[1, 2, 3].map(n => <span key={n} className={cn('h-1 w-4 rounded-full', n <= barras ? 'bg-secondary' : 'bg-border')} />)}
                                                </span>
                                            )}
                                        </span>
                                        <span className="flex min-w-0 flex-col gap-1.5">
                                            {seccion && <span className="truncate text-xs text-muted-foreground">{seccion}</span>}
                                            <span className="line-clamp-4 font-serif text-[15px] leading-[1.75] text-foreground/90">
                                                <TextoConEscrituras texto={h.extracto} />
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                                                {t('consult.openInBook')} <ArrowUpRight className="h-3 w-3" />
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                </section>
            ))}

            {!filtro && !todos && libros.length > LIBROS_A_LA_VISTA && (
                <button
                    type="button"
                    onClick={() => setTodos(true)}
                    className="self-center rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground/80 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {t('consult.topicMoreBooks', { count: libros.length - LIBROS_A_LA_VISTA })}
                </button>
            )}
        </div>
    );
}

function chip(activo: boolean): string {
    return cn(
        'min-h-8 rounded-full border px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        activo ? 'border-foreground bg-foreground font-semibold text-background' : 'border-border bg-card font-medium text-foreground/80 hover:bg-muted',
    );
}
