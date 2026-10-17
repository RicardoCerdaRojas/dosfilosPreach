import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen, Check, ChevronDown, Copy } from 'lucide-react';
import type { FuenteDeConsulta, TurnoDeConsulta } from '@dosfilos/infrastructure';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { enlazarFuentes, PREFIJO_FUENTE, textoConCitas, type EtiquetarFuente } from './citasDeRespuesta';
import { conEscrituras, TextoConEscrituras } from './TextoConEscrituras';
import { autoresDelPasaje } from './autoresDelPasaje';

/**
 * Una respuesta de «Consultar» con sus citas pulsables y la lista de fuentes
 * que usó (fase «biblioteca consultable», U3 y U4). La usan la pestaña de la
 * Biblioteca (las citas abren el visor) y el visor (las citas lo llevan a la
 * hoja).
 */
export function RespuestaConCitas({ turno, etiquetar, tituloDe, onAbrirFuente, compacta = false }: {
    turno: TurnoDeConsulta;
    /** Cómo se cita cada fuente: «(Varner, p. 188)». */
    etiquetar: EtiquetarFuente;
    /** El título del libro de una fuente, para la lista de fuentes. */
    tituloDe?: (fuente: FuenteDeConsulta) => string;
    onAbrirFuente: (fuente: FuenteDeConsulta) => void;
    /** En el visor, el texto es más chico. */
    compacta?: boolean;
}) {
    const { t } = useTranslation('library');
    const { markdown, enlaces } = useMemo(() => enlazarFuentes(turno.respuesta, turno.fuentes, etiquetar), [turno, etiquetar]);
    const [verFuentes, setVerFuentes] = useState(false);
    const autores = useMemo(() => (turno.pasaje ? autoresDelPasaje(turno.fuentes, etiquetar) : []), [turno, etiquetar]);
    const [copiado, setCopiado] = useState(false);

    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(textoConCitas(turno.respuesta, turno.fuentes, etiquetar));
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1800);
        } catch { /* sin portapapeles: el botón no cambia */ }
    };

    return (
        <div className="space-y-3">
            {/* U6: una pregunta sobre un pasaje responde por autor; arriba, quiénes
                lo tratan y en qué páginas (cada una abre el libro ahí). */}
            {turno.pasaje && (
                <div className="space-y-2 rounded-xl border border-secondary/40 bg-secondary/10 px-3 py-2.5" data-testid="pasaje-de-la-respuesta">
                    <p className="m-0 font-serif text-[15px] font-bold text-foreground">
                        {t('consult.passageHeading', { pasaje: turno.pasaje })}
                    </p>
                    {autores.length > 0 && (
                        <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-foreground/80">
                            {/* `foreground/70`, no `muted`: sobre el dorado claro, `muted` no llega a 4,5:1. */}
                            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/70">{t('consult.passageAuthors')}</span>
                            {autores.map(a => (
                                <span key={a.autor} className="inline-flex flex-wrap items-baseline gap-x-1">
                                    <span className="font-semibold text-foreground">{a.autor}</span>
                                    {a.paginas.map(p => (
                                        <button
                                            key={`${p.fuente.resourceId}-${p.etiqueta}`}
                                            type="button"
                                            onClick={() => onAbrirFuente(p.fuente)}
                                            className="inline-flex min-h-11 items-center rounded px-1 font-bible text-[14px] font-semibold text-foreground/80 underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0"
                                        >
                                            {p.etiqueta}
                                        </button>
                                    ))}
                                </span>
                            ))}
                        </p>
                    )}
                </div>
            )}
            {/* La respuesta es texto de ESTUDIO: en la serif de la marca, con
                medida de lectura (rediseño, 2026-10-17). */}
            <div className={cn('prose dark:prose-invert max-w-[68ch] font-serif prose-p:my-4 prose-p:leading-[1.85] prose-strong:text-foreground', compacta ? 'prose-sm' : 'text-[17px]')}>
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    // Una imagen en la respuesta vendría del texto de un libro (o
                    // de una instrucción metida en él): no se carga nada externo.
                    disallowedElements={['img']}
                    components={{
                        p: ({ children, node: _node, ...rest }) => <p {...rest}>{conEscrituras(children)}</p>,
                        li: ({ children, node: _node, ...rest }) => <li {...rest}>{conEscrituras(children)}</li>,
                        em: ({ children, node: _node, ...rest }) => <em {...rest}>{conEscrituras(children)}</em>,
                        a: ({ href, children, node: _node, ...rest }) => {
                            const citadas = href?.startsWith(PREFIJO_FUENTE) ? enlaces[Number(href.slice(PREFIJO_FUENTE.length))] : undefined;
                            if (!citadas) return <a href={href} {...rest}>{children}</a>;
                            return (
                                <button
                                    type="button"
                                    onClick={() => onAbrirFuente(citadas[0]!)}
                                    title={t('consult.openInBook')}
                                    className="mx-0.5 cursor-pointer whitespace-nowrap rounded border-0 bg-secondary/15 px-1.5 py-px align-baseline font-bible text-[0.95em] font-semibold text-foreground transition-colors hover:bg-secondary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    data-testid="cita-de-consulta"
                                >
                                    {children}
                                </button>
                            );
                        },
                    }}
                >
                    {markdown}
                </ReactMarkdown>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {turno.fuentes.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setVerFuentes(v => !v)}
                        aria-expanded={verFuentes}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-foreground/75 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <BookOpen className="h-4 w-4" />
                        {t('consult.sources', { count: turno.fuentes.length })}
                        <ChevronDown className={cn('h-4 w-4 transition-transform', verFuentes && 'rotate-180')} />
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => void copiar()}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-foreground/75 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiado ? t('consult.copied') : t('consult.copy')}
                </button>
            </div>

            {verFuentes && (
                <ol className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2" data-testid="fuentes-de-consulta">
                    {turno.fuentes.map(f => (
                        <li key={f.n}>
                            <button
                                type="button"
                                onClick={() => onAbrirFuente(f)}
                                className="group flex h-full w-full flex-col gap-1 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <span className="font-bible text-[15px] font-semibold text-foreground group-hover:text-primary">
                                    {etiquetar(f)}
                                </span>
                                {tituloDe && <span className="truncate text-xs text-muted-foreground">{tituloDe(f)}{f.seccion ? ` · § ${f.seccion.split('›').pop()!.trim()}` : ''}</span>}
                                <span className="line-clamp-3 font-serif text-[13px] leading-relaxed text-foreground/75"><TextoConEscrituras texto={f.extracto} /></span>
                            </button>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}
