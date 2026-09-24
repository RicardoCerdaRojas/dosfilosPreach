import { formatPassageReference } from '../../bible/canon/passage-reference';
import type { ExegeticalPaper } from '../entities/ExegeticalPaper';
import type { ExegeticalStep } from '../entities/ExegeticalStep';
import { countWords } from '../../services/movementBudget';

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
     * Pasos aceptados que NO entran porque nadie les compuso la prosa.
     *
     * No son un error ni algo a medias: son análisis que el autor puede haber
     * hecho a propósito sin querer publicarlos. Se listan para que nadie
     * descubra su ausencia al abrir el archivo.
     */
    excluded: AssemblyPart[];
    /** Palabras que tendrá el documento. */
    words: number;
}

export function assemblyContents(
    steps: ReadonlyArray<ExegeticalStep>,
    language: 'es' | 'en',
): AssemblyContents {
    const included: AssemblyPart[] = [];
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
        (body ? included : excluded).push(parte);
    };

    clasifica(steps.find(s => s.kind === 'introduction'));
    for (const v of steps.filter(s => s.kind === 'verse').sort((a, b) => a.order - b.order)) {
        clasifica(v);
    }
    clasifica(steps.find(s => s.kind === 'conclusion'));

    return {
        included,
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
