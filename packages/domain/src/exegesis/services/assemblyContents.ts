import { formatPassageReference } from '../../bible/canon/passage-reference';
import type { ExegeticalPaper } from '../entities/ExegeticalPaper';
import type { ExegeticalStep } from '../entities/ExegeticalStep';
import { countWords } from '../../services/movementBudget';
import type { DocumentSections } from './paperLength';

/**
 * Qué entra al documento y qué se queda fuera.
 *
 * El ensamblador decidía esto en silencio y con una regla que mezclaba dos
 * cosas: si un versículo estaba aceptado pero nadie le había compuesto la
 * prosa, volcaba su ANÁLISIS ESTRUCTURADO en el documento «para que el
 * ensamble nunca sea sólo intro + conclusión».
 *
 * Medido sobre el trabajo de Santiago 2:1–13, que responde cuatro preguntas
 * con cuatro versículos: de las 4.566 palabras del ensamble, unas 4.000 eran
 * volcados de análisis de los nueve versículos que el autor nunca pensó
 * incluir. Un trabajo de 2–3 páginas salió de 18.
 *
 * La regla ahora es una sola y se puede decir en una frase: **el análisis es
 * materia prima, la prosa es el documento**. Un versículo sin prosa compuesta
 * no entra — y se dice cuál y por qué, que era el miedo legítimo del diseño
 * anterior. Informar no ensucia el entregable; volcar sí.
 */
export interface AssemblyPart {
    stepId: string;
    kind: ExegeticalStep['kind'];
    /** Cómo se llama en pantalla y cómo se rotula en el documento. */
    label: string;
    words: number;
}

export interface AssemblyContents {
    /** En orden de documento: introducción, versículos, conclusión. */
    included: AssemblyPart[];
    /**
     * Elegidos para el documento y todavía sin prosa compuesta.
     *
     * Es el estado que faltaba. Antes un versículo que el autor QUERÍA pero no
     * había escrito se veía igual que uno descartado: los dos «quedaban
     * fuera». Separarlos convierte una ausencia silenciosa en un pendiente.
     */
    pending: AssemblyPart[];
    /** Excluidos del documento por decisión del autor. */
    excluded: AssemblyPart[];
    /** Palabras que tendrá el documento. */
    words: number;
}

/**
 * Si un paso pertenece al documento.
 *
 * Ausente equivale a `true`: todo paso aceptado cuenta mientras nadie diga lo
 * contrario, que es como se comportaban los trabajos anteriores al campo.
 */
export function pertenceAlDocumento(step: ExegeticalStep): boolean {
    return step.includeInDocument !== false;
}

export function assemblyContents(
    steps: ReadonlyArray<ExegeticalStep>,
    language: 'es' | 'en',
): AssemblyContents {
    const included: AssemblyPart[] = [];
    const pending: AssemblyPart[] = [];
    const excluded: AssemblyPart[] = [];

    const etiqueta = (step: ExegeticalStep): string =>
        step.verseRef
            ? formatPassageReference(step.verseRef, language)
            : (language === 'en'
                ? { introduction: 'Introduction', conclusion: 'Conclusion', verse: 'Verse', assembly: 'Assembly' }
                : { introduction: 'Introducción', conclusion: 'Conclusión', verse: 'Versículo', assembly: 'Ensamble' }
            )[step.kind];

    const clasifica = (step: ExegeticalStep | undefined) => {
        if (!step?.accepted) return;
        const body = step.accepted.markdown?.trim() ?? '';
        const parte: AssemblyPart = {
            stepId: step.id,
            kind: step.kind,
            label: etiqueta(step),
            words: countWords(body),
        };
        if (!pertenceAlDocumento(step)) excluded.push(parte);
        else if (body) included.push(parte);
        else pending.push(parte);
    };

    clasifica(steps.find(s => s.kind === 'introduction'));
    for (const v of steps.filter(s => s.kind === 'verse').sort((a, b) => a.order - b.order)) {
        clasifica(v);
    }
    clasifica(steps.find(s => s.kind === 'conclusion'));

    return {
        included,
        pending,
        excluded,
        words: included.reduce((n, p) => n + p.words, 0),
    };
}

/**
 * El documento, a partir de lo que `assemblyContents` dejó entrar.
 *
 * CADA VERSÍCULO LLEVA SU ENCABEZADO. La prosa compuesta llegaba sin rótulo
 * mientras el volcado del análisis sí traía el suyo, de modo que los
 * versículos efectivamente escritos quedaban como párrafos sueltos colgando
 * de la sección anterior —en un trabajo real, colgando de la introducción—.
 *
 * Y sin rótulo, `replaceVerseSection` tampoco encuentra la sección al
 * recomponer: el ensamble se queda atrás de los pasos sin que nadie lo note.
 */
export function assembleMarkdown(
    paper: ExegeticalPaper,
    language: 'es' | 'en',
    contents: AssemblyContents = assemblyContents(paper.steps, language),
): string {
    const passage = formatPassageReference(paper.passage, language);
    const out: string[] = [`# ${paper.title?.trim() || passage}`, ''];

    for (const parte of contents.included) {
        const step = paper.steps.find(s => s.id === parte.stepId);
        const body = step?.accepted?.markdown?.trim() ?? '';
        if (!body) continue;
        out.push('---', '');
        // Un cuerpo que ya abre con encabezado no lleva otro encima.
        if (!/^#{1,6}\s/.test(body)) out.push(`## ${parte.label}`, '');
        out.push(body, '');
    }
    return out.join('\n');
}

/**
 * Las secciones del documento, para repartir la extensión entre ellas.
 *
 * Sale de la MISMA marca que decide qué entra al ensamble, y por eso el
 * presupuesto y el documento no pueden discrepar. Un paso que no está
 * aceptado todavía cuenta igual: el reparto describe el documento que se va a
 * escribir, no el que ya está escrito, y si sólo contara lo compuesto el
 * primer versículo recibiría el trabajo entero para él solo.
 */
export function documentSections(
    steps: ReadonlyArray<ExegeticalStep>,
): DocumentSections {
    const cuenta = (kind: ExegeticalStep['kind']) =>
        steps.filter(s => s.kind === kind && pertenceAlDocumento(s)).length;
    return {
        verses: cuenta('verse'),
        introduction: cuenta('introduction') > 0,
        conclusion: cuenta('conclusion') > 0,
    };
}

/**
 * Qué se va a entregar, comparado con lo que se está viendo.
 *
 * `paper.assembledMarkdown` —el campo del que leen el medidor de extensión Y
 * los dos exportadores— no se escribe al regenerar el ensamble, sólo al
 * ACEPTARLO. Quien regenera ve el texto nuevo en pantalla y descarga el
 * anterior, sin que nada lo diga.
 *
 * Medido en Santiago 2:1-13: el paso tenía tres versiones —6.455, 4.513 y
 * 1.176 palabras— y ninguna aceptada desde la segunda. La pantalla mostraba
 * la de 1.176 con los cuatro versículos del trabajo; el campo entregable
 * seguía con la de 4.513, que traía los NUEVE versículos que el autor había
 * excluido y ninguno de los cuatro que quería.
 *
 * La comparación es de TEXTO y no de identificador de versión, y eso se midió
 * antes de elegirlo. Con identificadores, de los 42 trabajos en producción dos
 * quedaban marcados y uno de los dos era una falsa alarma: no tenía versión
 * aceptada y sin embargo su texto entregable era idéntico, carácter por
 * carácter, al de pantalla —recomponer un verso parchea `assembledMarkdown`
 * en su sitio (`spliceIntoAssembly`) sin tocar las versiones del paso—. El
 * otro difería de verdad: 2.552 caracteres entregables contra 14.913 en
 * pantalla. Una advertencia falsa enseña a ignorar las advertencias.
 *
 * Por la misma razón el estado se llama `difiere` y no «sin aceptar»: la
 * causa puede ser una falta de aceptación o un parche en sitio, y el hecho
 * que importa —y el único que se comprueba— es que los dos textos no son el
 * mismo.
 */
export interface AssemblyDeliveryCheck {
    state: 'sin-ensamble' | 'difiere' | 'al-dia';
    /** Palabras del texto que el exportador va a bajar. */
    deliveredWords: number;
    /** Palabras del ensamble que el autor tiene en pantalla. */
    onScreenWords: number;
}

export function assemblyDelivery(paper: ExegeticalPaper): AssemblyDeliveryCheck {
    const entregable = paper.assembledMarkdown?.trim() ?? '';
    const paso = (paper.steps ?? []).find(s => s.kind === 'assembly');
    const enPantalla = paso?.current?.markdown?.trim() ?? '';
    const palabras = {
        deliveredWords: countWords(entregable),
        onScreenWords: countWords(enPantalla),
    };
    // Sin ninguno de los dos no hay nada que comparar. Sin `assembledMarkdown`
    // tampoco: los exportadores caen en armar desde los pasos ACEPTADOS, que
    // es justo lo que el autor está viendo, y el trabajo ensamblado por
    // primera vez es exactamente ese caso.
    if (!entregable || !enPantalla) return { state: 'sin-ensamble', ...palabras };
    return { state: entregable === enPantalla ? 'al-dia' : 'difiere', ...palabras };
}
