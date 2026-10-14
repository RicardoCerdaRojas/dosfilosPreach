import type { BibliographicData, RequiredBibliographyField } from './bibliography';
import { formatBibliographyEntry, missingBibliographyFields, sortedAuthorOf } from './bibliography';
import { collectAnalysisClaims } from './analysisClaims';
import { findInlineCitations, resolvesToCitedSource } from './inlineCitations';
import { computeRubricCompliance } from '../entities/PaperRubric';
import type { SourceType } from '../entities/SourceType';
import type { ExegeticalPaper } from '../entities/ExegeticalPaper';

/**
 * La bibliografía del trabajo entregado.
 *
 * El exportador Word ya sabía MAQUETAR una bibliografía —sangría francesa,
 * página nueva, en cuanto encuentra un encabezado que diga «Bibliografía»—
 * y nadie la producía. `formatBibliographyEntry` existía desde antes y se
 * usaba sólo en pantalla. Esto es el puente que faltaba entre las dos.
 */

/** Una fuente del trabajo con la ficha que la biblioteca tenga de ella. */
export interface BibliographySourceRow {
    citationKey: string;
    displayLabel: string;
    data: BibliographicData | null;
}

export interface BibliographyEntry {
    citationKey: string;
    displayLabel: string;
    /** La entrada Turabian lista para imprimir. `null` cuando la ficha está coja. */
    text: string | null;
    /** Campos que faltan. Vacío cuando la entrada está completa. */
    missing: ReadonlyArray<RequiredBibliographyField>;
    /**
     * La ficha en crudo, para quien necesite otra forma de la misma obra.
     *
     * La bibliografía y la nota al pie son dos maquetaciones distintas del
     * MISMO dato —«Ross, Allen P. *Commentary*. Grand Rapids: Kregel, 2011.»
     * contra «Allen P. Ross, *Commentary* (Grand Rapids: Kregel, 2011), 561»—
     * y el exportador sólo recibía la primera ya armada. Sin la ficha, la
     * única nota que podía escribir era un eco del paréntesis del cuerpo.
     */
    data: BibliographicData | null;
}

/**
 * Las claves de cita que el trabajo USA, no las que tiene configuradas.
 *
 * La diferencia importa y es la razón de que esto no se derive de
 * `paper.sources`. El corpus de Santiago 2:1-13 tenía siete fuentes y el
 * trabajo citó cinco: Metzger y el aparato crítico entraron al corpus y nunca
 * llegaron al texto. Una bibliografía es la lista de obras CITADAS; imprimir
 * ahí un libro que no se citó es declarar una lectura que no ocurrió.
 *
 * Sólo cuentan los pasos ACEPTADOS, que es el mismo material del que se
 * compone el cuerpo: lo que se descartó al regenerar no dejó cita en el
 * documento y no debe dejar entrada en la bibliografía.
 */
export function citedSourceKeys(paper: ExegeticalPaper): ReadonlySet<string> {
    // Con el documento ensamblado, lo citado es lo que ESE texto cita. Los
    // análisis traen más de lo que llega a la prosa: en el TP #7 NA28 y Tuggy
    // estaban citados en los análisis, no en el documento, y la bibliografía
    // los listó igual (#30).
    const keys = new Set<string>();
    for (const step of paper.steps) {
        const analysis = step.accepted?.canonicalAnalysis;
        if (!analysis) continue;
        for (const claim of collectAnalysisClaims(analysis)) keys.add(claim.sourceKey);
    }
    const ensamblado = paper.assembledMarkdown?.trim();
    if (!ensamblado) return keys;
    // Las claves de los análisis también se buscan: una fuente quitada del
    // corpus después de generar sigue citada en el texto y no puede
    // desaparecer de la bibliografía en silencio.
    return keysCitedIn(ensamblado, [...new Set([...(paper.sources ?? []).map(s => s.citationKey ?? s.displayLabel), ...keys])]);
}

/** Las claves del corpus que un texto cita, por la misma regla del exportador. */
export function keysCitedIn(markdown: string, keys: ReadonlyArray<string>): ReadonlySet<string> {
    const out = new Set<string>();
    for (const cita of findInlineCitations(markdown, keys)) {
        const key = keys.find(k => resolvesToCitedSource(cita.author, [k]));
        if (key) out.add(key);
    }
    return out;
}

/** Un requisito de la rúbrica que el documento no cumple con lo que CITA. */
export interface UncitedRubricRequirement {
    sourceType: SourceType;
    required: number;
    cited: number;
    /** Fuentes del corpus de ese tipo que el documento no cita. */
    uncited: ReadonlyArray<string>;
}

/**
 * Requisitos de la rúbrica que el documento no cumple con lo citado.
 *
 * La bibliografía lista sólo lo citado (decisión del fundador, 2026-10-14):
 * una fuente del corpus que el texto no cita sale de la bibliografía, y con
 * ella el requisito que cubría. Se avisa antes de exportar (TP #7, #30: el
 * documento citó 5 de 7 fuentes; NA28 y Tuggy quedaron sin cita).
 */
export function uncitedRubricRequirements(paper: ExegeticalPaper): UncitedRubricRequirement[] {
    if (!paper.rubric) return [];
    const citadas = citedSourceKeys(paper);
    const clave = (s: ExegeticalPaper['sources'][number]) => s.citationKey ?? s.displayLabel;
    const tipos = paper.sources.filter(s => citadas.has(clave(s))).map(s => s.sourceType);
    return computeRubricCompliance(tipos, paper.rubric).requirements
        .filter(r => r.required > 0 && !r.satisfied)
        .map(r => ({
            sourceType: r.sourceType,
            required: r.required,
            cited: r.have,
            uncited: paper.sources.filter(s => s.sourceType === r.sourceType && !citadas.has(clave(s))).map(clave),
        }));
}

/**
 * Construye la bibliografía: las fuentes citadas, ordenadas por apellido.
 *
 * Una ficha incompleta NO se omite ni se rellena. Se devuelve con `text` en
 * `null` y la lista de lo que falta, para que quien renderice lo diga de
 * frente. Omitirla en silencio produce una bibliografía a la que le falta un
 * libro que el cuerpo sí cita —el peor de los dos errores, porque no se ve—,
 * y completarla de memoria es inventar una editorial.
 */
export function buildPaperBibliography(
    paper: ExegeticalPaper,
    rows: ReadonlyArray<BibliographySourceRow>,
): BibliographyEntry[] {
    const cited = citedSourceKeys(paper);
    const vistas = new Set<string>();

    const entries: BibliographyEntry[] = [];
    for (const row of rows) {
        if (!cited.has(row.citationKey) || vistas.has(row.citationKey)) continue;
        vistas.add(row.citationKey);
        const missing = missingBibliographyFields(row.data);
        entries.push({
            citationKey: row.citationKey,
            displayLabel: row.displayLabel,
            text: missing.length === 0 && row.data ? formatBibliographyEntry(row.data) : null,
            missing,
            data: row.data,
        });
    }

    // Una clave citada de la que no hay fila NO puede desaparecer en silencio.
    // Pasa cuando la fuente se quita del corpus después de generar: el cuerpo
    // sigue diciendo «(Wallace, 54)» y la bibliografía se quedaría sin
    // Wallace, que es la peor de las dos faltas porque nadie la ve. Entra con
    // la clave por rótulo y todos los campos por faltar.
    for (const key of cited) {
        if (vistas.has(key)) continue;
        entries.push({
            citationKey: key,
            displayLabel: key,
            text: null,
            missing: missingBibliographyFields(null),
            data: null,
        });
    }

    return entries.sort((a, b) => claveDeOrden(a, rows).localeCompare(claveDeOrden(b, rows), 'es'));
}

/**
 * Por dónde se alfabetiza.
 *
 * Se usa el MISMO nombre que la entrada va a imprimir —`authorSorted`, o el
 * que `proposeSortedAuthor` deduce— y no el título ni la clave de cita: una
 * bibliografía ordenada por una cosa e impresa por otra se lee desordenada.
 * Sin autor queda el rótulo del libro, que es lo único que hay.
 */
function claveDeOrden(entry: BibliographyEntry, rows: ReadonlyArray<BibliographySourceRow>): string {
    const data = rows.find(r => r.citationKey === entry.citationKey)?.data;
    const sorted = data ? sortedAuthorOf(data) : '';
    return (sorted || entry.displayLabel).toLocaleLowerCase('es');
}

/**
 * Si un encabezado es el de la bibliografía.
 *
 * Una sola regla, porque la gobiernan dos lugares y tienen que coincidir: el
 * exportador markdown la usa para NO agregar una segunda sección cuando el
 * cuerpo ya trae una, y el exportador Word para decidir a partir de dónde
 * maqueta con sangría francesa y salto de página. Si las dos reglas se
 * separan, el documento gana una bibliografía que no se maqueta, o se maqueta
 * un tramo que no lo es.
 *
 * Recibe el texto SIN los `#`, que es como lo tiene el exportador Word después
 * de parsear los bloques.
 */
export function esEncabezadoDeBibliografia(texto: string): boolean {
    return /^(bibliograf|works cited)/i.test(texto.trim());
}
