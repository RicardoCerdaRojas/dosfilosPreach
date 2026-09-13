/**
 * Qué corpus puede heredar un trabajo de sus hermanos de serie.
 *
 * EL PROBLEMA. Un plan de predicación recorre un libro en pericopas: Jonás
 * 1:1-3, 1:4-16, 2:1-11, 3:1-10… Son trabajos distintos sobre el MISMO libro,
 * y las fuentes que sirven para uno sirven casi siempre para el siguiente.
 * Medido sobre un plan real: el trabajo de Jonás 2 tenía once fuentes armadas
 * y el de Jonás 3 arrancaba con cero. El sistema sabía que eran una serie
 * —comparten `seriesId`— y hacía empezar de nuevo igual.
 *
 * No es sólo tiempo perdido. Rearmar el corpus a mano cada vez produce series
 * INCONSISTENTES: el mismo comentario clasificado distinto en dos pericopas, o
 * citado con claves diferentes, dentro de lo que el lector percibe como un solo
 * estudio.
 *
 * QUÉ SE HEREDA Y QUÉ NO. Se hereda la IDENTIDAD de la fuente —qué libro es,
 * cómo está clasificado, con qué rol, bajo qué clave se cita— y NUNCA los
 * fragmentos. Los excerpts se extraen contra un pasaje concreto: los de Jonás 2
 * hablan de Jonás 2, y arrastrarlos a Jonás 3 metería en el trabajo citas que
 * no vienen al caso. Tienen que volver a extraerse.
 *
 * Esa distinción es la razón de que esto sea una propuesta y no una copia.
 */

import type { ExegeticalPaper } from '../entities/ExegeticalPaper';
import type { ProjectSource } from '../entities/ProjectSource';
import type { SourceType } from '../entities/SourceType';
import type { SourceRole } from '../entities/StepSourcePlan';

/** Una fuente que se puede traer, ya sin nada atado al pasaje anterior. */
export interface FuenteHeredable {
    /** El recurso de biblioteca del que sale. Es lo que identifica la fuente. */
    sourceLibraryResourceId: string;
    /**
     * El corpus ya ingerido que se vuelve a apuntar. Viaja tal cual desde el
     * trabajo de origen: es dónde está el texto, y re-ingerirlo para el
     * trabajo nuevo gastaría cuota por un documento que ya está adentro.
     */
    corpusId: string;
    sourceType: SourceType;
    chosenRole: SourceRole | null;
    displayLabel: string;
    citationKey: string | null;
    /** De qué trabajo viene, para poder decirlo en pantalla. */
    deTrabajoId: string;
}

export interface PropuestaDeHerencia {
    /** El trabajo del que se propone heredar. */
    origenId: string;
    fuentes: FuenteHeredable[];
    /** Cuántas de sus fuentes ya están en el trabajo actual. */
    yaPresentes: number;
}

/**
 * Qué recurso de biblioteca es una fuente.
 *
 * El backref `sourceLibraryResourceId` lo escribe la ruta nueva. Las fuentes
 * adjuntadas antes —«agregar desde mi biblioteca»— guardan ese mismo id en
 * `corpusId` y dejaron el backref en null. Mirar sólo el backref dejaría sin
 * herencia a series enteras armadas antes del cambio; medido sobre la cuenta
 * real, 58 de 113 fuentes están en esa forma, y cinco trabajos la tienen en
 * TODAS las suyas.
 *
 * Es el mismo criterio que ya usa la selección de páginas para reconocer una
 * fuente de biblioteca.
 */
function recursoDe(s: Pick<ProjectSource, 'sourceLibraryResourceId' | 'corpusId'>): string | null {
    return s.sourceLibraryResourceId || s.corpusId || null;
}

/**
 * De qué hermano conviene heredar, y qué fuentes suyas faltan acá.
 *
 * Se elige el hermano con MÁS fuentes, no el más reciente: lo que se busca es
 * la base más completa, y un trabajo recién empezado puede ser el último y
 * tener una sola. Entre empates gana el PRIMERO de la lista, que es el más
 * reciente —el repositorio devuelve por `updatedAt` descendente— y el que
 * refleja mejor cómo quedó decidida la serie.
 *
 * `recursosVivos`, cuando se pasa, es el conjunto de libros que todavía están
 * en la biblioteca. Filtra los que ya no existen: medido sobre la serie real de
 * Jonás, una de las once fuentes apunta a un recurso borrado, y heredarla le
 * dejaría al pastor un libro que no se puede abrir ni citar, indistinguible de
 * los buenos hasta que intente usarlo. Omitirlo no filtra nada.
 *
 * Devuelve `null` cuando no hay nada que ofrecer —sin serie, sin hermanos, o
 * con todo ya presente—. Ofrecer una herencia vacía sería ruido, y peor:
 * enseñaría a ignorar el aviso cuando sí tenga algo.
 */
export function proponerCorpusHeredado(
    actual: Pick<ExegeticalPaper, 'id' | 'seriesId' | 'sources'>,
    candidatos: ReadonlyArray<Pick<ExegeticalPaper, 'id' | 'seriesId' | 'sources'>>,
    recursosVivos?: ReadonlySet<string>,
): PropuestaDeHerencia | null {
    if (!actual.seriesId) return null;

    const sirve = (s: Pick<ProjectSource, 'sourceLibraryResourceId' | 'corpusId'>) => {
        const recurso = recursoDe(s);
        return !!recurso && (!recursosVivos || recursosVivos.has(recurso));
    };

    const hermanos = candidatos.filter(p => (
        p.id !== actual.id
        && p.seriesId === actual.seriesId
        && (p.sources ?? []).some(sirve)
    ));
    if (hermanos.length === 0) return null;

    // El más completo se mide en fuentes QUE SE PUEDEN HEREDAR, no en fuentes:
    // un trabajo con once libros de los que diez ya no están en la biblioteca
    // es peor base que uno con cinco vivos, y contar en bruto elegiría el
    // primero. Entre empates se conserva el acumulador, o sea el primero de la
    // lista; como llega ordenada por fecha descendente, ése es el más reciente.
    const heredables = (p: typeof hermanos[number]) => (p.sources ?? []).filter(sirve).length;
    const mejor = hermanos.reduce((a, b) => (heredables(b) > heredables(a) ? b : a));

    const yaTengo = new Set(
        (actual.sources ?? [])
            .map(recursoDe)
            .filter((x): x is string => !!x),
    );

    let yaPresentes = 0;
    const fuentes: FuenteHeredable[] = [];
    const vistas = new Set<string>();

    for (const s of mejor.sources ?? []) {
        // Sin recurso, o con uno borrado de la biblioteca: no hay libro que
        // volver a adjuntar.
        if (!sirve(s)) continue;
        const recurso = recursoDe(s)!;
        if (yaTengo.has(recurso)) { yaPresentes++; continue; }
        // Un mismo libro adjuntado dos veces al trabajo de origen se trae una.
        if (vistas.has(recurso)) continue;
        vistas.add(recurso);

        fuentes.push({
            sourceLibraryResourceId: recurso,
            corpusId: s.corpusId,
            sourceType: s.sourceType,
            chosenRole: s.chosenRole ?? null,
            displayLabel: s.displayLabel,
            citationKey: s.citationKey ?? null,
            deTrabajoId: mejor.id,
        });
    }

    if (fuentes.length === 0) return null;
    return { origenId: mejor.id, fuentes, yaPresentes };
}
