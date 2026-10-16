import { useMemo } from 'react';
import type { FuenteDeConsulta, TurnoDeConsulta } from '@dosfilos/infrastructure';
import { useTranslation } from '@/i18n';
import { apellidoDelAutor } from '@/components/library/apellidoDelAutor';
import { inicialDe, paginaDeCita } from './presentacion';

interface LibroDeLaConsulta {
    resourceId: string;
    titulo: string;
    autor: string;
    paginas: Array<{ etiqueta: string; fuente: FuenteDeConsulta }>;
}

/**
 * «Fuentes de esta consulta» (rediseño, 2026-10-17): los libros y las páginas
 * que usaron todas las respuestas de la conversación, en un riel a la
 * derecha. Cada página abre el libro ahí.
 */
export function FuentesDeLaConsulta({ turnos, etiquetar, tituloDe, onAbrir }: {
    turnos: ReadonlyArray<TurnoDeConsulta>;
    etiquetar: (fuente: FuenteDeConsulta) => string;
    tituloDe: (fuente: FuenteDeConsulta) => string;
    onAbrir: (fuente: FuenteDeConsulta) => void;
}) {
    const { t } = useTranslation('library');
    const libros = useMemo(() => {
        const porLibro = new Map<string, LibroDeLaConsulta>();
        for (const turno of turnos) {
            for (const f of turno.fuentes) {
                const libro = porLibro.get(f.resourceId) ?? { resourceId: f.resourceId, titulo: tituloDe(f), autor: f.autor, paginas: [] };
                const etiqueta = paginaDeCita(etiquetar(f));
                if (!libro.paginas.some(p => p.etiqueta === etiqueta)) libro.paginas.push({ etiqueta, fuente: f });
                porLibro.set(f.resourceId, libro);
            }
        }
        for (const l of porLibro.values()) l.paginas.sort((a, b) => (a.fuente.hoja ?? 0) - (b.fuente.hoja ?? 0));
        return [...porLibro.values()];
    }, [turnos, etiquetar, tituloDe]);

    if (libros.length === 0) return null;
    return (
        <aside aria-label={t('consult.sourcesRail')} className="flex flex-col gap-3" data-testid="fuentes-de-la-consulta">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t('consult.sourcesRail')}</h2>
            <ul className="m-0 flex list-none flex-col gap-1 rounded-2xl border border-border bg-card p-1.5">
                {libros.map(l => (
                    <li key={l.resourceId} className="flex gap-3 rounded-xl p-2.5">
                        <span aria-hidden="true" className="flex w-[30px] flex-none items-center justify-center rounded-[3px_6px_6px_3px] bg-foreground font-serif text-xs font-bold text-secondary dark:bg-muted" style={{ height: '2.5rem' }}>
                            {inicialDe(apellidoDelAutor(l.autor), l.titulo)}
                        </span>
                        <span className="flex min-w-0 flex-col gap-1">
                            <span className="line-clamp-2 font-serif text-sm font-bold leading-snug text-foreground">{l.titulo}</span>
                            <span className="flex flex-wrap gap-x-1.5 gap-y-0.5">
                                {l.paginas.map(p => (
                                    <button
                                        key={p.etiqueta}
                                        type="button"
                                        onClick={() => onAbrir(p.fuente)}
                                        className="rounded font-bible text-[15px] font-semibold text-foreground/70 underline-offset-2 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        {p.etiqueta}
                                    </button>
                                ))}
                            </span>
                        </span>
                    </li>
                ))}
            </ul>
            <p className="text-xs leading-relaxed text-muted-foreground">{t('consult.sourcesRailHint')}</p>
        </aside>
    );
}
