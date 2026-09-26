import { describe, expect, it } from 'vitest';
import { emptySourceReason } from '../SourceType';

/**
 * Tres fuentes seguidas quedaron en cero al armar Santiago 2:1-13, por tres
 * razones distintas, y el usuario vio el mismo cuadro amarillo en las tres.
 */
describe('emptySourceReason — por qué esta fuente quedó sin fragmentos', () => {
    it('una gramática está indexada por categorías: el cero es su forma', () => {
        // Porter: 0 fragmentos con 465 secciones indexadas.
        expect(emptySourceReason('grammar-syntax', 0)).toBe('organized-by-category');
    });

    it('un léxico y un diccionario teológico, por lemas', () => {
        expect(emptySourceReason('lexicon-technical', 0)).toBe('organized-by-lemma');
        expect(emptySourceReason('theological-dictionary', 0)).toBe('organized-by-lemma');
    });

    it('un comentario SÍ se organiza por pasajes: ahí el cero no es la forma', () => {
        // Metzger quedó en cero y no por su forma: su extracción cita
        // capítulos que no existen en el libro, y la única entrada del pasaje
        // salió rotulada con el versículo equivocado.
        for (const tipo of ['commentary-critical', 'commentary-expository', 'textual-commentary'] as const) {
            expect(emptySourceReason(tipo, 0)).toBe('expected-by-passage');
        }
    });

    it('lo desconocido cae en el caso que manda a revisar, no en el que tranquiliza', () => {
        // Decir «es su forma» de un libro cuya forma no conocemos sería
        // explicar un cero que puede ser un defecto.
        expect(emptySourceReason('biblical-text-edition', 0)).toBe('expected-by-passage');
        expect(emptySourceReason('critical-apparatus', 0)).toBe('expected-by-passage');
    });
});

describe('emptySourceReason — con tramos elegidos la respuesta es otra', () => {
    it('elegir páginas y no tener fragmentos NO es «no elegiste nada»', () => {
        // Medido en producción: 32 de las 142 fuentes están así, casi una de
        // cada cuatro. El aviso las mandaba a repetir un trabajo ya hecho.
        expect(emptySourceReason('commentary-critical', 3)).toBe('ranges-without-excerpts');
    });

    it('y manda por encima de la forma del libro, sea cual sea', () => {
        // Con tramos elegidos, explicar que «una gramática se indexa por
        // categorías» es cierto y no viene al caso: lo que falta es extraer.
        for (const tipo of ['grammar-syntax', 'lexicon-technical', 'textual-commentary'] as const) {
            expect(emptySourceReason(tipo, 1)).toBe('ranges-without-excerpts');
        }
    });
});
