import { AlertTriangle, CheckCircle2, Ruler } from 'lucide-react';
import {
    DEFAULT_PAPER_FORMATTING,
    assemblyDelivery,
    checkLength,
    estimateLength,
    exportPaperToMarkdown,
    formatPassageReference,
    type ExegeticalPaper,
    type SupportedLanguage,
} from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Cuánto lleva escrito el trabajo frente a lo que el curso exige.
 *
 * El trabajo de Salmo 23:1–3 debía tener doce páginas y llegó con un
 * tercio; nada lo dijo hasta abrir el Word terminado, aunque la rúbrica
 * declaraba la extensión desde el primer día. Aquí se ve mientras aún se
 * puede hacer algo, y por verso: un promedio esconde que un versículo
 * salió completo y el siguiente en ficha.
 */
export function PaperLengthCard({ paper, language }: { paper: ExegeticalPaper; language: SupportedLanguage }) {
    const { t } = useTranslation('exegesis');

    const markdown = paper.assembledMarkdown?.trim() || exportPaperToMarkdown(paper);
    // El formato de la entrega decide cuántas palabras entran en la página:
    // el mismo campo que el exportador obedece.
    const formatting = paper.rubric?.formatting ?? null;
    const check = checkLength(markdown, paper.rubric?.expectedLength ?? null, formatting);
    if (check.words === 0) return null;

    const perStep = paper.steps
        .filter(s => s.kind === 'verse' && (s.accepted ?? s.current))
        .map(s => {
            const version = s.accepted ?? s.current!;
            return {
                id: s.id,
                label: s.verseRef ? formatPassageReference(s.verseRef, language) : t(`detail.steps.kind.${s.kind}`),
                pages: estimateLength(version.markdown ?? '', formatting).estimatedPages,
            };
        });
    // Un verso escrito a la mitad del más largo es el síntoma de la ficha
    // mecánica; sin comparar entre versos no se distingue de un verso corto.
    const longest = perStep.reduce((m, s) => Math.max(m, s.pages), 0);

    // Lo medido sale de `paper.assembledMarkdown`, que sólo se escribe al
    // ACEPTAR el ensamble. Con una versión generada y sin aceptar, esta
    // tarjeta mide —y el exportador baja— un documento que el autor ya no
    // tiene a la vista.
    const entrega = assemblyDelivery(paper);
    const desfasado = entrega.state === 'difiere';

    const tone = desfasado
        ? 'border-warning/40 bg-warning-subtle/40'
        : check.verdict === 'short' || check.verdict === 'long'
            ? 'border-warning/30 bg-warning-subtle/40'
            : 'border-border bg-card';

    return (
        <section className={cn('rounded-xl border p-4 space-y-3', tone)}>
            <header className="flex items-center gap-2">
                <Ruler className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">{t('detail.length.title')}</h3>
            </header>

            {desfasado && (
                <div className="rounded-md border border-warning/40 bg-warning-subtle/60 px-3 py-2 space-y-1">
                    <p className="inline-flex items-start gap-1.5 text-xs font-semibold text-warning-subtle-foreground">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        {t('detail.length.stale.title')}
                    </p>
                    <p className="text-[11px] text-warning-subtle-foreground">
                        {t('detail.length.stale.body', {
                            delivered: entrega.deliveredWords,
                            onScreen: entrega.onScreenWords,
                        })}
                    </p>
                </div>
            )}

            <p className="text-sm text-foreground">
                {t('detail.length.estimate', { pages: check.estimatedPages, words: check.words })}
            </p>

            {check.verdict === 'unknown' && (
                <p className="text-xs text-muted-foreground">{t('detail.length.noTarget')}</p>
            )}
            {check.verdict === 'ok' && check.expected && (
                <p className="inline-flex items-center gap-1.5 text-xs text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t('detail.length.ok', { target: describeTarget(check.expected, t) })}
                </p>
            )}
            {check.verdict === 'short' && check.expected && (
                <p className="inline-flex items-start gap-1.5 text-xs text-warning-subtle-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{t(`detail.length.short.${check.expected.unit}`, { missing: check.missing, target: describeTarget(check.expected, t) })}</span>
                </p>
            )}
            {check.verdict === 'long' && check.expected && (
                <p className="inline-flex items-start gap-1.5 text-xs text-warning-subtle-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{t('detail.length.long', { target: describeTarget(check.expected, t) })}</span>
                </p>
            )}

            {perStep.length > 1 && (
                <dl className="space-y-1 border-t border-border pt-2">
                    {perStep.map(s => (
                        <div key={s.id} className="flex items-center gap-2 text-xs">
                            <dt className="text-muted-foreground w-24 shrink-0 truncate">{s.label}</dt>
                            <dd className="flex-1 flex items-center gap-2">
                                <span className="h-1.5 rounded-full bg-primary/60" style={{ width: `${longest > 0 ? Math.max(4, (s.pages / longest) * 100) : 4}%` }} />
                                <span className="tabular-nums text-muted-foreground">
                                    {t('detail.length.pagesShort', { pages: s.pages })}
                                </span>
                            </dd>
                        </div>
                    ))}
                </dl>
            )}

            <p className="text-[11px] text-muted-foreground">
                {t('detail.length.disclaimer', {
                    spacing: t(`detail.length.spacing.${(formatting ?? DEFAULT_PAPER_FORMATTING).lineSpacing}`),
                })}
            </p>
        </section>
    );
}

/** «12–15 páginas» o «2.000 palabras», según lo que declare la rúbrica. */
function describeTarget(
    expected: { unit: 'pages' | 'words'; min: number | null; max: number | null },
    t: (key: string, options?: Record<string, unknown>) => string,
): string {
    const unit = t(`detail.length.unit.${expected.unit}`);
    if (expected.min !== null && expected.max !== null && expected.min !== expected.max) {
        return `${expected.min}–${expected.max} ${unit}`;
    }
    const value = expected.min ?? expected.max;
    return `${value} ${unit}`;
}
