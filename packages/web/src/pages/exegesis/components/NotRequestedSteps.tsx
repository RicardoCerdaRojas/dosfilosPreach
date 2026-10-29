import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatPassageReference, type ExegeticalStep, type SupportedLanguage } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';

/**
 * Los pasos que el encargo no pide y que nadie empezó: fuera del documento
 * (`includeInDocument === false`, que el sembrado pone a lo que no responde
 * ninguna pregunta) y sin ninguna versión. El ensamble nunca es uno de ellos.
 *
 * Un paso fuera del documento que el estudiante igual estudió se queda en la
 * lista principal: ahí está su trabajo.
 */
export function splitNotRequestedSteps<T extends Pick<ExegeticalStep, 'kind' | 'state' | 'includeInDocument' | 'versions'>>(
    steps: ReadonlyArray<T>,
): { requested: T[]; notRequested: T[] } {
    const requested: T[] = [];
    const notRequested: T[] = [];
    for (const s of steps) {
        // `includeInDocument === false` es `!pertenceAlDocumento`.
        const fuera = s.kind !== 'assembly' && s.includeInDocument === false && s.state === 'pending' && (s.versions?.length ?? 0) === 0;
        (fuera ? notRequested : requested).push(s);
    }
    return { requested, notRequested };
}

/**
 * Plegados al final de la lista (TP #9, B22). En un TP que solo responde
 * cuatro preguntas, 4:11, 4:13, 4:16, la introducción y la conclusión salían
 * «pendientes» entre las respuestas, como trabajo atrasado. Siguen a mano:
 * se despliegan y se pueden estudiar igual.
 */
export function NotRequestedSteps({ steps, language, hasQuestions, renderStep }: {
    steps: ReadonlyArray<ExegeticalStep>;
    language: SupportedLanguage;
    /** Con preguntas en el encargo dice «no pide»; sin ellas, «fuera del documento». */
    hasQuestions: boolean;
    renderStep: (step: ExegeticalStep) => ReactNode;
}) {
    const { t } = useTranslation('exegesis');
    const [abierto, setAbierto] = useState(false);
    const listaId = useId();
    if (steps.length === 0) return null;
    const nombres = steps
        .map(s => (s.kind === 'verse' && s.verseRef ? formatPassageReference(s.verseRef, language) : t(`detail.steps.kind.${s.kind}`)))
        .join(' · ');
    return (
        <section className="rounded-xl border border-dashed border-border bg-background" data-testid="pasos-no-pedidos">
            <button
                type="button"
                onClick={() => setAbierto(a => !a)}
                aria-expanded={abierto}
                aria-controls={abierto ? listaId : undefined}
                className="flex w-full min-h-11 items-start gap-2 rounded-xl px-4 py-3 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                {abierto ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">
                        {t(hasQuestions ? 'detail.steps.notRequestedGroup.title' : 'detail.steps.notRequestedGroup.titleExcluded', { count: steps.length })}
                    </span>
                    <span className="block text-xs text-muted-foreground">{nombres}</span>
                    <span className="block text-xs text-muted-foreground">{t('detail.steps.notRequestedGroup.hint')}</span>
                </span>
                <span className="shrink-0 text-xs font-medium text-primary-text">
                    {t(abierto ? 'detail.steps.notRequestedGroup.hide' : 'detail.steps.notRequestedGroup.show')}
                </span>
            </button>
            {abierto && (
                <div id={listaId} className="space-y-3 px-3 pb-3">
                    {steps.map(s => renderStep(s))}
                </div>
            )}
        </section>
    );
}
