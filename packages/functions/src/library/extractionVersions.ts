/**
 * Single source of truth for extraction-version semantics across the
 * cloud-functions codebase. Before this module existed the
 * `SUPPORTED_VERSIONS` constant was duplicated in 4+ places (the
 * trigger, both indexer entry points, plus the helper) — they fell out
 * of sync once and the auto-indexer rejected valid resources because
 * one copy hadn't been updated.
 *
 * If you add a new extractor (e.g. `6.0-...`), add it here and the
 * trigger + indexer pick it up automatically. The frontend has its
 * own mirror in `useLibraryResources.ts` (functions can't depend on
 * @dosfilos/domain so the duplication crosses the package boundary —
 * keep that copy in sync manually).
 */

/**
 * Every extraction version the cloud-functions code knows about.
 * Type-narrowed string union — TypeScript will catch typos at compile
 * time when callsites compare against literals.
 */
export type ExtractionVersion =
    | '3.0-llamaparse'
    | '4.0-gemini-standard'
    | '5.0-pdfparse-structured'
    /**
     * Obras de dominio público ingeridas desde ThML (el XML de CCEL). NO
     * pasan por extracción: el texto llega ya estructurado y anclado al
     * pasaje por los elementos `<scripCom>` de la fuente, y el conversor
     * sólo lo pasa a markdown con un encabezado por bloque.
     *
     * Lleva versión propia en vez de reusar una de las de arriba porque
     * este campo registra CÓMO se obtuvo el texto. Etiquetar como
     * LlamaParse algo que nunca lo tocó rompería el rastro de procedencia
     * y engañaría a cualquier lógica futura que se ramifique por acá —
     * empezando por el diagnóstico de calidad de extracción.
     */
    | '6.0-thml-public-domain'
    | '2.0-gemini'
    | 'fallback-pdfparse';

/**
 * Extraction versions whose output is in the `<!-- page: N -->`
 * structured-markdown contract that the chunker + indexer expect.
 *
 * A new resource that finishes extraction in any of these versions is
 * automatically picked up by the `autoIndexOnExtractionReady` Firestore
 * trigger AND can be re-indexed via the `indexStructuredDocument`
 * callable. Versions NOT in this list are legacy / pre-contract
 * outputs that the indexer would produce garbage chunks from.
 */
export const STRUCTURED_EXTRACTION_VERSIONS: readonly ExtractionVersion[] = [
    '3.0-llamaparse',
    '4.0-gemini-standard',
    '5.0-pdfparse-structured',
    '6.0-thml-public-domain',
] as const;

/**
 * Type-guard / membership check. Use this everywhere instead of
 * comparing against the array literal directly so adding a version
 * touches one file.
 */
export function isStructuredExtractionVersion(version: string | null | undefined): boolean {
    if (!version) return false;
    return (STRUCTURED_EXTRACTION_VERSIONS as readonly string[]).includes(version);
}
