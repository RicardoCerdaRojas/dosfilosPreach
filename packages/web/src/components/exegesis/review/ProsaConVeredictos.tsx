import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { VerifiedCitation } from '@dosfilos/domain';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import { STATUS_TONE } from '@/components/exegesis/citation/citationStatusTone';
import { enlazarVeredictos, PREFIJO_VEREDICTO } from './enlazarVeredictos';

/**
 * La prosa del paso, lo que va al Word, con cada cita marcada por su
 * veredicto y pulsable (TP #9, B41). «Es confuso porque pedí revisar la
 * prosa»: la página mostraba solo el análisis, aunque las citas de la prosa
 * también se verifican.
 *
 * Elegir una cita la abre en el panel de evidencia, igual que en el análisis:
 * mismo `id` (`cita-${path}`) para que la lista lateral la traiga a la vista.
 */
export function ProsaConVeredictos({ markdown, verdicts, reviewed, selectedPath, onSelect }: {
    markdown: string;
    verdicts: ReadonlyMap<string, VerifiedCitation>;
    reviewed: ReadonlySet<string>;
    selectedPath: string | null;
    onSelect: (path: string) => void;
}) {
    const { t } = useTranslation('exegesis');
    const { markdown: enlazado, paths } = useMemo(() => enlazarVeredictos(markdown, verdicts), [markdown, verdicts]);
    return (
        <div className="prose prose-base dark:prose-invert max-w-none leading-relaxed">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    a: ({ href, children, node: _node, ...rest }) => {
                        const path = href?.startsWith(PREFIJO_VEREDICTO) ? paths[Number(href.slice(PREFIJO_VEREDICTO.length))] : undefined;
                        const v = path ? verdicts.get(path) : undefined;
                        if (!path || !v) return <a href={href} {...rest}>{children}</a>;
                        const elegida = selectedPath === path;
                        return (
                            <button
                                type="button"
                                id={`cita-${path}`}
                                onClick={() => onSelect(path)}
                                aria-pressed={elegida}
                                data-testid="cita-con-veredicto"
                                className={cn(
                                    'inline cursor-pointer rounded-sm border-b border-dashed border-primary/70 bg-transparent px-0.5 [font:inherit] text-inherit hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    elegida && 'bg-accent ring-2 ring-ring',
                                )}
                            >
                                <span aria-hidden className={cn('mr-1 inline-block h-2 w-2 rounded-full align-middle', (reviewed.has(path) ? STATUS_TONE.verified : STATUS_TONE[v.status]).dot)} />
                                {children}
                                {/* El estado como texto, no como `aria-label` de un span sin rol. */}
                                <span className="sr-only"> · {reviewed.has(path) ? t('canonical.review.status.reviewed') : t(`canonical.verify.status.${v.status}`)}</span>
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
