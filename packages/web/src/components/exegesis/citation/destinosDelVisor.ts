import type { CitationPageKind, ProjectSource } from '@dosfilos/domain';
import type { CitationTarget } from './CitationSourceModal';
import type { SourceViewerTarget } from './SourceViewerProvider';

/**
 * De dónde a dónde abre el visor (fase F, F3): una fuente del trabajo, o una
 * cita escrita en la prosa.
 */

/**
 * Una fuente del trabajo abierta en el visor: en la primera hoja que el
 * trabajo eligió de ella (lo que el estudiante vino a mirar) o, sin hojas
 * elegidas, en la primera del libro.
 */
export function destinoDeFuente(paperId: string, source: ProjectSource): SourceViewerTarget {
    const tramos = source.excerptRecipe?.sheetRanges ?? [];
    const primera = tramos.length > 0 ? Math.min(...tramos.map(r => Number(r.start))) : 1;
    return {
        paperId,
        citation: {
            sourceKey: source.citationKey ?? source.displayLabel,
            page: Number.isFinite(primera) && primera >= 1 ? primera : 1,
            resourceId: source.sourceLibraryResourceId ?? source.corpusId,
            label: source.displayLabel,
        },
    };
}

/**
 * Abrir una fuente del trabajo: un PDF en el visor; lo demás (EPUB, Word, que
 * la Biblioteca acepta) como archivo en otra pestaña, como antes. El visor
 * sólo dibuja PDFs: abrir un EPUB ahí terminaba en «no se pudo abrir».
 */
export function abrirFuente(
    open: (target: SourceViewerTarget) => void,
    paperId: string,
    source: ProjectSource,
    recurso: { mimeType: string; storageUrl: string } | null | undefined,
): void {
    if (recurso && recurso.mimeType !== 'application/pdf') {
        window.open(recurso.storageUrl, '_blank', 'noopener,noreferrer');
        return;
    }
    open(destinoDeFuente(paperId, source));
}

/** Una cita de la prosa, ya resuelta a su fuente y su página. */
export interface CitaEnlazada {
    sourceKey: string;
    page: number;
    pageKind?: CitationPageKind;
}

/** Prefijo de los enlaces que marcan una cita dentro del markdown. */
export const PREFIJO_CITA = '#cita-';

/** Bloques de código, código en línea y enlaces o imágenes markdown. */
const PROTEGIDO = /```[\s\S]*?```|`[^`\n]*`|!?\[[^\]\n]*\]\([^)\n]*\)/g;

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Convierte en enlaces las citas de la prosa que nombran una fuente del
 * trabajo, para abrirlas en el visor en su página.
 *
 * Se enlaza SÓLO «Clave, p. N» (o «pp. N–M», «hoja N», o el número solo, que
 * es la forma entregada), y sólo para claves del trabajo: así una cita
 * compuesta «(Robertson, p. 534; Robertson, pp. 538–539)» da dos enlaces, uno
 * por página, y una referencia bíblica «(Génesis 19:25, 29)» no se toca
 * (`findInlineCitations` admite ese falso positivo a propósito, para el
 * verificador; aquí un enlace falso llevaría a un libro que no es).
 *
 * «p.» o el número solo son página impresa; «hoja» es la hoja del archivo.
 */
export function enlazarCitas(markdown: string, claves: ReadonlyArray<string | null | undefined>): { markdown: string; citas: CitaEnlazada[] } {
    const validas = [...new Set(claves.map(c => c?.trim()).filter((c): c is string => !!c))]
        .sort((a, b) => b.length - a.length);
    if (validas.length === 0) return { markdown, citas: [] };
    const patron = new RegExp(
        `(?<=[(;]\\s*)(${validas.map(escapar).join('|')})(,\\s*"[^"\\n]{1,120}")?,\\s*(pp?\\.|hoja)?\\s*(\\d{1,4})(?:\\s*[–-]\\s*\\d{1,4})?(?=\\s*[;)])`,
        'g',
    );
    const citas: CitaEnlazada[] = [];
    const enlazar = (texto: string) => texto.replace(patron, (todo, clave: string, _titulo, tipo: string | undefined, pagina: string) => {
        const i = citas.length;
        citas.push({ sourceKey: clave, page: Number(pagina), ...(tipo === 'hoja' ? {} : { pageKind: 'printed' as const }) });
        return `[${todo.replace(/[[\]]/g, '\\$&')}](${PREFIJO_CITA}${i})`;
    });
    // Lo que ya es código o un enlace no se toca: dentro de `código` el
    // enlace se vería como texto crudo, y dentro de un [enlace](…) rompería
    // el de afuera (revisión adversarial, fase F).
    let salida = '';
    let desde = 0;
    for (const m of markdown.matchAll(PROTEGIDO)) {
        salida += enlazar(markdown.slice(desde, m.index)) + m[0];
        desde = m.index! + m[0].length;
    }
    salida += enlazar(markdown.slice(desde));
    return { markdown: salida, citas };
}

/** El destino del visor para una cita enlazada. */
export function destinoDeCita(paperId: string, cita: CitaEnlazada): SourceViewerTarget {
    const citation: CitationTarget = { sourceKey: cita.sourceKey, page: cita.page, ...(cita.pageKind ? { pageKind: cita.pageKind } : {}) };
    return { paperId, citation };
}
