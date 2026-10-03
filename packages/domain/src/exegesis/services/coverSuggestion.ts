import type { PaperCover } from '../entities/ExegeticalPaper';
import type { ExegesisPaperSummary } from '../entities/ExegesisPaperSummary';
import type { WorkProfile } from '../entities/WorkProfile';

/**
 * De dónde sale la portada de un trabajo que todavía no la tiene.
 *
 * El fundador reescribía la portada en cada trabajo práctico: el seminario, su
 * nombre y la ciudad no cambian entre entregas, y el título sólo sube un número
 * (TP #4 → TP #5). La función para no repetirla —el perfil de trabajo— existía,
 * pero se aplica al CREAR y él no tenía ninguno (2026-09-30).
 */

/** Una portada con algo impreso. Sin seminario ni autor no hay portada. */
export function hasCover(cover: PaperCover | null | undefined): cover is PaperCover {
    return !!(cover?.institution?.trim() || cover?.author?.trim());
}

/**
 * El título de la entrega siguiente: «Trabajo práctico #4» → «Trabajo práctico
 * #5». Sólo cuando termina en «#N»; cualquier otro título se deja como está,
 * porque adivinar la numeración de otro formato es inventar.
 */
export function nextAssignmentTitle(title: string | undefined): string | undefined {
    const t = title?.trim();
    if (!t) return title;
    const m = t.match(/^(.*#\s*)(\d+)$/);
    return m ? `${m[1]}${Number(m[2]) + 1}` : t;
}

export interface CoverOrigin {
    kind: 'paper' | 'profile';
    id: string;
    /** Cómo se nombra el origen en pantalla. */
    label: string;
    /** La portada lista para usar: con el número de entrega ya avanzado. */
    cover: PaperCover;
}

/**
 * De dónde se puede tomar una portada, el más útil primero.
 *
 * Los trabajos anteriores van primero, del más nuevo al más viejo: su
 * portada es la última que el autor dio por buena, y trae el título de la
 * entrega para avanzarle el número. Los perfiles después: no traen título de
 * entrega (`PAPER_COVER_FIELDS_POR_ENTREGA`).
 */
export function coverOrigins(
    papers: ReadonlyArray<Pick<ExegesisPaperSummary, 'id' | 'title' | 'createdAt' | 'cover'>>,
    profiles: ReadonlyArray<Pick<WorkProfile, 'id' | 'displayName' | 'cover'>>,
    currentPaperId: string,
): CoverOrigin[] {
    const deTrabajos = papers
        .filter(p => p.id !== currentPaperId && hasCover(p.cover))
        // Por creación y no por edición: retocar el TP #3 después de crear el
        // #4 no lo vuelve «el anterior» del #5.
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((p): CoverOrigin => ({
            kind: 'paper',
            id: p.id,
            label: p.cover!.assignmentTitle?.trim() || p.title?.trim() || p.id,
            cover: { ...p.cover!, assignmentTitle: nextAssignmentTitle(p.cover!.assignmentTitle) },
        }));
    const dePerfiles = profiles
        .filter(p => hasCover(p.cover))
        .map((p): CoverOrigin => ({ kind: 'profile', id: p.id, label: p.displayName, cover: { ...p.cover! } }));
    return [...deTrabajos, ...dePerfiles];
}

/**
 * Los renglones en blanco de la portada, según el modelo de TMS (guía, cap. 1,
 * «Página de título»): 3 · SEMINARIO · 6 · TÍTULO · 6 · POR / AUTOR · 3 ·
 * LUGAR / FECHA.
 *
 * El exportador producía 4 · 6 · 7 · 4: un renglón vacío «de arranque» más los
 * pedidos, y el curso vacío sumaba otro. Vive en el dominio y con nombre para
 * que la guía de estilo pueda traer el suyo cuando la portada pase a ser parte
 * de ella.
 */
export interface CoverLayout {
    beforeInstitution: number;
    afterInstitution: number;
    afterTitle: number;
    afterAuthor: number;
}

export const TMS_COVER_LAYOUT: CoverLayout = {
    beforeInstitution: 3,
    afterInstitution: 6,
    afterTitle: 6,
    afterAuthor: 3,
};

/**
 * Cómo se arma la portada, según la guía de estilo.
 *
 * La portada salía del perfil de trabajo con renglones, mayúsculas y la línea
 * «POR» fijos en el exportador, mientras la bibliografía y las notas sí
 * vivían en la guía. El fundador espera que el formato de la portada también
 * lo diga la guía (pendiente 21 de la fase del TP de Santiago). Los DATOS
 * —seminario, autor, título— siguen en la portada del trabajo; la guía dice
 * dónde y cómo van.
 */
export interface CoverStyle {
    layout: CoverLayout;
    /** Todo en mayúsculas, como el modelo de TMS. */
    uppercase: boolean;
    /** La palabra que va antes del autor («POR», «PRESENTADO POR»). Vacía: sin línea. */
    byLine: string;
}

export const TMS_COVER_STYLE: CoverStyle = { layout: TMS_COVER_LAYOUT, uppercase: true, byLine: 'POR' };

/** La de la guía si la declara; la de TMS si no. */
export function coverStyleOf(manifest: { cover?: CoverStyle | null } | null | undefined): CoverStyle {
    return manifest?.cover ?? TMS_COVER_STYLE;
}

/**
 * La portada de UN trabajo: la guía congelada en el trabajo (`styleGuideSnapshot`)
 * manda, como en toda la composición; la guía viva sólo si no hay foto. Sin
 * esto, editar o borrar la guía después de entregar cambiaba la portada al
 * re-exportar, y el cuerpo seguía la foto (revisión adversarial de C5).
 */
export function paperCoverStyle(
    paper: { styleGuideSnapshot?: { manifest?: { cover?: CoverStyle | null } | null } | null },
    liveManifest: { cover?: CoverStyle | null } | null | undefined,
): CoverStyle {
    return coverStyleOf(paper.styleGuideSnapshot?.manifest ?? liveManifest);
}

