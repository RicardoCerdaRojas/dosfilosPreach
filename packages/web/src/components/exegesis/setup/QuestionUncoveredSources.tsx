import type { QuestionSourceCheck } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';

/**
 * Debajo de las fuentes que aportan a una pregunta, las que no, con su
 * porqué: revisada sin referencias, sin índice, con la búsqueda fallida o
 * todavía revisándose (`uncoveredSourcesOfRow`).
 *
 * TP #9 (Santiago 4:11-17, B21): «Ver por pregunta» sólo listaba las fuentes
 * con hojas, y Tuggy y el léxico no aparecían en ninguna pregunta. No se sabía
 * si se habían revisado o si se habían olvidado.
 */
export function QuestionUncoveredSources({ checks, nombre }: {
    checks: ReadonlyArray<QuestionSourceCheck>;
    nombre: (sourceId: string) => string;
}) {
    const { t } = useTranslation('exegesis');
    if (checks.length === 0) return null;
    const base = 'paperSetup.subSteps.corpus.questionReview.uncovered';
    const estado = (c: QuestionSourceCheck): string => {
        if (c.state === 'no-references') return t(c.lemmaMentioned ? `${base}.lemmaMentioned` : `${base}.noReferences`);
        return t(`${base}.${c.state}`);
    };
    return (
        <ul className="space-y-0.5" aria-label={t(`${base}.label`)} data-testid="pregunta-sin-aporte">
            {checks.map(c => (
                <li key={c.sourceId} className="text-[11px] text-muted-foreground">
                    <span className="text-foreground">{nombre(c.sourceId)}</span>
                    {' · '}
                    {estado(c)}
                </li>
            ))}
        </ul>
    );
}
