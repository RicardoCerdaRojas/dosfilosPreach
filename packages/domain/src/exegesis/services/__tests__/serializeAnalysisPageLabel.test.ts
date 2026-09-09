import { describe, it, expect } from 'vitest';
import { serializeAnalysis } from '../serializeAnalysis';
import { buildEmptyCanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import type { CanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import type { PassageReference } from '../../../bible/canon/passage-reference';

const VERSE: PassageReference = {
    bookId: 'JAS', chapterStart: 1, chapterEnd: 1, verseStart: 5, verseEnd: 5,
};

/** Cita a Metzger en la hoja 719 y a Wallace en la 53. */
function analysis(): CanonicalVerseAnalysis {
    return {
        ...buildEmptyCanonicalVerseAnalysis(VERSE),
        commentatorEngagement: [
            { sourceKey: 'Metzger', page: 719, role: 'technical', position: 'Sobre δοκίμιον.' },
            { sourceKey: 'Wallace', page: 53, role: 'technical', position: 'Cita el versículo.' },
        ],
    };
}

/** Los desfases medidos sobre la biblioteca real. */
const OFFSETS: Record<string, number | null> = { Metzger: -40, Wallace: null };

const label = (sourceKey: string, sheet: number) => {
    const offset = OFFSETS[sourceKey];
    if (offset === null || offset === undefined) return `hoja ${sheet}`;
    const printed = sheet + offset;
    return printed >= 1 ? `p. ${printed}` : `hoja ${sheet}`;
};

describe('serializeAnalysis — rótulo de página', () => {
    it('sin rotulador dice «hoja», porque el número guardado es la hoja', () => {
        // Antes decía «p. 719» y ese era el defecto: el rótulo por defecto
        // afirmaba una página impresa que nadie había medido. Una cita sin
        // `pageKind` es, por definición, anterior a la calibración y lleva la
        // hoja del archivo — decirlo es incompleto; disfrazarlo es falso.
        expect(serializeAnalysis(analysis(), 'es')).toContain('Metzger (hoja 719)');
    });

    it('respeta la pagina impresa que el analisis ya resolvio', () => {
        // Analizado con la numeración del recurso a la vista: el número YA es
        // la página impresa, y volver a convertirlo lo rompería.
        const a = analysis();
        const yaImpresa = {
            ...a,
            commentatorEngagement: a.commentatorEngagement.map(c => ({ ...c, pageKind: 'printed' as const })),
        };
        expect(serializeAnalysis(yaImpresa, 'es')).toContain('Metzger (p. 719)');
    });

    it('convierte a página impresa donde el desfase se pudo medir', () => {
        // Metzger −40: la hoja 719 lleva impreso el 679. Citar 719 mandaba
        // al profesor cuarenta páginas más allá.
        expect(serializeAnalysis(analysis(), 'es', { pageLabel: label }))
            .toContain('Metzger (p. 679)');
    });

    it('dice «hoja» donde no se pudo medir, en vez de convertir a ciegas', () => {
        const out = serializeAnalysis(analysis(), 'es', { pageLabel: label });

        expect(out).toContain('Wallace (hoja 53)');
        expect(out).not.toContain('Wallace (p. 53)');
    });

    it('también reetiqueta la página que el análisis escribió en su prosa', () => {
        // El caso real: la cita estructurada salía convertida y la
        // mención en prosa del mismo párrafo se quedaba con la hoja, así
        // que la misma página aparecía con dos números.
        const conProsa = {
            ...analysis(),
            verseThesis: 'Metzger (p. 719) documenta la variante.',
        };

        const out = serializeAnalysis(conProsa, 'es', {
            pageLabel: label,
            citableKeys: ['Metzger', 'Wallace'],
        });

        expect(out).toContain('Metzger (p. 679) documenta la variante.');
        expect(out).not.toContain('p. 719');
    });

    it('deja la prosa intacta si no se le pasan las claves citables', () => {
        const conProsa = { ...analysis(), verseThesis: 'Metzger (p. 719) documenta la variante.' };

        expect(serializeAnalysis(conProsa, 'es', { pageLabel: label }))
            .toContain('Metzger (p. 719) documenta la variante.');
    });

    it('no toca la cita textual, que es transcripción literal', () => {
        // Reescribir un número dentro de comillas convertiría una copia
        // fiel en una cita que la fuente no dice.
        const conVerbatim = {
            ...buildEmptyCanonicalVerseAnalysis(VERSE),
            commentatorEngagement: [
                {
                    sourceKey: 'Metzger' as const,
                    page: 719,
                    role: 'technical' as const,
                    position: 'Sobre δοκίμιον.',
                    verbatimQuote: 'as noted above in p. 719 of this volume',
                },
            ],
        };

        const out = serializeAnalysis(conVerbatim, 'es', {
            pageLabel: label,
            citableKeys: ['Metzger'],
        });

        expect(out).toContain('[verbatim: "as noted above in p. 719 of this volume"]');
    });

    it('se queda en la hoja si la conversión cayera antes de la primera página', () => {
        const early = {
            ...buildEmptyCanonicalVerseAnalysis(VERSE),
            commentatorEngagement: [
                { sourceKey: 'Metzger', page: 5, role: 'technical' as const, position: 'Preliminares.' },
            ],
        };

        expect(serializeAnalysis(early, 'es', { pageLabel: label })).toContain('Metzger (hoja 5)');
    });
});
