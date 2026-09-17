import type {
    ExegeticalPaper,
    ICuratedCorpusReader,
    IPageNumberingReader,
    IResourceContentReader,
    PageNumbering,
    ProjectSource,
    VerifierSource,
    VerifierSourceChunk,
} from '@dosfilos/domain';
import { citationAnchorFor, isCitableSourceType, relabelExcerptAnchor } from '@dosfilos/domain';

/**
 * La evidencia con la que se verifica un trabajo: qué texto de cada fuente
 * se le pone delante al verificador y con qué página rotulado.
 *
 * Vive aparte del caso de uso que verifica un paso entero porque corregir
 * UNA cita necesita exactamente la misma evidencia. Duplicarla era
 * garantizar que las dos divergieran: la que verifica el paso convierte
 * hojas a páginas impresas, y una copia que no lo hiciera marcaría «página
 * equivocada» en la cita recién corregida.
 */
export class VerifierSourcesBuilder {
    constructor(
        private contentReader: IResourceContentReader,
        /**
         * Cuando está cableado, las fuentes con receta aportan como evidencia
         * las hojas que el trabajo admitió, con su página. Sin él la
         * verificación sigue siendo correcta —el texto completo entra como
         * respaldo— pero deja de detectar que una cita apunta a la página
         * equivocada.
         */
        private corpusReader?: ICuratedCorpusReader,
        /**
         * Numeración impresa de cada fuente. Es lo que pone al verificador a
         * comparar en la misma unidad que la cita.
         */
        private pageNumbering?: IPageNumberingReader,
    ) { }

    async build(paper: ExegeticalPaper): Promise<VerifierSource[]> {
        const out: VerifierSource[] = [];
        for (const source of paper.sources) {
            if (!isCitableSourceType(source.sourceType)) continue;
            const numbering = await this.numberingFor(
                source.sourceLibraryResourceId ?? source.corpusId,
            );
            const chunks = await this.buildChunks(source, numbering);
            if (chunks.length === 0) continue;
            out.push({
                corpusId: source.corpusId,
                citationKey: source.citationKey,
                fullAuthor: source.citationKey,
                displayLabel: source.displayLabel,
                chunks,
                // El verificador recupera fragmentos por su cuenta y los rotula
                // él mismo; sin la numeración los rotularía en hojas.
                numbering,
            });
        }
        return out;
    }

    /**
     * Evidencia de una fuente con receta: las hojas admitidas, con su página,
     * más el texto completo como respaldo sin pista.
     *
     * Devuelve `null` cuando la fuente no tiene receta o no hay lector
     * cableado, para que el llamador siga por el camino anterior. Un fallo de
     * lectura también devuelve `null`: verificar con evidencia vieja es mejor
     * que no verificar.
     */
    /** `null` sin lector o cuando el recurso no declara numeración utilizable. */
    private async numberingFor(resourceId: string): Promise<PageNumbering | null> {
        if (!this.pageNumbering) return null;
        try {
            return await this.pageNumbering.numberingFor(resourceId);
        } catch (err) {
            console.warn('[VerifyStepCitations] sin numeración para', resourceId, err);
            return null;
        }
    }

    private async readAdmitted(source: ProjectSource): Promise<VerifierSourceChunk[] | null> {
        const ranges = source.excerptRecipe?.sheetRanges;
        if (!this.corpusReader || !ranges || ranges.length === 0) return null;
        const resourceId = source.sourceLibraryResourceId ?? source.corpusId;

        try {
            const chunks = await this.corpusReader.readAdmitted({ resourceId, sheetRanges: ranges });
            if (chunks.length === 0) return null;

            const numbering = await this.numberingFor(resourceId);
            const out = chunks
                .filter(c => c.text.trim().length > 0)
                .map<VerifierSourceChunk>(c => ({
                    text: c.text,
                    // El mismo criterio que el ancla del corpus, y por la
                    // misma razón: si el fragmento se rotula con la hoja y la
                    // cita habla de la página impresa, el cotejo compara dos
                    // unidades distintas y reprueba lo que está bien.
                    pageHint: citationAnchorFor({ sheet: c.sheet ?? null, section: null }, numbering) || null,
                }));

            // Mismo respaldo que el camino anterior: una cita a material fuera
            // de lo curado no debe volver como "no encontrada" solo porque el
            // usuario no eligió esa página para escribir.
            const fullText = await this.contentReader.getTextContent(resourceId);
            if (fullText && fullText.trim().length > 0) {
                out.push({ text: fullText, pageHint: null });
            }
            return out;
        } catch (err) {
            console.warn('[VerifyStepCitations] no se pudo leer lo admitido; se usa lo guardado', {
                resourceId,
                error: (err as Error).message,
            });
            return null;
        }
    }

    private async buildChunks(
        source: ProjectSource,
        numbering: PageNumbering | null,
    ): Promise<VerifierSourceChunk[]> {
        // Fuentes con receta: la evidencia con página son las hojas admitidas,
        // no los `excerpts` —que a partir del corpus consultable ya no son lo
        // que el paso recibió, y en algún momento dejan de guardarse.
        const admitted = await this.readAdmitted(source);
        if (admitted) return admitted;

        if (source.mode === 'extracted-excerpts') {
            const excerptChunks = source.excerpts
                .map<VerifierSourceChunk>(excerpt => ({
                    text: excerpt.text,
                    // `sourceLocation` es texto que el extractor escribió antes
                    // de que existiera la numeración: dice «p. 65» sobre la
                    // HOJA 65. Pasarlo tal cual pone al cotejo a comparar la
                    // página impresa de la cita contra una hoja, y marca
                    // «página no coincide» en citas que apuntan al mismo lugar.
                    // El camino con receta ya convertía; éste, que es el de los
                    // trabajos sin receta, se había quedado afuera.
                    pageHint: relabelExcerptAnchor(
                        excerpt.sourceLocation,
                        numbering,
                        { sheet: excerpt.sheet, section: excerpt.section },
                    ) || null,
                }))
                .filter(c => c.text.trim().length > 0);

            // Fallback chunk: also pull the full library-resource text
            // when available. The user's curated excerpts are the
            // primary evidence (preserving page-mismatch detection),
            // but a citation may reference content elsewhere in the
            // resource — the verifier should not return "not found"
            // just because the cited passage wasn't curated for paper
            // writing. The fallback chunk has no `pageHint` so any
            // match against it doesn't trigger page-mismatch.
            if (source.sourceLibraryResourceId) {
                const fullText = await this.contentReader.getTextContent(
                    source.sourceLibraryResourceId,
                );
                if (fullText && fullText.trim().length > 0) {
                    excerptChunks.push({ text: fullText, pageHint: null });
                }
            }
            return excerptChunks;
        }
        // 'full-document' (or legacy sources without `mode`): pull the
        // whole corpus text. Page-mismatch detection is impossible
        // here — the verifier handles a null `pageHint` gracefully.
        const text = await this.contentReader.getTextContent(source.corpusId);
        if (!text) return [];
        return [{ text, pageHint: null }];
    }
}
