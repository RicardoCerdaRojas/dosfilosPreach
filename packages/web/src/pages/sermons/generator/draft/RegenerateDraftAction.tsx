import { useState } from 'react';
import { Loader2, PenLine, RefreshCw } from 'lucide-react';
import { ToolbarIconButton } from '../ToolbarIconButton';
import { Checkbox } from '@/components/ui/checkbox';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useTranslation } from '@/i18n';

interface Props {
    loading: boolean;
    /**
     * El taller existe Y el pastor ya decidió algo en él.
     *
     * Es lo que separa "rehacer" de "saltarse el trabajo": sin decisiones,
     * regenerar es simplemente volver a pedir un borrador.
     */
    workshopHasDecisions: boolean;
    /** Llevar al taller, que es la ruta que NO se salta las decisiones. */
    onGoToWorkshop: () => void;
    onRegenerate: (opciones: { archivar: boolean }) => void;
}

/**
 * Rehacer el borrador desde cero: la SALIDA DE EMERGENCIA de ADR-037.
 *
 * VISIBLE, Y LA FRICCIÓN VA EN EL DIÁLOGO. El primer intento la escondió en un
 * menú `⋮` y el fundador la cortó en el acto: "casi imperceptible". Tenía
 * razón, y es la segunda vez en esta pantalla que esconder una acción resulta
 * ser el error — la primera fue el click en el mapa, "nunca lo hubiera
 * sabido". Una acción legítima que no se encuentra no se vuelve más segura: se
 * vuelve un motivo para desconfiar de la app.
 *
 * SIN "ESCRIBE REGENERAR PARA CONFIRMAR". Esa fricción es para lo
 * irreversible; acá el borrador queda archivado por sección y se puede volver
 * a él. Pedir que se teclee una palabra para algo reversible enseña a
 * despachar los diálogos sin leerlos, y entonces el aviso deja de proteger de
 * lo que sí importa.
 *
 * LO QUE SÍ IMPORTA, y por eso el diálogo existe: el borrador nuevo NO viene
 * de lo que el pastor decidió en el taller. Por eso, con decisiones hechas, se
 * ofrece "Ir al Taller" —donde volver a armar hace lo que casi siempre quiere—
 * y la destructiva deja de ser el botón primario. Advertir sin ofrecer la
 * salida correcta deja al apurado eligiendo la destructiva igual.
 *
 * ARCHIVAR ES SU DECISIÓN, NO NUESTRA POLÍTICA. Archivábamos siempre, que es
 * lo prudente por defecto pero le llena el historial de versiones que él sabe
 * que no quiere. Marcado por defecto: la prudencia es el punto de partida, no
 * una regla.
 */
export function RegenerateDraftAction({
    loading,
    workshopHasDecisions,
    onGoToWorkshop,
    onRegenerate,
}: Props) {
    const { t } = useTranslation('generator');
    const [archivar, setArchivar] = useState(true);

    return (
        <AlertDialog
            // La casilla vuelve a su estado prudente cada vez que se abre: un
            // "no guardar" de la vez pasada no puede decidir por el de hoy.
            onOpenChange={(abierto) => abierto && setArchivar(true)}
        >
            <AlertDialogTrigger asChild>
                {/* Ícono VISIBLE con tooltip — no el menú "⋮" que la escondió.
                    El nombre completo y las consecuencias viven en el diálogo,
                    que es donde se decide. */}
                <ToolbarIconButton
                    label={loading ? t('drafting.regeneratingBtn') : t('drafting.regenerateConfirm.title')}
                    disabled={loading}
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </ToolbarIconButton>
            </AlertDialogTrigger>

            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('drafting.regenerateConfirm.title')}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {workshopHasDecisions
                            ? t('drafting.regenerateConfirm.workshopDescription')
                            : t('drafting.regenerateConfirm.description')}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm cursor-pointer">
                    <Checkbox
                        checked={archivar}
                        onCheckedChange={(v) => setArchivar(v === true)}
                        className="mt-0.5"
                    />
                    <span>
                        {t('drafting.regenerateConfirm.keepVersion')}
                        <span className="block text-xs text-muted-foreground">
                            {t('drafting.regenerateConfirm.keepVersionHint')}
                        </span>
                    </span>
                </label>

                <AlertDialogFooter>
                    <AlertDialogCancel>{t('drafting.regenerateConfirm.cancel')}</AlertDialogCancel>

                    {workshopHasDecisions && (
                        <AlertDialogAction
                            onClick={onGoToWorkshop}
                            className="bg-primary-solid text-primary-foreground hover:bg-primary-solid-hover"
                        >
                            <PenLine className="mr-2 h-4 w-4" />
                            {t('drafting.regenerateConfirm.goToWorkshop')}
                        </AlertDialogAction>
                    )}

                    <AlertDialogAction
                        onClick={() => onRegenerate({ archivar })}
                        className={
                            workshopHasDecisions
                                ? 'bg-transparent text-destructive border border-destructive/40 hover:bg-destructive/10'
                                : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                        }
                    >
                        {t('drafting.regenerateConfirm.confirm')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
