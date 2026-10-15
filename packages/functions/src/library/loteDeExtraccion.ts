import { configDeExtraccion, PROMPT_DE_EXTRACCION, type GeminiPage } from './geminiExtraction';
import { markdownAPlano } from './markdownAPlano';
import { pagesToMarkdown, pagesToMarkedText } from './llamaParseClient';
import { parsearRespuesta, rescatarPaginas } from './rescatarPaginas';
import { medirExtraccion, type MedicionDeExtraccion } from './medirExtraccion';

/**
 * Reproceso de libros en LOTE (Gemini Batch API, mitad de precio, hasta 24 h).
 *
 * Sólo para releer libros ya extraídos, en segundo plano: una subida normal
 * sigue en línea porque alguien la espera. Nació de la auditoría del
 * 2026-10-15 (11 libros con páginas perdidas, 17 leídos con Gemini 2.5, 13
 * con el texto estructurado vacío). La prueba con 10 páginas de la BHQ:
 * acepta el PDF con 3.8 Flash, devuelve el mismo formato y los mismos
 * tokens; tardó 171 s contra 72 s en línea.
 *
 * Todo lo de acá es puro: el script de administración (y después la
 * interfaz del super admin) orquesta, sube y escribe.
 */

export interface Tramo {
    desde: number;
    hasta: number;
}

/**
 * Tramos sin solapamiento. 20 páginas y no las 24 de la primera tanda en
 * línea: en lote no hay calibración entre tramos, y un tramo que no entra
 * (MAX_TOKENS) cuesta un ciclo de espera entero; 20 páginas densas de hebreo
 * (~1 100 tokens de salida por página) quedan bajo el tope con margen.
 */
export const PAGINAS_POR_TRAMO = 20;

export function planearTramos(totalPaginas: number, porTramo = PAGINAS_POR_TRAMO): Tramo[] {
    const tramos: Tramo[] = [];
    for (let desde = 1; desde <= totalPaginas; desde += porTramo) {
        tramos.push({ desde, hasta: Math.min(totalPaginas, desde + porTramo - 1) });
    }
    return tramos;
}

/** Un tramo que no salió se parte en dos para la vuelta siguiente (si tiene más de una página). */
export function partirTramo(t: Tramo): Tramo[] {
    if (t.hasta <= t.desde) return [t];
    const medio = Math.floor((t.desde + t.hasta) / 2);
    return [{ desde: t.desde, hasta: medio }, { desde: medio + 1, hasta: t.hasta }];
}

/** El pedido de un tramo, igual al de la extracción en línea. */
export function pedidoDeTramo(fileUri: string) {
    return {
        contents: [{
            role: 'user',
            parts: [{ text: PROMPT_DE_EXTRACCION }, { fileData: { mimeType: 'application/pdf', fileUri } }],
        }],
        config: configDeExtraccion(),
    };
}

export type ResultadoDeTramo =
    | { ok: true; paginas: GeminiPage[]; rescatado: boolean }
    | { ok: false; motivo: string };

/**
 * Lee la respuesta de un tramo y numera sus páginas en el libro (el tramo
 * empieza en `desde`, el modelo numera desde 1).
 */
export function leerRespuestaDeTramo(
    respuesta: { text?: string | null; finishReason?: string | null; error?: unknown },
    tramo: Tramo,
): ResultadoDeTramo {
    if (respuesta.error) return { ok: false, motivo: `error del lote: ${JSON.stringify(respuesta.error).slice(0, 200)}` };
    if (respuesta.finishReason && respuesta.finishReason !== 'STOP') {
        return { ok: false, motivo: `respuesta cortada (${respuesta.finishReason})` };
    }
    const texto = respuesta.text ?? '';
    let crudas: Array<{ page?: number; text?: string; md?: string }>;
    let rescatado = false;
    try {
        crudas = parsearRespuesta<{ pages?: typeof crudas }>(texto).pages ?? [];
    } catch {
        crudas = rescatarPaginas(texto);
        rescatado = true;
    }
    if (crudas.length === 0) return { ok: false, motivo: 'sin páginas legibles' };
    const largo = tramo.hasta - tramo.desde + 1;
    const paginas = crudas
        .map((p, i) => ({
            page: tramo.desde - 1 + (typeof p.page === 'number' ? p.page : i + 1),
            text: typeof p.md === 'string' ? markdownAPlano(p.md) : (p.text ?? ''),
            md: p.md,
        }))
        // Un número fuera del tramo no es una página de este tramo.
        .filter(p => p.page >= tramo.desde && p.page <= tramo.desde - 1 + largo);
    return { ok: true, paginas, rescatado };
}

/**
 * Las páginas de un tramo que la respuesta no trajo, agrupadas en tramos para
 * pedirlas otra vez. En la primera prueba real (Varner, 2026-10-15) el modelo
 * devolvió 15 de 20 páginas en varios tramos: no corrió la numeración (lo
 * devuelto coincidía con el libro), sólo omitió páginas. La extracción en línea
 * relee el tramo corto; en lote se piden sólo las que faltaron.
 */
export function tramosQueFaltan(tramo: Tramo, devueltas: ReadonlyArray<{ page: number }>): Tramo[] {
    const vistas = new Set(devueltas.map(p => p.page));
    const faltan: Tramo[] = [];
    for (let n = tramo.desde; n <= tramo.hasta; n++) {
        if (vistas.has(n)) continue;
        const ultimo = faltan[faltan.length - 1];
        if (ultimo && ultimo.hasta === n - 1) ultimo.hasta = n;
        else faltan.push({ desde: n, hasta: n });
    }
    return faltan;
}

/** El libro unido: una entrada por página, la última gana (como la cola). */
export function unirPaginas(paginas: ReadonlyArray<GeminiPage>): { markdown: string; texto: string; paginas: GeminiPage[] } {
    const porPagina = new Map<number, GeminiPage>();
    for (const p of paginas) porPagina.set(p.page, p);
    const unidas = [...porPagina.values()].sort((a, b) => a.page - b.page);
    return { markdown: pagesToMarkdown(unidas), texto: pagesToMarkedText(unidas), paginas: unidas };
}

const HEBREO = /[֐-׿]/g;
const GRIEGO = /[Ͱ-Ͽἀ-῿]/g;

export interface Comparacion {
    reemplazar: boolean;
    motivo: string;
    actual: { faltantes: number; hebreo: number; griego: number; textoVacio: boolean };
    nueva: { faltantes: number; hebreo: number; griego: number; textoVacio: boolean };
}

/**
 * Si el texto nuevo reemplaza al actual. Nunca deja un libro peor:
 *  - no puede faltarle MÁS páginas que al actual;
 *  - no puede perder más del 10 % del griego ni del hebreo (el modelo nuevo
 *    lee mejor, no menos; perder escritura es señal de una lectura rota);
 *  - y tiene que mejorar algo: menos faltantes, texto estructurado que ya no
 *    está vacío, o un modelo mejor (`mejoraPorModelo`).
 */
export function compararExtracciones(
    actual: { texto: string; medicion: MedicionDeExtraccion },
    nueva: { texto: string; medicion: MedicionDeExtraccion },
    mejoraPorModelo: boolean,
): Comparacion {
    const resumen = (x: { texto: string; medicion: MedicionDeExtraccion }) => ({
        faltantes: x.medicion.paginasFaltantes.total,
        hebreo: (x.texto.match(HEBREO) ?? []).length,
        griego: (x.texto.match(GRIEGO) ?? []).length,
        textoVacio: x.medicion.textoVacio,
    });
    const a = resumen(actual);
    const n = resumen(nueva);
    const base = { actual: a, nueva: n };
    if (n.faltantes > a.faltantes) return { ...base, reemplazar: false, motivo: `faltan más páginas (${n.faltantes} contra ${a.faltantes})` };
    if (n.hebreo < a.hebreo * 0.9) return { ...base, reemplazar: false, motivo: `pierde hebreo (${n.hebreo} contra ${a.hebreo})` };
    if (n.griego < a.griego * 0.9) return { ...base, reemplazar: false, motivo: `pierde griego (${n.griego} contra ${a.griego})` };
    if (n.textoVacio) return { ...base, reemplazar: false, motivo: 'el texto nuevo también está vacío' };
    const mejoras = [
        n.faltantes < a.faltantes ? `faltantes ${a.faltantes} → ${n.faltantes}` : '',
        a.textoVacio && !n.textoVacio ? 'texto estructurado recuperado' : '',
        mejoraPorModelo ? 'leído con el modelo nuevo' : '',
    ].filter(Boolean);
    if (mejoras.length === 0) return { ...base, reemplazar: false, motivo: 'no mejora nada' };
    return { ...base, reemplazar: true, motivo: mejoras.join('; ') };
}

/** Mide un texto contra el PDF (atajo para el script y las pruebas). */
export function medirTexto(texto: string, capa: ReadonlyArray<number> | null, respaldo?: string): MedicionDeExtraccion {
    return medirExtraccion(texto, capa?.length ?? null, capa, respaldo);
}
