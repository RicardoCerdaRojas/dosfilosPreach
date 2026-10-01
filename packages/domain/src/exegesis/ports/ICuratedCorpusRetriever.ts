import type { SheetRange } from '../entities/ProjectSource';
import type { CorpusChunk } from '../corpus/selectCorpusChunks';

/**
 * Le pide al corpus del trabajo el material que sirve para un paso.
 *
 * Es el reemplazo de inlinear el corpus entero en cada prompt. Hasta aquí, un
 * trabajo con doce fuentes mandaba ~514.000 caracteres en CADA paso, contra un
 * tope de 200.000 — así que un estudio serio no entraba, por buena que fuera la
 * curaduría de páginas.
 *
 * La división de trabajo que este puerto encarna:
 *
 *   - El USUARIO define el universo, eligiendo hojas por fuente. Eso no lo
 *     reemplaza ningún algoritmo: decide qué material es admisible.
 *   - El PASO define la muestra, preguntando qué de ese universo habla de su
 *     versículo.
 *
 * Lo fijado no pasa por el ranking: entra completo. Ver `selectForPrompt`.
 */
export interface ICuratedCorpusRetriever {
    retrieve(input: RetrieveCuratedCorpusInput): Promise<CuratedCorpusResult>;
}

export interface CuratedCorpusScope {
    /** Recurso de biblioteca del que sale el material. */
    resourceId: string;
    /** Hojas que el trabajo admitió para esta fuente. */
    sheetRanges: ReadonlyArray<SheetRange>;
    /** Hojas que entran a todos los pasos sin competir. */
    pinnedRanges: ReadonlyArray<SheetRange>;
}

export interface RetrieveCuratedCorpusInput {
    userId: string;
    /**
     * Qué se busca. La referencia del versículo más el encuadre del trabajo:
     * misma forma de consulta que ya usa el proponente de tramos.
     */
    query: string;
    sources: ReadonlyArray<CuratedCorpusScope>;
    /**
     * Caracteres disponibles para el corpus en este paso. Lo decide quien arma
     * el prompt, que es el único que sabe cuánto ocupan las instrucciones, la
     * guía de estilo y los análisis previos.
     */
    budgetChars: number;
}

export interface CuratedCorpusResult {
    /** Lo que entra al prompt, agrupado por fuente y en orden de documento. */
    byResource: Record<string, ReadonlyArray<CorpusChunk>>;
    /** Caracteres que aportaron los tramos fijados. */
    pinnedChars: number;
    /** Caracteres que aportó el ranking. */
    rankedChars: number;
    /** Candidatos del ranking que no entraron por presupuesto. */
    droppedRanked: number;
    /** Lo fijado consumió todo el presupuesto y el ranking quedó afuera. */
    pinnedExhaustedBudget: boolean;
    /**
     * Fuentes que no pudieron consultarse. Una fuente rota no puede llevarse
     * puesto el paso entero, pero tampoco puede desaparecer en silencio: el
     * usuario tiene que poder saber que su comentario no participó.
     */
    failedSources: ReadonlyArray<string>;
    /** Fuentes consultadas que no aportaron nada para este versículo. */
    emptySources: ReadonlyArray<string>;
}

/**
 * Lee, completo y sin rankear, el material que una fuente admite.
 *
 * Lo usa el verificador de citas. Necesita evidencia CON pista de página para
 * detectar que una cita apunta a la página equivocada, y esa evidencia
 * desaparece cuando la fuente deja de guardar sus `excerpts`: sin este puerto
 * la verificación seguiría siendo correcta —hay un respaldo con el texto
 * completo— pero perdería la detección de página en silencio, que es la clase
 * de degradación más difícil de notar.
 */
export interface ICuratedCorpusReader {
    readAdmitted(input: {
        resourceId: string;
        sheetRanges: ReadonlyArray<SheetRange>;
    }): Promise<ReadonlyArray<CorpusChunk>>;
}
