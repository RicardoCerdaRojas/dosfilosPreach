import type { BibliographicData, RequiredBibliographyField } from './bibliography';
import { formatBibliographyEntry, missingBibliographyFields, proposeSortedAuthor } from './bibliography';
import { collectAnalysisClaims } from './analysisClaims';
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
    const keys = new Set<string>();
    for (const step of paper.steps) {
        const analysis = step.accepted?.canonicalAnalysis;
        if (!analysis) continue;
        for (const claim of collectAnalysisClaims(analysis)) keys.add(claim.sourceKey);
    }
    return keys;
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
    const sorted = (data?.authorSorted ?? '').trim()
        || proposeSortedAuthor((data?.author ?? '').trim());
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
