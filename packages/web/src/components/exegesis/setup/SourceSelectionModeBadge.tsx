import { useTranslation } from 'react-i18next';
import { BookMarked, Crosshair, Hand, Sparkles } from 'lucide-react';
import type { ExcerptSelectionMode } from '@dosfilos/domain';

/**
 * Dice cómo se eligieron los fragmentos de una fuente.
 *
 * No es decoración: son dos niveles de confianza distintos. `structural`
 * significa que se tomó la sección del comentario dedicada al pasaje, corrida
 * y completa. `semantic` significa que se trajeron los fragmentos más
 * parecidos a una consulta — sirve, pero puede traer material de otro pasaje
 * y dejar afuera parte del que importa.
 *
 * El usuario necesita poder distinguirlas al revisar el corpus, porque la
 * acción que corresponde es distinta: la aproximada conviene revisarla
 * fragmento por fragmento antes de generar.
 *
 * Cuatro modos (TP #8, 8a, A4): además de la sección y la coincidencia, las
 * hojas que nombran los versículos con pregunta (`passage`) y las elegidas a
 * mano (`manual`). Las dos se mostraban como «Coincidencia aproximada»: la más
 * precisa y la que pasó por ojo humano, con el rótulo de la menos confiable.
 *
 * No renderiza nada cuando la fuente es anterior a la selección estructural
 * (`null`): afirmar un modo que no se registró sería inventar.
 */
const MODOS = {
    structural: { Icon: Crosshair, tone: 'bg-info-subtle text-info-subtle-foreground border-info/30' },
    passage: { Icon: BookMarked, tone: 'bg-info-subtle text-info-subtle-foreground border-info/30' },
    manual: { Icon: Hand, tone: 'bg-muted text-foreground border-border' },
    semantic: { Icon: Sparkles, tone: 'bg-warning-subtle text-warning-subtle-foreground border-warning/30' },
} as const satisfies Record<ExcerptSelectionMode, unknown>;

export function SourceSelectionModeBadge({ mode }: { mode: ExcerptSelectionMode | null }) {
    const { t } = useTranslation('exegesis');

    if (!mode) return null;

    const { Icon, tone } = MODOS[mode] ?? MODOS.semantic;
    const clave = mode in MODOS ? mode : 'semantic';
    const label = t(`paperSetup.subSteps.corpus.list.selectionMode.${clave}`);
    const hint = t(`paperSetup.subSteps.corpus.list.selectionMode.${clave}Hint`);

    return (
        <span
            className={`text-[10px] font-medium rounded-full border px-1.5 py-0 leading-tight inline-flex items-center gap-1 ${tone}`}
            title={hint}
        >
            <Icon className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
            {label}
        </span>
    );
}
