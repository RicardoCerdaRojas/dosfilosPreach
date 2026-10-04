import { describe, expect, it } from 'vitest';
import { buildOutline } from '../preachOutline';

const movimiento = [
    '> **Jonás 4:5-8** — 5 Y salió Jonás de la ciudad, y acampó hacia el oriente de la ciudad, y se hizo allí una enramada.',
    '> 6 Y preparó Jehová Dios una calabacera.',
    '',
    'El desprecio por Nínive revela algo. **Ama la planta, no al Dios que la preparó.** Y eso nos confronta.',
    '',
    'Jonás sale de Nínive y se sienta a esperar. Su salida muestra que no le importa la ciudad.',
    '',
    '### Ilustración',
    '* El rey Luis XVI escribió «Rien» el 14 de julio.',
    '1. Primero, *mirar* lo que Dios prepara.',
    '2. Segundo, la gracia.',
].join('\n');

describe('bosquejo de un movimiento (C7)', () => {
    const outline = buildOutline(movimiento);

    it('la cita queda como un recordatorio de una línea, sin el markdown', () => {
        expect(outline[0]).toMatchObject({ kind: 'quote' });
        expect(outline[0]!.text.startsWith('Jonás 4:5-8 —')).toBe(true);
        expect(outline.filter((i) => i.kind === 'quote')).toHaveLength(1);
    });

    it('de un párrafo con negrita queda la negrita; sin negrita, la primera oración', () => {
        expect(outline).toContainEqual({ kind: 'emphasis', text: 'Ama la planta, no al Dios que la preparó.' });
        expect(outline).toContainEqual({ kind: 'cue', text: 'Jonás sale de Nínive y se sienta a esperar.' });
    });

    it('subtítulos y viñetas completas, con su número y sin asteriscos', () => {
        expect(outline).toContainEqual({ kind: 'heading', text: 'Ilustración' });
        expect(outline).toContainEqual({ kind: 'point', text: 'El rey Luis XVI escribió «Rien» el 14 de julio.' });
        expect(outline).toContainEqual({ kind: 'point', text: 'Primero, mirar lo que Dios prepara.', ordinal: '1' });
    });

    it('un párrafo larguísimo sin punto se recorta', () => {
        const [cue] = buildOutline('palabra '.repeat(80));
        expect(cue!.text.length).toBeLessThanOrEqual(140);
        expect(cue!.text.endsWith('…')).toBe(true);
    });
});
