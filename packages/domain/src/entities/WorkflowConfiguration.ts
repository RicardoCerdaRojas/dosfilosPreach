import { WorkflowPhase } from './SermonWorkflow';

export interface PhaseDocument {
    id: string;
    name: string;
    content?: string; // Extracted text (optional if stored in Storage)
    storagePath?: string; // Path in Firebase Storage
    type: string;
}

export interface PhaseConfiguration {
    basePrompt?: string; // The core "Expert Persona" prompt
    userPrompts: string[]; // Additional specific instructions
    documents: PhaseDocument[]; // Knowledge base documents
    libraryDocIds?: string[]; // IDs of library documents to include
    cachedResources?: Array<{ title: string; author: string }>; // Metadata of cached resources
    fileSearchStoreId?: string; // 🎯 NEW: ID of the File Search Store to use
    temperature?: number; // Creativity level
    /**
     * Sólo en la fase de redacción: el estilo del manuscrito que el usuario
     * guardó. Ausente = el del sistema (`manuscriptStyleFor`).
     */
    manuscriptStyle?: string;
}

export interface WorkflowConfiguration {
    id: string;
    userId: string;

    // Global Settings
    preferredBibleVersion: string;
    theologicalBias?: string;
    hermeneuticalApproach?: string; // e.g. "Historical-Grammatical", "Christocentric"
    defaultTargetAudience?: string;

    // Advanced Global Settings
    advanced?: {
        aiModel: string;
        globalTemperature: number;
    };

    // Phase-specific settings
    [WorkflowPhase.EXEGESIS]: PhaseConfiguration;
    [WorkflowPhase.HOMILETICS]: PhaseConfiguration;
    [WorkflowPhase.DRAFTING]: PhaseConfiguration;

    // Planner specific
    seriesPlanner?: PhaseConfiguration;

    updatedAt: Date;
}

export const DEFAULT_WORKFLOW_CONFIG: Omit<WorkflowConfiguration, 'id' | 'userId' | 'updatedAt'> = {
    preferredBibleVersion: 'Reina Valera 1960',
    [WorkflowPhase.EXEGESIS]: {
        userPrompts: [],
        documents: [],
        temperature: 0.3
    },
    [WorkflowPhase.HOMILETICS]: {
        userPrompts: [],
        documents: [],
        temperature: 0.7
    },
    [WorkflowPhase.DRAFTING]: {
        userPrompts: [],
        documents: [],
        temperature: 0.7
    }
};
