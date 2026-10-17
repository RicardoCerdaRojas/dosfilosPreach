/**
 * El panel del reproceso en lote, en funciones puras (fase «el reproceso en
 * lote desde el panel de super admin», PR 1: ver, auditar y estimar).
 *
 * El criterio es el mismo de `scripts/auditar-biblioteca.ts` y del lote:
 * faltan páginas, el texto quedó vacío, lo leyó un motor sin visión o la
 * visión con un modelo anterior. El costo sale de los lotes reales.
 */

import type { ResumenDeLote } from '@/hooks/admin/useBatchJobs';

/** Lo que devuelve `getBatchCandidates` por libro (sólo metadatos, nunca texto). */
export interface CandidatoCrudo {
    id: string;
    titulo: string;
    autor: string;
    mimeType: string | null;
    sizeBytes: number | null;
    pdfPageCount: number | null;
    pageCount: number | null;
    paginasFaltantes: { total: number; paginas: number[] } | null;
    textoEstructuradoVacio: boolean;
    extractionVersion: string | null;
    extractionModel: string | null;
    textExtractionStatus: string | null;
    reprocesadoEnLote: { lote: string; fecha: string | null; motivo: string | null } | null;
}

export type Motivo =
    | 'faltan' | 'vacio' | 'sinVision' | 'modeloViejo' | 'fallido' | 'sinExtraer'
    | 'sinMedir' | 'yaReprocesado' | 'grande' | 'enProceso';

export interface Candidato extends CandidatoCrudo {
    paginas: number | null;
    motivos: Motivo[];
    /** Mayor = conviene más reprocesarlo. 0 = no hay motivo. */
    prioridad: number;
    /** No se puede reprocesar en lote (no es PDF, dominio público, se está extrayendo). */
    excluido: boolean;
}

/**
 * El modelo con que hoy se lee la visión. COPIA de `MODEL_VISION`
 * (`functions/src/llm/modelCatalog.ts`); la prueba de paridad lee ese fuente.
 */
export const MODELO_ACTUAL = 'gemini-3.8-flash';
/** Las versiones de la visión (las de `MODELO_VIEJO` en el script y la auditoría). */
export const VERSIONES_DE_VISION = new Set(['4.0-gemini-standard', '6.0-gemini-cola', '2.0-gemini']);
/** Texto de dominio público ya limpio: no hay nada que leer de un PDF. */
const VERSIONES_EXCLUIDAS = new Set(['6.0-thml-public-domain']);
/**
 * Desde este tamaño, un PDF CIFRADO no se puede descifrar en el servidor
 * (qpdf no entra en la memoria de la función); la terminal sí lo descifra. El
 * panel no sabe si un libro está cifrado (no hay campo): sólo avisa el tamaño.
 */
export const TOPE_CIFRADO_BYTES = 60 * 1024 * 1024;

export function diagnosticar(c: CandidatoCrudo): Candidato {
    const paginas = c.pdfPageCount ?? c.pageCount ?? null;
    const motivos: Motivo[] = [];
    const faltan = c.paginasFaltantes?.total ?? 0;
    if (faltan > 0) motivos.push('faltan');
    if (c.textoEstructuradoVacio) motivos.push('vacio');
    // Cualquier versión que no sea de visión (ni de dominio público) se leyó
    // sin visión: LlamaParse, pdf-parse, la capa de texto, `fallback-pdfparse`,
    // `1.0-legacy`. El script las reemplaza todas (revisión adversarial).
    const v = c.extractionVersion;
    if (v && !VERSIONES_DE_VISION.has(v) && !VERSIONES_EXCLUIDAS.has(v)) motivos.push('sinVision');
    if (v && VERSIONES_DE_VISION.has(v) && c.extractionModel !== MODELO_ACTUAL) motivos.push('modeloViejo');
    if (c.textExtractionStatus === 'failed') motivos.push('fallido');
    else if (!v) motivos.push('sinExtraer');
    // Sin medición no se puede decir que esté bien leído.
    if (c.pdfPageCount === null && !c.paginasFaltantes) motivos.push('sinMedir');
    if (c.reprocesadoEnLote) motivos.push('yaReprocesado');
    if ((c.sizeBytes ?? 0) > TOPE_CIFRADO_BYTES) motivos.push('grande');
    const enProceso = c.textExtractionStatus === 'processing';
    if (enProceso) motivos.push('enProceso');
    const excluido = enProceso
        || (c.mimeType !== null && !c.mimeType.includes('pdf'))
        || (c.extractionVersion !== null && VERSIONES_EXCLUIDAS.has(c.extractionVersion));

    let prioridad = 0;
    if (faltan > 0) prioridad += 40 + Math.round(60 * Math.min(1, faltan / Math.max(1, paginas ?? faltan)));
    if (c.textoEstructuradoVacio) prioridad += 80;
    if (motivos.includes('fallido')) prioridad += 70;
    if (motivos.includes('sinExtraer')) prioridad += 60;
    if (motivos.includes('sinVision')) prioridad += 50;
    if (motivos.includes('modeloViejo')) prioridad += 30;
    if (prioridad > 0 && c.reprocesadoEnLote) prioridad = Math.max(1, prioridad - 40);
    return { ...c, paginas, motivos, prioridad: excluido ? 0 : prioridad, excluido };
}

/**
 * Lo que «Elegir los recomendados» elige: con motivo y NO reprocesado ya. Un
 * libro que el lote ya trató y conserva páginas faltantes suele tenerlas en
 * blanco o ilegibles: volver a pagarlo entero no las recupera (revisión
 * adversarial). Se puede elegir a mano.
 */
export function esRecomendado(c: Candidato): boolean {
    return !c.excluido && c.prioridad > 0 && !c.motivos.includes('yaReprocesado');
}

/** Los más convenientes primero; los excluidos al final. */
export function ordenarCandidatos(candidatos: ReadonlyArray<CandidatoCrudo>): Candidato[] {
    return candidatos.map(diagnosticar).sort((a, b) =>
        Number(a.excluido) - Number(b.excluido) || b.prioridad - a.prioridad || a.titulo.localeCompare(b.titulo));
}

/**
 * Precio en línea de Gemini 3.8 Flash por millón de tokens. COPIA de
 * `LLM_PRICING['gemini-3.8-flash']` (`functions/src/llm/llmCost.ts`); la
 * prueba de paridad lee ese fuente. El lote cobra la mitad.
 */
export const PRECIO_EN_LINEA = { entradaPor1M: 0.75, salidaPor1M: 3.75 } as const;
/**
 * Costo por página medido en los lotes reales (biblioteca1–5, 2026-10-15/16):
 * ~1.160 tokens de entrada y ~810 de salida por página, a precio de lote.
 * Medido: US$1,95–2,23 cada 1.000 páginas.
 */
export const USD_POR_PAGINA_EN_LOTE = (1160 * PRECIO_EN_LINEA.entradaPor1M / 2 + 810 * PRECIO_EN_LINEA.salidaPor1M / 2) / 1e6;
/** Reintentos (tramos con páginas en blanco, RECITATION): 10–30 % medido. */
export const FACTOR_DE_REINTENTOS = 1.2;
/** Desde el 2027-01-01 el precio de Gemini 3.8 Flash se duplica (`llmCost.ts`). */
export const SUBA_DE_PRECIO = new Date('2027-01-01T00:00:00Z');

export interface Estimacion {
    libros: number;
    paginas: number;
    /** Sin páginas conocidas: no entran en la cuenta. */
    sinPaginas: number;
    loteUsd: number;
    conReintentosUsd: number;
    enLineaUsd: number;
    /** Pasada la suba de precio, todo cuesta el doble. */
    preciosDuplicados: boolean;
    /** A menos de dos días de la suba: un lote tarda hasta 24 h y podría cobrarse al precio nuevo. */
    cercaDeLaSuba: boolean;
    /** Libros contados con `pageCount` (lo extraído) porque no tienen `pdfPageCount`: la cuenta puede quedarse corta. */
    paginasAproximadas: number;
}

export function estimar(seleccion: ReadonlyArray<Pick<Candidato, 'paginas'> & Partial<Pick<Candidato, 'pdfPageCount'>>>, hoy: Date = new Date()): Estimacion {
    const factor = hoy >= SUBA_DE_PRECIO ? 2 : 1;
    const paginas = seleccion.reduce((n, c) => n + (c.paginas ?? 0), 0);
    const faltaParaLaSuba = SUBA_DE_PRECIO.getTime() - hoy.getTime();
    const lote = paginas * USD_POR_PAGINA_EN_LOTE * factor;
    return {
        libros: seleccion.length,
        paginas,
        sinPaginas: seleccion.filter(c => c.paginas === null).length,
        loteUsd: lote,
        conReintentosUsd: lote * FACTOR_DE_REINTENTOS,
        enLineaUsd: lote * 2,
        preciosDuplicados: factor === 2,
        cercaDeLaSuba: faltaParaLaSuba > 0 && faltaParaLaSuba < 2 * 24 * 3600 * 1000,
        paginasAproximadas: seleccion.filter(c => c.paginas !== null && (c as Partial<Candidato>).pdfPageCount == null).length,
    };
}

/** Un nombre de lote válido para la terminal: minúsculas, cifras y guiones. */
export function nombreDeLote(texto: string): string {
    return texto.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/** El nombre con que se lanza: el escrito (saneado) o uno con la fecha. Mismo formato que exige `launchBatch`. */
export function nombreElegido(nombre: string, hoy: Date = new Date()): string {
    return nombreDeLote(nombre) || `lote-${hoy.toISOString().slice(0, 10)}`;
}

/**
 * El comando de la terminal, mientras lanzar desde el panel llega en el PR 2.
 * La clave va DENTRO de la orden (regla de secretos: nunca guardada ni a la
 * vista). Sin nombre, uno con la fecha: «lote» a secas choca la segunda vez
 * («Ya existe scripts/.lotes/lote»). Un id que no es de Firestore no entra.
 */
export function comandoDePreparar(nombre: string, ids: ReadonlyArray<string>, hoy: Date = new Date()): string {
    const elegido = nombreElegido(nombre, hoy);
    const validos = ids.filter(id => /^[A-Za-z0-9_-]+$/.test(id));
    return `GEMINI_API_KEY="$(gcloud secrets versions access latest --secret=GEMINI_API_KEY --project=dosfilosapp)" npx tsx scripts/reprocesar-en-lote.ts preparar ${elegido} --ids ${validos.join(',')}`;
}

export interface LotePasado {
    nombre: string;
    fecha: string | null;
    libros: Array<{ id: string; titulo: string; motivo: string | null }>;
}

/** Los lotes ya aplicados, armados desde la marca que deja `aplicar` en cada libro. */
export function lotesPasados(candidatos: ReadonlyArray<CandidatoCrudo>): LotePasado[] {
    const porLote = new Map<string, LotePasado>();
    for (const c of candidatos) {
        const r = c.reprocesadoEnLote;
        if (!r) continue;
        const lote = porLote.get(r.lote) ?? { nombre: r.lote, fecha: r.fecha, libros: [] };
        lote.libros.push({ id: c.id, titulo: c.titulo, motivo: r.motivo });
        if (r.fecha && (!lote.fecha || r.fecha > lote.fecha)) lote.fecha = r.fecha;
        porLote.set(r.lote, lote);
    }
    return [...porLote.values()].sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));
}

/**
 * «Aplicar los que mejoran» toma sólo lo seguro: listo, sin aplicar, sin
 * tramos con fallas, con una comparación al día que dice que reemplaza.
 */
export function aplicablesSinPreguntar<L extends ResumenDeLote['libros'][number]>(libros: ReadonlyArray<L>): L[] {
    return libros.filter(b => b.listo && !b.aplicado?.reemplazado && b.incompletos === 0 && !!b.comparacion?.reemplazar && !b.comparacionVieja);
}
