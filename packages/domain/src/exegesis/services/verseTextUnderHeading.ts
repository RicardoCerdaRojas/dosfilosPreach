import { formatPassageReference } from '../../bible/canon/passage-reference';
import type { ExegeticalPaper } from '../entities/ExegeticalPaper';
import { sectionHeadingKey } from './composedVerseSections';

/**
 * El texto del versículo bajo su título, como el TI #1 entregado (B68c):
 * debajo de cada título de versículo, el hebreo con vocales y sin acentos,
 * y la traducción del trabajo entre comillas.
 */
export interface VerseTextBlock {
    original: string;
    translation: string;
}

/**
 * El hebreo con vocales y sin acentos: sin te'amim (U+0591–U+05AF), sin
 * meteg (U+05BD) y sin paseq (U+05C0). Con vocales, maqaf y sof pasuq.
 *
 * Medido contra el TI #1: el WLC de Sal 23:1–3 sin te'amim ni meteg es
 * idéntico (en NFC) a lo que el fundador entregó. El paseq no aparecía en
 * esos versículos; se quita porque es del sistema de acentos (legarmeh), y
 * en Sal 23:5–6 quedaba como una barra suelta. El griego no se toca: sus
 * acentos son ortografía.
 */
export function originalWithoutAccents(text: string): string {
    return text
        .normalize('NFC')
        .replace(/[\u0591-\u05AF\u05BD]/g, '')
        .replace(/\s*\u05C0/g, '')
        .replace(/\//g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .normalize('NFC');
}

/** «…», salvo que la traducción ya venga entre comillas. */
function entreComillas(text: string): string {
    const t = text.trim().replace(/^["“«]+|["”»]+$/g, '').trim();
    return t ? `«${t}»` : '';
}

/**
 * El texto de cada versículo del trabajo, por la clave de su título
 * (`sectionHeadingKey` del rótulo del pasaje, el mismo que escribe el
 * ensamble). Solo entran los versículos con análisis y texto original: sin
 * análisis no hay de dónde sacar ni el texto ni la traducción del trabajo.
 *
 * Un trabajo que responde preguntas titula sus secciones con la pregunta, y
 * esa clave no coincide con ningún versículo: no lleva el texto debajo. Es
 * lo que se busca: el TP responde, el trabajo de investigación presenta el
 * versículo.
 */
export function verseTextBlocks(paper: Pick<ExegeticalPaper, 'steps' | 'displayLanguage'>): Map<string, VerseTextBlock> {
    const out = new Map<string, VerseTextBlock>();
    for (const step of paper.steps ?? []) {
        // El análisis vive en la versión del paso, como lo lee el compositor
        // de la prosa del versículo (`ComposeVerseAcademicProseUseCase`).
        const analisis = (step.accepted ?? step.current)?.canonicalAnalysis;
        if (step.kind !== 'verse' || !step.verseRef || !analisis?.originalText?.trim()) continue;
        const original = originalWithoutAccents(analisis.originalText);
        const translation = entreComillas(analisis.finalTranslation || analisis.initialTranslation || '');
        if (!original) continue;
        out.set(sectionHeadingKey(formatPassageReference(step.verseRef, paper.displayLanguage)), { original, translation });
    }
    return out;
}
