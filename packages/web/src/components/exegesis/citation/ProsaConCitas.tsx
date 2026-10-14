import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { enlazarCitas, PREFIJO_CITA, type CitaEnlazada } from './destinosDelVisor';

/**
 * La prosa de un paso con sus citas pulsables (fase F, F3): cada «(Clave,
 * p. N)» que nombra una fuente del trabajo abre el visor en esa página. El
 * resto del markdown se dibuja igual que antes.
 */
export function ProsaConCitas({ markdown, claves, onOpenCita, tituloCita }: {
    markdown: string;
    claves: ReadonlyArray<string | null | undefined>;
    onOpenCita: (cita: CitaEnlazada) => void;
    /** El aviso al pasar el mouse sobre una cita («Ver en el libro»). */
    tituloCita: string;
}) {
    const { markdown: enlazado, citas } = useMemo(() => enlazarCitas(markdown, claves), [markdown, claves]);
    return (
        <div className="prose prose-base dark:prose-invert max-w-none leading-relaxed">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    a: ({ href, children, node: _node, ...rest }) => {
                        const cita = href?.startsWith(PREFIJO_CITA) ? citas[Number(href.slice(PREFIJO_CITA.length))] : undefined;
                        if (!cita) return <a href={href} {...rest}>{children}</a>;
                        return (
                            <button
                                type="button"
                                onClick={() => onOpenCita(cita)}
                                title={tituloCita}
                                className="cursor-pointer rounded-sm border-b border-dashed border-primary/70 bg-transparent p-0 [font:inherit] text-inherit hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                data-testid="cita-en-prosa"
                            >
                                {children}
                            </button>
                        );
                    },
                }}
            >
                {enlazado}
            </ReactMarkdown>
        </div>
    );
}
