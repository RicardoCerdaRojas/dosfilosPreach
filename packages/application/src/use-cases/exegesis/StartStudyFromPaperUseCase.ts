import {
    SermonEntity,
    SermonSeriesEntity,
    formatPassageReference,
    paperHasStudyMaterial,
    type IExegeticalPaperRepository,
    type ISermonRepository,
    type ISeriesRepository,
} from '@dosfilos/domain';

/**
 * Lleva un paper exegético al estudio pastoral de 8 pasos.
 *
 * Reemplaza a `GenerateSermonFromPaperUseCase`, que hacía lo contrario:
 * pasaba el paper ensamblado por un modelo, escribía un borrador de
 * sermón completo y dejaba al pastor en el Paso 3 (Redacción) con la
 * exégesis y la homilética sintetizadas por el asistente.
 *
 * Tres razones para invertir la dirección:
 *
 *   1. **Violaba los principios que el producto defiende.** P1 (labor
 *      antes que output) y P2 (el asistente desarrolla, no origina).
 *      La `04-kill-list.md` ya condenaba exactamente esto por la puerta
 *      del wizard; era la misma violación por la puerta del paper.
 *
 *   2. **No funcionaba.** Con `pastoral_fidelity_flow` encendido —hoy,
 *      los 13 usuarios— el portón del wizard rebota cualquier intento
 *      de entrar a Homilética o Redacción sin la semilla completa. El
 *      botón cobraba el modelo, prometía "un sermón listo para
 *      predicar" y depositaba al pastor contra un muro. Medido en
 *      producción: 9 sermones nacidos de un paper, 1 solo llegó a
 *      tener estudio, y 3 se publicaron sin ninguno.
 *
 *   3. **Tiraba el trabajo bueno.** Lo valioso del paper no es su
 *      prosa terminada —eso ya lo entrega el composer ministerial, que
 *      devuelve markdown y no persiste sermón— sino sus análisis
 *      canónicos aceptados: léxico, sintaxis, trasfondo, comentaristas.
 *      Eso es exactamente la materia prima de los 8 pasos.
 *
 * Lo que hace este caso de uso, entonces:
 *   - NO contacta ningún modelo. No reserva créditos. Es instantáneo.
 *   - NO escribe `content` ni `wizardProgress.draft`. El pastor no
 *     recibe texto que no escribió.
 *   - Deja el sermón apuntando al Paso 1 con `derivedContext.kind =
 *     'paper'`, que es lo que hace que el wizard cargue el material del
 *     paper como consulta al lado de cada paso
 *     (`buildPaperStudyReference`).
 *   - La semilla NO se crea acá: `PastoralSeedService.ensureForSermon`
 *     la mintea, idempotente, cuando el pastor entra al Paso 1. Crearla
 *     por adelantado dejaría semillas vacías de pastores que nunca
 *     abrieron el estudio, y ensuciaría la métrica de abandono.
 */
export interface StartStudyFromPaperInput {
    paperId: string;
    actorUserId: string;
    /**
     * Sermón existente a vincular en vez de crear uno nuevo. Lo usa la
     * recuperación de marcadores vacíos del wizard: sermones que
     * `autoCreateSermonPlaceholders` insertó con `sourcePaperId` y sin
     * contenido. Se verifica que pertenezca al actor.
     */
    targetSermonId?: string;
}

export interface StartStudyFromPaperOutput {
    sermonId: string;
    /** False cuando el paper no tiene análisis aceptados que ofrecer. */
    hasStudyMaterial: boolean;
}

export class StartStudyFromPaperUseCase {
    constructor(
        private paperRepository: IExegeticalPaperRepository,
        private sermonRepository: ISermonRepository,
        // Opcional por la misma razón que en el caso de uso anterior:
        // los consumidores que no cuidan la coherencia del planificador
        // (tests, por ejemplo) no deberían tener que inyectar series.
        private seriesRepository?: ISeriesRepository,
    ) {}

    async execute(input: StartStudyFromPaperInput): Promise<StartStudyFromPaperOutput> {
        const paper = await this.paperRepository.getPaper(input.actorUserId, input.paperId);
        if (!paper) {
            throw new Error('Paper no encontrado o sin permiso');
        }

        const passageLabel = formatPassageReference(paper.passage, paper.displayLanguage);
        // A diferencia del caso de uso retirado, NO se exige `phase ===
        // 'assembled'`. Aquel necesitaba el paper terminado porque
        // redactaba desde `assembledMarkdown`. Este lee los análisis
        // aceptados verso a verso, que existen mucho antes del ensamble
        // — y el estudio pastoral gana más si el pastor puede empezarlo
        // mientras el paper todavía avanza. Un paper sin nada aceptado
        // igual sirve para abrir el estudio con el pasaje; lo dice el
        // flag y la UI lo muestra.
        const hasStudyMaterial = paperHasStudyMaterial(paper);

        const sermon = await this.linkSermon({
            paper,
            passageLabel,
            targetSermonId: input.targetSermonId,
            actorUserId: input.actorUserId,
        });

        if (!input.targetSermonId) {
            await this.patchSeriesPlannedSermon(paper.seriesId, paper.pericopeId, sermon.id);
        }

        return { sermonId: sermon.id, hasStudyMaterial };
    }

    /**
     * Crea el sermón o vincula uno existente. En ambos casos el
     * `wizardProgress` queda con lo mínimo verdadero: el pasaje, el
     * origen, y el Paso 1. Sin exégesis, sin homilética, sin borrador
     * — esos tres los produce el pastor, en ese orden.
     */
    private async linkSermon(args: {
        paper: { id: string; ownerId: string; title?: string; seriesId?: string | null };
        passageLabel: string;
        targetSermonId: string | undefined;
        actorUserId: string;
    }): Promise<SermonEntity> {
        const wizardProgress = {
            currentStep: 1,
            passage: args.passageLabel,
            lastSaved: new Date(),
            derivedContext: {
                kind: 'paper' as const,
                paperId: args.paper.id,
                paperTitle: args.paper.title ?? args.passageLabel,
                generatedAt: new Date(),
            },
        };

        if (args.targetSermonId) {
            const existing = await this.sermonRepository.findById(args.targetSermonId);
            if (!existing) {
                throw new Error(`Sermón objetivo no encontrado: ${args.targetSermonId}`);
            }
            if (existing.userId !== args.actorUserId) {
                throw new Error('Sermón objetivo no pertenece al actor');
            }
            const updated = existing.update({ wizardProgress });
            return this.sermonRepository.update(updated);
        }

        // Sin objetivo explícito, se retoma el borrador que este paper ya abrió.
        //
        // Antes se creaba uno nuevo en cada llamada, y la pantalla no pasa
        // `targetSermonId`: cada clic del botón dejaba otro borrador vacío. En
        // la cuenta real hay CINCO «Sermón sobre Jonas 1:1-3», todos parados en
        // el paso 1, y tres del pasaje siguiente. El pastor creía estar
        // volviendo a su estudio y empezaba otro.
        //
        // Sólo se retoma un BORRADOR. Un sermón ya publicado no se reabre por
        // un clic —predicarlo de nuevo es empezar de cero, no seguir editando—
        // y entre varios borradores gana el último tocado, que es donde estaba
        // trabajando.
        const suyos = await this.sermonRepository.findBySourcePaperId(
            args.paper.ownerId, args.paper.id,
        );
        const retomable = suyos
            .filter(s => s.status === 'draft' || s.status === 'working')
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
        if (retomable) {
            // El paso en el que iba NO se pisa: reabrir en el 1 a quien iba en
            // el 5 le borraría el rastro de dónde estaba.
            const conservandoElPaso = {
                ...wizardProgress,
                currentStep: retomable.wizardProgress?.currentStep ?? 1,
            };
            return this.sermonRepository.update(retomable.update({ wizardProgress: conservandoElPaso }));
        }

        const sermon = SermonEntity.create({
            userId: args.paper.ownerId,
            title: args.paper.title ?? args.passageLabel,
            // Vacío A PROPÓSITO. Acá el caso de uso anterior escribía el
            // sermón que el modelo había redactado. El cuerpo lo llena
            // el pastor al llegar al Paso 3, después del estudio.
            content: '',
            bibleReferences: [args.passageLabel],
            sourcePaperId: args.paper.id,
            seriesId: args.paper.seriesId ?? undefined,
            status: 'draft',
            wizardProgress,
        });
        await this.sermonRepository.create(sermon);
        return sermon;
    }

    /**
     * Coherencia con el planificador de series: el sermón recién
     * vinculado ocupa el lugar de la perícopa, así que el planner deja
     * de ofrecer "Iniciar borrador" para ella.
     *
     * Best-effort, igual que antes: si el repo de series falla, el
     * sermón ya está guardado y es la fuente de verdad. Se registra
     * para poder reconciliar la deriva fuera de banda.
     */
    private async patchSeriesPlannedSermon(
        seriesId: string | null | undefined,
        pericopeId: string | null | undefined,
        sermonId: string,
    ): Promise<void> {
        if (!this.seriesRepository || !seriesId || !pericopeId) return;
        try {
            const series = await this.seriesRepository.findById(seriesId);
            if (!series) return;
            const plannedSermons = series.metadata?.plannedSermons ?? [];
            const idx = plannedSermons.findIndex(p => p.id === pericopeId);
            if (idx === -1) return;
            const target = plannedSermons[idx];
            if (!target) return;
            // No pisar un `draftId` existente: el pastor puede haber
            // arrancado un borrador manual para la misma perícopa antes
            // de traer el paper. Queda pinchado el primero.
            if (target.draftId) return;
            const updatedPlanned = plannedSermons.map((p, i) =>
                i === idx
                    ? { ...p, draftId: sermonId, status: 'sermon-in-progress' as const }
                    : p,
            );
            const next = SermonSeriesEntity.create({
                id: series.id,
                userId: series.userId,
                title: series.title,
                description: series.description,
                sermonIds: series.sermonIds,
                draftIds: [...(series.draftIds ?? []), sermonId],
                type: series.type,
                resourceIds: series.resourceIds,
                startDate: series.startDate,
                coverUrl: series.coverUrl,
                endDate: series.endDate,
                metadata: { ...series.metadata, plannedSermons: updatedPlanned },
            });
            await this.seriesRepository.update(next);
        } catch (err) {
            console.error(
                `[StartStudyFromPaperUseCase] series patch failed for series=${seriesId} pericope=${pericopeId}:`,
                err,
            );
        }
    }
}
