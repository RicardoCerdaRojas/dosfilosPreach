/**
 * Redacción v2 Fase 3 / Ola 6.2b (§4.3) — el constructor de proposición: los 8
 * elementos del fundador.
 *
 * PROPOSICIÓN SIEMPRE, universal a las seis formas: es elemento pedagógico y
 * exhortativo de la predicación expositiva, no un adorno de algunas formas.
 *
 * EL FLUJO ES: el tutor pide los 8 elementos, cada uno PRE-SEMBRADO desde el
 * estudio donde exista; el sistema ensambla con lo que el pastor decidió, lo
 * muestra, el pastor pule; luego confronta contra los 8.
 *
 * Y LO QUE HACE QUE ESTO IMPORTE: la proposición se vuelve el CONTRATO de todo
 * lo que sigue. Los puntos del bosquejo heredan su llamado a la acción — Mateo
 * 28 rinde "Debes ir… Debes hacer… Debes reconocer…". Por eso el elemento 8 es
 * G3 en miniatura: si los puntos no armonizan con el llamado y con la idea
 * central del texto, el sermón dejó de rastrear al pasaje.
 */

import type { Severidad } from './complianceTypes';
import type { GenreSermonStructure, FormaSustantivo } from './genreSermonStructure';

/**
 * De dónde sale cada elemento. Gobierna qué puede pre-sembrar el sistema y qué
 * NO debe inventar: `pastor` es decisión pastoral y el sistema la pide, no la
 * rellena.
 */
export type OrigenElemento = 'estudio' | 'bosquejo' | 'pastor' | 'sistema';

export interface ElementoDeProposicion {
    n: number;
    id: keyof PropositionDraft;
    nombre: string;
    descripcion: string;
    origen: OrigenElemento;
    /**
     * `false` solo en el pronombre de 1ª plural, que el diseño permite implícito.
     * Su ausencia no confronta.
     */
    obligatorio: boolean;
}

export interface PropositionDraft {
    /** 1 — "En Mateo…". Viene del estudio. */
    pasaje?: string;
    /** 2 — "veremos tres…". Sale del bosquejo. */
    cantidadDePuntos?: number;
    /** 3 — verdades, motivos, exhortaciones… Lo elige el pastor. */
    sustantivo?: string;
    /** 4 — obedecer, confiar, poner por obra… Decisión pastoral. */
    llamadoALaAccion?: string;
    /** 5 — que, para, a fin de, por lo que. */
    elementoProposicional?: string;
    /** 6 — vivimos, confiamos… Puede ser implícito. */
    pronombrePrimeraPlural?: string;
    /** 7 — idea central del pasaje, VERBATIM del paso 7 del estudio. */
    ideaCentral?: string;
    /** 8 — los puntos, que heredan el llamado y rastrean al texto. */
    puntos?: readonly string[];
}

export const PROPOSITION_ELEMENTS: readonly ElementoDeProposicion[] = [
    { n: 1, id: 'pasaje', nombre: 'Define el pasaje', descripcion: 'Nombra el texto que se predica ("En Mateo…").', origen: 'estudio', obligatorio: true },
    { n: 2, id: 'cantidadDePuntos', nombre: 'Introduce la cantidad de puntos', descripcion: 'Anuncia cuántos puntos se verán ("veremos tres…").', origen: 'bosquejo', obligatorio: true },
    { n: 3, id: 'sustantivo', nombre: 'Sustantivo', descripcion: 'Verdades, motivos, razones, exhortaciones… Lo elige el pastor; el género sugiere si va singular o plural.', origen: 'pastor', obligatorio: true },
    { n: 4, id: 'llamadoALaAccion', nombre: 'Llamado a la acción', descripcion: 'Obedecer, confiar, poner por obra… Decisión pastoral. Es lo que heredan los puntos del bosquejo.', origen: 'pastor', obligatorio: true },
    { n: 5, id: 'elementoProposicional', nombre: 'Elemento proposicional', descripcion: 'La bisagra: que, para, a fin de, por lo que.', origen: 'sistema', obligatorio: true },
    // Único opcional del catálogo: el diseño lo permite implícito.
    { n: 6, id: 'pronombrePrimeraPlural', nombre: 'Pronombre de 1ª plural', descripcion: 'Vivimos, confiamos… Puede quedar implícito; es gramática y la resuelve el sistema.', origen: 'sistema', obligatorio: false },
    { n: 7, id: 'ideaCentral', nombre: 'Idea central del pasaje', descripcion: 'VERBATIM del paso 7 del estudio: no se reescribe ni se resume.', origen: 'estudio', obligatorio: true },
    { n: 8, id: 'puntos', nombre: 'Puntos en armonía', descripcion: 'Los puntos armonizan con el llamado a la acción y con la idea central del texto. Aquí siempre manda el flujo del texto: no se inventan ni se introducen ideas fuera de contexto.', origen: 'bosquejo', obligatorio: true },
] as const;

/** Lo que el estudio y el bosquejo pueden pre-sembrar. */
export interface SeedInput {
    /** Referencia del pasaje, del estudio. */
    pasaje?: string;
    /** Paso 7 del estudio. Se copia VERBATIM. */
    ideaCentralDelPaso7?: string;
    /** Títulos de los puntos del bosquejo, en orden. */
    puntosDelBosquejo?: readonly string[];
}

/**
 * Pre-siembra los elementos que YA existen en el estudio. Los de origen
 * `pastor` quedan vacíos a propósito: el sustantivo y el llamado a la acción son
 * decisión pastoral, y rellenarlos con una sugerencia convierte al tutor en el
 * autor de la proposición. El sistema pide; no decide.
 *
 * La idea central se copia VERBATIM del paso 7. Reescribirla aquí abriría una
 * segunda versión de la idea central del pasaje, y la proposición dejaría de ser
 * un contrato con el estudio para ser una paráfrasis de él.
 */
export function seedProposition(input: SeedInput): PropositionDraft {
    const draft: PropositionDraft = {};
    if (input.pasaje) draft.pasaje = input.pasaje;
    if (input.ideaCentralDelPaso7) draft.ideaCentral = input.ideaCentralDelPaso7;
    if (input.puntosDelBosquejo?.length) {
        draft.puntos = input.puntosDelBosquejo;
        draft.cantidadDePuntos = input.puntosDelBosquejo.length;
    }
    return draft;
}

export type ClaseHallazgoProposicion =
    | 'elemento-faltante'
    | 'cantidad-no-coincide'
    | 'sustantivo-contra-genero'
    | 'punto-sin-llamado'
    | 'armonia-indeterminada';

export interface HallazgoDeProposicion {
    clase: ClaseHallazgoProposicion;
    esViolacion: boolean;
    severidad?: Severidad;
    referencia: string;
    mensaje: string;
    refina?: string;
}

export interface ConfrontacionInput {
    draft: PropositionDraft;
    /** Del catálogo de §6; `null` si el género no tiene estructura derivable. */
    estructura: GenreSermonStructure | null;
}

export interface ReporteDeProposicion {
    hallazgos: readonly HallazgoDeProposicion[];
    /** Elementos obligatorios presentes / total. */
    completitud: { presentes: number; obligatorios: number };
    completa: boolean;
}

/** Normaliza para comparar por raíz: sin tildes, minúsculas. */
function normalizar(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Raíz aproximada de un verbo español para cotejar herencia: "obedecer" →
 * "obedec", que engancha "obedece/obedecemos/obedeciendo".
 *
 * TOSCA A PROPÓSITO, igual que la vara de suficiencia estructural del paso 3:
 * mide PRESENCIA del llamado en el punto, no calidad de la armonía. El juicio
 * fino es semántico y se escala después, con datos. Por eso lo que no alcanza a
 * decidir sale como `armonia-indeterminada` y no como falla.
 */
function raizVerbal(verbo: string): string {
    const v = normalizar(verbo.trim());
    return v.replace(/(ar|er|ir)$/, '');
}

export function confrontProposition(input: ConfrontacionInput): ReporteDeProposicion {
    const { draft, estructura } = input;
    const hallazgos: HallazgoDeProposicion[] = [];

    // ── Los 8 elementos ──────────────────────────────────────────────────────
    let presentes = 0;
    const obligatorios = PROPOSITION_ELEMENTS.filter(e => e.obligatorio);
    for (const e of obligatorios) {
        const v = draft[e.id];
        const vacio =
            v === undefined ||
            v === null ||
            (typeof v === 'string' && v.trim() === '') ||
            (Array.isArray(v) && v.length === 0);
        if (vacio) {
            hallazgos.push({
                clase: 'elemento-faltante',
                esViolacion: true,
                // La proposición incompleta no es infidelidad al texto: es
                // trabajo sin terminar. Se confronta como estándar.
                severidad: 'estandar',
                referencia: `${e.n}. ${e.nombre}`,
                mensaje: `Falta el elemento ${e.n} (${e.nombre}): ${e.descripcion}`,
            });
        } else {
            presentes++;
        }
    }

    // ── Coherencia con el bosquejo ───────────────────────────────────────────
    if (draft.puntos && draft.cantidadDePuntos !== undefined && draft.cantidadDePuntos !== draft.puntos.length) {
        // La proposición ANUNCIA cuántos puntos vienen. Si el anuncio y el
        // bosquejo no coinciden, el contrato se rompe en la primera frase.
        hallazgos.push({
            clase: 'cantidad-no-coincide',
            esViolacion: true,
            severidad: 'estandar',
            referencia: `anuncia ${draft.cantidadDePuntos}, bosqueja ${draft.puntos.length}`,
            mensaje: 'La proposición anuncia una cantidad de puntos distinta a la del bosquejo.',
        });
    }

    // ── Sustantivo vs. lo que pide el género ─────────────────────────────────
    if (estructura && draft.sustantivo && draft.puntos) {
        const esperado: FormaSustantivo = estructura.proposicion.sustantivo;
        const unSoloPunto = draft.puntos.length === 1;
        if (esperado === 'singular' && !unSoloPunto) {
            hallazgos.push({
                clase: 'sustantivo-contra-genero',
                // GUÍA, no violación: es el género sugiriendo su forma, y la
                // decisión sigue siendo del pastor. En parábola, además, el
                // catálogo ya confronta la multiplicación por su lado.
                esViolacion: false,
                referencia: estructura.proposicion.nota,
                mensaje: 'Este género pide una proposición de sustantivo singular; el bosquejo trae varios puntos.',
            });
        }
    }

    // ── Elemento 8: los puntos heredan el llamado a la acción ────────────────
    if (draft.puntos?.length && draft.llamadoALaAccion?.trim()) {
        const raiz = raizVerbal(draft.llamadoALaAccion);
        if (raiz.length < 3) {
            // Un llamado demasiado corto no da raíz cotejable. No se inventa un
            // veredicto: se declara que la vara no alcanzó.
            hallazgos.push({
                clase: 'armonia-indeterminada',
                esViolacion: false,
                referencia: draft.llamadoALaAccion,
                mensaje: 'El llamado a la acción es demasiado corto para cotejar herencia en los puntos: revísalo a mano.',
            });
        } else {
            // SE SEÑALA LA INCONSISTENCIA, NO LA AUSENCIA.
            //
            // Si NINGÚN punto recoge el verbo del llamado, lo más probable es
            // que la herencia vaya por otra ruta legítima — por el SUSTANTIVO,
            // por ejemplo: "dos realidades del conflicto" con puntos "Dios
            // habla…" y "El hombre desobedece…" hereda perfectamente, y marcar
            // los dos entrena al pastor a ignorar el panel.
            //
            // Lo que SÍ es señal es que unos hereden y otros no: ahí hay una
            // inconsistencia real dentro del mismo bosquejo.
            const heredan = draft.puntos.filter(p => normalizar(p).includes(raiz)).length;
            const algunoHereda = heredan > 0;
            for (const [i, p] of draft.puntos.entries()) {
                if (algunoHereda && !normalizar(p).includes(raiz)) {
                    hallazgos.push({
                        clase: 'punto-sin-llamado',
                        // GUÍA, no violación (2026-08-23). La herencia del
                        // llamado es real —"tres verdades que debes obedecer" ⇒
                        // títulos que empiezan con "Debes"— pero aquí se coteja
                        // con una raíz verbal, y esa es una vara tosca sobre una
                        // relación sutil.
                        //
                        // Caso que lo demostró: "dos REALIDADES del conflicto
                        // que deben guiarnos a la obediencia", con puntos "Dios
                        // habla…" y "El hombre desobedece…". La herencia va por
                        // el SUSTANTIVO (son realidades), no por el verbo del
                        // llamado — y marcarlo como falla acusaba a una
                        // proposición correcta.
                        esViolacion: false,
                        referencia: `punto ${i + 1}`,
                        mensaje: `Revisa si este punto recoge el llamado de la proposición ("${draft.llamadoALaAccion}").`,
                    });
                }
            }
        }
    }

    return {
        hallazgos,
        completitud: { presentes, obligatorios: obligatorios.length },
        completa: presentes === obligatorios.length,
    };
}

/**
 * Borrador ensamblado para que el pastor lo PULA — no texto final.
 *
 * Es una plantilla determinista a propósito: el sistema no debe originar la voz
 * del pastor, y una redacción generada sonaría a otro autor. Devuelve `null` si
 * falta algo obligatorio: mostrar una proposición con huecos invita a aceptarla
 * como está.
 */
export function assemblePropositionDraft(draft: PropositionDraft): string | null {
    const { pasaje, cantidadDePuntos, sustantivo, llamadoALaAccion, elementoProposicional, ideaCentral } = draft;
    if (!pasaje || !cantidadDePuntos || !sustantivo || !llamadoALaAccion || !elementoProposicional || !ideaCentral) {
        return null;
    }
    const pronombre = draft.pronombrePrimeraPlural?.trim();
    const sujeto = pronombre ? `${pronombre} ` : '';
    return `En ${pasaje} veremos ${cantidadDePuntos} ${sustantivo} ${elementoProposicional} ${sujeto}debemos ${llamadoALaAccion}, porque ${ideaCentral}`;
}
