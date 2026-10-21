import { configDeExtraccion, PROMPT_DE_EXTRACCION, type GeminiPage } from './geminiExtraction';
import { markdownAPlano } from './markdownAPlano';
import { pagesToMarkdown, pagesToMarkedText } from './llamaParseClient';
import { parsearRespuesta, repararEscapes, rescatarPaginas } from './rescatarPaginas';
import { normalizeGreekLookalikes } from './sanitizeExtractedText';
import { CAPA_CON_TEXTO, MIN_CARACTERES_PAGINA, medirExtraccion, type MedicionDeExtraccion } from './medirExtraccion';

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
        crudas = rescatarPaginas(repararEscapes(texto));
        rescatado = true;
    }
    if (crudas.length === 0) return { ok: false, motivo: 'sin páginas legibles' };
    const largo = tramo.hasta - tramo.desde + 1;
    // Si trajo justo las páginas del tramo pero con números fuera de él (p. ej.
    // el folio impreso), la posición manda: si no, un tramo de una página
    // volvería siempre «vacío» y se pediría sin fin.
    const fueraDeRango = (p: { page?: number }) => typeof p.page === 'number' && (p.page < 1 || p.page > largo);
    const porPosicion = crudas.length === largo && crudas.some(fueraDeRango);
    const paginas = crudas
        .map((p, i) => ({
            page: tramo.desde - 1 + (!porPosicion && typeof p.page === 'number' ? p.page : i + 1),
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
export function tramosQueFaltan(tramo: Tramo, devueltas: ReadonlyArray<{ page: number; text?: string; md?: string }>): Tramo[] {
    // Una página devuelta en blanco cuenta como no devuelta (Metzger, NICNT
    // Santiago, 2026-10-15: páginas con texto en el PDF que volvieron vacías).
    // Una página de verdad en blanco se pide sola dos veces y se abandona.
    const vistas = new Set(devueltas.filter(paginaLeida).map(p => p.page));
    const faltan: Tramo[] = [];
    for (let n = tramo.desde; n <= tramo.hasta; n++) {
        if (vistas.has(n)) continue;
        const ultimo = faltan[faltan.length - 1];
        if (ultimo && ultimo.hasta === n - 1) ultimo.hasta = n;
        else faltan.push({ desde: n, hasta: n });
    }
    return faltan;
}

/**
 * De las páginas que volvieron en blanco, cuáles vale la pena pedir otra vez.
 * Si el libro tiene capa de texto (la mitad de sus páginas con más de
 * `CAPA_CON_TEXTO` caracteres) y la página está vacía en ella, está en blanco
 * de verdad: en el lote del 2026-10-15, 188 de 212 páginas que volvían en
 * blanco una y otra vez no tenían texto en el PDF. Un libro escaneado sin capa
 * no dice nada: se sigue pidiendo (con el tope de dos intentos por página).
 */
export function separarEnBlanco(faltan: ReadonlyArray<Tramo>, capa: ReadonlyArray<number> | null): { pedir: Tramo[]; enBlanco: number[] } {
    const conCapa = capa !== null && capa.filter(c => c > CAPA_CON_TEXTO).length * 2 >= capa.length;
    if (!conCapa) return { pedir: [...faltan], enBlanco: [] };
    const enBlanco: number[] = [];
    const pedir: Tramo[] = [];
    for (const t of faltan) {
        for (let n = t.desde; n <= t.hasta; n++) {
            if ((capa[n - 1] ?? 0) <= CAPA_CON_TEXTO) { enBlanco.push(n); continue; }
            const ultimo = pedir[pedir.length - 1];
            if (ultimo && ultimo.hasta === n - 1) ultimo.hasta = n;
            else pedir.push({ desde: n, hasta: n });
        }
    }
    return { pedir, enBlanco };
}

/**
 * Rellena con la capa de texto del PDF las páginas que el modelo no pudo leer
 * (las devolvió en blanco una y otra vez, o RECITATION las cortó) y que en el
 * PDF sí tienen texto. En biblioteca1 (2026-10-15) fueron ~27 páginas, casi
 * todas de Kregel Salmos: mejor el texto del PDF que una página perdida.
 */
export function rellenarConCapa(
    paginas: ReadonlyArray<GeminiPage>,
    total: number,
    textoDeLaCapa: ReadonlyArray<string>,
): { paginas: GeminiPage[]; rellenadas: number[] } {
    const conTexto = new Set(paginas.filter(paginaLeida).map(p => p.page));
    const vistas = new Set(paginas.map(p => p.page));
    const rellenadas: number[] = [];
    const nuevas: GeminiPage[] = [];
    for (let n = 1; n <= total; n++) {
        const capa = (textoDeLaCapa[n - 1] ?? '').trim();
        if (!conTexto.has(n) && capa.replace(/\s/g, '').length > CAPA_CON_TEXTO) {
            nuevas.push({ page: n, text: capa, md: capa });
            rellenadas.push(n);
        } else if (!vistas.has(n)) {
            // Una página que el modelo omitió del todo (en blanco también en el
            // PDF) igual lleva su marca: sin ella la medición la cuenta AUSENTE
            // y el libro parece peor que el actual, que sí la marca.
            nuevas.push({ page: n, text: '', md: '' });
        }
    }
    return { paginas: [...paginas, ...nuevas], rellenadas };
}

/**
 * Si el modelo LEYÓ la página: el MISMO criterio que la medición
 * (`medirExtraccion`), contando como cuenta ella —el contenido que queda bajo
 * la marca, sin espacios—. Un folio o un título corrido («12», «JAMES 3») no
 * es una página leída; con criterios distintos, el lote no la volvía a pedir y
 * la medición la contaba faltante (revisión adversarial del lote).
 */
export function paginaLeida(p: { text?: string; md?: string }): boolean {
    const contenido = (p.md && p.md.trim()) || (p.text && p.text.trim()) || '';
    return contenido.replace(/\s/g, '').length >= MIN_CARACTERES_PAGINA;
}

/**
 * Los tramos sin ciertas páginas (las abandonadas: en blanco también en el
 * PDF, o que el modelo no lee), reagrupados. Antes se las marcaba con un
 * texto corto para que «contaran como devueltas», y desde el criterio de
 * página leída (40 caracteres) ese texto ya no contaba: el tramo quedaba
 * «incompleto» para siempre (lote biblioteca2, 2026-10-17).
 */
export function sinPaginas(tramos: ReadonlyArray<Tramo>, quitar: ReadonlySet<number>): Tramo[] {
    const salida: Tramo[] = [];
    for (const t of tramos) {
        for (let n = t.desde; n <= t.hasta; n++) {
            if (quitar.has(n)) continue;
            const ultimo = salida[salida.length - 1];
            if (ultimo && ultimo.hasta === n - 1) ultimo.hasta = n;
            else salida.push({ desde: n, hasta: n });
        }
    }
    return salida;
}

/**
 * El libro unido: una entrada por página, la última gana (como la cola), salvo
 * que venga en blanco y ya hubiera texto. Cada página pasa por
 * `normalizeGreekLookalikes` («µ» de micro → «μ»): así lo comparan, lo
 * aplican y lo reponen ya corregido, sin volver a leer nada.
 */
export function unirPaginas(paginas: ReadonlyArray<GeminiPage>): { markdown: string; texto: string; paginas: GeminiPage[] } {
    const porPagina = new Map<number, GeminiPage>();
    for (const cruda of paginas) {
        const p = {
            ...cruda,
            text: cruda.text === undefined ? cruda.text : normalizeGreekLookalikes(cruda.text).text,
            ...(cruda.md === undefined ? {} : { md: normalizeGreekLookalikes(cruda.md).text }),
        };
        const previa = porPagina.get(p.page);
        if (previa && paginaLeida(previa) && !paginaLeida(p)) continue;
        porPagina.set(p.page, p);
    }
    const unidas = [...porPagina.values()].sort((a, b) => a.page - b.page);
    return { markdown: pagesToMarkdown(unidas), texto: pagesToMarkedText(unidas), paginas: unidas };
}

/**
 * Debajo de esto, el griego o el hebreo «perdido» es ruido: en la auditoría
 * eran letras latinas que el OCR viejo leyó como griegas («Το establish»,
 * «Ν.», «ω-»), y el texto nuevo las corrige.
 */
const MIN_ESCRITURA = 200;
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
 *    lee mejor, no menos; perder escritura es señal de una lectura rota),
 *    si había al menos `MIN_ESCRITURA` caracteres;
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
    const pierde = (antes: number, despues: number) => antes >= MIN_ESCRITURA && despues < antes * 0.9;
    if (pierde(a.hebreo, n.hebreo)) return { ...base, reemplazar: false, motivo: `pierde hebreo (${n.hebreo} contra ${a.hebreo})` };
    if (pierde(a.griego, n.griego)) return { ...base, reemplazar: false, motivo: `pierde griego (${n.griego} contra ${a.griego})` };
    if (n.textoVacio) return { ...base, reemplazar: false, motivo: 'el texto nuevo también está vacío' };
    const mejoras = [
        n.faltantes < a.faltantes ? `faltantes ${a.faltantes} → ${n.faltantes}` : '',
        a.textoVacio && !n.textoVacio ? 'texto estructurado recuperado' : '',
        mejoraPorModelo ? 'leído con el modelo nuevo' : '',
    ].filter(Boolean);
    if (mejoras.length === 0) return { ...base, reemplazar: false, motivo: 'no mejora nada' };
    return { ...base, reemplazar: true, motivo: mejoras.join('; ') };
}

/**
 * Mide un texto contra el PDF (atajo para el script y las pruebas). El total
 * viene del PDF (pdf-lib), no de la capa de texto: si la capa no se pudo leer
 * (plazo vencido), medir sin total daría 0 faltantes en los dos textos y
 * anularía el guardia de `compararExtracciones`.
 */
export function medirTexto(texto: string, totalPaginas: number, capa: ReadonlyArray<number> | null, respaldo?: string): MedicionDeExtraccion {
    return medirExtraccion(texto, totalPaginas, capa, respaldo);
}

/**
 * El texto actual de un libro, página por página, desde cualquiera de sus dos
 * formas: el `structured.md` (`<!-- page: N -->`, páginas separadas por
 * `---`) o el `textContent` (`[PAGE N]`). Sin marcas, vacío.
 */
export function paginasDelTexto(texto: string): Map<number, string> {
    const paginas = new Map<number, string>();
    const marca = /<!--\s*page:\s*(\d+)\s*-->|\[PAGE (\d+)\]/g;
    const cortes: Array<{ pagina: number; desde: number; hasta: number }> = [];
    for (let m = marca.exec(texto); m; m = marca.exec(texto)) {
        cortes.push({ pagina: Number(m[1] ?? m[2]), desde: m.index + m[0].length, hasta: texto.length });
        if (cortes.length > 1) cortes[cortes.length - 2]!.hasta = m.index;
    }
    for (const c of cortes) {
        const contenido = texto.slice(c.desde, c.hasta).replace(/\n\s*---\s*$/, '').trim();
        // Una página repetida (no debería) conserva la versión con más texto.
        if ((paginas.get(c.pagina)?.length ?? -1) < contenido.length) paginas.set(c.pagina, contenido);
    }
    return paginas;
}

/**
 * Palabras de escritura que se cuentan por página: griego con al menos una
 * letra que no se confunde con una latina (el OCR viejo leía «ΙΝΤRΟDUCΤΙΟΝ»
 * con Ι Ν Τ Ο griegas: eso no es griego), y hebreo con consonantes (los
 * puntos y acentos solos no cuentan: con y sin acentos no es «perder»). Tres
 * letras como mínimo: las letras sueltas («ᾷ», «μ») no son palabras leídas.
 */
const PALABRA_GRIEGA = /[\u0370-\u03FF\u1F00-\u1FFF][\u0370-\u03FF\u1F00-\u1FFF\u0300-\u036F]{2,}/g;
const GRIEGA_DISTINTIVA = /[\u0393\u0394\u0398\u039B\u039E\u03A0\u03A3\u03A6\u03A8\u03A9\u03B1-\u03BC\u03BE-\u03C9\u1F00-\u1FFF]/;
const PALABRA_HEBREA = /[\u0590-\u05FF]*[\u05D0-\u05EA][\u0590-\u05FF]*[\u05D0-\u05EA][\u0590-\u05FF]*/g;
export const palabrasDeEscritura = (texto: string, escritura: 'griego' | 'hebreo') => escritura === 'griego'
    ? (texto.match(PALABRA_GRIEGA) ?? []).filter(p => GRIEGA_DISTINTIVA.test(p)).length
    : (texto.match(PALABRA_HEBREA) ?? []).length;

/** Debajo de esto, una página no tiene escritura que proteger. */
export const MIN_PALABRAS_POR_PAGINA = 3;

/**
 * Si la página vieja y la nueva son la MISMA página del libro: al menos el
 * 60 % de las palabras latinas (4+ letras) de la nueva están en la vieja.
 * Una extracción vieja con la numeración corrida (el modelo numeraba por el
 * folio impreso; pdf-parse partía en trozos iguales) tiene la «p. 120» en
 * otro lugar del libro: conservarla duplicaría una página y perdería otra.
 * Con menos de 8 palabras latinas no se puede saber, y no se conserva.
 */
function mismaPagina(vieja: string, nueva: string): boolean {
    const latinas = (t: string) => (t.toLowerCase().match(/[a-záéíóúñü]{4,}/g) ?? []);
    const enNueva = [...new Set(latinas(nueva))];
    if (enNueva.length < 8) return false;
    const enVieja = new Set(latinas(vieja));
    return enNueva.filter(p => enVieja.has(p)).length >= enNueva.length * 0.6;
}

export interface PaginaConservada { pagina: number; escritura: 'griego' | 'hebreo'; antes: number; despues: number }

/**
 * La lectura nueva puede perder griego o hebreo en unas pocas páginas aunque
 * mejore el libro: en Schreiner (1-2 Pedro, lote `prueba-2`, 2026-10-19) la
 * nota 78 de la p. 302 decía «The term φθορᾷ … the parallel term
 * φθαρήσονται» y la nueva «The term ᾷ … the parallel term shows»: pp. 301,
 * 302 y 319. En el libro entero era un 2,5 %, y la regla de
 * `compararExtracciones` (10 % del total) no lo veía.
 *
 * Una página nueva con menos de la mitad de las palabras griegas o hebreas
 * de la actual, si es la misma página, conserva el texto actual. Se protege
 * la página, no el libro. Si son muchas (más de 5 y del 3 % del libro), no es
 * griego perdido sino otra cosa (numeración corrida, otro PDF): `desalineado`,
 * no se conserva nada y quien llama no debe reemplazar.
 */
export function conservarEscritura(
    nuevas: ReadonlyArray<GeminiPage>,
    actuales: ReadonlyMap<number, string>,
): { paginas: GeminiPage[]; conservadas: PaginaConservada[]; desalineado: boolean } {
    const conservadas: PaginaConservada[] = [];
    const paginas = nuevas.map(p => {
        const actual = actuales.get(p.page);
        if (!actual) return p;
        const nueva = (p.md && p.md.trim()) || p.text || '';
        for (const escritura of ['griego', 'hebreo'] as const) {
            const antes = palabrasDeEscritura(actual, escritura);
            const despues = palabrasDeEscritura(nueva, escritura);
            if (antes >= MIN_PALABRAS_POR_PAGINA && despues < antes / 2 && mismaPagina(actual, nueva)) {
                conservadas.push({ pagina: p.page, escritura, antes, despues });
                return { page: p.page, text: markdownAPlano(actual), md: actual };
            }
        }
        return p;
    });
    const desalineado = conservadas.length > Math.max(5, nuevas.length * 0.03);
    return desalineado ? { paginas: [...nuevas], conservadas, desalineado } : { paginas, conservadas, desalineado };
}

/** «2, 7–9, 11»: páginas sueltas y tramos, para un motivo que se lee. */
export function listaDePaginas(tramos: ReadonlyArray<Tramo>, max = 12): string {
    const partes = tramos.map(t => (t.desde === t.hasta ? `${t.desde}` : `${t.desde}–${t.hasta}`));
    return partes.length > max ? `${partes.slice(0, max).join(', ')} y ${partes.length - max} más` : partes.join(', ');
}

/**
 * El texto de un libro página por página, desde sus dos formas guardadas: por
 * página, la más completa (en los libros de LlamaParse el md trae sólo marcas
 * y el texto vive en `textContent`). Si el `textContent` está recortado (900
 * KB), su última página puede estar cortada a la mitad y no se usa.
 */
export function paginasMasCompletas(md: string, textContent: string, textContentRecortado: boolean): Map<number, string> {
    const delMd = paginasDelTexto(md);
    const delTc = paginasDelTexto(textContent);
    if (textContentRecortado) {
        const ultima = Math.max(-1, ...delTc.keys());
        if (ultima >= 0) delTc.delete(ultima);
    }
    const largo = (t: string | undefined) => (t ?? '').replace(/\s/g, '').length;
    return new Map([...new Set([...delMd.keys(), ...delTc.keys()])].map(n => [n,
        largo(delMd.get(n)) >= largo(delTc.get(n)) ? delMd.get(n)! : delTc.get(n)!]));
}
