import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen, Check, ChevronDown, Copy } from 'lucide-react';
import type { FuenteDeConsulta, TurnoDeConsulta } from '@dosfilos/infrastructure';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { enlazarFuentes, PREFIJO_FUENTE, textoConCitas, type EtiquetarFuente } from './citasDeRespuesta';

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
            <div className={cn('prose dark:prose-invert max-w-none leading-relaxed', compacta ? 'prose-sm' : 'prose-base')}>
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        a: ({ href, children, node: _node, ...rest }) => {
                            const citadas = href?.startsWith(PREFIJO_FUENTE) ? enlaces[Number(href.slice(PREFIJO_FUENTE.length))] : undefined;
                            if (!citadas) return <a href={href} {...rest}>{children}</a>;
                            return (
                                <button
                                    type="button"
                                    onClick={() => onAbrirFuente(citadas[0]!)}
                                    title={t('consult.openInBook')}
                                    className="cursor-pointer rounded-sm border-b border-dashed border-primary/70 bg-transparent p-0 [font:inherit] text-inherit hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <BookOpen className="h-4 w-4" />
                        {t('consult.sources', { count: turno.fuentes.length })}
                        <ChevronDown className={cn('h-4 w-4 transition-transform', verFuentes && 'rotate-180')} />
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => void copiar()}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiado ? t('consult.copied') : t('consult.copy')}
                </button>
            </div>

            {verFuentes && (
                <ol className="space-y-2 border-l-2 border-primary/30 pl-4" data-testid="fuentes-de-consulta">
                    {turno.fuentes.map(f => (
                        <li key={f.n}>
                            <button
                                type="button"
                                onClick={() => onAbrirFuente(f)}
                                className="group w-full rounded-md p-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <span className="font-serif text-sm font-semibold text-foreground group-hover:text-primary">
                                    {etiquetar(f)}
                                </span>
                                {tituloDe && <span className="ml-2 text-xs text-muted-foreground">{tituloDe(f)}</span>}
                                {f.seccion && <span className="block text-xs text-muted-foreground">§ {f.seccion}</span>}
                                <span className="mt-1 block text-sm text-muted-foreground line-clamp-3">{f.extracto}</span>
                            </button>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}
