import { describe, it, expect } from 'vitest';
import { parseBriefQuestions, questionsForVerse, unansweredQuestions } from '../briefQuestions';

/**
 * El encuadre real del trabajo de Santiago 2:1–13.
 *
 * El análisis de 2:2 SÍ decía dónde estaba la apódosis; la prosa compuesta no
 * lo mencionaba. El dato existía y se recortó, porque nada le decía al
 * compositor que esa frase era justamente lo que el profesor preguntaba.
 */
const ENCUADRE = [
    'Trabajo práctico semanal de exégesis del NT sobre Santiago 2:1-13. NO es un paper exegético completo.',
    '',
    'Preguntas, en este orden:',
    '1. ¿Cómo están funcionando los genitivos τοῦ κυρίου ἡμῶν Ἰησοῦ Χριστοῦ τῆς δόξης (Stg. 2:1)?',
    '2. ¿Cómo funciona ἐὰν (Stg. 2:2)? ¿Qué relación tiene con el versículo 4?',
    '3. ¿Qué significa la conjunción μέντοι (Stg. 2:8)?',
    '4. ¿Cómo está funcionando el participio ἐλεγχόμενοι (Stg. 2:9)?',
    '',
    'Cada pregunta vale 20 puntos. Se califica la interacción genuina con las fuentes.',
].join('\n');

describe('parseBriefQuestions', () => {
    const qs = parseBriefQuestions(ENCUADRE);

    it('encuentra las cuatro y sólo las cuatro', () => {
        expect(qs.map(q => q.number)).toEqual([1, 2, 3, 4]);
    });

    it('el párrafo de criterios no se pega a la última pregunta', () => {
        expect(qs[3]!.text).not.toContain('20 puntos');
    });

    it('la pregunta 2 nombra su versículo Y el que necesita mirar', () => {
        expect(qs[1]!.verses).toEqual([{ chapter: 2, verse: 2 }, { chapter: 2, verse: 4 }]);
    });

    it('«el versículo 4» hereda el capítulo de la referencia que lo precede', () => {
        const q = parseBriefQuestions('1. ¿Y en 3:7? ¿Qué relación tiene con el versículo 9?')[0]!;
        expect(q.verses).toEqual([{ chapter: 3, verse: 7 }, { chapter: 3, verse: 9 }]);
    });

    it('un versículo suelto sin referencia delante se descarta', () => {
        // Inventarle un capítulo mandaría la pregunta a la sección equivocada.
        expect(parseBriefQuestions('1. ¿Qué pasa en el versículo 4?')[0]!.verses).toEqual([]);
    });

    it('una pregunta partida en dos renglones sigue siendo una', () => {
        const qs2 = parseBriefQuestions('1. ¿Cómo funciona ἐάν (Stg. 2:2)?\n¿Qué relación tiene con el versículo 4?');
        expect(qs2).toHaveLength(1);
        expect(qs2[0]!.verses).toHaveLength(2);
    });

    it('un encuadre en prosa, sin preguntas, devuelve vacío', () => {
        // Respuesta legítima: hay trabajos que se encargan así.
        expect(parseBriefQuestions('Analiza el uso de los participios en el capítulo.')).toEqual([]);
        expect(parseBriefQuestions(null)).toEqual([]);
    });
});

describe('questionsForVerse', () => {
    const qs = parseBriefQuestions(ENCUADRE);

    it('cada versículo recibe la suya', () => {
        expect(questionsForVerse(qs, 2, 1).map(q => q.number)).toEqual([1]);
        expect(questionsForVerse(qs, 2, 2).map(q => q.number)).toEqual([2]);
        expect(questionsForVerse(qs, 2, 8).map(q => q.number)).toEqual([3]);
        expect(questionsForVerse(qs, 2, 9).map(q => q.number)).toEqual([4]);
    });

    it('la manda el PRIMER versículo que nombra, no todos', () => {
        // La pregunta 2 nombra 2:2 y 2:4. Repartirla a las dos haría que dos
        // secciones contestaran lo mismo.
        expect(questionsForVerse(qs, 2, 4)).toEqual([]);
    });

    it('un versículo que ninguna pregunta nombra no recibe nada', () => {
        expect(questionsForVerse(qs, 2, 5)).toEqual([]);
    });
});

describe('unansweredQuestions', () => {
    const qs = parseBriefQuestions(ENCUADRE);

    it('con los cuatro versículos elegidos, no falta ninguna', () => {
        const elegidos = [1, 2, 8, 9].map(verse => ({ chapter: 2, verse }));
        expect(unansweredQuestions(qs, elegidos)).toEqual([]);
    });

    it('si falta un versículo, dice qué pregunta se queda sin responder', () => {
        const elegidos = [1, 2, 8].map(verse => ({ chapter: 2, verse }));
        expect(unansweredQuestions(qs, elegidos).map(q => q.number)).toEqual([4]);
    });

    it('una pregunta que no nombra versículo cuenta como no respondida', () => {
        // No se puede repartir, así que nadie la tiene a cargo. Callarlo sería
        // exactamente el fallo silencioso que esto viene a evitar.
        const sueltas = parseBriefQuestions('1. ¿Cuál es la tesis del pasaje?');
        expect(unansweredQuestions(sueltas, [{ chapter: 2, verse: 1 }])).toHaveLength(1);
    });
});
