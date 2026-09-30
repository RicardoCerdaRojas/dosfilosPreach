import { describe, it, expect } from 'vitest';
import { puntuarGriego, puntuarHebreo } from '../run.mjs';

/**
 * El puntaje decide qué cuenta como acierto. Si es generoso, el banco premia
 * errores; si es mezquino, castiga respuestas correctas escritas de otra forma.
 * Estos casos fijan las dos fronteras.
 */
const todos = c => Object.values(c).every(Boolean);

describe('puntuarGriego', () => {
    const lelymenos = { lema: 'λύω', tiempo: 'perfecto', voz: ['pasiva', 'media'], modo: 'participio', caso: 'nominativo', numero: 'singular', genero: 'masculino' };

    it('acepta la misma respuesta en inglés o como medio-pasiva', () => {
        expect(todos(puntuarGriego(lelymenos, { lema: 'λύω', tiempo: 'perfect', voz: 'medio-pasiva', modo: 'participle', caso: 'nominative', numero: 'singular', genero: 'masculine' }))).toBe(true);
    });

    it('acepta el lema contracto de un verbo en -άω', () => {
        const e = { lema: 'ἀγαπάω', tiempo: 'futuro', voz: ['activa'], modo: 'indicativo', persona: '2', numero: 'singular' };
        expect(puntuarGriego(e, { lema: 'ἀγαπῶ', tiempo: 'futuro', voz: 'activa', modo: 'indicativo', persona: '2', numero: 'singular' }).lema).toBe(true);
    });

    it('castiga la persona equivocada aunque el resto esté bien', () => {
        const e = { lema: 'ἀπόλλυμι', tiempo: 'aoristo', voz: ['activa'], modo: 'subjuntivo', persona: '3', numero: 'singular' };
        expect(puntuarGriego(e, { lema: 'ἀπόλλυμι', tiempo: 'aoristo', voz: 'activa', modo: 'subjuntivo', persona: '2', numero: 'singular' }).persona_o_caso).toBe(false);
    });
});

describe('puntuarHebreo', () => {
    it('acepta la raíz con guiones y el wayyiqtol descrito en palabras', () => {
        expect(todos(puntuarHebreo(
            { raiz: 'אמר', conjugacion: 'qal', forma_verbal: 'wayyiqtol', pgn: '3ms' },
            { raiz: 'א-מ-ר', conjugacion: 'Qal', forma_verbal: 'imperfecto consecutivo (wayyiqtol)', pgn: '3ms' },
        ))).toBe(true);
    });

    it('no confunde un perfecto con un weqatal', () => {
        expect(puntuarHebreo(
            { raiz: 'ברא', conjugacion: 'qal', forma_verbal: 'perfecto', pgn: '3ms' },
            { raiz: 'ברא', conjugacion: 'qal', forma_verbal: 'perfecto consecutivo', pgn: '3ms' },
        ).forma_verbal).toBe(false);
    });

    it('acepta cualquiera de los análisis legítimos de persona', () => {
        expect(puntuarHebreo(
            { raiz: 'יצא', conjugacion: 'qal', forma_verbal: 'imperfecto', pgn: '3fs|2ms' },
            { raiz: 'יצא', conjugacion: 'qal', forma_verbal: 'imperfecto', pgn: '2ms' },
        ).pgn).toBe(true);
    });
});
