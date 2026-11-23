/**
 * Los requisitos de un trabajo y dónde se cumple cada uno (diseño §2.2, A5).
 *
 * Regla del procedimiento (byblos, NT785 2026-11-18): todo requisito del
 * enunciado se cumple en el CUERPO; los apéndices solo amplían. En el trabajo de
 * Santiago 3 «todas las notas del aparato crítico, con su decisión razonada» se
 * cumplió a fondo solo en el Apéndice B.
 *
 * Se arman sin el asistente, de lo que ya está escrito: la rúbrica (extensión,
 * fuentes por tipo, criterios, lecturas exigidas), las preguntas del encuadre y
 * el tipo de trabajo. El autor agrega los que falten, dice en qué sección se
 * cumple cada uno y si va en el cuerpo. Los derivados se recalculan cada vez:
 * si la rúbrica deja de pedir algo, ese requisito deja de aparecer (sus marcas
 * quedan guardadas por id y vuelven si el requisito vuelve).
 */
import type { PaperRubric } from '../entities/PaperRubric';
import { PAPER_PROFILES, type PaperProfileKind } from './paperProfile';
import type { PaperUnit } from './paperUnits';

export type RequirementOrigin = 'rubrica' | 'enunciado' | 'tipo' | 'silabo' | 'manual';

export interface PaperRequirement {
    /** Estable: `rubrica:extension`, `rubrica:fuente:lexicon-technical`, `enunciado:pregunta:2`, `manual:<id>`. */
    id: string;
    origin: RequirementOrigin;
    /** El texto para la pantalla: una clave con sus datos, o el texto del autor. */
    text: { key: string; values?: Record<string, string | number> } | { literal: string };
    /** La unidad donde se cumple; `null` = el trabajo entero. */
    unitId: string | null;
    /** Se cumple en el cuerpo (no solo en un apéndice). */
    inBody: boolean;
    /** Cumplido: medido por el sistema, o marcado por el autor si no se puede medir. */
    done: boolean;
    /**
     * `measured`: el sistema lo mide (extensión, fuentes, preguntas, marco) y
     * el autor no marca nada: una marca a mano se vuelve falsa cuando el texto
     * cambia. `self`: lo juzga el autor («Lo reviso yo»).
     */
    check: { mode: 'measured'; value: { key: string; values?: Record<string, string | number> } } | { mode: 'self' };
}

/** Lo que el autor decide de cada requisito, por id. */
export interface RequirementMark {
    unitId?: string | null;
    inBody?: boolean;
    done?: boolean;
}

export interface ManualRequirement {
    id: string;
    text: string;
    unitId: string | null;
    inBody: boolean;
    done: boolean;
}

export const MANUAL_REQUIREMENTS_MAX = 40;
export const MANUAL_REQUIREMENT_TEXT_MAX = 400;

/** Lo que la app ya sabe del trabajo, para medir los requisitos. */
export interface RequirementMeasures {
    /** La extensión del documento ensamblado; `null` = todavía no hay documento. */
    length?: { verdict: 'unknown' | 'short' | 'ok' | 'long'; estimatedPages: number; words: number } | null;
    /** Fuentes del corpus por tipo, contra la rúbrica (`computeRubricCompliance`). */
    sources?: ReadonlyArray<{ sourceType: string; have: number; required: number }>;
    /** Las unidades que ya tienen texto en el documento. */
    answeredUnits?: ReadonlySet<string>;
    /** Si la introducción o la conclusión entran al documento. */
    framingInDocument?: boolean;
    /**
     * Las lecturas del sílabo enlazadas a un libro de la biblioteca
     * (`silabo:<slug>` → está en el corpus). Una sin enlazar no se mide: «no
     * está» sería falso si el libro está con otro nombre.
     */
    readingsInCorpus?: ReadonlyMap<string, boolean>;
}

export interface RequirementsInput {
    profileKind: PaperProfileKind;
    rubric: Pick<PaperRubric, 'expectedLength' | 'sourceRequirements' | 'qualityCriteria' | 'courseBibliography'> | null | undefined;
    units: ReadonlyArray<PaperUnit>;
    marks?: Readonly<Record<string, RequirementMark>> | null;
    manual?: ReadonlyArray<ManualRequirement> | null;
    measures?: RequirementMeasures | null;
}

/**
 * La medida de un requisito, si el sistema puede tomarla. `null`: lo juzga el
 * autor. Sin el dato (el trabajo no se armó todavía) también se mide: «sin
 * documento» es un estado, no una razón para pedirle al autor que marque.
 */
function measure(id: string, unitId: string | null, m: RequirementMeasures | null | undefined): { ok: boolean; value: { key: string; values?: Record<string, string | number> } } | null {
    if (!m) return null;
    if (id === 'rubrica:extension' && m.length !== undefined) {
        if (!m.length || m.length.verdict === 'unknown') return { ok: false, value: { key: 'length.none' } };
        return { ok: m.length.verdict === 'ok', value: { key: `length.${m.length.verdict}`, values: { pages: Math.round(m.length.estimatedPages * 10) / 10 } } };
    }
    if (id.startsWith('rubrica:fuente:') && m.sources) {
        const tipo = id.slice('rubrica:fuente:'.length);
        const c = m.sources.find(x => x.sourceType === tipo);
        if (!c) return null;
        return { ok: c.have >= c.required, value: { key: 'sources', values: { have: c.have, required: c.required } } };
    }
    if (id.startsWith('enunciado:pregunta:') && m.answeredUnits) {
        const ok = !!unitId && m.answeredUnits.has(unitId);
        return { ok, value: { key: ok ? 'question.answered' : 'question.pending' } };
    }
    if (id === 'tipo:sin-marco' && m.framingInDocument !== undefined) {
        return { ok: !m.framingInDocument, value: { key: m.framingInDocument ? 'framing.included' : 'framing.none' } };
    }
    if (id.startsWith('silabo:') && m.readingsInCorpus?.has(id)) {
        const ok = m.readingsInCorpus.get(id) === true;
        return { ok, value: { key: ok ? 'reading.inCorpus' : 'reading.missing' } };
    }
    return null;
}

/** Lo que sale de lo ya escrito, antes de las marcas del autor. */
function derived(input: RequirementsInput): Array<Omit<PaperRequirement, 'inBody' | 'done' | 'check'>> {
    const out: Array<Omit<PaperRequirement, 'inBody' | 'done' | 'check'>> = [];
    const r = input.rubric;
    if (r?.expectedLength && (r.expectedLength.min !== null || r.expectedLength.max !== null)) {
        const { unit, min, max } = r.expectedLength;
        // Con un solo extremo no se escribe «de — a 12»: «al menos 8» o «hasta 12».
        const forma = min !== null && max !== null ? '' : min !== null ? 'Min' : 'Max';
        out.push({ id: 'rubrica:extension', origin: 'rubrica', unitId: null, text: { key: `length.${unit}${forma}`, values: { min: min ?? 0, max: max ?? 0 } } });
    }
    for (const s of r?.sourceRequirements ?? []) {
        if (s.minimum <= 0) continue;
        out.push({ id: `rubrica:fuente:${s.sourceType}`, origin: 'rubrica', unitId: null, text: { key: 'sources', values: { minimum: s.minimum, sourceType: s.sourceType } } });
    }
    for (const c of r?.qualityCriteria ?? []) {
        out.push({ id: `rubrica:criterio:${c.id}`, origin: 'rubrica', unitId: null, text: { literal: c.name } });
    }
    for (const b of r?.courseBibliography ?? []) {
        if (b.requirement !== 'required') continue;
        out.push({ id: syllabusRequirementId(b.title), origin: 'silabo', unitId: null, text: { key: 'reading', values: { title: b.title } } });
    }
    for (const u of input.units) {
        if (u.kind !== 'pregunta') continue;
        out.push({ id: `enunciado:pregunta:${u.number}`, origin: 'enunciado', unitId: u.id, text: { key: 'question', values: { number: u.number } } });
    }
    // La forma que impone el tipo (procedimiento §4d).
    if (input.profileKind === 'tp-por-pregunta') {
        out.push({ id: 'tipo:sin-marco', origin: 'tipo', unitId: null, text: { key: 'profile.noFraming' } });
    } else {
        out.push({ id: 'tipo:tesis', origin: 'tipo', unitId: null, text: { key: 'profile.thesis' } });
    }
    if (input.profileKind === 'sintesis-sermon') {
        out.push({ id: 'tipo:herencia', origin: 'tipo', unitId: 'parte-2', text: { key: 'profile.inheritGlosses' } });
    }
    return out;
}

/**
 * Los requisitos con lo que el autor decidió. Una unidad marcada que ya no
 * existe (cambió el encuadre) vuelve a «el trabajo entero»: un requisito no se
 * queda colgado de una sección que no está.
 */
export function paperRequirements(input: RequirementsInput): PaperRequirement[] {
    const unidades = new Set(input.units.map(u => u.id));
    const valida = (id: string | null | undefined) => (id && unidades.has(id) ? id : null);
    const marks = input.marks ?? {};
    const deRubrica = derived(input).map(d => {
        const m = marks[d.id] ?? {};
        return {
            ...d,
            unitId: m.unitId === undefined ? valida(d.unitId) : valida(m.unitId),
            inBody: m.inBody ?? true,
        };
    }).map(d => {
        const medida = measure(d.id, d.unitId, input.measures);
        // Medido: la marca a mano no cuenta (se vuelve falsa cuando el texto cambia).
        return medida
            ? { ...d, done: medida.ok, check: { mode: 'measured' as const, value: medida.value } }
            : { ...d, done: marks[d.id]?.done ?? false, check: { mode: 'self' as const } };
    });
    const manuales = (input.manual ?? []).map(m => ({
        id: `manual:${m.id}`, origin: 'manual' as const, text: { literal: m.text },
        unitId: valida(m.unitId), inBody: m.inBody, done: m.done, check: { mode: 'self' as const },
    }));
    return [...deRubrica, ...manuales];
}

/**
 * Qué controles de ubicación tienen sentido en cada tipo: «se cumple en»
 * cuando las secciones no salen solas de las preguntas, y «solo en un
 * apéndice» donde el tipo lleva apéndices. En un TP, ninguno: cada pregunta ya
 * tiene su sección y no hay apéndices.
 */
export function requirementPlacementControls(kind: PaperProfileKind): { unit: boolean; appendix: boolean } {
    const p = PAPER_PROFILES[kind];
    return { unit: p.unitKind !== 'pregunta', appendix: p.appendices };
}

export type RequirementWarning =
    /** Se cumple solo en un apéndice: la regla del cuerpo. */
    | { kind: 'appendix-only'; requirementId: string }
    /** Una pregunta sin sección que la conteste (el encuadre cambió). */
    | { kind: 'no-unit'; requirementId: string };

export function requirementWarnings(reqs: ReadonlyArray<PaperRequirement>): RequirementWarning[] {
    const out: RequirementWarning[] = [];
    for (const r of reqs) {
        if (!r.inBody) out.push({ kind: 'appendix-only', requirementId: r.id });
        if (r.origin === 'enunciado' && r.unitId === null) out.push({ kind: 'no-unit', requirementId: r.id });
    }
    return out;
}

/** Las marcas listas para guardar: solo campos conocidos. */
export function cleanRequirementMarks(value: unknown): Record<string, RequirementMark> {
    if (!value || typeof value !== 'object') return {};
    const out: Record<string, RequirementMark> = {};
    for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
        if (!id || !raw || typeof raw !== 'object') continue;
        const m = raw as RequirementMark;
        const limpio: RequirementMark = {};
        if (m.unitId === null || typeof m.unitId === 'string') limpio.unitId = m.unitId;
        if (typeof m.inBody === 'boolean') limpio.inBody = m.inBody;
        if (typeof m.done === 'boolean') limpio.done = m.done;
        if (Object.keys(limpio).length) out[id] = limpio;
    }
    return out;
}

export function cleanManualRequirements(value: unknown): ManualRequirement[] {
    if (!Array.isArray(value)) return [];
    const vistos = new Set<string>();
    const out: ManualRequirement[] = [];
    for (const raw of value) {
        const m = raw as Partial<ManualRequirement>;
        const text = typeof m?.text === 'string' ? m.text.trim().slice(0, MANUAL_REQUIREMENT_TEXT_MAX) : '';
        if (!m?.id || !text || vistos.has(m.id)) continue;
        vistos.add(m.id);
        out.push({ id: m.id, text, unitId: typeof m.unitId === 'string' ? m.unitId : null, inBody: m.inBody !== false, done: m.done === true });
        if (out.length >= MANUAL_REQUIREMENTS_MAX) break;
    }
    return out;
}

/** El id del requisito de una lectura exigida del sílabo. */
export function syllabusRequirementId(title: string): string {
    return `silabo:${slug(title)}`;
}

function slug(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}
