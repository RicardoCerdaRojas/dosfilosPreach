import { describe, it, expect } from 'vitest';
import type { FeedbackPattern } from '@dosfilos/domain';
import { matchPattern, proposeFeedbackKind, sentencesOf, similarPattern, suggestPatternName } from '../pdfFeedback';
import { importRowFromNote, importRowProblem, importRowToCorrection, withComment } from '../pdfImportRows';
import { NUEVO, newRow, rowToInput, rowIsValid, savedRow, withKind } from '../feedbackRows';
import { anchorLabel, shortQuote } from '../courseDeskFormat';

/**
 * Lo que propone el diálogo de la devolución para cada comentario del PDF:
 * la clase (una propuesta, nunca una decisión), el nombre del patrón y el
 * patrón existente que se ofrece reutilizar.
 */

// Los 14 comentarios con texto del TI #1 del Salmo 23 (el 15.º es una marca sin texto), tal como los dejó el profesor en Canvas.
const TI1: Array<[string, 'strength' | 'correction']> = [
    ['Revisa el detalle de espaciado antes y después de títulos.', 'correction'],
    ['Muy buena tesis: no es meramente descriptiva («este trabajo analiza...»), sino una afirmación interpretativa concreta y verificable.', 'strength'],
    ['Transparencia metodológica ejemplar.', 'strength'],
    ['Distinción textual-crítica correcta y necesaria.', 'strength'],
    ['Fuente muy específica aplicada con precisión al problema real de la ambigüedad de רֹעִי.', 'strength'],
    ['No solo reportas el desacuerdo, sino que decides entre las posturas con tu propio argumento, presentándolo correctamente como tu elección interpretativa, no como un hecho gramatical incontrovertible.', 'strength'],
    ['Sobresaliente: evalúas la conjetura editorial con tus propios criterios (ningún manuscrito la respalda + rompería el paralelismo estructural) y la rechazas con argumentos, no solo la reportas. Esto es exactamente crítica textual bien hecha.', 'strength'],
    ['Explicación correcta y bien aplicada.', 'strength'],
    ['Este apóstrofe no es de redacción, sino de programación.', 'correction'],
    ['Disciplina exegética excelente; muchos exégetas asumen automáticamente que todo Piel implica intensidad frente a un Qal, y aquí verificas el dato léxico antes de afirmar nada.', 'strength'],
    ['Explicación precisa y económica del Polel.', 'strength'],
    ['Excelente hallazgo y aplicación.', 'strength'],
    ['Sólido.', 'strength'],
    ['Excelente cierre: vuelves explícitamente a la tesis y la sostienes con lo que demostraste, verso por verso.', 'strength'],
];

describe('la clase propuesta', () => {
    it('los comentarios del TI #1: elogio → fortaleza, lo demás → corrección', () => {
        expect(TI1.map(([c]) => proposeFeedbackKind(c).kind)).toEqual(TI1.map(([, k]) => k));
    });

    it('sin texto: corrección marcada «sin comentario»', () => {
        expect(proposeFeedbackKind('')).toEqual({ kind: 'correction', reason: 'empty' });
        expect(proposeFeedbackKind('   ')).toEqual({ kind: 'correction', reason: 'empty' });
        expect(proposeFeedbackKind(null)).toEqual({ kind: 'correction', reason: 'empty' });
    });

    it('un elogio negado o un comentario que pide un cambio es corrección', () => {
        expect(proposeFeedbackKind('No es correcto: el verbo es piel.').kind).toBe('correction');
        expect(proposeFeedbackKind('Poco preciso.').kind).toBe('correction');
        expect(proposeFeedbackKind('Incorrecto.').kind).toBe('correction');
        expect(proposeFeedbackKind('Buena idea, pero falta la cita.').kind).toBe('correction');
        expect(proposeFeedbackKind('Excelente, aunque revisa la nota 4.').kind).toBe('correction');
        // «precisamente» es «justamente», no un elogio.
        expect(proposeFeedbackKind('Precisamente aquí cambia el sujeto.').kind).toBe('correction');
    });

    it('lo que pide un cambio nunca sale fortaleza (revisión adversarial): imperativos, matices, reparos, preguntas', () => {
        const casos = [
            'Precisa la fuente de esta cita', 'Precisa mejor la tesis', '¿Es correcto esto?', 'Solo el primero es correcto',
            'No es del todo precisa', 'Muy buena tesis. Solo agrega la referencia', 'Excelente. Agrega el número de página.',
            'Muy bien. Cambia "afimar" por "afirmar".', 'Excelente idea; sería mejor citar a Waltke', 'Muy bien, aunque convendría citar la página',
            'Correcto, aunque no queda claro el sujeto', 'Notable el uso del hebreo; cuida las tildes', 'Correcta la categoría, mal la traducción',
            'Strong claim, but needs support', 'Nice, needs a citation',
            // Frase por frase: una que no es elogio basta.
            'Excelente. El sujeto cambia en el v. 3.',
            // Solo el matiz: «aunque» basta.
            'Correcto, aunque el orden de las palabras importa.',
            // «precisamente» es «justamente», no un elogio.
            'Precisamente aquí empieza la segunda estrofa.',
        ];
        expect(casos.filter(c => proposeFeedbackKind(c).kind !== 'correction')).toEqual([]);
    });

    it('las frases: no corta en «analiza...»)» ni en «v. 3»', () => {
        expect(sentencesOf('Muy buena tesis: no es meramente descriptiva («este trabajo analiza...»), sino una afirmación.')).toHaveLength(1);
        expect(sentencesOf('Excelente. Agrega la página.')).toEqual(['Excelente.', 'Agrega la página.']);
        expect(sentencesOf('Bien en el v. 3 y en el v. 4.')).toHaveLength(1);
    });

    it('en inglés también', () => {
        expect(proposeFeedbackKind('Excellent analysis.').kind).toBe('strength');
        expect(proposeFeedbackKind('Well done.').kind).toBe('strength');
        expect(proposeFeedbackKind('Not correct.').kind).toBe('correction');
        expect(proposeFeedbackKind('Check the spacing here.').kind).toBe('correction');
    });
});

describe('el nombre propuesto del patrón', () => {
    it('la primera frase (hasta el punto, los dos puntos o el punto y coma)', () => {
        expect(suggestPatternName('Muy buena tesis: no es meramente descriptiva.')).toBe('Muy buena tesis');
        expect(suggestPatternName('Disciplina exegética excelente; muchos exégetas asumen…')).toBe('Disciplina exegética excelente');
        expect(suggestPatternName('Sólido.')).toBe('Sólido');
        expect(suggestPatternName('Sin punto final')).toBe('Sin punto final');
        expect(suggestPatternName('')).toBe('');
    });

    it('no corta en abreviaturas ni en fichas cortas: «v. 14», «Cf.», «p. 5», «Ej.», «s.v.»', () => {
        expect(suggestPatternName('v. 14: cierre doble en la conclusión.')).toBe('v. 14: cierre doble en la conclusión');
        expect(suggestPatternName('Cf. Waltke 2007, p. 45.')).toBe('Cf. Waltke 2007, p. 45');
        expect(suggestPatternName('p. 5 falta la cita.')).toBe('p. 5 falta la cita');
        expect(suggestPatternName('Ej. «ἀπολέσαι». Mejor sin glosa.')).toBe('Ej. «ἀπολέσαι»');
        expect(suggestPatternName('BDAG s.v. λόγος no dice eso.')).toBe('BDAG s.v. λόγος no dice eso');
        // Una abreviatura de más de tres letras («Ibid.») tampoco corta; una ficha corta que no es abreviatura («Lev.») tampoco.
        expect(suggestPatternName('Mismo error que en Ibid. y en la nota 5.')).toBe('Mismo error que en Ibid. y en la nota 5');
        expect(suggestPatternName('Revisa la cita de Lev. 19 sobre el prójimo.')).toBe('Revisa la cita de Lev. 19 sobre el prójimo');
        // Dos comentarios que empiezan con «v.» ya no se funden en un patrón «v».
        expect(suggestPatternName('v. 3: falta la glosa.')).not.toBe(suggestPatternName('v. 14: cierre doble.'));
    });

    it('a 60 caracteres como mucho, en una palabra, con «…»', () => {
        const n = suggestPatternName('Fuente muy específica aplicada con precisión al problema real de la ambigüedad de רֹעִי.');
        expect(n).toBe('Fuente muy específica aplicada con precisión al problema…');
        expect(n.length).toBeLessThanOrEqual(60);
    });
});

describe('el patrón existente', () => {
    const patrones: FeedbackPattern[] = [
        { id: 'esp', name: 'Espaciado de títulos', decision: 'pending' },
        { id: 'dtc', name: 'Distinción textual-crítica', kind: 'strength', decision: 'pending' },
        { id: 'sol', name: 'Sólido', kind: 'strength', decision: 'pending' },
    ];

    it('el mismo nombre (normalizado) y la misma clase se reutiliza; de la otra clase choca', () => {
        expect(matchPattern(patrones, 'espaciado de TÍTULOS.', 'correction').same?.id).toBe('esp');
        expect(matchPattern(patrones, 'Espaciado de títulos', 'strength')).toEqual({ same: null, clash: patrones[0] });
        expect(matchPattern(patrones, 'Otro', 'correction')).toEqual({ same: null, clash: null });
    });

    it('se ofrece el de la misma clase cuyo nombre aparece en el comentario (de 8 letras o más)', () => {
        expect(similarPattern(patrones, 'Distinción textual-crítica correcta y necesaria.', 'strength')?.id).toBe('dtc');
        expect(similarPattern(patrones, 'Distinción textual-crítica correcta y necesaria.', 'correction')).toBeNull();
        // «Sólido» es muy corto para ofrecerlo por aparecer en otro comentario.
        expect(similarPattern(patrones, 'Un argumento sólido y claro.', 'strength')).toBeNull();
    });

    it('una fila del PDF: propuesta, nombre que sigue al comentario hasta tocarlo, problemas y su fila del registro', () => {
        const fila = importRowFromNote({ sheet: 11, page: '9', author: 'Profesor', text: '', quote: 'permite afimar' });
        expect(fila).toMatchObject({ choice: 'correction', proposal: { reason: 'empty' }, name: '' });
        // Una marca sin texto pide escribir qué era.
        expect(importRowProblem(fila, patrones)).toBe('comment');
        const escrita = withComment(fila, 'Errata: «afimar». Revisa la ortografía.');
        // «Errata» es corto: el nombre sigue hasta el corte siguiente.
        expect(escrita.name).toBe('Errata: «afimar»');
        expect(importRowProblem(escrita, patrones)).toBeNull();
        const tocada = withComment({ ...escrita, name: 'Ortografía', nameTouched: true }, 'Otra cosa.');
        expect(tocada.name).toBe('Ortografía');
        expect(importRowToCorrection(escrita, patrones)).toMatchObject({
            kind: 'correction', patternId: NUEVO, patternName: 'Errata: «afimar»', note: 'Errata: «afimar». Revisa la ortografía.', page: '9', quote: 'permite afimar',
        });
        // Ignorada: no pasa al registro y no bloquea.
        expect(importRowProblem({ ...fila, choice: 'ignore' }, patrones)).toBeNull();
        expect(importRowToCorrection({ ...escrita, choice: 'ignore' }, patrones)).toBeNull();
        // Un nombre de la otra clase bloquea; el mismo de la misma clase va a ese patrón.
        expect(importRowProblem({ ...escrita, name: 'Sólido' }, patrones)).toBe('clash');
        expect(importRowToCorrection({ ...escrita, choice: 'strength', name: 'sólido' }, patrones)).toMatchObject({ patternId: 'sol', patternName: '' });
        // Elegido para sumarse a otro patrón.
        expect(importRowToCorrection({ ...escrita, choice: 'strength', reuseId: 'dtc' }, patrones)).toMatchObject({ kind: 'strength', patternId: 'dtc' });
    });
});

describe('las filas del registro', () => {
    const patrones: FeedbackPattern[] = [
        { id: 'cd', name: 'Cierre doble', decision: 'pending' },
        { id: 'tc', name: 'Crítica textual bien hecha', kind: 'strength', decision: 'pending' },
    ];

    it('una fila nueva trae el primer patrón de su clase; cambiar de clase cambia de patrón', () => {
        const r = newRow(patrones);
        expect(r.patternId).toBe('cd');
        expect(withKind(r, 'strength', patrones).patternId).toBe('tc');
        expect(withKind({ ...r, patternId: NUEVO, patternName: 'Glosa' }, 'strength', patrones)).toMatchObject({ patternId: NUEVO, patternName: 'Glosa', kind: 'strength' });
        expect(newRow([], 'strength').patternId).toBe(NUEVO);
        // Una guardada no se muda en silencio al primer patrón de la otra clase.
        expect(withKind({ ...r, saved: true }, 'strength', patrones)).toMatchObject({ patternId: NUEVO, patternName: '', kind: 'strength' });
    });

    it('a `recordFeedback`: el patrón nuevo con su clase y el ancla solo con lo que tiene (sin `undefined`)', () => {
        expect(rowToInput({ ...newRow(patrones, 'strength'), patternId: NUEVO, patternName: ' Tesis ', note: ' Muy buena. ', page: ' 1 ', quote: '' }))
            .toEqual({ patternName: 'Tesis', patternKind: 'strength', note: 'Muy buena.', anchor: { page: '1' } });
        expect(rowToInput(newRow(patrones))).toEqual({ patternId: 'cd' });
        const guardada = savedRow({ id: 'c1', patternId: 'tc', note: 'x', anchor: { page: '6', quote: "Waltke y O'Connor" } }, patrones);
        expect(guardada).toMatchObject({ kind: 'strength', page: '6', quote: "Waltke y O'Connor", saved: true });
        expect(rowToInput(guardada)).toEqual({ id: 'c1', patternId: 'tc', note: 'x', anchor: { page: '6', quote: "Waltke y O'Connor" } });
    });

    it('un nombre nuevo que ya usa un patrón de la otra clase no vale', () => {
        expect(rowIsValid({ ...newRow(patrones, 'strength'), patternId: NUEVO, patternName: 'cierre doble' }, patrones)).toBe(false);
        expect(rowIsValid({ ...newRow(patrones, 'correction'), patternId: NUEVO, patternName: 'cierre doble' }, patrones)).toBe(true);
    });
});

describe('cómo se lee el ancla', () => {
    const t = (k: string, o?: Record<string, unknown>) => `${k}:${String(o?.page)}`;
    it('«p. 6 · «frase»»; una página que no es número va tal cual; la frase larga se corta', () => {
        expect(anchorLabel({ page: '6', quote: "Waltke y O'Connor" }, t)).toBe("feedback.anchorPage:6 · «Waltke y O'Connor»");
        expect(anchorLabel({ page: 'iv' }, t)).toBe('feedback.anchorPage:iv');
        expect(anchorLabel({ page: 'hoja 6', quote: null }, t)).toBe('hoja 6');
        // La hoja sin número se guarda neutral y se lee traducida.
        expect(anchorLabel({ page: 'h. 5' }, (k, o) => `${k}:${String(o?.n)}`)).toBe('feedback.anchorSheet:5');
        expect(anchorLabel(null, t)).toBe('');
        expect(shortQuote('una frase bastante larga para el tope', 20)).toBe('una frase bastante…');
    });
});
