export { CreateExegeticalPaperUseCase } from './CreateExegeticalPaperUseCase';
export { ListExegeticalPapersUseCase } from './ListExegeticalPapersUseCase';
export { ListExegesisPaperSummariesUseCase } from './ListExegesisPaperSummariesUseCase';
export { GetExegeticalPaperUseCase } from './GetExegeticalPaperUseCase';
export { ArchiveExegeticalPaperUseCase } from './ArchiveExegeticalPaperUseCase';
export { UpdatePaperBriefUseCase } from './UpdatePaperBriefUseCase';
export { UpdatePaperCoverUseCase, normalizeCover } from './UpdatePaperCoverUseCase';
export type { UpdatePaperCoverInput } from './UpdatePaperCoverUseCase';
export { SaveAssembledPaperUseCase } from './SaveAssembledPaperUseCase';
export { UpdateStepPlanUseCase } from './UpdateStepPlanUseCase';
export { UpdateRubricUseCase } from './UpdateRubricUseCase';
export { ResetRubricUseCase } from './ResetRubricUseCase';
export { ExtractRubricFromTextUseCase } from './ExtractRubricFromTextUseCase';
export { ExtractRubricFromDocumentUseCase } from './ExtractRubricFromDocumentUseCase';
export { ExtractRubricFromImageUseCase } from './ExtractRubricFromImageUseCase';
export { ExtractRubricPreviewFromImageUseCase } from './ExtractRubricPreviewFromImageUseCase';
export { ExtractStyleGuideManifestUseCase } from './ExtractStyleGuideManifestUseCase';

// User-level rubric templates
export { ListUserRubricsUseCase } from './ListUserRubricsUseCase';
export { CreateUserRubricUseCase } from './CreateUserRubricUseCase';
export { UpdateUserRubricUseCase } from './UpdateUserRubricUseCase';
export { DeleteUserRubricUseCase } from './DeleteUserRubricUseCase';
export { SetDefaultUserRubricUseCase } from './SetDefaultUserRubricUseCase';
export { ApplyRubricTemplateToPaperUseCase } from './ApplyRubricTemplateToPaperUseCase';
export { ApplyStrategyOnlyRubricToPaperUseCase } from './ApplyStrategyOnlyRubricToPaperUseCase';
export { SaveCurrentRubricAsTemplateUseCase } from './SaveCurrentRubricAsTemplateUseCase';
export { CreateUserRubricFromTextUseCase } from './CreateUserRubricFromTextUseCase';

// User-level assignment-brief templates
export {
    ListUserAssignmentBriefsUseCase,
    CreateUserAssignmentBriefUseCase,
    UpdateUserAssignmentBriefUseCase,
    DeleteUserAssignmentBriefUseCase,
    SetDefaultUserAssignmentBriefUseCase,
    type CreateUserAssignmentBriefInput,
    type UpdateUserAssignmentBriefInput,
    type DeleteUserAssignmentBriefInput,
    type SetDefaultUserAssignmentBriefInput,
} from './UserAssignmentBriefUseCases';

// User style guides
export { ListUserStyleGuidesUseCase } from './ListUserStyleGuidesUseCase';
export { GetActiveStyleGuideUseCase } from './GetActiveStyleGuideUseCase';
export { CreateUserStyleGuideUseCase } from './CreateUserStyleGuideUseCase';
export { SetActiveStyleGuideUseCase } from './SetActiveStyleGuideUseCase';
export { UpdateUserStyleGuideUseCase } from './UpdateUserStyleGuideUseCase';
export {
    UpdateUserStyleGuideManifestUseCase,
    StyleGuideValidationError,
    type UpdateUserStyleGuideManifestInput,
} from './UpdateUserStyleGuideManifestUseCase';
export { DeleteUserStyleGuideUseCase } from './DeleteUserStyleGuideUseCase';

// Project sources
export { AddProjectSourceUseCase } from './AddProjectSourceUseCase';
export { InheritCorpusFromSeriesUseCase } from './InheritCorpusFromSeriesUseCase';
export { UpdateProjectSourceUseCase } from './UpdateProjectSourceUseCase';
export { RemoveProjectSourceUseCase } from './RemoveProjectSourceUseCase';
export {
    ExtractExcerptsForPaperUseCase,
    type ExtractExcerptsForPaperInput,
    type ExtractExcerptsForPaperOutput,
    type ExtractExcerptsSelection,
} from './ExtractExcerptsForPaperUseCase';
// Reabrir un paso aceptado para rehacerlo, sin perder el historial.
export { ReopenStepUseCase } from './ReopenStepUseCase';
// Selector de páginas: hojas elegidas a mano → fragmentos, con la receta.
export {
    SelectSourcePagesUseCase,
    PaperCorpusTooLargeError,
    type SelectSourcePagesInput,
    type SelectSourcePagesResult,
} from './SelectSourcePagesUseCase';
export {
    ProposeStepCorpusAllocationsUseCase,
    type ProposeStepCorpusAllocationsInput,
    type ProposeStepCorpusAllocationsOutput,
} from './ProposeStepCorpusAllocationsUseCase';
export {
    UpdateStepCorpusAllocationUseCase,
    type UpdateStepCorpusAllocationInput,
} from './UpdateStepCorpusAllocationUseCase';
export {
    RankLibraryResourcesForPaperUseCase,
    type RankLibraryResourcesForPaperInput,
    type RankLibraryResourcesForPaperOutput,
} from './RankLibraryResourcesForPaperUseCase';

// Steps (D.1: state machine + placeholder generation; Gemini lands in D.2)
export { SeedStepsForPassageUseCase } from './SeedStepsForPassageUseCase';
export { GenerateStepUseCase } from './GenerateStepUseCase';
export {
    AnalyzeVerseCanonicallyUseCase,
    type AnalyzeVerseCanonicallyUseCaseInput,
} from './AnalyzeVerseCanonicallyUseCase';
export {
    ComposeAcademicPaperUseCase,
    ComposeAcademicPaperPersistError,
    type ComposeAcademicPaperUseCaseInput,
} from './ComposeAcademicPaperUseCase';
export {
    ComposeConclusionFromAnalysesUseCase,
    type ComposeConclusionFromAnalysesUseCaseInput,
} from './ComposeConclusionFromAnalysesUseCase';
export {
    ComposeIntroductionFromAnalysesUseCase,
    type ComposeIntroductionFromAnalysesUseCaseInput,
} from './ComposeIntroductionFromAnalysesUseCase';
export {
    ComposeVerseAcademicProseUseCase,
    type ComposeVerseAcademicProseInput,
    type ComposeVerseAcademicProseOutput,
} from './ComposeVerseAcademicProseUseCase';
export {
    ComposeSermonFromAnalysesUseCase,
    ComposeDevotionalFromAnalysesUseCase,
    ComposeStudyGuideFromAnalysesUseCase,
    type ComposeSermonFromAnalysesUseCaseInput,
    type ComposeDevotionalFromAnalysesUseCaseInput,
    type ComposeStudyGuideFromAnalysesUseCaseInput,
} from './MinistryComposerUseCases';
export { AcceptStepUseCase } from './AcceptStepUseCase';
export { SaveStepEditUseCase } from './SaveStepEditUseCase';
export {
    VerifyStepCitationsUseCase,
    type VerifyStepCitationsInput,
    type VerifyStepCitationsOutput,
} from './VerifyStepCitationsUseCase';
export {
    RunCoherencePassUseCase,
    type RunCoherencePassInput,
    type RunCoherencePassOutput,
} from './RunCoherencePassUseCase';
export {
    ClassifySourceTypeUseCase,
    type ClassifySourceTypeInput,
    type ClassifySourceTypeUseCaseOutput,
} from './ClassifySourceTypeUseCase';

// Puente: paper → estudio pastoral de 8 pasos. El paper alimenta el
// estudio; no lo saltea (reemplaza a `GenerateSermonFromPaperUseCase`).
export {
    StartStudyFromPaperUseCase,
    type StartStudyFromPaperInput,
    type StartStudyFromPaperOutput,
} from './StartStudyFromPaperUseCase';
export {
    SaveExegesisArtifactExtractionUseCase,
    type SaveExegesisArtifactExtractionInput,
    type ExegesisArtifactType,
} from './SaveExegesisArtifactExtractionUseCase';
export {
    ListPaperDerivedArtifactsUseCase,
    type ListPaperDerivedArtifactsInput,
    type DerivedArtifact,
    type DerivedArtifactKind,
} from './ListPaperDerivedArtifactsUseCase';
export {
    VerifySermonCitationsUseCase,
    type VerifySermonCitationsInput,
    type VerifySermonCitationsOutput,
    type VerifiedSermonCitation,
    type SermonCitationStatus,
} from './VerifySermonCitationsUseCase';
export {
    parseSermonCitations,
    type ParsedSermonCitation,
} from './sermonCitationParser';

// Pericope assistant (Phase 3 of the sermon-series pipeline)
export {
    DetectPericopesUseCase,
    type DetectPericopesInput,
} from './DetectPericopesUseCase';

// Expository assistant pipeline (v1.5)
export { loadBookVerses, type LoadBookVersesInput, type LoadBookVersesResult } from './expository/loadBookVerses';
export {
    RunExpositoryPassesUseCase,
    type PanoramaCallInput,
    type MacroCallInput,
    type MicroCallInput,
    type PreachableCallInput,
    type FidelityCallInput,
} from './expository/RunExpositoryPassesUseCase';
export * from './SetPaperStyleGuideUseCase';
export { ReviewCitationUseCase } from './ReviewCitationUseCase';
export { CorrectCitationUseCase } from './CorrectCitationUseCase';
export type { CorrectCitationInput, CorrectCitationOutput } from './CorrectCitationUseCase';
export type { ReviewCitationInput } from './ReviewCitationUseCase';
