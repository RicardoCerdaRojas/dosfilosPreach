import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { TFunction } from 'i18next';
import { useFirebase } from '@/context/firebase-context';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useContentHistory } from '@/hooks/useContentHistory';
import { useGeneratorChat } from '@/hooks/useGeneratorChat';
import { deriveSectionWalk, hasDecisions, WorkflowPhase, type SermonContent } from '@dosfilos/domain';
import { useWizard } from '../WizardContext';
import { buildFullContent } from './sermonContent';
import { useDraftRefinement } from './useDraftRefinement';
import { useDraftVersions } from './useDraftVersions';
import { useDraftGeneration } from './useDraftGeneration';
import { useDraftPublishing } from './useDraftPublishing';
import { useDraftCanvas } from './useDraftCanvas';

/**
 * TODO LO QUE EL PASO DE REDACCIÓN NECESITA SABER ANTES DE DIBUJAR.
 *
 * El paso quedó separado en dos: acá se reúnen los datos y las acciones —siete
 * hooks, cinco estados y los derivados del bosquejo—; en `StepDraft` sólo se
 * decide qué se muestra. La costura es deliberada: mientras las dos cosas
 * convivían, cambiar un botón obligaba a leer la orquestación entera, y la
 * orquestación sólo se podía leer salteando JSX.
 *
 * TODOS LOS HOOKS VAN ACÁ Y NINGUNO DEBAJO DE UN CONDICIONAL. Es la regla que
 * costó un "Rendered fewer hooks than expected" en producción y la que el
 * trinquete `check-react-hooks.sh` vigila.
 */
export function useDraftStep(t: TFunction, activeLanguage: 'es' | 'en') {
    const { user } = useFirebase();
    const {
        homiletics, rules, setDraft, draft, setStep, exegesis, config, passage, sermonId,
        derivedContext, sectionElements, setSectionElements, sectionProse, setSectionProse,
        reset, saving,
    } = useWizard();

    const draftShadowGate = useFeatureFlag('sermon_draft_shadow');
    // Fase 4 — la voz del predicador. Apagado: el borrador sale como hoy.
    const voiceGate = useFeatureFlag('voice_fingerprint');
    // ADR-037 — las decisiones viven en el contexto del wizard y se persisten
    // con el resto del progreso: el spike ya adjudicó que el modelo propone
    // bien, así que el esquema deja de ser provisional.
    const socraticGate = useFeatureFlag('socratic_drafting');

    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
    /**
     * Pestaña activa, CONTROLADA para poder llevarlo al borrador al armarlo.
     *
     * Sin esto, armar dejaba al pastor mirando el taller sin ninguna señal de
     * que algo había pasado: el botón cambiaba de etiqueta —porque ya no quedaba
     * nada pendiente— y ésa era toda la respuesta. Preguntó por qué, que es la
     * pregunta de alguien que no sabe si su acción funcionó.
     */
    const [activeTab, setActiveTab] = useState<'draft' | 'workshop'>('draft');
    /**
     * El pastor ya eligió camino en esta visita.
     *
     * No se persiste: al volver a un sermón donde ya decidió algo, `hayDecisiones`
     * basta para saltarse el selector. Sirve para el caso en que acaba de pulsar
     * "Entrar al taller" y todavía no decidió nada — sin esto, el selector
     * volvería a aparecer sobre la pantalla que acaba de abrir.
     */
    const [caminoElegido, setCaminoElegido] = useState(false);
    const [modifiedSections, setModifiedSections] = useState<Set<string>>(new Set());
    const [showPreview, setShowPreview] = useState(false);

    const {
        messages, setMessages, isLoading: isChatLoading, activeContext,
        refreshContext: handleRefreshContext, handleSendMessage: sendGeneralMessage,
    } = useGeneratorChat({ phase: 'sermon', content: draft, config, user, sermonId });

    const contentHistory = useContentHistory('sermon', sermonId ?? undefined);

    const getFullContent = () => buildFullContent(draft, t);

    // ORDEN DE DECLARACIÓN, NO CAPRICHO: el canvas es dueño del historial, y
    // generar necesita archivar antes de pisar el borrador. Las versiones van
    // primero porque el canvas las cablea a sus tarjetas.
    const versiones = useDraftVersions({ draft, setDraft, contentHistory, setModifiedSections });

    const canvas = useDraftCanvas({
        draft, setDraft, homiletics, rules, config, exegesis, contentHistory,
        messages, setMessages, activeContext, onRefreshContext: handleRefreshContext,
        versiones, modifiedSections, t,
    });

    const { loading, generar } = useDraftGeneration({
        homiletics, rules, config, derivedContext, sermonId,
        userId: user?.uid, passage, activeLanguage,
        shadowEnabled: draftShadowGate.enabled,
        voiceEnabled: voiceGate.enabled,
        setDraft,
        archivarBorradorActual: canvas.historial.archivarBorradorActual,
        abrirHistorial: canvas.historial.abrirHistorial,
        t,
    });

    const publicacion = useDraftPublishing({
        draft, exegesis, sermonId, userId: user?.uid, getFullContent, reset, t,
    });

    const refinamiento = useDraftRefinement({
        draft, setDraft, expandedSectionId: canvas.expandedSectionId, setMessages, setModifiedSections,
        sendGeneralMessage, contentHistory, config, rules, homiletics, exegesis, passage,
    });

    /**
     * ADR-037 — el recorrido del taller, derivado de SU bosquejo.
     *
     * El mapa y el taller viven juntos: elegir una sección en el mapa cambia el
     * taller. Separarlos obligaría a recordar en cuál se estaba trabajando, que
     * es exactamente lo que el mapa existe para evitar.
     */
    const socraticWalk = useMemo(
        () =>
            homiletics
                ? deriveSectionWalk({
                      points: (homiletics.outline?.mainPoints ?? []) as any[],
                      sermonPassage: passage,
                      proposition: homiletics.homileticalProposition,
                      // Material del estudio de ocho pasos que antes no llegaba
                      // a la redacción por ningún camino.
                      openingIllustration: rules.pastoralSeed?.pastoralAnecdote,
                      keyWords: homiletics.exegeticalStudy?.keyWords,
                  })
                : [],
        [homiletics, passage, rules.pastoralSeed?.pastoralAnecdote],
    );

    // La sección activa por defecto es la PRIMERA PENDIENTE, no la primera del
    // recorrido: abrir en una que ya es suya le haría creer que hay algo que
    // decidir ahí.
    const activeSection =
        socraticWalk.find((s) => s.id === activeSectionId) ??
        socraticWalk.find((s) => s.status === 'pendiente') ??
        socraticWalk[0];

    const armarBorrador = async (armado: SermonContent) => {
        const guardo = await canvas.historial.archivarBorradorActual(t('drafting.versions.beforeAssemble'));
        setDraft(armado);
        // Llevarlo a ver lo que acaba de armar. El resultado de esta acción ES el
        // borrador: dejarlo en el taller lo obliga a buscarlo para saber si
        // funcionó.
        setActiveTab('draft');
        toast.success(guardo ? t('drafting.versions.assembledWithBackup') : t('drafting.versions.assembled'));
    };

    const hayTaller = socraticGate.enabled && Boolean(activeSection);
    const hayDecisiones = Object.values(sectionElements).some(hasDecisions);

    // EL SELECTOR ES UNA COMPUERTA, NO UNA PANTALLA DE TRABAJO. Antes incrustaba
    // el taller completo debajo — el mismo que vive en su pestaña, pero en media
    // pantalla y sin la banda del paso. El problema no era el espacio: era el
    // taller MONTADO EN DOS LUGARES.
    //
    // Se muestra sólo mientras no haya por dónde entrar: sin borrador, sin
    // decisiones y sin haber elegido en esta sesión. En cuanto decide algo, la
    // pantalla de trabajo es la suya y volver al selector sería un paso atrás que
    // él no pidió.
    const mostrarSelector = !draft && !hayDecisiones && !caminoElegido;

    return {
        // Datos del sermón
        homiletics, exegesis, rules, draft, passage, sermonId, saving, user,
        // El estilo del manuscrito del usuario, para el redactor por sección.
        manuscriptStyle: config?.[WorkflowPhase.DRAFTING]?.manuscriptStyle || undefined,
        sectionElements, setSectionElements, sectionProse, setSectionProse,
        // Estado de la pantalla
        activeTab, setActiveTab, showPreview, setShowPreview,
        caminoElegido, setCaminoElegido, activeSectionId, setActiveSectionId,
        // Piezas de trabajo
        canvas, refinamiento, publicacion, isChatLoading,
        loading, generar, getFullContent, armarBorrador, setStep,
        // Derivados del bosquejo
        socraticWalk, activeSection, hayTaller, hayDecisiones, mostrarSelector,
    };
}
