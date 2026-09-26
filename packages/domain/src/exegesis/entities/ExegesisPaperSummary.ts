import type { PassageReference } from '../../bible/canon/passage-reference';
import type { ExegeticalPaperPhase } from './ExegeticalPaper';
import type { SourceType } from './SourceType';
import type { SourceRole } from './StepSourcePlan';

/**
 * Lightweight projection of an `ExegeticalPaper` for the list/dashboard.
 *
 * The full paper carries `steps[].versions[]` (append-only markdown history),
 * `assembledMarkdown`, `sources[]`, rubric + plan — by far the largest doc in
 * the app. The list only needs the headline fields + three counts. This
 * summary is what the `getExegesisPapersSummary` callable returns so the full
 * papers never cross the wire just to draw the list. The full paper is loaded
 * via `getPaper` only when one is opened.
 */
export interface ExegesisPaperSummary {
    id: string;
    title?: string;
    passage: PassageReference;
    displayLanguage: 'es' | 'en';
    phase: ExegeticalPaperPhase;
    archivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    assignmentBrief: string | null;
    /** `steps.length` — total planned/generated steps. */
    stepCount: number;
    /** Count of steps with a non-null `accepted` decision. */
    acceptedStepCount: number;
    /** `sources.length` — corpus size. */
    sourceCount: number;
    /**
     * Las claves de cita que este trabajo efectivamente CITÓ.
     *
     * No son las fuentes del corpus: son las que llegaron al texto. La
     * diferencia es el dato entero — el corpus de Santiago 2:1-13 tenía siete
     * fuentes y el trabajo citó cinco.
     *
     * Vacío en los trabajos anteriores a este campo y en los que todavía no
     * aceptaron ningún paso, que es lo mismo que decir «no citó nada».
     */
    citedSourceKeys: ReadonlyArray<string>;
    /**
     * A qué serie pertenece, o `null` si es un trabajo suelto. Lo necesita la
     * herencia de corpus para encontrar a los hermanos de un plan.
     */
    seriesId: string | null;
    /**
     * La IDENTIDAD de cada fuente, sin sus fragmentos.
     *
     * Los `excerpts` son lo que engorda un trabajo —medido en la cuenta real,
     * 4,83 MB entre 22 trabajos— y por eso la lista nunca los baja. Pero la
     * herencia de corpus necesita saber QUÉ libros tiene cada hermano, y eso
     * cabe en unos cientos de bytes por fuente. Bajarlo acá evita volver a
     * pedir los trabajos enteros, que es justo lo que este resumen existe para
     * no hacer.
     */
    sources: ResumenDeFuente[];
}

/** Una fuente vista desde el resumen: quién es, sin nada de su contenido. */
export interface ResumenDeFuente {
    sourceLibraryResourceId: string | null;
    corpusId: string;
    sourceType: SourceType;
    /** Opcional para que una `ProjectSource` entera encaje acá sin adaptarla. */
    chosenRole?: SourceRole | null;
    displayLabel: string;
    citationKey: string | null;
}
