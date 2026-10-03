import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { TFunction } from 'i18next';
import { exegesisService, sermonService, type VerifySermonCitationsOutput } from '@dosfilos/application';
import { PublicationUnchangedError } from '@dosfilos/domain';
import { useSermonContraScan } from '@/hooks/useSermonContraScan';
import { useConfirm } from '@/hooks/useConfirm';

export interface DraftPublishingInput {
    draft: any;
    exegesis: any;
    sermonId: string | null;
    userId: string | undefined;
    /** El sermón completo ya renderizado — lo que se guarda y se publica. */
    getFullContent: () => string;
    /** Limpia el asistente al salir publicado. */
    reset: () => void;
    t: TFunction;
}

/**
 * LAS DOS COMPUERTAS ANTES DEL PÚLPITO, Y EL ORDEN ENTRE ELLAS.
 *
 * Publicar no es un guardado: es la acción por la que un texto llega a una
 * congregación. Pasa por dos filtros en secuencia y ninguno de los dos es un
 * muro:
 *
 *   1. CONTRA-SCAN (ADR-033) — busca en su biblioteca lo que CONTRADICE la idea
 *      central y se lo muestra antes de publicar. Con el flag apagado despeja de
 *      inmediato y el flujo queda igual que antes.
 *   2. VERIFICADOR DE CITAS (PR #218) — compara cada cita contra el corpus del
 *      sermón. Es determinista (subcadena + Jaccard, sin llamada al modelo por
 *      cita), así que cuesta menos de 50 ms.
 *
 * SI EL VERIFICADOR FALLA, SE PUEDE PUBLICAR IGUAL. Es una red de seguridad, no
 * una reja: que nuestro chequeo se caiga no puede dejar a un pastor sin poder
 * publicar el domingo. Se muestra el diálogo en su estado "no disponible" y él
 * decide con la advertencia a la vista.
 */
export function useDraftPublishing(input: DraftPublishingInput) {
    const navigate = useNavigate();
    const { t } = input;
    const [publishing, setPublishing] = useState(false);
    const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [verificationResult, setVerificationResult] = useState<VerifySermonCitationsOutput | null>(null);

    const contraScan = useSermonContraScan({ onCleared: () => verificarCitas() });
    const { confirm, confirmDialog } = useConfirm();

    const avisarSinCambios = (copyId: string | null) =>
        toast.info(t('drafting.republish.unchanged'), copyId
            ? { action: { label: t('drafting.republish.seePublished'), onClick: () => navigate(`/dashboard/sermons/${copyId}`) } }
            : undefined);

    /** ¿Hay con qué guardar o publicar? Los cuatro se necesitan siempre. */
    const listo = () => Boolean(input.draft && input.userId && input.exegesis && input.sermonId);

    /** Los campos del sermón que se persisten desde el borrador vigente. */
    const camposDelSermon = () => ({
        title: input.draft.title,
        content: input.getFullContent(),
        bibleReferences: [input.exegesis.passage],
        tags: input.exegesis.keyWords.map((kw: any) => kw.original),
    });

    /**
     * Guardar y salir escribe el sermón RENDERIZADO en `content`.
     *
     * El autoguardado sólo toca `wizardProgress.draft`, que la página de detalle
     * no lee: sin esto, un sermón guardado se abría con el cuerpo vacío.
     */
    const guardarYSalir = async () => {
        try {
            if (input.sermonId && input.draft && input.exegesis) {
                await sermonService.updateSermon(input.sermonId, camposDelSermon());
            }
        } catch (error) {
            console.error('[draft] no se pudo persistir al guardar y salir', error);
        }
        toast.success(t('drafting.success.saved'));
        navigate('/dashboard');
    };

    /** Abre la secuencia de compuertas. */
    const publicar = async () => {
        if (!listo()) {
            toast.error(t('drafting.errors.noDraft'));
            return;
        }
        // La idea central es la tesis del pastor (prohibida al modelo); si el
        // sermón no la tiene, el título es lo más cercano que hay.
        const ideaCentral = input.draft.pastoralSeed?.centralIdea?.trim() || input.draft.title;

        // RE-PUBLICAR SÓLO SI CAMBIÓ ALGO (#2 del ejercicio de Jonás). Se
        // pregunta antes de las compuertas para no correrlas por nada. Si la
        // consulta falla se sigue: el servicio igual se niega a duplicar.
        try {
            await sermonService.updateSermon(input.sermonId!, camposDelSermon());
            const estado = await sermonService.publicationStatus(input.sermonId!);
            if (estado.change === 'unchanged') {
                avisarSinCambios(estado.lastCopyId);
                return;
            }
            if (estado.change === 'changed') {
                const n = estado.version;
                const ok = await confirm({
                    title: t('drafting.republish.newVersionTitle', { n }),
                    body: t('drafting.republish.newVersionBody', { n }),
                    confirmLabel: t('drafting.republish.newVersionConfirm', { n }),
                    destructive: false,
                });
                if (!ok) return;
            }
        } catch (error) {
            console.warn('[draft] no se pudo saber si cambió desde la última publicación', error);
        }

        await contraScan.attempt(input.sermonId!, ideaCentral);
    };

    /** Segunda compuerta — corre cuando el contra-scan despeja. */
    const verificarCitas = async () => {
        if (!listo()) return;
        setVerificationDialogOpen(true);
        setVerifying(true);
        setVerificationResult(null);
        try {
            setVerificationResult(
                await exegesisService.verifySermonCitations.execute({
                    ownerId: input.userId!,
                    sermonId: input.sermonId!,
                }),
            );
        } catch (error) {
            console.error('[draft] la verificación de citas falló', error);
            // Red de seguridad caída ≠ publicación bloqueada: se muestra el
            // diálogo vacío con su advertencia y el pastor decide.
            //
            // `hasLibraryManifest` se declara desde el borrador, no en `false`:
            // el sermón SÍ puede traer citas ancladas a su biblioteca, y decir
            // que no las tiene porque nuestro verificador se cayó sería acusarlo
            // de no citar cuando citó.
            setVerificationResult({
                sourceKind: null,
                sourceCorpusLength: 0,
                hasLibraryManifest: Boolean(input.draft?.citationManifest?.entries?.length),
                citations: [],
            });
        } finally {
            setVerifying(false);
        }
    };

    /** Publicación real, tras las compuertas. */
    const publicarAhora = async () => {
        if (!listo()) return;
        setVerificationDialogOpen(false);
        setPublishing(true);
        try {
            await sermonService.updateSermon(input.sermonId!, camposDelSermon());
            const publicado = await sermonService.publishSermonAsCopy(input.sermonId!);
            toast.success(t('drafting.success.published'));
            input.reset();
            navigate(`/dashboard/sermons/${publicado.id}`);
        } catch (error) {
            if (error instanceof PublicationUnchangedError) {
                avisarSinCambios(error.copyId);
                return;
            }
            console.error(error);
            toast.error(t('drafting.errors.publishing'));
        } finally {
            setPublishing(false);
        }
    };

    return {
        publishing,
        contraScan,
        verificationDialogOpen,
        setVerificationDialogOpen,
        verifying,
        verificationResult,
        guardarYSalir,
        publicar,
        publicarAhora,
        /** El diálogo de «versión nueva»; quien usa el hook lo renderiza. */
        confirmDialog,
    };
}
