import type { DocumentData } from 'firebase/firestore';
import { expandVersions } from './stepVersionStorage';
import type {
    ExegeticalPaper,
    ExegeticalStep,
    ExegeticalStepVersion,
    ProjectSource,
    ProjectSourceExcerpt,
    SheetRange,
    SourceType,
} from '@dosfilos/domain';
import {
    EMPTY_STEP_SOURCE_PLAN,
    cleanAcquisitionMarks,
    cleanIgnoredGrammarCategories,
    cleanManualRequirements,
    cleanPaperInputMarks,
    cleanRequirementMarks,
    cleanSeriesPlacement,
    migrateLegacyRole,
    resolveExegeticalMethod,
    resolveExegeticalStrategy,
    resolvePaperProfileKind,
} from '@dosfilos/domain';

/**
 * Cómo se lee un trabajo de Firestore, sin el SDK de cliente: lo usan el
 * repositorio de la web y el servidor MCP (A9), que no puede cargar
 * `firebase/firestore` del navegador. Leer igual en los dos lados es lo que
 * garantiza que las herramientas vean el trabajo que ve el autor.
 */

export function deserialize(id: string, data: DocumentData): ExegeticalPaper {
    return {
        id,
        ownerId: data.ownerId,
        createdAt: data.createdAt?.toDate?.() ?? data.createdAt ?? new Date(),
        updatedAt: data.updatedAt?.toDate?.() ?? data.updatedAt ?? new Date(),
        passage: data.passage,
        displayLanguage: data.displayLanguage ?? 'es',
        // Pre-strategy papers default to 'free' so we don't suddenly
        // bug-banner about missing dialectical roles on existing work.
        // New papers always carry an explicit value.
        exegeticalStrategy: resolveExegeticalStrategy(data.exegeticalStrategy),
        exegeticalMethod: resolveExegeticalMethod(data.exegeticalMethod),
        profileKind: resolvePaperProfileKind(data.profileKind),
        inputMarks: cleanPaperInputMarks(data.inputMarks),
        requirementMarks: cleanRequirementMarks(data.requirementMarks),
        manualRequirements: cleanManualRequirements(data.manualRequirements),
        ignoredGrammarCategories: cleanIgnoredGrammarCategories(data.ignoredGrammarCategories),
        acquisitionMarks: cleanAcquisitionMarks(data.acquisitionMarks),
        title: data.title,
        assignmentBrief: data.assignmentBrief ?? null,
        thesis: deserializeThesis(data.thesis),
        sectionTitles: deserializeSectionTitles(data.sectionTitles),
        cover: data.cover ?? null,
        excludedSources: Array.isArray(data.excludedSources) ? data.excludedSources : null,
        styleGuideId: data.styleGuideId ?? null,
        // La copia de la guía. `capturedAt` viaja como Timestamp y hay
        // que devolverlo a Date: la interfaz lo muestra como fecha.
        // Ausente en los papers anteriores a la copia — ahí se resuelve
        // contra la guía viva.
        styleGuideSnapshot: data.styleGuideSnapshot
            ? {
                ...data.styleGuideSnapshot,
                capturedAt: data.styleGuideSnapshot.capturedAt?.toDate?.()
                    ?? data.styleGuideSnapshot.capturedAt
                    ?? new Date(),
            }
            : null,
        sources: Array.isArray(data.sources) ? data.sources.map(deserializeSource) : [],
        rubric: data.rubric ? deserializeRubric(data.rubric) : null,
        // Phase 2B paper-level field. Legacy papers don't carry it
        // (the helper falls back to rubric.structuralExpectations).
        // Read as-is so downstream code can detect `undefined` and
        // route through `getEffectiveStructuralExpectations`.
        structuralExpectations: Array.isArray(data.structuralExpectations)
            ? data.structuralExpectations
            : undefined,
        stepPlan: deserializeStepPlan(data.stepPlan),
        phase: data.phase ?? 'configuring',
        steps: Array.isArray(data.steps) ? data.steps.map(deserializeStep) : [],
        currentStepId: data.currentStepId ?? null,
        assembledMarkdown: data.assembledMarkdown ?? null,
        archivedAt: data.archivedAt?.toDate?.() ?? data.archivedAt ?? null,
        seriesId: typeof data.seriesId === 'string' ? data.seriesId : null,
        pericopeId: typeof data.pericopeId === 'string' ? data.pericopeId : null,
        // Solo si viene y es válido: los estudios anteriores al campo no lo tienen.
        ...withSeriesPlacement(data.seriesPlacement),
        projectId: typeof data.projectId === 'string' ? data.projectId : null,
        linkedProjectIds: Array.isArray(data.linkedProjectIds)
            ? data.linkedProjectIds.filter((x: unknown): x is string => typeof x === 'string')
            : [],
        projectWorkTypeId: typeof data.projectWorkTypeId === 'string' ? data.projectWorkTypeId : null,
    };
}

export function withSeriesPlacement(raw: unknown): Pick<ExegeticalPaper, 'seriesPlacement'> {
    const sp = cleanSeriesPlacement(raw);
    return sp ? { seriesPlacement: sp } : {};
}

/**
 * Source-level deserializer that handles the legacy `role` field. Pre-
 * redesign documents stored `role: ProjectSourceRole` (8 flat values);
 * the redesign uses `sourceType: SourceType` (13 granular values). Any
 * doc that still carries the old field is migrated transparently here.
 *
 * Once all in-flight test papers have been read at least once (and re-
 * saved by any subsequent mutation), the legacy field will disappear
 * and this shim becomes a no-op. Keep it indefinitely as a safety net.
 */
/**
 * Lee la receta del selector de páginas desde Firestore.
 *
 * Defensivo a propósito: los rangos vienen de un documento que puede haber
 * sido escrito por una versión anterior o quedar a medio migrar, y una receta
 * malformada no debe tumbar la lectura del paper entero — se descarta y la
 * fuente queda como si nunca se hubiera armado con el selector.
 */
export function deserializeRecipe(raw: any): ProjectSource['excerptRecipe'] {
    if (!raw || typeof raw !== 'object') return null;
    const ranges = (value: unknown): SheetRange[] =>
        Array.isArray(value)
            ? value
                .filter((r: any) => r && Number.isFinite(r.start) && Number.isFinite(r.end))
                .map((r: any) => ({ start: Number(r.start), end: Number(r.end) }))
            : [];
    const sheetRanges = ranges(raw.sheetRanges);
    if (sheetRanges.length === 0) return null;
    return {
        sheetRanges,
        proposedRanges: ranges(raw.proposedRanges),
        // Las recetas anteriores a los tramos fijados no traen el campo: sin
        // fijados, todo compite en el ranking, que es el comportamiento previo.
        pinnedRanges: ranges(raw.pinnedRanges),
        passageFingerprint: typeof raw.passageFingerprint === 'string' ? raw.passageFingerprint : '',
    };
}

export function deserializeSource(raw: any): ProjectSource {
    const sourceType: SourceType = raw.sourceType
        ? raw.sourceType
        : migrateLegacyRole(raw.role ?? 'misc');
    return {
        id: raw.id,
        paperId: raw.paperId,
        corpusId: raw.corpusId,
        sourceType,
        // Ausente en las fuentes anteriores al campo: sin elección del
        // pastor, `resolveSourceRole` vuelve a la sugerencia del tipo y
        // se clasifican igual que siempre.
        chosenRole: raw.chosenRole ?? null,
        displayLabel: raw.displayLabel ?? '',
        citationKey: raw.citationKey ?? null,
        order: typeof raw.order === 'number' ? raw.order : 0,
        // Las fuentes extraídas antes de la selección estructural no
        // declaran cómo se eligieron sus fragmentos: quedan en null y la UI
        // no afirma nada sobre ellas.
        excerptSelectionMode: raw.excerptSelectionMode ?? null,
        // La receta solo existe en fuentes armadas con el selector de páginas.
        excerptRecipe: deserializeRecipe(raw.excerptRecipe),
        // v1.5 fields with retro-compat defaults. Pre-v1.5 docs have
        // none of these — they should keep behaving as 'full-document'
        // sources with no excerpts and no library backref.
        mode: raw.mode === 'extracted-excerpts' ? 'extracted-excerpts' : 'full-document',
        excerpts: Array.isArray(raw.excerpts) ? raw.excerpts.map(deserializeExcerpt) : [],
        sourceLibraryResourceId: raw.sourceLibraryResourceId ?? null,
        // v1.5.1 stale-detection fields. Null on pre-v1.5.1 sources;
        // the UI treats null fingerprint as "not stale" so legacy
        // excerpts don't suddenly bug-banner the user.
        extractedAt: raw.extractedAt?.toDate?.() ?? raw.extractedAt ?? null,
        extractionFingerprint: typeof raw.extractionFingerprint === 'string' ? raw.extractionFingerprint : null,
        createdAt: raw.createdAt?.toDate?.() ?? raw.createdAt ?? new Date(),
    };
}

/**
 * One excerpt deserializer. Mirrors `deserializeSource` for the
 * timestamp coercion. `editedAt` is intentionally null (not undefined)
 * for never-edited excerpts so consumers can rely on `=== null` checks
 * without worrying about the `undefined` case.
 */
export function deserializeExcerpt(raw: any): ProjectSourceExcerpt {
    return {
        text: typeof raw?.text === 'string' ? raw.text : '',
        sourceLocation: typeof raw?.sourceLocation === 'string' ? raw.sourceLocation : '',
        relevanceScore: typeof raw?.relevanceScore === 'number' ? raw.relevanceScore : 0,
        userEdited: raw?.userEdited === true,
        editedAt: raw?.editedAt?.toDate?.() ?? raw?.editedAt ?? null,
        // Ausentes en todo extracto anterior al campo; ahí se sigue parseando
        // `sourceLocation`, que es lo que hace `relabelExcerptAnchor`.
        ...(typeof raw?.sheet === 'number' ? { sheet: raw.sheet } : {}),
        ...(typeof raw?.section === 'string' && raw.section ? { section: raw.section } : {}),
    };
}

/**
 * Deserializes a `PaperRubric` blob from Firestore. The structure is
 * preserved verbatim apart from the `Date` fields, which Firestore
 * serializes as Timestamps. Pre-redesign documents have no `rubric`
 * field; the caller skips this helper for those (passes `null` to the
 * `paper.rubric` slot).
 */
export function deserializeRubric(raw: any): ExegeticalPaper['rubric'] {
    if (!raw) return null;
    return {
        // Ausente antes del campo: `rubricPreset()` lo deduce del ancla.
        preset: raw.preset ?? null,
        provenance: raw.provenance ?? 'system-default',
        description: raw.description ?? null,
        expectedLength: raw.expectedLength ?? null,
        citationStandard: raw.citationStandard ?? null,
        sourceRequirements: Array.isArray(raw.sourceRequirements) ? raw.sourceRequirements : [],
        // Las rúbricas anteriores a la bibliografía del curso no la traen.
        courseBibliography: Array.isArray(raw.courseBibliography) ? raw.courseBibliography : [],
        structuralExpectations: Array.isArray(raw.structuralExpectations) ? raw.structuralExpectations : [],
        qualityCriteria: Array.isArray(raw.qualityCriteria) ? raw.qualityCriteria : [],
        // Ausente en las rúbricas anteriores al campo: `null` es «la guía de la casa».
        formatting: raw.formatting ?? null,
        sourceCorpusId: raw.sourceCorpusId ?? null,
        sourcePastedText: raw.sourcePastedText ?? null,
        sourceTemplateId: raw.sourceTemplateId ?? null,
        createdAt: raw.createdAt?.toDate?.() ?? raw.createdAt ?? new Date(),
        updatedAt: raw.updatedAt?.toDate?.() ?? raw.updatedAt ?? new Date(),
    };
}

/**
 * Deserializes a `StepSourcePlan`. Defaults to the empty plan when
 * the document predates the redesign — generation against the empty
 * plan is identical to "use rubric defaults for everything".
 */
export function deserializeStepPlan(raw: any): ExegeticalPaper['stepPlan'] {
    if (!raw) {
        return { ...EMPTY_STEP_SOURCE_PLAN, updatedAt: new Date() };
    }
    return {
        perStep: raw.perStep ?? {},
        defaults: {
            verse: raw.defaults?.verse ?? EMPTY_STEP_SOURCE_PLAN.defaults.verse,
            conclusion: raw.defaults?.conclusion ?? EMPTY_STEP_SOURCE_PLAN.defaults.conclusion,
            introduction: raw.defaults?.introduction ?? EMPTY_STEP_SOURCE_PLAN.defaults.introduction,
        },
        updatedAt: raw.updatedAt?.toDate?.() ?? raw.updatedAt ?? new Date(),
        // v1.7 corpus-usage planning. Without these the proposer's
        // save round-trips lose `proposedAt` → `hasProposal` stays
        // false → the planning table never renders after the user
        // clicks "Propose" (the bug surfaced in May 2026 testing).
        proposedAt: raw.proposedAt?.toDate?.() ?? raw.proposedAt ?? null,
        proposalCorpusSourceIds: Array.isArray(raw.proposalCorpusSourceIds)
            ? raw.proposalCorpusSourceIds.filter((id: unknown): id is string => typeof id === 'string')
            : undefined,
    };
}

/**
 * Normaliza las fechas de un paso.
 *
 * Los pasos se leían CRUDOS —`steps: data.steps`— y por eso `ExegeticalStep`
 * declaraba `createdAt: Date` mientras en ejecución llegaba un `Timestamp` de
 * Firestore. Nadie lo notó porque nadie tocaba esas fechas: el primer consumidor
 * real fue `isAbandonedGeneration`, que llamó `getTime()` —que `Timestamp` no
 * tiene— y quedó silenciosamente inerte. Es el mismo patrón del `author: string`
 * que en producción era null: el tipo decía una cosa y el dato decía otra.
 *
 * Se preserva el resto del paso con spread en vez de enumerar campos: un
 * whitelist acá borraría en silencio cualquier campo nuevo, que es exactamente
 * el fallo que `serializeSource` tuvo que resolver con tipos.
 */
export function toDateOrNull(value: unknown): Date | null {
    if (!value) return null;
    const asTimestamp = value as { toDate?: () => Date };
    if (typeof asTimestamp.toDate === 'function') return asTimestamp.toDate();
    return value instanceof Date ? value : new Date(value as string | number);
}

/**
 * El texto en lengua original se llamó `greekText` hasta que el módulo empezó a
 * analizar el AT, y para entonces guardaba hebreo bajo un nombre que decía
 * griego. Todo análisis escrito antes del rename sigue en Firestore con el
 * nombre viejo, y son trabajos reales en curso: leerlos con el nombre nuevo los
 * dejaría sin texto base, en silencio y sin error.
 *
 * Se traduce al leer, y se borra el nombre viejo del objeto para que no vuelva
 * a escribirse: si sobreviviera al `...raw`, cada guardado posterior dejaría los
 * dos campos y no habría forma de saber cuál manda.
 */
export function normalizeAnalysisTextField(analysis: any): any {
    if (!analysis || typeof analysis !== 'object') return analysis;
    if (!('greekText' in analysis)) return analysis;
    const { greekText, ...resto } = analysis;
    return { ...resto, originalText: resto.originalText ?? greekText ?? '' };
}

export function deserializeStepVersion(raw: any): ExegeticalStepVersion {
    return {
        ...raw,
        canonicalAnalysis: normalizeAnalysisTextField(raw?.canonicalAnalysis),
        createdAt: toDateOrNull(raw?.createdAt) ?? new Date(),
        verifications: raw?.verifications
            ? { ...raw.verifications, lastRunAt: toDateOrNull(raw.verifications.lastRunAt) }
            : raw?.verifications ?? undefined,
        ...(Array.isArray(raw?.citationCorrections)
            ? {
                citationCorrections: raw.citationCorrections.map((c: any) => ({
                    ...c,
                    correctedAt: toDateOrNull(c?.correctedAt) ?? new Date(),
                })),
            }
            : {}),
        ...(Array.isArray(raw?.citationReviews)
            ? {
                citationReviews: raw.citationReviews.map((r: any) => ({
                    path: String(r?.path ?? ''),
                    note: String(r?.note ?? ''),
                    reviewedAt: toDateOrNull(r?.reviewedAt) ?? new Date(),
                })),
            }
            : {}),
        ...(raw?.previousProse
            ? {
                previousProse: {
                    ...raw.previousProse,
                    ...(raw.previousProse.undoneAt ? { undoneAt: toDateOrNull(raw.previousProse.undoneAt) ?? new Date() } : {}),
                    ...(Array.isArray(raw.previousProse.citationReviews)
                        ? {
                            citationReviews: raw.previousProse.citationReviews.map((r: any) => ({
                                path: String(r?.path ?? ''),
                                note: String(r?.note ?? ''),
                                reviewedAt: toDateOrNull(r?.reviewedAt) ?? new Date(),
                            })),
                        }
                        : {}),
                },
            }
            : {}),
    };
}

export function deserializeStep(raw: any): ExegeticalStep {
    const versions: ExegeticalStepVersion[] = Array.isArray(raw?.versions)
        ? expandVersions(raw.versions).map(deserializeStepVersion)
        : [];
    const porId = new Map(versions.map(v => [v.id, v]));

    /**
     * `current` y `accepted` se guardan como IDENTIFICADOR y se resuelven acá.
     *
     * Se guardaban como copias enteras de la versión, análisis canónico
     * incluido, de modo que cada versión podía quedar almacenada tres veces.
     * Medido sobre los 42 trabajos en producción: de 8.595 KB, 4.145 eran esa
     * duplicación —casi la mitad—, y el trabajo más grande estaba a 91% del
     * límite de 1 MB por documento de Firestore.
     *
     * Resolver al LEER es lo que hace el cambio barato: todo el código que
     * hace `step.accepted.markdown` sigue recibiendo el objeto y no se entera.
     *
     * El segundo argumento es la forma vieja. Un documento guardado antes de
     * este cambio trae el objeto y no el identificador, y se sigue leyendo sin
     * migrar nada; también cubre el caso de una versión referenciada que no
     * esté en `versions[]`, donde perder la referencia sería perder el texto.
     */
    const resolver = (
        id: unknown,
        legado: unknown,
    ): ExegeticalStepVersion | null => {
        if (typeof id === 'string') {
            const hallada = porId.get(id);
            if (hallada) return hallada;
        }
        return legado ? deserializeStepVersion(legado) : null;
    };

    return {
        ...raw,
        createdAt: toDateOrNull(raw?.createdAt) ?? new Date(),
        updatedAt: toDateOrNull(raw?.updatedAt) ?? new Date(),
        current: resolver(raw?.currentId, raw?.current),
        accepted: resolver(raw?.acceptedId, raw?.accepted),
        versions,
    };
}

/** La tesis: las fechas viajan como Timestamp. Sin texto, no hay tesis. */
export function deserializeThesis(raw: any): ExegeticalPaper['thesis'] {
    if (!raw || typeof raw.text !== 'string' || !raw.text.trim()) return null;
    return {
        text: raw.text,
        origin: raw.origin === 'proposed' || raw.origin === 'edited' ? raw.origin : 'student',
        approvedAt: toDateOrNull(raw.approvedAt),
        updatedAt: toDateOrNull(raw.updatedAt) ?? new Date(),
    };
}

/** Los títulos temáticos: solo textos no vacíos, por id del paso. */
export function deserializeSectionTitles(raw: any): Record<string, string> | null {
    if (!raw || typeof raw !== 'object') return null;
    const out = Object.fromEntries(
        Object.entries(raw).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [k, (v as string).trim()]),
    );
    return Object.keys(out).length > 0 ? out : null;
}
