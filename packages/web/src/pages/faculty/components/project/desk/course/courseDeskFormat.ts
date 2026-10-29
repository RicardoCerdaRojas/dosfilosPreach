import { formatPassageForReader, type AIProject, type ExegesisPaperSummary, type PassageReference } from '@dosfilos/domain';

/**
 * Lo que comparten las piezas del escritorio del Curso: fechas de calendario,
 * pasajes y las rutas que salen del escritorio (siempre con la vuelta al
 * proyecto, `docs/FASE_ESCRITORIO_PROYECTO_2026-10.md` §2.8).
 */

export type DeskLang = 'es' | 'en';

export const langOf = (language: string | undefined): DeskLang => (language?.startsWith('en') ? 'en' : 'es');

/**
 * «vie 31 oct» desde `YYYY-MM-DD`. La fecha de entrega es un día del
 * calendario (local), no un instante: armarla con `new Date('2026-10-31')`
 * la leería en UTC y en Chile saldría el día anterior.
 */
export function formatDueDate(day: string | null | undefined, lang: DeskLang): string {
    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
    const [y, m, d] = day.split('-').map(Number) as [number, number, number];
    return new Date(y, m - 1, d).toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** El pasaje en la numeración de la Biblia del estudiante (lo que él lee). */
export function passageLabel(passage: PassageReference | null | undefined, lang: DeskLang): string {
    return passage ? formatPassageForReader(passage, lang) : '';
}

/** Hoy, `YYYY-MM-DD` local. */
export function todayLocal(now: Date = new Date()): string {
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${m}-${d}`;
}

export const projectPath = (projectId: string) => `/dashboard/projects/${projectId}`;

/** El estudio, con la vuelta al proyecto (`?from=`; la página del estudio la respeta). */
export function studyUrl(studyId: string, projectId: string): string {
    return `/dashboard/exegesis/${encodeURIComponent(studyId)}?from=${encodeURIComponent(projectPath(projectId))}`;
}

/**
 * Crear un trabajo desde el escritorio: nace en el curso, con su tipo y su
 * rótulo puestos. Con `scheduleEntryId`, al crearlo se vincula con esa
 * entrega del calendario; sin ella (semana a semana), se crea su entrada.
 */
export function createWorkUrl(input: { projectId: string; workTypeId?: string | null; scheduleEntryId?: string | null; label?: string | null }): string {
    const q = new URLSearchParams({ projectId: input.projectId });
    if (input.workTypeId) q.set('workTypeId', input.workTypeId);
    if (input.scheduleEntryId) q.set('scheduleEntryId', input.scheduleEntryId);
    if (input.label?.trim()) q.set('label', input.label.trim());
    return `/dashboard/exegesis/new?${q.toString()}`;
}

/** Las clases de un control táctil del escritorio: 44 px en el teléfono, compacto desde `sm`. */
export const TOUCH = 'min-h-11 sm:min-h-0';

/** Un botón de solo ícono: 44 × 44 en el teléfono (el alto solo no basta para el dedo). */
export const ICON_TOUCH = 'min-h-11 min-w-11 sm:min-h-0 sm:min-w-0';

/** Los campos de los formularios del escritorio, como los de las tarjetas del curso. */
export const FIELD =
    'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus min-h-11 sm:min-h-0 sm:py-1.5';

/** Las casillas: el tono sólido de la marca (AA como control) y foco visible. */
export const CHECKBOX = 'h-5 w-5 shrink-0 accent-primary-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/**
 * Los diálogos del escritorio en el teléfono: no pasan del alto visible
 * (`dvh`, que descuenta la barra del navegador), el cuerpo hace scroll y el
 * pie queda fijo, para que «Guardar» no se pierda debajo de un texto largo.
 */
export const DIALOG = 'flex max-h-[90dvh] flex-col gap-0 p-0';
export const DIALOG_HEADER = 'shrink-0 px-4 pb-3 pt-5 pr-12 sm:px-6';
export const DIALOG_BODY = 'min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6';
export const DIALOG_FOOTER = 'shrink-0 gap-2 border-t border-border px-4 py-3 sm:px-6';

/** Lo que borra y no se recupera: el rojo sólido con AA (`--destructive-solid`). */
export const DESTRUCTIVE = 'bg-destructive-solid text-destructive-foreground hover:bg-destructive-solid-hover';

/**
 * Un instante ISO desde un día `YYYY-MM-DD` local, a mediodía: así el día
 * no cambia al pasar a UTC (medianoche en Chile ya es el día anterior en
 * algunos husos, y al revés).
 */
export function localDayToIso(day: string): string | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).toISOString();
}

/** El día local `YYYY-MM-DD` de una fecha (o `''` si no es una fecha válida). */
export function localDayOf(v: Date | string | null | undefined): string {
    if (!v) return '';
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? '' : todayLocal(d);
}

/**
 * Los estudios que se pueden traer: los del usuario sin proyecto, los de
 * otro proyecto (quedarán vinculados) y los de este curso que todavía no
 * tienen entrada en el calendario. Sin archivados ni los que ya cumplen una
 * entrega. Del más viejo al más nuevo: así se leen TP #1, #2…
 */
export function importCandidates(
    papers: ReadonlyArray<ExegesisPaperSummary>,
    project: Pick<AIProject, 'id' | 'courseSchedule'>,
): ExegesisPaperSummary[] {
    const conEntrada = new Set((project.courseSchedule ?? []).map(e => e.paperId).filter(Boolean));
    return papers
        .filter(p => !p.archivedAt && p.phase !== 'archived' && !conEntrada.has(p.id))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/** Una frase larga, para leerla en una fila: corta en una palabra, con «…». */
export function shortQuote(q: string, max = 90): string {
    const t = q.replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    const corte = t.slice(0, max - 1);
    const espacio = corte.lastIndexOf(' ');
    return `${(espacio > max / 2 ? corte.slice(0, espacio) : corte).replace(/[\s,;:]+$/, '')}…`;
}

/**
 * Dónde hizo el profesor una observación: «p. 6 · «Waltke y O'Connor…»».
 * La hoja sin número impreso se guarda neutral («h. 5») y aquí se lee en
 * el idioma de cada uno («hoja 5»). Otra cosa escrita a mano va tal cual.
 * Sin ancla, vacío.
 */
export function anchorLabel(
    anchor: { page?: string | null; quote?: string | null } | null | undefined,
    t: (k: string, o?: Record<string, unknown>) => string,
    max = 90,
): string {
    const page = anchor?.page?.trim();
    const quote = anchor?.quote?.trim();
    const hoja = page ? /^h\.\s?(\d{1,4})$/.exec(page) : null;
    const pagina = !page ? ''
        : hoja ? t('feedback.anchorSheet', { n: hoja[1] })
            : /^(\d{1,4}|[ivxlcdm]{1,7})$/i.test(page) ? t('feedback.anchorPage', { page }) : page;
    return [pagina, quote ? `«${shortQuote(quote, max)}»` : ''].filter(Boolean).join(' · ');
}
