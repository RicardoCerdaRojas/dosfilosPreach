import type { SourceType } from '../entities/SourceType';
import type { ProjectRequirement } from '../services/projectBibliography';

/**
 * Lee una bibliografía de un sílabo, una lista pegada o una foto (etapa 2,
 * estado del arte, paso 1). Devuelve las obras como fichas y lo que el
 * sílabo exige o prohíbe sobre las fuentes, si lo dice.
 */
export interface ICourseBibliographyExtractor {
    extract(input: ExtractCourseBibliographyInput): Promise<ExtractedCourseBibliography>;
}

export interface ExtractCourseBibliographyInput {
    /** El texto: lo pegado, o lo que trae la capa de texto de un PDF. Puede ir vacío con imagen. */
    text: string;
    /** Una foto o captura de la lista, en base64 sin prefijo. */
    image?: { mimeType: string; base64: string } | null;
    language: 'es' | 'en';
}

export interface ExtractedBibliographyEntry {
    title: string;
    author?: string | null;
    series?: string | null;
    year?: number | null;
    publisher?: string | null;
    /** Si el curso la exige (lectura obligatoria, libro de texto) o solo la lista. */
    requirement: 'required' | 'recommended';
    /** La clasificación que propone el lector; se revisa en la ficha. */
    sourceType?: SourceType | null;
    /** Lo que el sílabo dice de ella: «lectura semanal», «capítulos 1–3». */
    note?: string | null;
    /** Páginas, DOI e ISBN cuando el documento los da (RIS, BibTeX, una referencia completa). */
    pageCount?: number | null;
    doi?: string | null;
    isbn?: string | null;
}

export interface ExtractedCourseBibliography {
    /**
     * Qué documento era: un ENCARGO (sílabo, consigna: trae requisitos) o una
     * BIBLIOGRAFÍA (la de un artículo, un libro o una lista: solo obras).
     */
    documentKind?: 'assignment' | 'bibliography';
    /** Los requisitos medibles que trae un encargo (etapa 2b). */
    requirementItems?: Array<Omit<ProjectRequirement, 'id' | 'origin'>>;
    entries: ExtractedBibliographyEntry[];
    /** Lo que el sílabo exige sobre las fuentes, en texto («mínimo 100 páginas de artículos»). */
    requirements: string | null;
    /** Lo que prohíbe («no usar la misma fuente dos semanas seguidas»). */
    prohibitions: string | null;
    tokensUsed?: number;
    /**
     * La respuesta se cortó (documento muy largo) y se rescataron las obras
     * completas hasta el corte: `truncatedAfter` es la última que entró, para
     * importar el resto desde ahí.
     */
    truncated?: boolean;
    truncatedAfter?: string | null;
}
