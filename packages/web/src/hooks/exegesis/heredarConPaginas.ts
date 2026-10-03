import {
    countSheets,
    isPickedByPages,
    normalizeSheetRanges,
    type PageIndexEntry,
    type ProjectSource,
    type SheetRange,
} from '@dosfilos/domain';

/** Lo que propone el proponedor de hojas para un libro contra el pasaje. */
export interface PropuestaDeHojas {
    ranges: ReadonlyArray<SheetRange>;
    kind: 'structural' | 'semantic' | string;
    pageIndex: ReadonlyArray<PageIndexEntry>;
}

export interface ResultadoDeHerencia {
    /** Fuentes que entraron al trabajo. */
    creadas: number;
    /** Las que quedaron con páginas para este pasaje. */
    conPaginas: number;
    /** Léxicos, diccionarios y gramáticas: se eligen a mano en el selector. */
    porLema: number;
    /** Sin propuesta (o con error al proponer): se ven en el aviso del panel de pasos. */
    sinPropuesta: number;
}

/**
 * Hereda el corpus de la serie Y le da a cada comentario páginas para ESTE
 * pasaje.
 *
 * Heredar dejaba las fuentes sin páginas, a propósito —las de la perícopa
 * anterior no sirven—, pero nada las proponía después y el análisis las leía
 * desde la portada (Jonás 4:5-11, 2026-10-02). Ahora, por cada fuente que se
 * organiza por pasaje: se proponen sus hojas contra el pasaje nuevo, se les
 * suman las que el hermano tenía fijadas (la introducción) y se guardan.
 *
 * Las propuestas van de a `concurrencia`; las escrituras, de a una: cada
 * guardado reescribe el arreglo de fuentes del trabajo y en paralelo se
 * pelearían por el mismo documento.
 */
export async function heredarConPaginas(deps: {
    heredar: () => Promise<{ creadas: ProjectSource[]; fijadasDelHermano: Record<string, SheetRange[]> }>;
    proponer: (resourceId: string) => Promise<PropuestaDeHojas>;
    guardar: (fuente: ProjectSource, propuesta: PropuestaDeHojas, hojas: SheetRange[], fijadas: SheetRange[]) => Promise<void>;
    concurrencia?: number;
    alAvanzar?: (hechas: number, total: number) => void;
}): Promise<ResultadoDeHerencia> {
    const { creadas, fijadasDelHermano } = await deps.heredar();
    const porPasaje = creadas.filter(s => !isPickedByPages(s));
    const resultado: ResultadoDeHerencia = {
        creadas: creadas.length,
        conPaginas: 0,
        porLema: creadas.length - porPasaje.length,
        sinPropuesta: 0,
    };

    const propuestas = new Map<string, PropuestaDeHojas | null>();
    const cola = [...porPasaje];
    let hechas = 0;
    const trabajar = async () => {
        for (let s = cola.shift(); s; s = cola.shift()) {
            try {
                propuestas.set(s.id, await deps.proponer(s.sourceLibraryResourceId ?? s.corpusId));
            } catch (err) {
                console.warn('[herencia] no se pudo proponer páginas', s.displayLabel, err);
                propuestas.set(s.id, null);
            }
            deps.alAvanzar?.(++hechas, porPasaje.length);
        }
    };
    await Promise.all(Array.from({ length: Math.max(1, deps.concurrencia ?? 3) }, trabajar));

    for (const s of porPasaje) {
        const propuesta = propuestas.get(s.id) ?? null;
        const fijadas = fijadasDelHermano[s.id] ?? [];
        const hojas = normalizeSheetRanges([...(propuesta?.ranges ?? []), ...fijadas]);
        // Sólo con lo fijado del hermano la fuente quedaría limitada a su
        // introducción: mejor sin páginas, que el aviso lo diga.
        if (!propuesta || countSheets(propuesta.ranges) === 0) {
            resultado.sinPropuesta++;
            continue;
        }
        // Un guardado que falla deja ESA fuente sin páginas —el aviso lo dice—
        // y sigue con las demás: abortar dejaba el resto igual, y la herencia
        // ya no se vuelve a ofrecer (revisión adversarial de A3).
        try {
            await deps.guardar(s, propuesta, hojas, fijadas);
            resultado.conPaginas++;
        } catch (err) {
            console.warn('[herencia] no se pudieron guardar las páginas', s.displayLabel, err);
            resultado.sinPropuesta++;
        }
    }
    return resultado;
}
