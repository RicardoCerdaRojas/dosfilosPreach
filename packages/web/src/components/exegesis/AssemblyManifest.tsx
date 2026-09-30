import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';
import { unansweredQuestions } from '@dosfilos/domain';
import type { AssemblyContents, AssemblyPart, parseBriefQuestions } from '@dosfilos/domain';

/**
 * Qué entra al documento y qué se queda fuera.
 *
 * El ensamblador volcaba el análisis estructurado de los versículos sin prosa
 * «para que el ensamble nunca sea sólo intro + conclusión». Ese miedo era
 * legítimo —que el autor descubriera la ausencia al abrir el archivo— y la
 * respuesta era la equivocada: informar no ensucia el entregable, volcar sí.
 * Esta lista es la respuesta correcta al mismo miedo.
 *
 * Lee la MISMA función que usa el ensamblador, así la lista y el archivo no
 * pueden discrepar.
 */
export function AssemblyManifest({ contents, paperId, preguntas }: {
    contents: AssemblyContents;
    paperId: string;
    preguntas: ReturnType<typeof parseBriefQuestions>;
}) {
    const { t } = useTranslation('exegesis');
    const { setStepInclusion } = useExegesisPapers();

    const fila = (p: AssemblyPart, estado: 'in' | 'pending' | 'out') => (
        <li key={p.stepId} className="flex items-baseline gap-2 text-[12px]">
            <input
                type="checkbox"
                id={`inc-${p.stepId}`}
                checked={estado !== 'out'}
                onChange={(e) => setStepInclusion.mutate(
                    { paperId, stepId: p.stepId, include: e.target.checked },
                    { onError: () => toast.error(t('detail.steps.assembly.toggleFailed')) },
                )}
                className="mt-0.5 shrink-0 rounded border-border"
            />
            <label
                htmlFor={`inc-${p.stepId}`}
                className={cn('flex-1 truncate cursor-pointer',
                    estado === 'out' ? 'text-muted-foreground line-through' : 'text-foreground')}
            >
                {p.label}
            </label>
            <span className="text-[11px] tabular-nums text-muted-foreground">
                {estado === 'pending'
                    ? t('detail.steps.assembly.pendingMark')
                    : estado === 'out'
                        ? ''
                        : t('detail.steps.assembly.words', { count: p.words })}
            </span>
        </li>
    );

    return (
        <div className="mb-4 rounded-lg border border-border bg-muted/40 px-3 py-2.5 space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t('detail.steps.assembly.manifestTitle', { count: contents.words })}
            </p>
            <ul className="space-y-1">
                {contents.included.map(p => fila(p, 'in'))}
                {contents.pending.map(p => fila(p, 'pending'))}
                {contents.excluded.map(p => fila(p, 'out'))}
            </ul>
            {contents.pending.length > 0 && (
                <p className="border-t border-border pt-2 text-[11px] text-warning-subtle-foreground">
                    {t('detail.steps.assembly.pendingHint', { count: contents.pending.length })}
                </p>
            )}
            {(() => {
                // Preguntas que ninguna sección elegida va a responder. Es el
                // aviso que convierte un documento incompleto —que hoy se
                // descubre leyendo— en algo que el sistema dice antes de
                // exportar.
                const versiculos = contents.included
                    .concat(contents.pending)
                    .map(p => p.label.match(/(\d+):(\d+)/))
                    .filter((m): m is RegExpMatchArray => !!m)
                    .map(m => ({ chapter: Number(m[1]), verse: Number(m[2]) }));
                const sinResponder = unansweredQuestions(preguntas, versiculos);
                if (sinResponder.length === 0) return null;
                return (
                    <p className="border-t border-border pt-2 text-[11px] text-warning-subtle-foreground">
                        {t('detail.steps.assembly.unanswered', {
                            count: sinResponder.length,
                            numbers: sinResponder.map(q => q.number).join(', '),
                        })}
                    </p>
                );
            })()}
            <p className="text-[11px] leading-snug text-muted-foreground">
                {t('detail.steps.assembly.hint')}
            </p>
        </div>
    );
}
