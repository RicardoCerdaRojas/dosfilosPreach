import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, BookText, Sparkles, Loader2, Lightbulb, Languages, FileCheck2, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { PassagePicker } from '@/components/exegesis/PassagePicker';
import { RubricTemplatePicker } from '@/components/exegesis/setup/RubricTemplatePicker';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';
import { useUserRubrics } from '@/hooks/exegesis/useUserRubrics';
import { useUserAssignmentBriefs } from '@/hooks/exegesis/useUserAssignmentBriefs';
import { AssignmentBriefPicker } from '@/components/exegesis/setup/AssignmentBriefPicker';
import { ProjectOriginPicker } from '@/components/exegesis/ProjectOriginPicker';
import { ProjectBibliographyOffer } from '@/components/exegesis/ProjectBibliographyOffer';
import { MethodPicker } from '@/components/exegesis/MethodPicker';
import {
    ASSIGNMENT_BRIEF_MAX_CHARS,
    defaultWorkTypeId,
    formatPassageForReader,
    nextAssignmentDate,
    nextLabelFor,
    projectWorkTypes,
    resolveProjectCharge,
    type AddProjectSourceInput,
    type AIProject,
    type CourseOp,
    type ExegeticalMethod,
    type ExegeticalStrategy,
    type PassageReference,
    type SupportedLanguage,
} from '@dosfilos/domain';
import { useWorkProfiles } from '@/hooks/exegesis/useWorkProfiles';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';
import type { WorkProfile } from '@dosfilos/domain';
import { briefToPrefill } from '@/lib/exegesis/briefToPrefill';

/**
 * Step 1 of the exegesis creation flow — minimal page.
 *
 * Only collects what's needed to OPEN the paper:
 *   - Passage (required)
 *   - Assignment brief (optional but encouraged) — the paper-level
 *     framing (professor's prompt + student's angle) that the
 *     orchestrator threads into every step's system prompt.
 *
 * Everything else (rubric, style guide, corpus, structural plan)
 * lives in the dedicated setup page at `/exegesis/{paperId}/setup`,
 * which this page redirects to on submit. The split exists because
 * those steps are too rich to live alongside "create" — each
 * deserves its own focused surface.
 */
export function ExegesisCreatePage() {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation('exegesis');
    const { createPaper } = useExegesisPapers();
    // El proyecto de origen (ADR-046). Solo viene puesto si se llegó desde el
    // proyecto (`?projectId=`): no se sugiere el último usado, porque un
    // estudio asociado por error a otro curso confunde más de lo que ahorra
    // (decisión del fundador, 2026-10-22). Se puede asociar después.
    const [searchParams] = useSearchParams();
    const { t: tc } = useTranslation('projectDeskCourse');
    const { projects, updateProject } = useFacultyProjects();
    const proyectosActivos = (projects ?? []).filter(p => !p.archivedAt && !p.deletedAt);
    const [projectId, setProjectId] = useState<string | null>(() => searchParams.get('projectId'));
    const proyectoElegido = proyectosActivos.find(p => p.id === projectId) ?? null;
    // Desde el escritorio del Curso (`docs/FASE_ESCRITORIO_PROYECTO_2026-10.md`
    // §9.1): «Crear el TP #10» trae el tipo de trabajo, la entrega del
    // calendario y su rótulo. Solo valen mientras el estudio siga naciendo en
    // ESE curso: si el estudiante elige otro proyecto, no se vincula nada.
    const proyectoDeLaUrl = searchParams.get('projectId');
    const delCurso = !!proyectoElegido && proyectoElegido.id === proyectoDeLaUrl && proyectoElegido.type === 'course';
    const entradaDeLaUrl = searchParams.get('scheduleEntryId');
    const rotuloDeLaUrl = searchParams.get('label')?.trim() || null;
    const entradaDelCalendario = delCurso && entradaDeLaUrl
        ? (proyectoElegido.courseSchedule ?? []).find(e => e.id === entradaDeLaUrl) ?? null
        : null;
    // Semana a semana, un trabajo creado desde el escritorio (trae su tipo) crea
    // igual su entrada sin fecha: entregado y devolución necesitan dónde vivir.
    const tipoDeLaUrl = searchParams.get('workTypeId');
    const semanaASemana = delCurso && proyectoElegido.courseScheduleMode === 'free' && !!tipoDeLaUrl;
    const rotuloSugerido = rotuloDeLaUrl
        ?? (semanaASemana && tipoDeLaUrl ? nextLabelFor(tipoDeLaUrl, proyectoElegido.courseSchedule ?? []) : null);
    /** El trabajo cumple una entrega: la del calendario, o una nueva (sin fecha). */
    const entrega = delCurso && (entradaDelCalendario || rotuloSugerido || semanaASemana)
        ? { entry: entradaDelCalendario, label: entradaDelCalendario?.label || rotuloSugerido || '' }
        : null;
    /** Qué tipo de trabajo del proyecto es (etapa 1b): TP semanal, paper final. */
    const [workTypeId, setWorkTypeId] = useState<string | null>(null);
    const tiposDelProyecto = projectWorkTypes(proyectoElegido);
    /** Lo que hereda del estado del arte del proyecto (etapa 2). */
    const [fuentesDelProyecto, setFuentesDelProyecto] = useState<AddProjectSourceInput[]>([]);
    /** La guía del encargo del proyecto, cuando el estudio nace de uno. */
    const [styleGuideDelProyecto, setStyleGuideDelProyecto] = useState<string | null>(null);
    const { rubrics, defaultRubric } = useUserRubrics();
    const { briefs, defaultBrief } = useUserAssignmentBriefs();
    // El encuadre del perfil elegido, si trae uno: el perfil lo apuntaba y
    // la creación lo ignoraba (TP #6).
    const [briefDelPerfilId, setBriefDelPerfilId] = useState<string | null>(null);

    const [passage, setPassage] = useState<PassageReference | null>(null);
    const [passageError, setPassageError] = useState<string | null>(null);
    const [assignmentBrief, setAssignmentBrief] = useState('');
    // Track whether the user has typed into the brief — once they have,
    // a default brief loaded from Firestore mustn't clobber their text.
    const [briefUserTyped, setBriefUserTyped] = useState(false);
    // El mismo tope que el panel de edición en la configuración: dos cifras
    // sueltas terminan discrepando, y lo creado aquí no se podría reeditar allá.
    const briefMaxChars = ASSIGNMENT_BRIEF_MAX_CHARS;
    // Rubric template choice. Three states:
    //   - undefined → "use default if any" (matches the use case's
    //     fallback). Initial value when the user hasn't touched the
    //     picker.
    //   - templateId string → apply that template.
    //   - null → "no template, use system default rubric".
    //
    // Strategy and rubric used to be coupled here (picking dialectical
    // auto-applied the strategy-only rubric). They are now independent:
    // strategy drives how the corpus is built; rubric is the
    // professor's grading instrument. A student can have a dialectical
    // corpus AND a custom seminary rubric.
    const [rubricTemplateId, setRubricTemplateId] = useState<string | null | undefined>(undefined);

    // Default the paper language to whatever the UI is set to, but
    // make it explicit + editable. The student may be using a Spanish
    // UI to write a paper in English (or vice versa). The choice is
    // sticky on the paper; it drives the orchestrator's output
    // language for every step.
    const initialLanguage: SupportedLanguage = i18n.language?.split('-')[0] === 'en' ? 'en' : 'es';
    const [displayLanguage, setDisplayLanguage] = useState<SupportedLanguage>(initialLanguage);
    // Methodology mode. Defaults to dialectical because that's the
    // differentiator we want users to land on; opting out is a
    // deliberate, named choice (`free`) — not the absence of one.
    const [exegeticalStrategy, setExegeticalStrategy] = useState<ExegeticalStrategy>('dialectical');
    // El método (capa 3): cuándo entran los comentarios. Sin elegir, el
    // análisis de siempre. Lo traen el perfil y el tipo de trabajo.
    const [exegeticalMethod, setExegeticalMethod] = useState<ExegeticalMethod | null>(null);

    // Perfil de trabajo: cómo quedó configurado un trabajo anterior del
    // mismo curso. Rellena los campos y NO decide: el estudiante ve los
    // valores puestos y cambia los que quiera antes de crear. Un perfil que
    // decide en silencio es un perfil que nadie revisa.
    const { profiles, defaultProfile } = useWorkProfiles();
    const [workProfileId, setWorkProfileId] = useState<string | null>(null);
    // DESPUÉS del estado que lee: antes iba arriba y, con un perfil guardado,
    // el `find` leía `workProfileId` sin declarar y la página se caía en
    // blanco («Cannot access before initialization»).
    const perfilElegido = profiles.find(p => p.id === workProfileId) ?? null;
    const perfilAplicado = useRef(false);

    const aplicarPerfil = useCallback((profile: WorkProfile | null) => {
        // Elegir «sin perfil» también es una decisión: el perfil por defecto
        // que llegue tarde no la pisa.
        perfilAplicado.current = true;
        setWorkProfileId(profile?.id ?? null);
        // Elegir un perfil a mano reemplaza la guía del proyecto: si no, el
        // trabajo mezclaba la rúbrica de uno con la guía del otro.
        setStyleGuideDelProyecto(null);
        if (!profile) return;
        // Un perfil guardado antes del 2026-10-07 no creaba plantilla y quedó
        // con `null`, que al crear significa «sin plantilla: la del sistema»
        // (12 páginas, 13 fuentes). En el TP #7 el perfil «TP Semanal» era
        // así y el trabajo nació con la rúbrica del paper (#1). Sin rúbrica,
        // el perfil no opina: el selector queda como estaba y se avisa.
        // Sin rúbrica vuelve a automático: no hereda la del perfil anterior.
        setRubricTemplateId(profile.rubricTemplateId ?? undefined);
        setBriefDelPerfilId(profile.briefTemplateId);
        setExegeticalStrategy(profile.exegeticalStrategy);
        setExegeticalMethod(profile.exegeticalMethod ?? null);
        setCoverFromProfile(profile.cover ?? null);
    }, []);

    /** La portada del perfil, que se escribe en el trabajo recién creado. */
    const [coverFromProfile, setCoverFromProfile] = useState<WorkProfile['cover']>(null);

    /**
     * Lo que hereda del proyecto: los datos del curso más los del tipo de
     * trabajo elegido. Rellena igual que un perfil y tampoco decide. Gana
     * sobre el perfil por defecto, porque el estudio nace del curso.
     */
    const encargoEnUso = useRef(false);
    const aplicarEncargo = useCallback((proyecto: AIProject | null, tipo: string | null) => {
        setProjectId(proyecto?.id ?? null);
        setWorkTypeId(proyecto ? tipo : null);
        setStyleGuideDelProyecto(null);
        const c = proyecto ? resolveProjectCharge(proyecto, tipo) : null;
        if (!c) {
            // Dejar un proyecto cuyo encargo se aplicó deshace ese encargo:
            // si no, el estudio nacía suelto con la rúbrica y la portada del
            // curso anterior, y la portada ni siquiera se ve en esta página.
            if (encargoEnUso.current) {
                encargoEnUso.current = false;
                setRubricTemplateId(undefined);
                setBriefDelPerfilId(null);
                setCoverFromProfile(null);
                setExegeticalStrategy('dialectical');
                setExegeticalMethod(null);
                if (defaultProfile) aplicarPerfil(defaultProfile);
            }
            return;
        }
        encargoEnUso.current = true;
        perfilAplicado.current = true;
        setWorkProfileId(null);
        // Cada campo se pone entero, también vacío: pasar del TP al paper
        // final no puede dejar el encuadre o la portada del TP.
        // `null` en la rúbrica es «la del sistema» y se respeta; solo la
        // ausencia deja la plantilla por defecto del usuario.
        setRubricTemplateId(c.rubricTemplateId === undefined ? undefined : c.rubricTemplateId);
        setBriefDelPerfilId(c.briefTemplateId ?? null);
        setExegeticalStrategy(c.exegeticalStrategy ?? 'dialectical');
        setExegeticalMethod(c.exegeticalMethod ?? null);
        setCoverFromProfile(c.cover ?? null);
        setStyleGuideDelProyecto(c.styleGuideId ?? null);
    }, [defaultProfile, aplicarPerfil]);
    const encargoAplicadoAhora = !!proyectoElegido && !!resolveProjectCharge(proyectoElegido, workTypeId);

    // Si se llegó desde un proyecto con encargo, se aplica en cuanto cargan
    // los proyectos (una vez).
    const encargoAplicado = useRef(false);
    useEffect(() => {
        if (encargoAplicado.current || !proyectoElegido) return;
        encargoAplicado.current = true;
        // El tipo que pidió el escritorio, si es de este proyecto; si no, el de siempre.
        const pedido = searchParams.get('workTypeId');
        const tipo = pedido && proyectoElegido.id === searchParams.get('projectId') && projectWorkTypes(proyectoElegido).some(x => x.id === pedido)
            ? pedido
            : defaultWorkTypeId(proyectoElegido);
        aplicarEncargo(proyectoElegido, tipo);
    }, [proyectoElegido, aplicarEncargo, searchParams]);

    // El pasaje de la entrega, si el calendario lo tiene, mientras el estudiante no haya elegido otro.
    const pasajeDeLaEntrega = useRef(false);
    useEffect(() => {
        if (pasajeDeLaEntrega.current || !entradaDelCalendario?.passage) return;
        pasajeDeLaEntrega.current = true;
        setPassage(p => p ?? entradaDelCalendario.passage ?? null);
    }, [entradaDelCalendario]);

    // El perfil por defecto se aplica al entrar, y sólo mientras el
    // estudiante no haya tocado nada. Si se llegó desde un proyecto, su
    // encargo se aplica después y gana igual, aunque el perfil cargue antes.
    useEffect(() => {
        if (perfilAplicado.current || !defaultProfile) return;
        aplicarPerfil(defaultProfile);
    }, [defaultProfile, aplicarPerfil]);

    // Auto-load the user's default brief once the hook resolves.
    // Skip when the user already typed something so we don't clobber.
    // El del perfil gana sobre el encuadre por defecto.
    useEffect(() => {
        if (briefUserTyped) return;
        const elegido = briefToPrefill(briefs, briefDelPerfilId, defaultBrief);
        // Sin encuadre que heredar se vacía: pasar del TP al paper final no
        // puede dejar la consigna del TP (revisión de la etapa 1b). Lo que el
        // estudiante escribió no se toca: lo protege `briefUserTyped`.
        if (!elegido) { setAssignmentBrief(''); return; }
        setAssignmentBrief(elegido.body.slice(0, briefMaxChars));
    }, [briefs, briefDelPerfilId, defaultBrief, briefUserTyped]);

    const isCreating = createPaper.isPending;
    const canCreate = !!passage && !isCreating;
    const briefCharCount = assignmentBrief.length;

    /**
     * Vincula el trabajo recién creado con su entrega. Si la entrega ya no
     * está (otra pestaña la quitó) o no había (semana a semana), se crea con
     * su tipo y su rótulo, sin fecha: así «entregado» y la devolución tienen
     * dónde vivir. Si falla, el trabajo ya existe: se avisa y se sigue.
     */
    const vincularEntrega = async (proyecto: string, paperId: string) => {
        if (!entrega) return;
        const ops: CourseOp[] = entrega.entry
            ? [{ op: 'linkPaper', entryId: entrega.entry.id, paperId }]
            // Sin rótulo, el pasaje: la fila de la mesa necesita cómo llamarse.
            : [{ op: 'upsertEntry', entry: { workTypeId: workTypeId ?? '', label: entrega.label || (passage ? formatPassageForReader(passage, displayLanguage) : ''), paperId } }];
        try {
            await updateProject?.mutateAsync({ projectId: proyecto, courseOps: ops });
        } catch (err) {
            console.error('[exegesis] link schedule entry failed:', err);
            toast.error(tc('create.linkFailed', { label: entrega.label }));
        }
    };

    const handleCreate = async () => {
        if (!passage) return;
        try {
            // La portada del perfil o del proyecto nace con el trabajo: es el
            // dato que menos cambia entre trabajos del mismo curso y el que
            // más molesta retipear. Va en la misma creación; antes era una
            // segunda llamada que, si fallaba, dejaba el trabajo sin portada.
            // La fecha, del mes en curso: el perfil guarda la de la entrega
            // con que se creó, y el TP #7 salió «SEPTIEMBRE 2026» en octubre.
            const cover = coverFromProfile
                ? { ...coverFromProfile, date: nextAssignmentDate(coverFromProfile.date, new Date()) }
                : null;
            const paper = await createPaper.mutateAsync({
                passage,
                displayLanguage,
                exegeticalStrategy,
                ...(exegeticalMethod ? { exegeticalMethod } : {}),
                styleGuideId: styleGuideDelProyecto ?? perfilElegido?.styleGuideId ?? null,
                assignmentBrief: assignmentBrief.trim() || null,
                rubricTemplateId,
                // El proyecto elegido de verdad: uno de la URL que no está entre
                // los activos (archivado, ajeno) no se manda.
                ...(proyectoElegido ? { projectId: proyectoElegido.id, projectWorkTypeId: workTypeId } : {}),
                ...(proyectoElegido && fuentesDelProyecto.length > 0 ? { initialSources: fuentesDelProyecto } : {}),
                ...(cover ? { cover } : {}),
            });
            toast.success(t('create.toast.created'));
            if (entrega && proyectoElegido) await vincularEntrega(proyectoElegido.id, paper.id);
            navigate(`/dashboard/exegesis/${paper.id}/setup`);
        } catch (err) {
            console.error('[exegesis] create failed:', err);
            toast.error(t('create.toast.createFailed'));
        }
    };

    return (
        <div className="flex flex-col h-full bg-background font-sans overflow-y-auto">
            <header className="border-b border-border bg-card px-6 py-4">
                <div className="max-w-3xl mx-auto flex items-center gap-3">
                    <Link
                        to="/dashboard/exegesis"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        aria-label={t('create.backToList')}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div>
                        <h1 className="text-lg font-semibold text-foreground font-serif">
                            {t('create.title')}
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            {t('create.subtitle')}
                        </p>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-8 space-y-6">
                <Step
                    number={1}
                    icon={<BookText className="h-4 w-4" />}
                    title={t('setup.passage.stepTitle')}
                    subtitle={t('setup.passage.stepSubtitle')}
                >
                    <PassagePicker
                        value={passage}
                        onChange={(ref, err) => {
                            setPassage(ref);
                            setPassageError(err?.hint ?? null);
                        }}
                    />
                </Step>

                <Step
                    number={2}
                    icon={<Languages className="h-4 w-4" />}
                    title={t('create.language.title')}
                    subtitle={t('create.language.subtitle')}
                >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex gap-2">
                            <LanguageOption
                                value="es"
                                label="Español"
                                selected={displayLanguage === 'es'}
                                onSelect={() => setDisplayLanguage('es')}
                            />
                            <LanguageOption
                                value="en"
                                label="English"
                                selected={displayLanguage === 'en'}
                                onSelect={() => setDisplayLanguage('en')}
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground italic">
                            {t('create.language.hint')}
                        </p>
                    </div>
                </Step>

                <Step
                    number={3}
                    icon={<Compass className="h-4 w-4" />}
                    title={t('create.strategy.title')}
                    subtitle={t('create.strategy.subtitle')}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <StrategyOption
                            value="dialectical"
                            selected={exegeticalStrategy === 'dialectical'}
                            onSelect={() => { perfilAplicado.current = true; setExegeticalStrategy('dialectical'); }}
                            recommended
                            title={t('create.strategy.dialectical.title')}
                            body={t('create.strategy.dialectical.body')}
                        />
                        <StrategyOption
                            value="free"
                            selected={exegeticalStrategy === 'free'}
                            onSelect={() => { perfilAplicado.current = true; setExegeticalStrategy('free'); }}
                            title={t('create.strategy.free.title')}
                            body={t('create.strategy.free.body')}
                        />
                    </div>
                    <p className="text-[11px] text-muted-foreground italic mt-2">
                        {t('create.strategy.hint')}
                    </p>
                    <div className="mt-4 border-t border-border pt-3">
                        <MethodPicker value={exegeticalMethod} onChange={setExegeticalMethod} />
                    </div>
                </Step>

                {proyectosActivos.length > 0 && (
                    <ProjectOriginPicker
                        projects={proyectosActivos}
                        projectId={projectId}
                        workTypes={tiposDelProyecto}
                        workTypeId={workTypeId}
                        inherits={encargoAplicadoAhora}
                        onProject={p => aplicarEncargo(p, defaultWorkTypeId(p))}
                        onWorkType={tipo => aplicarEncargo(proyectoElegido, tipo)}
                    />
                )}
                {entrega && (
                    <p role="note" data-testid="create-schedule-entry" className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">
                        {entrega.entry
                            ? tc('create.fulfills', { label: entrega.label })
                            : entrega.label
                                ? tc('create.newEntry', { label: entrega.label })
                                : tc('create.newEntryUnlabeled')}
                    </p>
                )}
                <ProjectBibliographyOffer project={proyectoElegido} bookId={passage?.bookId ?? null} onChange={setFuentesDelProyecto} />

                {profiles.length > 0 && (
                    <div className="rounded-xl border border-border bg-card p-3 space-y-1">
                        <label htmlFor="work-profile" className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                            {t('paperSetup.workProfile.pickLabel')}
                        </label>
                        <select
                            id="work-profile"
                            value={workProfileId ?? ''}
                            onChange={e => aplicarPerfil(profiles.find(p => p.id === e.target.value) ?? null)}
                            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                            <option value="">{t('paperSetup.workProfile.pickNone')}</option>
                            {profiles.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.displayName}{p.course ? ` · ${p.course}` : ''}
                                </option>
                            ))}
                        </select>
                        <p className="text-[11px] text-muted-foreground">{t('paperSetup.workProfile.pickHint')}</p>
                        {perfilElegido && perfilElegido.rubricTemplateId === null && (
                            <p className="text-[11px] text-warning-subtle-foreground">{t('paperSetup.workProfile.noRubric')}</p>
                        )}
                    </div>
                )}

                <Step
                    number={4}
                    icon={<FileCheck2 className="h-4 w-4" />}
                    title={t('create.rubric.title')}
                    subtitle={t('create.rubric.subtitle')}
                >
                    <div className="space-y-2">
                        <RubricTemplatePicker
                            value={rubricTemplateId}
                            onChange={next => { perfilAplicado.current = true; setRubricTemplateId(next); }}
                            rubrics={rubrics}
                            defaultRubric={defaultRubric}
                        />
                        <p className="text-[11px] text-muted-foreground italic">
                            {t('create.rubric.hint')}
                        </p>
                    </div>
                </Step>

                <Step
                    number={5}
                    icon={<Lightbulb className="h-4 w-4" />}
                    title={t('create.brief.title')}
                    subtitle={t('create.brief.subtitle')}
                >
                    <div className="space-y-2">
                        <AssignmentBriefPicker
                            currentBody={assignmentBrief}
                            onApply={(body) => {
                                setAssignmentBrief(body.slice(0, briefMaxChars));
                                setBriefUserTyped(true);
                            }}
                        />
                        <textarea
                            value={assignmentBrief}
                            onChange={(e) => {
                                setAssignmentBrief(e.target.value.slice(0, briefMaxChars));
                                setBriefUserTyped(true);
                            }}
                            placeholder={t('create.brief.placeholder')}
                            rows={6}
                            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-y"
                        />
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{t('create.brief.optional')}</span>
                            <span>{t('create.brief.characterCount', { count: briefCharCount, max: briefMaxChars })}</span>
                        </div>
                        <div className="rounded-md bg-success-subtle border border-success/30 px-3 py-2 flex items-start gap-2">
                            <Sparkles className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                            <p className="text-[11px] text-success-subtle-foreground leading-relaxed">
                                {t('create.brief.tip')}
                            </p>
                        </div>
                    </div>
                </Step>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                    <Button variant="ghost" onClick={() => navigate('/dashboard/exegesis')}>
                        {t('create.cancel')}
                    </Button>
                    <Button
                        disabled={!canCreate}
                        onClick={handleCreate}
                        className="bg-primary-solid hover:bg-primary-solid-hover text-primary-foreground"
                    >
                        {isCreating && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                        {t('create.submit')}
                    </Button>
                </div>

                {passageError && !passage && (
                    <p className="text-xs text-destructive -mt-3">
                        {passageError}
                    </p>
                )}
            </main>
        </div>
    );
}

interface StepProps {
    number: number;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    children: React.ReactNode;
}

function Step({ number, icon, title, subtitle, children }: StepProps) {
    return (
        <section className="rounded-2xl border border-border bg-card p-5">
            <header className="flex items-start gap-3 mb-4">
                <div className="shrink-0 w-8 h-8 rounded-full bg-success-subtle text-success-subtle-foreground flex items-center justify-center text-xs font-semibold">
                    {number}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{icon}</span>
                        <h2 className="text-base font-semibold text-foreground">
                            {title}
                        </h2>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                </div>
            </header>
            <div>
                {children}
            </div>
        </section>
    );
}

function LanguageOption({
    value,
    label,
    selected,
    onSelect,
}: {
    value: 'es' | 'en';
    label: string;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={[
                'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                selected
                    ? 'border-success bg-success-subtle text-success-subtle-foreground'
                    : 'border-border bg-card text-foreground hover:bg-accent',
            ].join(' ')}
            aria-pressed={selected}
        >
            <span className="text-[10px] uppercase tracking-wide opacity-70 mr-2">{value}</span>
            {label}
        </button>
    );
}

function StrategyOption({
    value,
    selected,
    onSelect,
    title,
    body,
    recommended = false,
}: {
    value: ExegeticalStrategy;
    selected: boolean;
    onSelect: () => void;
    title: string;
    body: string;
    recommended?: boolean;
}) {
    const { t } = useTranslation('exegesis');
    return (
        <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            data-strategy={value}
            className={[
                'text-left rounded-lg border-2 p-3 transition-colors space-y-1',
                selected
                    ? 'border-primary bg-primary/5 text-foreground shadow-sm'
                    : 'border-border bg-card text-foreground hover:border-foreground/30',
            ].join(' ')}
        >
            <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{title}</span>
                {recommended && (
                    <span className="text-[10px] uppercase tracking-wide font-medium rounded-full border border-success/40 bg-success-subtle text-success-subtle-foreground px-1.5 py-0">
                        {t('create.strategy.recommended')}
                    </span>
                )}
            </div>
            <p className="text-[12px] text-muted-foreground leading-snug">
                {body}
            </p>
        </button>
    );
}

