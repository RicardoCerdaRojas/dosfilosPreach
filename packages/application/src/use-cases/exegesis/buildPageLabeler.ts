import {
    isCitableSourceType,
    printedPageIn,
    type CitationPageKind,
    type ExegeticalPaper,
    type IPageNumberingReader,
} from '@dosfilos/domain';

/** Rotula el número de una cita: `p. N` cuando es página impresa, `hoja N` si no. */
export type PageLabeler = (sourceKey: string, page: number, kind: CitationPageKind) => string;

/**
 * Rotulador de páginas para un trabajo, resuelto por fuente citable.
 *
 * Hace dos cosas distintas según lo que el análisis haya guardado:
 *
 *   - `printed` — el número ya es la página impresa, porque el recurso
 *     declaraba su numeración cuando se analizó el verso. Se rotula y nada
 *     más: volver a convertirlo lo rompería.
 *   - `sheet` — el número es la hoja del archivo. Es lo que guardó todo
 *     análisis anterior a la calibración, y también lo que guarda hoy un
 *     recurso sin numeración conocida. Si el recurso ya tiene numeración, se
 *     convierte acá; si no, se dice «hoja N».
 *
 * Esa segunda rama es lo que permite recomponer un trabajo viejo con las
 * páginas correctas sin volver a analizarlo verso por verso.
 *
 * Vive fuera de los casos de uso porque la necesitan el compositor del paper
 * completo y el de prosa por verso, y una regla de citación duplicada es una
 * regla que se corrige en uno solo de los dos lugares — que es exactamente
 * cómo la conversión terminó cableada en un camino de tres.
 */
export async function buildPageLabeler(
    reader: IPageNumberingReader | undefined,
    paper: ExegeticalPaper,
    logLabel: string,
): Promise<PageLabeler | undefined> {
    if (!reader) return undefined;

    const citable = paper.sources.filter(s => s.citationKey && isCitableSourceType(s.sourceType));
    const entries = await Promise.all(citable.map(async source => {
        const resourceId = source.sourceLibraryResourceId ?? source.corpusId;
        try {
            return [source.citationKey!, await reader.numberingFor(resourceId)] as const;
        } catch (err) {
            // Un índice que no responde no puede tumbar la composición: sin
            // numeración se cita la hoja, dicha como hoja.
            console.warn(`[${logLabel}] no se pudo leer la numeración de`, resourceId, err);
            return [source.citationKey!, null] as const;
        }
    }));
    const numberings = new Map(entries);

    return (sourceKey, value, kind) => {
        if (kind === 'printed') return `p. ${value}`;
        const printed = printedPageIn(numberings.get(sourceKey) ?? null, value);
        return printed === null ? `hoja ${value}` : `p. ${printed}`;
    };
}
