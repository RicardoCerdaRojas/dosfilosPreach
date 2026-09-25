/**
 * Las preguntas del encuadre, y a qué sección le toca cada una.
 *
 * El encuadre YA llegaba al compositor, rotulado «BRIEF DEL PAPER (contexto,
 * no lo repitas)»: se le entregaba como trasfondo que debía ignorar, que es lo
 * contrario de una tarea. Y aunque se reetiquetara, el compositor de un
 * versículo vería las CUATRO preguntas sin saber cuál es la suya.
 *
 * Medido sobre el trabajo de Santiago 2:1–13: el análisis de 2:2 decía «los
 * verbos principales de la oración completa (la apódosis) se encuentran en los
 * versículos 3 y 4: ἐπιβλέψητε, διεκρίθητε, y ἐγένεσθε», y la prosa compuesta
 * no lo mencionaba. El dato existía y se recortó, porque nada decía que esa
 * frase era justamente lo que el profesor preguntaba.
 */

/** Una pregunta numerada del encuadre. */
export interface BriefQuestion {
    /** El número tal como lo escribió el profesor. */
    number: number;
    text: string;
    /**
     * Versículos que la pregunta nombra, en orden de aparición.
     *
     * El PRIMERO decide de quién es la pregunta. Los demás son evidencia que
     * hay que alcanzar: «¿Qué relación tiene con el versículo 4?» pertenece a
     * 2:2 y necesita mirar 2:4, no al revés.
     */
    verses: ReadonlyArray<{ chapter: number; verse: number }>;
}

/** Una línea que abre pregunta: «1.», «2)», «3 -». */
const ABRE_PREGUNTA = /^\s*(\d{1,2})\s*[.)\-]\s+(.*)$/;

/**
 * Referencias dentro del texto de una pregunta.
 *
 * Dos formas, porque el profesor usa las dos en el mismo renglón: «(Stg. 2:2)»
 * da capítulo y versículo, y «el versículo 4» da sólo el versículo y hereda el
 * capítulo de la referencia anterior de esa misma pregunta.
 */
const CAPITULO_VERSICULO = /(\d{1,3}):(\d{1,3})/g;
const VERSICULO_SUELTO = /(?:vers[íi]culo|v\.)\s*(\d{1,3})/gi;

/**
 * Las preguntas numeradas del encuadre, en su orden.
 *
 * Una línea sin número continúa la pregunta anterior: un profesor parte una
 * pregunta larga en dos renglones y eso no la convierte en dos preguntas.
 *
 * Vacío cuando el encuadre no viene en forma de preguntas, que es una
 * respuesta legítima y no un error: hay trabajos que se encargan en prosa.
 */
export function parseBriefQuestions(brief: string | null | undefined): BriefQuestion[] {
    const lineas = (brief ?? '').split('\n');
    const out: Array<{ number: number; partes: string[] }> = [];

    for (const linea of lineas) {
        const m = linea.match(ABRE_PREGUNTA);
        if (m) {
            out.push({ number: Number(m[1]), partes: [m[2]!.trim()] });
            continue;
        }
        // Una línea suelta sólo continúa si ya hay una pregunta abierta y la
        // línea no está en blanco: el párrafo de criterios que va DESPUÉS de
        // las preguntas se pegaría a la última.
        const texto = linea.trim();
        if (out.length > 0 && texto && !/^\s*$/.test(texto) && texto.startsWith('¿')) {
            out[out.length - 1]!.partes.push(texto);
        }
    }

    return out.map(({ number, partes }) => {
        const text = partes.join(' ').trim();
        return { number, text, verses: versesIn(text) };
    });
}

function versesIn(texto: string): Array<{ chapter: number; verse: number }> {
    const out: Array<{ chapter: number; verse: number; at: number }> = [];

    CAPITULO_VERSICULO.lastIndex = 0;
    for (let m = CAPITULO_VERSICULO.exec(texto); m; m = CAPITULO_VERSICULO.exec(texto)) {
        out.push({ chapter: Number(m[1]), verse: Number(m[2]), at: m.index });
    }

    VERSICULO_SUELTO.lastIndex = 0;
    for (let m = VERSICULO_SUELTO.exec(texto); m; m = VERSICULO_SUELTO.exec(texto)) {
        // Hereda el capítulo de la referencia completa que la precede. Sin
        // ninguna delante, no se puede resolver y se descarta: inventar un
        // capítulo mandaría la pregunta a la sección equivocada.
        const previa = out.filter(r => r.at < m!.index).pop();
        if (previa) out.push({ chapter: previa.chapter, verse: Number(m[1]), at: m.index });
    }

    return out
        .sort((a, b) => a.at - b.at)
        .filter((r, i, todas) => todas.findIndex(x => x.chapter === r.chapter && x.verse === r.verse) === i)
        .map(({ chapter, verse }) => ({ chapter, verse }));
}

/**
 * De qué sección es cada pregunta: la del PRIMER versículo que nombra.
 *
 * «¿Qué relación tiene con el versículo 4?» pertenece a 2:2 —que es donde está
 * ἐάν— y necesita mirar 2:4. Repartirla también a 2:4 haría que dos secciones
 * contestaran lo mismo.
 */
export function questionsForVerse(
    questions: ReadonlyArray<BriefQuestion>,
    chapter: number,
    verse: number,
): BriefQuestion[] {
    return questions.filter(q => {
        const dueña = q.verses[0];
        return !!dueña && dueña.chapter === chapter && dueña.verse === verse;
    });
}

/**
 * Preguntas que ninguna de las secciones dadas va a responder.
 *
 * Es el aviso que convierte un documento incompleto —que hoy se descubre
 * leyendo— en algo que el sistema dice antes de exportar.
 */
export function unansweredQuestions(
    questions: ReadonlyArray<BriefQuestion>,
    verses: ReadonlyArray<{ chapter: number; verse: number }>,
): BriefQuestion[] {
    return questions.filter(q => {
        const dueña = q.verses[0];
        if (!dueña) return true;
        return !verses.some(v => v.chapter === dueña.chapter && v.verse === dueña.verse);
    });
}
