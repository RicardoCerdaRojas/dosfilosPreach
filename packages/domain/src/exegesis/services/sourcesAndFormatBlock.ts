import type { ExegeticalPaper } from '../entities/ExegeticalPaper';
import { DEFAULT_PAPER_FORMATTING } from '../entities/PaperRubric';
import {
    countOriginalLanguageChars,
    classifyOriginalLanguageAbsence,
    MIN_CHARS_PARA_AFIRMAR_AUSENCIA,
} from './originalLanguageEvidence';
import type { PreviousDelivery } from './sourceMemory';
import { repeatedFromPreviousDelivery } from './sourceMemory';

/**
 * El bloque de FUENTES Y FORMATO del encuadre, escrito por el sistema.
 *
 * La plantilla de predicación lo dejaba como un corchete para llenar a mano:
 * «anota cuál translitera, cuál no se puede repetir, cuál es el ancla». El
 * fundador probó a llenarlo y dijo que era lo más difícil — y tenía razón,
 * porque le estaba pidiendo que escribiera a mano cosas que el sistema YA
 * midió:
 *
 *   - cuál translitera lo decide `classifyOriginalLanguageAbsence`
 *   - cuál se citó la vez pasada lo sabe `previousDelivery`
 *   - cuál tipo de fuente ancla lo dice la rúbrica elegida
 *   - la forma de cita también
 *
 * Pedirle al autor que transcriba eso es la brecha de dependencia al revés:
 * hacerle a él el trabajo de la máquina. Un encuadre que hay que llenar con
 * datos derivables es un encuadre que se va a dejar vacío, y vacío no sirve.
 *
 * Lo que el sistema NO propone es el bloque de preguntas. Descubrir las cruces
 * del texto es el acto exegético y es justamente lo que no se delega.
 */

const ANCLA: Record<string, string> = {
    'commentary-expository': 'el comentario expositivo',
    'commentary-critical': 'el comentario crítico',
    'theological-monograph': 'la monografía teológica',
    'historical-background': 'el trasfondo histórico',
};

export function buildSourcesAndFormatBlock(
    paper: ExegeticalPaper,
    previous: PreviousDelivery | null,
): string {
    const lineas: string[] = [];

    // 1. Forma de cita: sale de la rúbrica y es lo que el exportador obedece.
    const fmt = paper.rubric?.formatting ?? DEFAULT_PAPER_FORMATTING;
    lineas.push(fmt.citationForm === 'parenthetical'
        ? 'Citas parentéticas (Apellido, p. N), con la PÁGINA IMPRESA. Tercera persona.'
        : 'Citas en nota al pie (Apellido, "Título", p. N), con la PÁGINA IMPRESA. Tercera persona.');

    // 2. Qué tipo de fuente ancla, según la rúbrica que el autor eligió.
    const verso = paper.rubric?.structuralExpectations.find(e => e.section === 'verse');
    const ancla = ANCLA[verso?.emphasizedTypes[0] ?? ''];
    if (ancla) lineas.push(`Ancla de cada versículo: ${ancla}; el resto contrasta o verifica.`);

    // 3. Qué libros TRANSLITERAN, que es un hecho positivo y verificable.
    //
    //    Y sólo eso. Listar aquí también los que «perdieron» el original sería
    //    repetir el falso positivo que #699 ya había descartado midiendo: de
    //    los 8 libros de producción sin un carácter en lengua original, 2 no
    //    tenían por qué tenerlo —una teología sistemática y una hermenéutica—.
    //    A nivel de FUENTE el cero no distingue «la extracción falló» de «este
    //    libro no cita el original»; sólo distingue cuando se cruza con una
    //    afirmación que sí cita una forma, que es lo que hace la revisión de
    //    citas. Un encuadre que acusa a un libro sano enseña a ignorar el
    //    encuadre.
    const transliteran: string[] = [];
    for (const s of paper.sources) {
        if (!s.citationKey) continue;
        const texto = s.excerpts.map(e => e.text).join('\n');
        if (texto.length < MIN_CHARS_PARA_AFIRMAR_AUSENCIA) continue;
        if (countOriginalLanguageChars(texto) > 0) continue;
        if (classifyOriginalLanguageAbsence(texto) === 'transliterated') transliteran.push(s.citationKey);
    }
    if (transliteran.length > 0) {
        lineas.push(
            `${transliteran.join(', ')} translitera${transliteran.length > 1 ? 'n' : ''} el original: `
            + 'sirve para el argumento, no para citar la forma. Las formas van apoyadas en otra fuente.',
        );
    }

    // 4. Lo citado en la entrega anterior. El sistema reporta el hecho; la
    //    regla de cuántas semanas hay que esperar la pone el sílabo.
    const repetidas = repeatedFromPreviousDelivery(
        paper.sources.map(s => s.citationKey), previous,
    );
    if (repetidas.size > 0 && previous) {
        lineas.push(
            `Ya citadas en la entrega anterior (${previous.title ?? 'trabajo previo'}): `
            + `${[...repetidas].sort().join(', ')}. Si el plan no permite repetir, no deberían entrar.`,
        );
    }

    return lineas.join('\n');
}
