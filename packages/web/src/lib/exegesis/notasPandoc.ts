/**
 * La nota que no es cita, con la sintaxis de Pandoc `^[…]` (fase «Lecciones
 * del TI #2», etapa 3.5): la nota metodológica de la introducción.
 *
 * Se busca contando corchetes y no con `[^\]]+`: la nota nombra ediciones
 * —«la BHS [ed. 1997]»— y la expresión simple la cortaba en el primer «]»,
 * dejando el resto de la nota impreso en el cuerpo (revisión adversarial).
 * Una nota sin cerrar se deja como texto.
 */
export interface NotaPandoc {
    start: number;
    end: number;
    body: string;
}

export function findPandocNotes(text: string): NotaPandoc[] {
    const notas: NotaPandoc[] = [];
    let i = text.indexOf('^[');
    while (i !== -1) {
        let profundidad = 0;
        let j = i + 1;
        for (; j < text.length; j++) {
            if (text[j] === '[') profundidad += 1;
            else if (text[j] === ']' && --profundidad === 0) break;
        }
        if (j >= text.length) break;
        const body = text.slice(i + 2, j).trim();
        if (body) notas.push({ start: i, end: j + 1, body });
        i = text.indexOf('^[', j + 1);
    }
    return notas;
}

/**
 * Sin notas al pie —el trabajo cita entre paréntesis—, la nota queda en el
 * texto entre paréntesis: «método (texto de la nota).». Un trabajo que pasó
 * de notas a paréntesis después de componer la introducción la traía así.
 */
export function pandocNotesAsParentheses(text: string): string {
    const notas = findPandocNotes(text);
    if (notas.length === 0) return text;
    let salida = '';
    let cursor = 0;
    for (const n of notas) {
        salida += `${text.slice(cursor, n.start).trimEnd()} (${n.body})`;
        cursor = n.end;
    }
    return salida + text.slice(cursor);
}

/**
 * En pantalla, la nota se dibuja como nota al pie de GFM —llamada volada y
 * el texto al final de la prosa— en vez de mostrar `^[…]` crudo.
 */
export function pandocNotesAsGfmFootnotes(markdown: string): string {
    const notas = findPandocNotes(markdown);
    if (notas.length === 0) return markdown;
    let salida = '';
    let cursor = 0;
    const definiciones: string[] = [];
    notas.forEach((n, k) => {
        const etiqueta = `nota-${k + 1}`;
        salida += `${markdown.slice(cursor, n.start).trimEnd()}[^${etiqueta}]`;
        definiciones.push(`[^${etiqueta}]: ${n.body.replace(/\s*\n\s*/g, ' ')}`);
        cursor = n.end;
    });
    return `${salida}${markdown.slice(cursor)}\n\n${definiciones.join('\n')}\n`;
}
