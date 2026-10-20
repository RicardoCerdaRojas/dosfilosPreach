import { censusOf } from './scriptCensus';
import { truncateUtf8 } from './truncateUtf8';
import { parseFirebaseStorageLocation } from './storageLocation';
import { markdownAPlano } from './markdownAPlano';
import { conservarEscritura, paginasMasCompletas, unirPaginas, type PaginaConservada } from './loteDeExtraccion';
import { NOMBRE_DE_LOTE } from './estadoDelLote';
import { ErrorDelLote, type Dependencias } from './orquestarLote';

/**
 * Reponer desde el respaldo las páginas que un lote dejó sin su griego o su
 * hebreo (fase «lote desde el panel», 2026-10-19).
 *
 * Los libros aplicados antes de la protección por página (`conservarEscritura`,
 * PR #793) pudieron perder escritura en unas pocas páginas aunque el libro
 * mejorara: Schreiner, 1-2 Pedro, lote `prueba-2`, pp. 301, 302 y 304. Al
 * aplicar quedó un respaldo del texto anterior (`structured.antes-del-lote-…`
 * y `textContent.antes-del-lote-…`), tanto en los lotes del panel como en los
 * de la terminal. Esto compara el texto actual con ese respaldo con la misma
 * regla, y repone sólo esas páginas: el resto del libro queda como está.
 */

const LIMITE_TEXTCONTENT = 900_000;
const ID_DE_RECURSO = /^[A-Za-z0-9_-]{1,128}$/;

export interface RevisionDeEscritura {
    /** Las páginas que perdieron escritura respecto del respaldo (las que se reponen), con tope de 60. */
    paginas: PaginaConservada[];
    /** Cuántas son en total (la lista va con tope). */
    total: number;
    /** Demasiadas a la vez: el respaldo no se corresponde página a página. No se repone. */
    desalineado: boolean;
    /** Las que se repusieron (vacío si sólo se revisó). */
    repuestas: number[];
    /** El respaldo con que se comparó (nombre del archivo). */
    respaldo: string;
}

/**
 * El respaldo de antes del lote: el sello de hora MÁS ANTIGUO de ese lote
 * (aplicar dos veces el mismo lote deja un segundo respaldo con la salida
 * parcial del propio lote), y el md y el textContent del MISMO sello. El nombre
 * del lote se compara exacto: el prefijo de `prueba` también trae `prueba-3`.
 */
async function respaldoDelLote(d: Dependencias, carpeta: string, lote: string): Promise<{ md: string | null; tc: string | null; sello: string } | null> {
    const exacto = new RegExp(`/(structured|textContent)\\.antes-del-lote-${lote}-(\\d{4}-\\d{2}-\\d{2}T[\\d-]+Z)\\.(md|txt)$`);
    const rutas = [
        ...await d.almacen.listar(`${carpeta}/structured.antes-del-lote-${lote}-`),
        ...await d.almacen.listar(`${carpeta}/textContent.antes-del-lote-${lote}-`),
    ].filter(r => exacto.test(r));
    const sellos = [...new Set(rutas.map(r => r.match(exacto)![2]!))].sort();
    const sello = sellos[0];
    if (!sello) return null;
    const de = (tipo: string) => rutas.find(r => r.endsWith(`/${tipo}.antes-del-lote-${lote}-${sello}.${tipo === 'structured' ? 'md' : 'txt'}`)) ?? null;
    return { md: de('structured'), tc: de('textContent'), sello };
}

/** Una fecha de Firestore (Timestamp, Date o texto) en ms. */
const enMs = (v: unknown): number | null => {
    const d = (v as { toDate?: () => Date } | null)?.toDate?.() ?? (v instanceof Date ? v : typeof v === 'string' ? new Date(v) : null);
    return d && Number.isFinite(d.getTime()) ? d.getTime() : null;
};

export async function revisarOReponer(
    d: Dependencias,
    p: { rid: string; lote: string; escribir: boolean },
    /** Apenas el libro quedó escrito (la auditoría). */
    alEscribir: (r: { repuestas: number[]; dueno: string }) => Promise<void> = async () => undefined,
): Promise<RevisionDeEscritura> {
    if (!ID_DE_RECURSO.test(p.rid) || !NOMBRE_DE_LOTE.test(p.lote)) throw new ErrorDelLote('invalid-argument', 'Libro o lote inválido.');
    const ref = d.db.collection('library_resources').doc(p.rid);
    const snap = await ref.get();
    const recurso = snap.data();
    if (!recurso) throw new ErrorDelLote('not-found', 'El libro ya no existe.');
    const carpeta = `users/${recurso.userId}/library/${p.rid}`;

    // El texto actual tiene que ser el que dejó ESTE lote: si después se aplicó
    // otro o se volvió a extraer, reponer metería texto de dos generaciones atrás.
    const marca = recurso.reprocesadoEnLote as { lote?: unknown; fecha?: unknown } | undefined;
    if (marca?.lote !== p.lote) throw new ErrorDelLote('failed-precondition', `El texto actual no es el del lote «${p.lote}»: el libro se volvió a procesar después.`);
    const fechaDelLote = enMs(marca.fecha);
    const extraido = enMs(recurso.extractedAt);
    if (fechaDelLote !== null && extraido !== null && extraido > fechaDelLote + 60_000) {
        throw new ErrorDelLote('failed-precondition', `El libro se volvió a extraer después del lote «${p.lote}».`);
    }

    const respaldoDe = await respaldoDelLote(d, carpeta, p.lote);
    if (!respaldoDe) throw new ErrorDelLote('not-found', `No hay respaldo de antes del lote «${p.lote}» para este libro.`);
    const mdRespaldo = respaldoDe.md ? (await d.almacen.leer(respaldoDe.md)) ?? '' : '';
    const tcRespaldo = respaldoDe.tc ? (await d.almacen.leer(respaldoDe.tc)) ?? '' : '';
    const respaldo = paginasMasCompletas(mdRespaldo, tcRespaldo, Buffer.byteLength(tcRespaldo, 'utf8') >= LIMITE_TEXTCONTENT);
    if (respaldo.size === 0) throw new ErrorDelLote('failed-precondition', 'El respaldo no tiene marcas de página: no se puede comparar página por página.');

    // El texto actual: el md que escribió el lote (completo, una marca por página).
    const enMd = recurso.structuredContentUrl ? parseFirebaseStorageLocation(String(recurso.structuredContentUrl), d.bucketPorDefecto) : null;
    if (!enMd?.path) throw new ErrorDelLote('failed-precondition', 'El libro no tiene texto estructurado para comparar.');
    // Se reescribe en el bucket por defecto: un md en otro bucket no se toca.
    if (enMd.bucket !== d.bucketPorDefecto) throw new ErrorDelLote('failed-precondition', 'El texto del libro está en otro bucket: no se puede reponer desde aquí.');
    const mdActual = (await d.almacen.bajar(enMd).catch(err => {
        if ((err as { code?: number }).code === 404) throw new ErrorDelLote('failed-precondition', 'No se encontró el texto estructurado del libro.');
        throw err;
    })).toString('utf8');
    const actuales = paginasMasCompletas(mdActual, '', false);
    if (actuales.size === 0) throw new ErrorDelLote('failed-precondition', 'El texto actual del libro no tiene marcas de página.');

    const paginasActuales = [...actuales].sort((a, b) => a[0] - b[0]).map(([page, texto]) => ({ page, text: markdownAPlano(texto), md: texto }));
    const r = conservarEscritura(paginasActuales, respaldo);
    const revision: RevisionDeEscritura = {
        paginas: r.desalineado ? [] : r.conservadas.slice(0, 60),
        total: r.desalineado ? 0 : r.conservadas.length,
        desalineado: r.desalineado,
        repuestas: [],
        respaldo: `antes-del-lote-${p.lote}-${respaldoDe.sello}`,
    };
    if (!p.escribir || r.desalineado || r.conservadas.length === 0) return revision;
    // Sólo un libro listo: uno fallido o pendiente no pasa a «ready» por reponer.
    if (recurso.textExtractionStatus !== 'ready') throw new ErrorDelLote('failed-precondition', 'El libro no está listo (se está extrayendo o falló): no se repone.');

    // `unirPaginas` también cambia «µ» de micro por «μ» en todo el libro
    // (`normalizeGreekLookalikes`): reponer arregla de paso las que el lote
    // dejó. Es texto que cambia fuera de las páginas repuestas, a propósito; el
    // respaldo `antes-de-reponer` guarda cómo estaba.
    const nuevo = unirPaginas(r.paginas);
    const repuestas = r.conservadas.map(c => c.pagina);
    const ahora = () => new Date(d.ahora());
    // 1) Tomar el libro sólo si nadie lo tocó desde que se leyó.
    try {
        await ref.update(
            { textExtractionStatus: 'processing', extractionHeartbeatAt: ahora(), processingStartedAt: ahora(), updatedAt: ahora() },
            ...(snap.updateTime ? [{ lastUpdateTime: snap.updateTime }] : []),
        );
    } catch {
        throw new ErrorDelLote('failed-precondition', 'El libro cambió mientras se revisaba: vuelve a intentarlo.');
    }
    const tcActual = typeof recurso.textContent === 'string' ? recurso.textContent : '';
    let mdEscrito = false;
    try {
        // 2) Respaldo del estado actual, sin pisar uno anterior.
        const sello = `antes-de-reponer-${ahora().toISOString().replace(/[:.]/g, '-')}`;
        await d.almacen.escribir(`${carpeta}/structured.${sello}.md`, mdActual, { contentType: 'text/markdown; charset=utf-8', sinPisar: true });
        if (tcActual) await d.almacen.escribir(`${carpeta}/textContent.${sello}.txt`, tcActual, { contentType: 'text/plain; charset=utf-8', sinPisar: true });
        mdEscrito = true;
        await d.almacen.escribir(enMd.path, nuevo.markdown, {
            contentType: 'text/markdown; charset=utf-8',
            metadata: { resourceId: p.rid, extractionVersion: String(recurso.extractionVersion ?? '') },
        });
        // 3) A «ready» con el texto nuevo: el indexador se dispara en esa transición.
        const recortado = truncateUtf8(nuevo.texto, LIMITE_TEXTCONTENT);
        await ref.update({
            textContent: recortado,
            textExtractionStatus: 'ready',
            characterCount: nuevo.texto.length,
            wasTruncated: recortado.length < nuevo.texto.length,
            scriptCensus: censusOf(nuevo.texto),
            needsReindex: true,
            'reprocesadoEnLote.paginasRepuestas': repuestas,
            updatedAt: ahora(),
        });
    } catch (err) {
        await ref.update({ textExtractionStatus: recurso.textExtractionStatus ?? 'ready', updatedAt: ahora() })
            .catch(e => console.error(`[reponer] ${p.rid}: no se pudo devolver el estado`, e));
        if (mdEscrito) {
            await d.almacen.escribir(enMd.path, mdActual, { contentType: 'text/markdown; charset=utf-8' })
                .catch(e => console.error(`[reponer] ${p.rid}: no se pudo devolver el md`, e));
        }
        throw err;
    }
    await alEscribir({ repuestas, dueno: String(recurso.userId) });
    return { ...revision, repuestas };
}
