/**
 * El bosquejo de un movimiento (C7 de la fase Púlpito premium).
 *
 * Muchos pastores preparan en manuscrito y predican desde el bosquejo: el
 * manuscrito les da seguridad y el bosquejo les deja mirar a la gente. Hasta
 * acá el atril sólo mostraba el manuscrito. El bosquejo se DERIVA del mismo
 * texto, sin pedirle nada al pastor:
 *
 * - `###` → subtítulo (Ilustración, Palabras clave, Implicaciones…).
 * - Viñetas y numeradas → punto, completas: ya son la unidad de idea.
 * - Párrafos → sus frases en **negrita**, que es como el pastor marca lo que
 *   no puede olvidar; si no tiene ninguna, la primera oración, como pie.
 * - Citas (`>`) → su primera línea, como recordatorio de qué se lee.
 */
import { decodeMarkdownText } from './sermonReading';

export type OutlineItem =
    | { kind: 'heading'; text: string }
    | { kind: 'point'; text: string; ordinal?: string }
    | { kind: 'emphasis'; text: string }
    | { kind: 'cue'; text: string }
    | { kind: 'quote'; text: string };

/** Largo máximo de un pie: es para reconocer el párrafo, no para leerlo. */
export const OUTLINE_CUE_MAX = 140;

const stripInline = (text: string) =>
    decodeMarkdownText(text)
        .replace(/<br\s*\/?>/gi, ' ')
        // El bosquejo es texto plano: el formato del editor no se lee (INLINE_FORMAT_RULE).
        .replace(/<\/?(?:u|b|strong|i|em)>/gi, '')
        .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1$2')
        .replace(/_(.+?)_/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();

function firstSentence(text: string): string {
    const plain = stripInline(text);
    const m = /^(.+?[.!?…»”"])(\s|$)/.exec(plain);
    const sentence = (m ? m[1]! : plain).trim();
    return sentence.length > OUTLINE_CUE_MAX ? `${sentence.slice(0, OUTLINE_CUE_MAX - 1).trimEnd()}…` : sentence;
}

export function buildOutline(body: string): OutlineItem[] {
    const items: OutlineItem[] = [];
    // El salto estándar (`\` al final del renglón) no se lee: el bosquejo
    // mostraba la barra suelta (revisión adversarial de LINE_BREAK_RULE).
    const lines = (body ?? '').replace(/\r\n/g, '\n').replace(/(?<!\\)\\(?=\n)/g, '').split('\n');
    let paragraph: string[] = [];

    const flushParagraph = () => {
        const text = paragraph.join(' ').trim();
        paragraph = [];
        if (!text) return;
        const bold = [...text.matchAll(/\*\*(.+?)\*\*/g)].map((m) => stripInline(m[1]!)).filter(Boolean);
        if (bold.length) bold.forEach((b) => items.push({ kind: 'emphasis', text: b }));
        else items.push({ kind: 'cue', text: firstSentence(text) });
    };

    for (const raw of lines) {
        const line = raw.trim();
        if (!line) {
            flushParagraph();
            continue;
        }
        const heading = /^#{3,6}\s+(.+)$/.exec(line);
        if (heading) {
            flushParagraph();
            items.push({ kind: 'heading', text: stripInline(heading[1]!) });
            continue;
        }
        const bullet = /^[-*+]\s+(.+)$/.exec(line);
        const ordered = /^(\d+)[.)]\s+(.+)$/.exec(line);
        if (bullet || ordered) {
            flushParagraph();
            items.push(
                ordered
                    ? { kind: 'point', text: stripInline(ordered[2]!), ordinal: ordered[1] }
                    : { kind: 'point', text: stripInline(bullet![1]!) },
            );
            continue;
        }
        const quote = /^>\s?(.*)$/.exec(line);
        if (quote) {
            flushParagraph();
            const text = stripInline(quote[1]!);
            const last = items[items.length - 1];
            // Una cita de varias líneas es UN recordatorio.
            if (text && !(last && last.kind === 'quote')) {
                items.push({ kind: 'quote', text: text.length > OUTLINE_CUE_MAX ? `${text.slice(0, OUTLINE_CUE_MAX - 1).trimEnd()}…` : text });
            }
            continue;
        }
        paragraph.push(line);
    }
    flushParagraph();
    return items;
}
