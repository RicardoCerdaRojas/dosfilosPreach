import { describe, it, expect } from 'vitest';
import { citationsLost, insertIdea, paragraphHeadings, proseParagraphs } from '../ideaPlacement';

/**
 * TP #6 (#22): para sumar una evidencia (Mayor, pp. 14 y 111) había que
 * recomponer la sección entera. «Agregar una idea» inserta una oración y no
 * toca nada más.
 */
const PROSA = [
    '### Pregunta 2',
    '',
    'El genitivo σοφίας es epexegético. La mansedumbre consiste en sabiduría (McCartney, 198).',
    '',
    'Otra lectura lo toma como fuente.\nSigue en la línea siguiente.',
].join('\n');

describe('insertIdea — el resto queda idéntico', () => {
    it('los párrafos no cuentan los encabezados', () => {
        expect(proseParagraphs(PROSA)).toHaveLength(2);
    });

    it('entra después de la oración de referencia, y fuera de eso nada cambia', () => {
        const r = insertIdea(PROSA, {
            paragraphIndex: 0,
            afterSentence: 'El genitivo σοφίας es epexegético.',
            sentence: 'Mayor lo apoya con ejemplos paralelos (Mayor, 14).',
        });
        expect(r.anchored).toBe(true);
        expect(r.markdown).toBe(PROSA.replace(
            'epexegético. La',
            'epexegético. Mayor lo apoya con ejemplos paralelos (Mayor, 14). La',
        ));
        expect(r.paragraph).toContain('Mayor lo apoya');
    });

    it('sin oración de referencia, o si no está, va al final del párrafo', () => {
        const r = insertIdea(PROSA, { paragraphIndex: 1, afterSentence: 'no existe', sentence: 'Idea (Ropes, 244).' });
        expect(r.anchored).toBe(false);
        expect(r.markdown.endsWith('Sigue en la línea siguiente. Idea (Ropes, 244).')).toBe(true);
        expect(r.markdown.startsWith(PROSA.slice(0, PROSA.indexOf('Otra lectura')))).toBe(true);
    });

    it('un índice fuera de rango se acota al último párrafo', () => {
        expect(insertIdea(PROSA, { paragraphIndex: 9, afterSentence: '', sentence: 'X.' }).paragraphIndex).toBe(1);
    });

    it('sin prosa, la idea es el texto', () => {
        expect(insertIdea('', { paragraphIndex: 0, afterSentence: '', sentence: 'Sola.' }).markdown).toBe('Sola.');
    });
});

describe('citationsLost — la cita que el estudiante verificó no se pierde', () => {
    it('igual aunque cambie «pp.» por la forma sin «p.»', () => {
        expect(citationsLost('Mayor lo dice (Mayor, pp. 14 y 111)', 'Así lo muestra Mayor (Mayor, 14 y 111).')).toEqual([]);
    });
    it('si la redacción la perdió, se avisa', () => {
        expect(citationsLost('Mayor lo dice (Mayor, 14)', 'Así lo muestra Mayor.')).toEqual(['(Mayor, 14)']);
    });
});

/** Revisión adversarial de «Agregar una idea». */
describe('insertIdea — bordes', () => {
    it('sin el punto final en la referencia, igual corta en el fin de la oración', () => {
        const r = insertIdea('Uno dice algo. Dos sigue.', { paragraphIndex: 0, afterSentence: 'Uno dice algo', sentence: 'Nueva (Mayor, 14).' });
        expect(r.markdown).toBe('Uno dice algo. Nueva (Mayor, 14). Dos sigue.');
    });
    it('con sólo el comienzo de la oración, la idea va después de la oración entera', () => {
        const r = insertIdea('La sabiduría es pura y pacífica. Otra.', { paragraphIndex: 0, afterSentence: 'La sabiduría es pura', sentence: 'X.' });
        expect(r.markdown).toBe('La sabiduría es pura y pacífica. X. Otra.');
    });
    it('un encabezado pegado corta el bloque, y listas y tablas no se ofrecen', () => {
        const md = '## Sub\nPárrafo uno.\n- ítem uno.\n\n| a | b |\n\nTexto.\n## Sig';
        expect(proseParagraphs(md)).toEqual(['Párrafo uno.\n- ítem uno.', 'Texto.']);
        const r = insertIdea(md, { paragraphIndex: 1, afterSentence: '', sentence: 'X.' });
        expect(r.markdown).toBe('## Sub\nPárrafo uno.\n- ítem uno.\n\n| a | b |\n\nTexto. X.\n## Sig');
    });
    it('con CRLF, los párrafos se separan igual', () => {
        expect(proseParagraphs('Uno.\r\n\r\nDos.')).toEqual(['Uno.', 'Dos.']);
    });
});

describe('citationsLost — por autor y página', () => {
    it('sin alarmas falsas', () => {
        expect(citationsLost('dice (Mayor 14)', 'lo dice (Mayor, 14).')).toEqual([]);
        expect(citationsLost('dice (cf. Mayor, p. 14)', 'lo dice (Mayor, 14).')).toEqual([]);
        expect(citationsLost('dice (Mayor, 14; Moo, 170)', 'lo dice (Mayor, 14) y (Moo, 170).')).toEqual([]);
        expect(citationsLost('como en (Stg 3:7)', 'como en Santiago 3:7.')).toEqual([]);
    });
    it('una página romana perdida, se avisa', () => {
        expect(citationsLost('dice (Moo, xiv)', 'lo dice Moo.')).toEqual(['(Moo, xiv)']);
    });
});

describe('paragraphHeadings — qué pregunta responde cada párrafo', () => {
    it('cada párrafo lleva el encabezado bajo el que está', () => {
        const md = '# Santiago 3:13-18\n\n## ¿Qué modifica…?\n\nUno.\n\nDos.\n\n## ¿Cuál es el sujeto…?\n\nTres.';
        expect(paragraphHeadings(md)).toEqual(['¿Qué modifica…?', '¿Qué modifica…?', '¿Cuál es el sujeto…?']);
        expect(paragraphHeadings('Sin encabezados.')).toEqual([null]);
    });
});
