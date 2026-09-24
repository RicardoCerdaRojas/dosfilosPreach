import { formatPassageReference } from '../../bible/canon/passage-reference';
import { esEncabezadoDeBibliografia } from '../services/paperBibliography';
import type { BibliographyEntry } from '../services/paperBibliography';
import type { ExegeticalPaper } from './ExegeticalPaper';
import type { ExegeticalStep } from './ExegeticalStep';

/**
 * Renders an `ExegeticalPaper` to a self-contained Markdown string
 * suitable for download.
 *
 * Source-of-truth precedence:
 *   1. `paper.assembledMarkdown` (the canonical post-assembly output,
 *      possibly with the user's manual edits) — used verbatim.
 *   2. Otherwise, fall back to concatenating accepted-step markdown in
 *      canonical paper order: introduction → verses (in passage order)
 *      → conclusion. Steps without an `accepted` version are skipped
 *      (a partial export is more useful than nothing while the paper is
 *      still in progress).
 *
 * The wrapper adds a small front-matter header with title, passage,
 * and export timestamp. Section headings (Introducción / Versículo
 * N / Conclusión) are localized off `paper.displayLanguage`, NOT the
 * UI language — the export should match the language the body was
 * generated in.
 *
 * Pure function. No DOM / Blob / download — those live in the web
 * layer where the browser APIs are.
 */
export function exportPaperToMarkdown(
    paper: ExegeticalPaper,
    options: { exportedAt?: Date; bibliography?: ReadonlyArray<BibliographyEntry> } = {},
): string {
    const labels = paper.displayLanguage === 'en' ? LABELS_EN : LABELS_ES;
    const exportedAt = options.exportedAt ?? new Date();
    const passageDisplay = formatPassageReference(paper.passage, paper.displayLanguage);
    const titleDisplay = paper.title?.trim() || passageDisplay;

    const body = paper.assembledMarkdown
        ? paper.assembledMarkdown
        : assembleFromAcceptedSteps(paper.steps, labels);

    const header = [
        `# ${titleDisplay}`,
        '',
        `**${labels.passage}:** ${passageDisplay}`,
        `**${labels.exportedOn}:** ${exportedAt.toISOString().slice(0, 10)}`,
        paper.assignmentBrief?.trim()
            ? `\n> ${paper.assignmentBrief.trim().replace(/\n/g, '\n> ')}`
            : null,
        '',
        '---',
        '',
    ].filter((line): line is string => line !== null).join('\n');

    // La bibliografía es OPCIONAL y la pone el llamador. Dos razones.
    //
    // Los datos no son del trabajo sino de cada LIBRO, y viven en la
    // biblioteca: el dominio no tiene de dónde sacarlos. Y las tarjetas que
    // miden el largo del trabajo llaman a esta misma función; sumarles la
    // bibliografía inflaría un conteo de palabras que la rúbrica no cuenta.
    // Los dos caminos de descarga la pasan; los contadores, no.
    //
    // Y no se agrega si el cuerpo YA trae una. `assembledMarkdown` se usa
    // literal y puede venir del ensamblado o de la mano del usuario: si ahí ya
    // hay una bibliografía, añadir otra deja el documento con dos, y la
    // segunda aparecería en página nueva como si fuera un anexo.
    const biblio = yaTraeBibliografia(body)
        ? ''
        : renderBibliography(options.bibliography ?? [], labels);

    const cuerpo = body.trim().length > 0 ? body.trim() : `_${labels.emptyBody}_`;
    return `${header}\n${cuerpo}\n${biblio}`;
}

/**
 * La sección de bibliografía, con el encabezado que el exportador Word busca
 * para darle sangría francesa y mandarla a página nueva.
 *
 * Una ficha incompleta se imprime FEA a propósito: el rótulo del libro y, entre
 * corchetes, lo que le falta. Omitirla dejaría el cuerpo citando un libro que
 * la bibliografía no nombra —un error que nadie ve hasta que lo ve el
 * profesor—, y completarla de memoria sería inventar una editorial. Que
 * estorbe en la página es el punto: obliga a resolverla antes de entregar.
 */
/** Si el cuerpo ya escribió su propia bibliografía, en cualquiera de los dos idiomas. */
function yaTraeBibliografia(body: string): boolean {
    return body.split('\n').some(linea => {
        const m = linea.match(/^#{1,3}\s+(.*)$/);
        return m ? esEncabezadoDeBibliografia(m[1]!) : false;
    });
}

function renderBibliography(
    entries: ReadonlyArray<BibliographyEntry>,
    labels: SectionLabels,
): string {
    if (entries.length === 0) return '';
    const lineas = entries.map(e => e.text
        ? `- ${e.text}`
        : `- ${e.displayLabel}. [${labels.incompleteEntry}: ${e.missing.join(', ')}]`);
    return `\n## ${labels.bibliography}\n\n${lineas.join('\n')}\n`;
}

interface SectionLabels {
    passage: string;
    exportedOn: string;
    introduction: string;
    conclusion: string;
    verse: string;
    emptyBody: string;
    bibliography: string;
    incompleteEntry: string;
}

const LABELS_ES: SectionLabels = {
    passage: 'Pasaje',
    exportedOn: 'Exportado',
    introduction: 'Introducción',
    conclusion: 'Conclusión',
    verse: 'Versículo',
    bibliography: 'Bibliografía',
    incompleteEntry: 'FICHA INCOMPLETA, faltan',
    emptyBody: 'Sin contenido aceptado todavía. Genera y acepta los pasos antes de exportar para obtener el trabajo completo.',
};

const LABELS_EN: SectionLabels = {
    passage: 'Passage',
    exportedOn: 'Exported',
    introduction: 'Introduction',
    conclusion: 'Conclusion',
    verse: 'Verse',
    bibliography: 'Bibliography',
    incompleteEntry: 'INCOMPLETE ENTRY, missing',
    emptyBody: 'No accepted content yet. Generate and accept steps before exporting to get the full paper.',
};

function assembleFromAcceptedSteps(steps: ReadonlyArray<ExegeticalStep>, labels: SectionLabels): string {
    const intro = steps.find(s => s.kind === 'introduction')?.accepted?.markdown?.trim();
    const verses = steps
        .filter(s => s.kind === 'verse' && s.accepted?.markdown?.trim())
        .sort((a, b) => a.order - b.order);
    const conclusion = steps.find(s => s.kind === 'conclusion')?.accepted?.markdown?.trim();

    const parts: string[] = [];
    if (intro) parts.push(`## ${labels.introduction}\n\n${intro}`);
    for (const v of verses) {
        const verseNumber = v.verseRef?.verseStart ?? v.order;
        parts.push(`## ${labels.verse} ${verseNumber}\n\n${v.accepted!.markdown.trim()}`);
    }
    if (conclusion) parts.push(`## ${labels.conclusion}\n\n${conclusion}`);
    return parts.join('\n\n');
}
