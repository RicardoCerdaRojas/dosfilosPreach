import { useState } from 'react';
import { toast } from 'sonner';
import { sermonGeneratorService } from '@dosfilos/application';
import {
    normalizeHomileticalApproach,
    WorkflowPhase,
    type GenerationRules,
    type SermonContent,
} from '@dosfilos/domain';
import type { TFunction } from 'i18next';
import { buildRulesWithContext } from './augmentGenerationRules';
import { buildSermonCitationManifest } from './buildSermonCitationManifest';
import { draftIncludesCentralIdea, draftMissingParallelRefs } from './draftChecks';
import { recordDraftShadows } from './recordDraftShadows';
import { loadVoiceSamples } from './loadVoiceSamples';

export interface DraftGenerationInput {
    homiletics: any;
    rules: GenerationRules;
    config: any;
    derivedContext: any;
    sermonId: string | null;
    userId: string | undefined;
    passage: string;
    activeLanguage: 'es' | 'en';
    /** Enciende las sombras de medición. */
    shadowEnabled: boolean;
    /** Enciende el aprendizaje de la voz del predicador (Fase 4). */
    voiceEnabled: boolean;
    setDraft: (draft: SermonContent) => void;
    /** Guarda el borrador vigente en el historial. Devuelve si guardó algo. */
    archivarBorradorActual: (etiqueta: string) => Promise<boolean>;
    /** Abre el historial de una sección — el aviso lo ofrece tras regenerar. */
    abrirHistorial: (sectionId: string) => void;
    t: TFunction;
}

/**
 * Redactar un borrador nuevo desde la proposición y el bosquejo.
 *
 * Vivía dentro de `StepDraft` como una función de 190 líneas que hacía cinco
 * cosas: reunir contexto, llamar al generador, revisar lo generado, archivar lo
 * anterior y medir. Acá cada una es una llamada legible y las piezas que se
 * pueden probar sin un modelo —los chequeos— viven en su módulo con pruebas.
 *
 * LO QUE NO CAMBIA: ningún chequeo re-genera solo. Los tres avisos posibles
 * (idea central ausente, paralelos no citados, citas sin respaldo quitadas) son
 * eso, AVISOS. Decidir qué hacer es del pastor (P2).
 */
export function useDraftGeneration(input: DraftGenerationInput) {
    const [loading, setLoading] = useState(false);
    const { t } = input;

    /**
     * `archivar` es DECISIÓN DEL PASTOR, no una política nuestra. Archivábamos
     * siempre, que es lo prudente por defecto pero le llenaba el historial de
     * versiones que él sabía que no quería guardar. El diálogo se lo pregunta;
     * acá sólo se obedece. Por defecto sí, porque quien entra sin pasar por el
     * diálogo (el estado vacío) no ha decidido nada.
     */
    const generar = async ({ archivar = true }: { archivar?: boolean } = {}) => {
        const { homiletics } = input;
        if (!homiletics) return;

        // Fail-closed: NUNCA se redacta sin la FORMA que el predicador eligió.
        // Una forma nula no puede degradar en silencio a que el modelo elija una
        // — ésa es exactamente la fabricación que este módulo existe para matar.
        // (se normaliza para que un valor heredado siga contando como forma real)
        const forma = normalizeHomileticalApproach(homiletics.homileticalApproach).approach;
        if (!forma) {
            toast.error('Elige una forma de sermón antes de redactar. El borrador no elige la forma por ti.');
            return;
        }

        setLoading(true);
        try {
            const base = input.config ? input.config[WorkflowPhase.DRAFTING] : undefined;
            const draftConfig = base
                ? {
                      ...base,
                      aiModel: input.config?.advanced?.aiModel,
                      temperature:
                          input.config?.[WorkflowPhase.DRAFTING]?.temperature ||
                          input.config?.advanced?.globalTemperature,
                  }
                : undefined;

            // FASE 4 — CÓMO SUENA CUANDO ESCRIBE ÉL. Se piden fragmentos de sus
            // propios sermones del taller para que el borrador no salga con voz
            // genérica. Sin material suyo devuelve una lista vacía y el prompt
            // queda exactamente como hoy: silencio, no aviso de carencia.
            const voiceSamples = input.voiceEnabled
                ? await loadVoiceSamples({ userId: input.userId, currentPassage: input.passage })
                : [];

            const rulesWithContext = await buildRulesWithContext({
                // El estilo del manuscrito que el usuario guardó en Ajustes
                // (#5 del ejercicio de Jonás); sin él, el del sistema.
                rules: { ...input.rules, manuscriptStyle: input.config?.[WorkflowPhase.DRAFTING]?.manuscriptStyle },
                derivedContext: input.derivedContext,
                sermonId: input.sermonId,
                userId: input.userId,
            });

            // ADR-031 — el manifiesto de citas se arma de su biblioteca personal
            // (prioridad) + homilética CORE (respaldo), para que el sermón cite
            // narrativamente CON un ancla verificable (fragmento + libro +
            // página). Best-effort: si falla, el generador cae a su camino viejo.
            const citationManifest = await buildSermonCitationManifest({
                query: homiletics.homileticalProposition,
                userId: input.userId,
            });

            const { draft: result } = await sermonGeneratorService.generateSermonDraft(
                homiletics,
                voiceSamples.length > 0 ? { ...rulesWithContext, voiceSamples } : rulesWithContext,
                draftConfig,
                input.userId,
                input.activeLanguage,
                citationManifest,
            );

            avisarSobreLoGenerado(result, rulesWithContext);

            // REGENERAR NO PUEDE SER DESTRUCTIVO. Antes se reemplazaba con
            // `setDraft` sin pasar por el historial: el sermón anterior
            // desaparecía sin quedar en ningún lado. Se guarda POR SECCIÓN
            // —como el historial ya funciona— para poder rescatar sólo la
            // introducción que le gustaba sin perder los puntos nuevos.
            const guardoVersiones = archivar
                ? await input.archivarBorradorActual(t('drafting.versions.beforeRegenerate'))
                : false;

            input.setDraft(result);

            // EL AVISO OFRECE EL SEGURO EN EL MOMENTO EN QUE HACE FALTA: justo
            // después de regenerar es cuando el pastor quiere comparar o volver.
            if (guardoVersiones) {
                toast.success(t('drafting.success.generated'), {
                    duration: 10000,
                    action: {
                        label: t('drafting.versions.seePrevious'),
                        onClick: () => input.abrirHistorial('introduction'),
                    },
                });
            } else {
                toast.success(t('drafting.success.generated'));
            }

            if (input.shadowEnabled && input.sermonId) {
                recordDraftShadows({
                    draft: result,
                    sermonId: input.sermonId,
                    passage: input.passage,
                    homileticalApproach: homiletics?.homileticalApproach,
                    principle: rulesWithContext.pastoralSeed?.timelessPrinciple,
                    genre: rulesWithContext.pastoralSeed?.genre,
                });
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || t('drafting.errors.generating'));
        } finally {
            setLoading(false);
        }
    };

    return { loading, generar };
}

/**
 * Los tres avisos posibles sobre un borrador recién salido del modelo.
 *
 * NINGUNO BLOQUEA NI RE-GENERA. El prompt pide las tres cosas; esto comprueba
 * si obedeció y se lo dice al pastor, que es quien decide si revisa, regenera o
 * lo edita a mano.
 */
function avisarSobreLoGenerado(result: SermonContent, rules: GenerationRules): void {
    const ideaCentral = rules.pastoralSeed?.centralIdea?.trim();
    if (ideaCentral && !draftIncludesCentralIdea(result, ideaCentral)) {
        toast.warning(
            'El borrador NO incluye tu idea central palabra-por-palabra. Revisa, re-genera o edítalo a mano.',
            { duration: 8000 },
        );
    }

    // ADR-035 R3/R7 — ¿citó los paralelos que el pastor marcó? Cierra el dolor
    // original: el sermón no debe salir ciego a sus alusiones.
    const faltantes = draftMissingParallelRefs(result, rules.pastoralSeed?.parallels);
    if (faltantes.length > 0) {
        toast.warning(
            `El borrador no cita ${faltantes.length === 1 ? 'el paralelo' : 'los paralelos'} que marcaste: ${faltantes.join('; ')}. Revisa o re-genera.`,
            { duration: 8000 },
        );
    }

    // La limpieza de citas corre en el SERVICIO de generación (punto único,
    // alineado con el gate de publicación). Acá sólo se informa cuántas se
    // quitaron por no tener respaldo en sus fuentes.
    const san = result.citationSanitization;
    if (san && san.removed > 0) {
        toast.warning(
            `Quitamos ${san.removed} cita(s) sin respaldo en tus fuentes (probablemente inventadas). Revisa el borrador.`,
            { duration: 9000 },
        );
    }
}
