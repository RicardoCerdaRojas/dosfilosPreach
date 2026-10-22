import {
    FirestoreAIAgentRepository,
    FirestoreAIChatRepository,
    FirestoreAIProjectRepository,
    FirestoreExtractionRepository,
    FirestoreExegeticalPaperRepository,
    FirebaseSeriesRepository,
    FirebaseSermonRepository,
    SseMultiAgentService,
} from '@dosfilos/infrastructure';

// Use Cases
import {
    CreateChatSessionUseCase,
    GetChatHistoryUseCase,
    GetSessionSummariesUseCase,
    SendAgentMessageUseCase,
    OrchestratedMessageUseCase,
    ExtractTheologicalContentUseCase,
    GetFacultyAgentsUseCase,
    GetSessionUseCase,
    // Projects
    CreateProjectUseCase,
    UpdateProjectUseCase,
    DeleteProjectUseCase,
    SetProjectArchivedUseCase,
    SetProjectDeletedUseCase,
    DeleteChatSessionUseCase,
    GenerateProjectContextUseCase,
    GetUserProjectsUseCase,
    UpdateSessionProjectUseCase,
    RenameChatSessionUseCase,
    DeleteChatMessageUseCase,
    ProcessMicroActionUseCase,
    ListProjectOutputsUseCase,
    CreateProjectOutputUseCase,
    UpdateProjectOutputUseCase,
    DeleteProjectOutputUseCase,
    // Extractions
    GenerateAndSaveExtractionUseCase,
    ListSessionExtractionsUseCase,
    ListProjectExtractionsUseCase,
    ListUserExtractionsUseCase,
    ListUserExtractionSummariesUseCase,
    GetExtractionUseCase,
    UpdateExtractionMarkdownUseCase,
    RenameExtractionUseCase,
    DeleteExtractionUseCase,
    AddExtractionToProjectUseCase,
    RemoveExtractionFromProjectUseCase,
    SaveSermonExtractionUseCase,
    CreateEstudioMadreExtractionUseCase,
    OrphanExtractionsBySermonUseCase,
    BuildSermonFromFacultyOutlineUseCase,
} from '../use-cases/faculty';

class FacultyService {
    public createSession: CreateChatSessionUseCase;
    public getHistory: GetChatHistoryUseCase;
    public getSessionSummaries: GetSessionSummariesUseCase;
    public getSession: GetSessionUseCase;
    public sendMessage: SendAgentMessageUseCase;
    public orchestratedMessage: OrchestratedMessageUseCase;
    public extractContent: ExtractTheologicalContentUseCase;
    public processMicroAction: ProcessMicroActionUseCase;
    public getAgents: GetFacultyAgentsUseCase;
    // Projects
    public getProjects: GetUserProjectsUseCase;
    public createProject: CreateProjectUseCase;
    public updateProject: UpdateProjectUseCase;
    public deleteProject: DeleteProjectUseCase;
    public setProjectArchived: SetProjectArchivedUseCase;
    public setProjectDeleted: SetProjectDeletedUseCase;
    public deleteSession: DeleteChatSessionUseCase;
    public deleteMessage: DeleteChatMessageUseCase;
    public renameSession: RenameChatSessionUseCase;
    public generateProjectContext: GenerateProjectContextUseCase;
    public updateSessionProject: UpdateSessionProjectUseCase;
    // Project outputs
    public listOutputs: ListProjectOutputsUseCase;
    public createOutput: CreateProjectOutputUseCase;
    public updateOutput: UpdateProjectOutputUseCase;
    public deleteOutput: DeleteProjectOutputUseCase;
    // Persisted extractions
    public generateAndSaveExtraction: GenerateAndSaveExtractionUseCase;
    public listSessionExtractions: ListSessionExtractionsUseCase;
    public listProjectExtractions: ListProjectExtractionsUseCase;
    public listUserExtractions: ListUserExtractionsUseCase;
    public listUserExtractionSummaries: ListUserExtractionSummariesUseCase;
    public getExtraction: GetExtractionUseCase;
    public updateExtractionMarkdown: UpdateExtractionMarkdownUseCase;
    public renameExtraction: RenameExtractionUseCase;
    public deleteExtraction: DeleteExtractionUseCase;
    public addExtractionToProject: AddExtractionToProjectUseCase;
    public removeExtractionFromProject: RemoveExtractionFromProjectUseCase;
    public saveSermonExtraction: SaveSermonExtractionUseCase;
    public crearEstudioMadre: CreateEstudioMadreExtractionUseCase;
    public orphanExtractionsBySermon: OrphanExtractionsBySermonUseCase;
    // Faculty → Wizard convergence: produces a Sermon with
    // wizardProgress pre-populated from a Faculty outline + optional
    // pastoral personalization, replacing the legacy Faculty editor
    // landing surface with the sermon wizard at Step 3.
    public buildSermonFromFacultyOutline: BuildSermonFromFacultyOutlineUseCase;

    constructor() {
        const modelId = (import.meta as any).env?.VITE_GEMINI_MODEL_ID || 'gemini-2.5-flash';
        const visionModelId = (import.meta as any).env?.VITE_GEMINI_VISION_MODEL_ID || 'gemini-2.5-pro';
        // El chat dejó de hablar con Gemini desde el navegador: ahora pasa por el
        // endpoint SSE del servidor, que autentica, limita por usuario y mide el
        // gasto. La clave ya no vive en el bundle.
        const streamEndpoint =
            (import.meta as any).env?.VITE_FACULTY_STREAM_URL ||
            'https://us-central1-dosfilosapp.cloudfunctions.net/facultyChatStream';

        const agentRepository = new FirestoreAIAgentRepository();
        const chatRepository = new FirestoreAIChatRepository();
        const projectRepository = new FirestoreAIProjectRepository();
        const extractionRepository = new FirestoreExtractionRepository();
        // Phase 4 enrichment refs — wired here so chat sessions
        // launched from a paper / series / pericope can show the
        // model the right anchor without the UI having to thread it.
        const paperRepository = new FirestoreExegeticalPaperRepository();
        const seriesRepository = new FirebaseSeriesRepository();
        const generatorService = new SseMultiAgentService(streamEndpoint, modelId, visionModelId);

        this.createSession = new CreateChatSessionUseCase(agentRepository, chatRepository);
        this.getHistory = new GetChatHistoryUseCase(chatRepository);
        this.getSessionSummaries = new GetSessionSummariesUseCase(chatRepository);
        this.getSession = new GetSessionUseCase(chatRepository);
        this.sendMessage = new SendAgentMessageUseCase(agentRepository, chatRepository, generatorService);
        this.orchestratedMessage = new OrchestratedMessageUseCase(
            agentRepository,
            chatRepository,
            generatorService,
            projectRepository,
            paperRepository,
            seriesRepository,
        );
        this.extractContent = new ExtractTheologicalContentUseCase(chatRepository, generatorService, projectRepository);
        this.generateAndSaveExtraction = new GenerateAndSaveExtractionUseCase(
            this.extractContent,
            chatRepository,
            extractionRepository,
        );
        this.listSessionExtractions = new ListSessionExtractionsUseCase(extractionRepository);
        this.listProjectExtractions = new ListProjectExtractionsUseCase(extractionRepository);
        this.listUserExtractions = new ListUserExtractionsUseCase(extractionRepository);
        this.listUserExtractionSummaries = new ListUserExtractionSummariesUseCase(extractionRepository);
        this.getExtraction = new GetExtractionUseCase(extractionRepository);
        this.updateExtractionMarkdown = new UpdateExtractionMarkdownUseCase(extractionRepository);
        this.renameExtraction = new RenameExtractionUseCase(extractionRepository);
        this.deleteExtraction = new DeleteExtractionUseCase(extractionRepository);
        this.addExtractionToProject = new AddExtractionToProjectUseCase(extractionRepository);
        this.removeExtractionFromProject = new RemoveExtractionFromProjectUseCase(extractionRepository);
        this.saveSermonExtraction = new SaveSermonExtractionUseCase(extractionRepository);
        this.crearEstudioMadre = new CreateEstudioMadreExtractionUseCase(extractionRepository);
        this.orphanExtractionsBySermon = new OrphanExtractionsBySermonUseCase(extractionRepository);
        // Sermon repo is wired here so Faculty can persist full Sermon
        // docs with wizardProgress. Same singleton FirebaseSermonRepository
        // used elsewhere — sermons are global per user, not faculty-scoped.
        const sermonRepository = new FirebaseSermonRepository();
        this.buildSermonFromFacultyOutline = new BuildSermonFromFacultyOutlineUseCase(
            this.extractContent,
            sermonRepository,
            this.saveSermonExtraction,
            extractionRepository,
        );
        this.processMicroAction = new ProcessMicroActionUseCase(chatRepository, generatorService);
        this.getAgents = new GetFacultyAgentsUseCase(agentRepository);
        // Projects
        this.getProjects = new GetUserProjectsUseCase(projectRepository);
        this.createProject = new CreateProjectUseCase(projectRepository);
        this.updateProject = new UpdateProjectUseCase(projectRepository);
        this.deleteProject = new DeleteProjectUseCase(projectRepository, chatRepository, extractionRepository, paperRepository);
        this.setProjectArchived = new SetProjectArchivedUseCase(projectRepository);
        this.setProjectDeleted = new SetProjectDeletedUseCase(projectRepository);
        this.deleteSession = new DeleteChatSessionUseCase(chatRepository, extractionRepository);
        this.deleteMessage = new DeleteChatMessageUseCase(chatRepository);
        this.renameSession = new RenameChatSessionUseCase(chatRepository);
        this.generateProjectContext = new GenerateProjectContextUseCase(chatRepository, projectRepository, generatorService);
        this.updateSessionProject = new UpdateSessionProjectUseCase(chatRepository);
        this.listOutputs = new ListProjectOutputsUseCase(projectRepository);
        this.createOutput = new CreateProjectOutputUseCase(projectRepository);
        this.updateOutput = new UpdateProjectOutputUseCase(projectRepository);
        this.deleteOutput = new DeleteProjectOutputUseCase(projectRepository);
    }
}

// Singleton instance
export const facultyService = new FacultyService();
