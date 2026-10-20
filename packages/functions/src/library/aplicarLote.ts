import { FieldValue } from 'firebase-admin/firestore';
import { MODEL_VISION } from '../llm/modelCatalog';
import { camposDeMedicion } from './medirExtraccion';
import { censusOf } from './scriptCensus';
import { truncateUtf8 } from './truncateUtf8';
import { parseFirebaseStorageLocation } from './storageLocation';
import { abrirFicha, cerrarFicha } from './fichaDeCorrida';
import {
    compararExtracciones, conservarEscritura, medirTexto, paginasMasCompletas, rellenarConCapa, unirPaginas, type Comparacion, type PaginaConservada,
} from './loteDeExtraccion';
import {
    reclamarAplicacion, registrarAplicacion, registrarComparacion, rutaDeCapa, soltarAplicacion, type Lote,
} from './estadoDelLote';
import { actualizar, ErrorDelLote, leerLote, paginasDelLibro, type Dependencias } from './orquestarLote';

/**
 * Aplicar un lote del panel (fase «lote desde el panel», PR 3): comparar el
 * texto actual de cada libro con el nuevo y, si mejora sin perder nada,
 * reemplazarlo. Es el `aplicar` de `scripts/reprocesar-en-lote.ts`, con lo
 * que el script no comprobaba: que el libro no se esté extrayendo, que el PDF
 * sea el mismo que se cortó y que nadie lo esté aplicando a la vez.
 */

export const VERSION_DEL_LOTE = '6.0-gemini-cola';
const VERSIONES_DE_VISION = new Set(['4.0-gemini-standard', '6.0-gemini-cola', '2.0-gemini']);
const LIMITE_TEXTCONTENT = 900_000;
const HEBREO_O_GRIEGO = /[Ͱ-Ͽἀ-῿֐-׿]/g;

interface Calculo {
    cmp: Comparacion;
    rellenadas: number[];
    /** Páginas donde el texto nuevo perdía griego o hebreo: conservan el actual. */
    conservadas: PaginaConservada[];
    /** Cuántas detectó (con desalineación, `conservadas` queda vacía y esto no). */
    conservadasTotal: number;
    nuevo: ReturnType<typeof unirPaginas>;
    medidaNueva: ReturnType<typeof medirTexto>;
    mdActual: string;
    tcActual: string;
    recurso: FirebaseFirestore.DocumentData;
    /** La hora del documento leído: escribir exige que nadie lo haya cambiado desde entonces. */
    leidoEn: FirebaseFirestore.Timestamp | undefined;
    total: number;
}

/** Sólo «no existe» cuenta como md vacío; cualquier otro error al bajarlo corta (si no, se pisaba sin respaldo). */
const noExiste = (err: unknown) => (err as { code?: number | string }).code === 404;

/** Arma el texto nuevo y lo compara con el actual. No escribe nada. */
async function calcular(d: Dependencias, lote: Lote, rid: string): Promise<Calculo> {
    const libro = lote.libros.find(b => b.rid === rid);
    if (!libro || libro.estado !== 'preparado' || !libro.totalPaginas) throw new ErrorDelLote('failed-precondition', 'El libro no se preparó en este lote.');
    const snap = await d.db.collection('library_resources').doc(rid).get();
    const recurso = snap.data();
    if (!recurso) throw new ErrorDelLote('not-found', 'El libro ya no existe.');
    const total = libro.totalPaginas;
    const capaTexto = await d.almacen.leer(rutaDeCapa(lote, rid));
    const textosDeCapa = capaTexto ? (JSON.parse(capaTexto) as string[]) : null;
    const capa = textosDeCapa?.map(t => t.replace(/\s/g, '').length) ?? null;
    const relleno = rellenarConCapa(await paginasDelLibro(d, lote, rid), total, textosDeCapa ?? []);
    const enMd = recurso.structuredContentUrl ? parseFirebaseStorageLocation(String(recurso.structuredContentUrl), d.bucketPorDefecto) : null;
    const mdActual = enMd?.path
        ? (await d.almacen.bajar(enMd).catch(err => { if (noExiste(err)) return Buffer.from(''); throw err; })).toString('utf8')
        : '';
    const tcActual = typeof recurso.textContent === 'string' ? recurso.textContent : '';
    // Página por página, el texto actual más completo de sus dos formas.
    const actuales = paginasMasCompletas(mdActual, tcActual,
        recurso.wasTruncated === true || Buffer.byteLength(tcActual, 'utf8') >= LIMITE_TEXTCONTENT);
    const protegido = conservarEscritura(unirPaginas(relleno.paginas).paginas, actuales);
    const nuevo = unirPaginas(protegido.paginas);
    const medidaActual = medirTexto(mdActual || tcActual, total, capa, tcActual);
    const medidaNueva = medirTexto(nuevo.markdown, total, capa, nuevo.texto);
    const mejoraPorModelo = VERSIONES_DE_VISION.has(recurso.extractionVersion)
        ? recurso.extractionModel !== MODEL_VISION
        : recurso.extractionVersion !== VERSION_DEL_LOTE;
    // Una sola copia del texto actual: `structured.md` y `textContent` son el
    // mismo libro, y sumarlos contaba dos veces su griego y su hebreo.
    const escritura = (t: string) => (t.match(HEBREO_O_GRIEGO) ?? []).length;
    const textoActual = escritura(mdActual) >= escritura(tcActual) ? mdActual : tcActual;
    let cmp = compararExtracciones({ texto: textoActual, medicion: medidaActual }, { texto: nuevo.markdown, medicion: medidaNueva }, mejoraPorModelo);
    if (protegido.desalineado) {
        // Muchas páginas «pierden» escritura a la vez: no es griego perdido sino
        // páginas que no se corresponden (numeración corrida, otro PDF). No se
        // reemplaza: hay que mirarlo a mano.
        cmp = { ...cmp, reemplazar: false, motivo: `${protegido.conservadas.length} páginas no coinciden con el texto actual en griego o hebreo: revisar a mano antes de reemplazar` };
    }
    const conservadas = protegido.desalineado ? [] : protegido.conservadas;
    // Una página conservada ya no lleva el texto del PDF: no se cuenta en las dos listas.
    const rellenadas = relleno.rellenadas.filter(n => !conservadas.some(c => c.pagina === n));
    return { cmp, rellenadas, conservadas, conservadasTotal: protegido.conservadas.length, nuevo, medidaNueva, mdActual, tcActual, recurso, leidoEn: snap.updateTime, total };
}

const guardable = (c: Calculo) => ({
    reemplazar: c.cmp.reemplazar, motivo: c.cmp.motivo, actual: c.cmp.actual, nueva: c.cmp.nueva, rellenadas: c.rellenadas.length,
    // Sólo números de página y conteos: nunca texto del libro.
    conservadas: c.conservadas.slice(0, 40),
    conservadasTotal: c.conservadas.length,
});

/** «Comparar»: calcula y guarda la comparación de un libro (sólo números y el motivo). */
export async function compararLibro(d: Dependencias, loteId: string, rid: string) {
    const lote = await leerLote(d, loteId);
    if (!lote) throw new ErrorDelLote('not-found', 'El lote no existe');
    const c = await calcular(d, lote, rid);
    await actualizar(d, loteId, l => registrarComparacion(l, rid, guardable(c), d.ahora()));
    return guardable(c);
}

/**
 * «Aplicar» un libro. Nunca lo deja peor: si la comparación dice que no
 * mejora, no escribe (y queda anotado por qué). Si escribe: respaldo de los
 * dos textos, el md nuevo, y el documento en dos pasos (`processing` →
 * `ready`) para que el indexador lo rehaga; si algo falla a mitad, se deshace.
 */
export async function aplicarLibro(
    d: Dependencias,
    p: { loteId: string; rid: string; aceptarIncompletos: boolean; por: string },
    /** Apenas el libro quedó escrito (la auditoría): antes de anotarlo en el lote, que podría fallar. */
    alEscribir: (r: { motivo: string }) => Promise<void> = async () => undefined,
): Promise<{ reemplazado: boolean; motivo: string }> {
    const error = await actualizar(d, p.loteId, l => reclamarAplicacion(l, p.rid, p.aceptarIncompletos, d.ahora()));
    if (error) throw new ErrorDelLote('failed-precondition', `No se puede aplicar: ${error}.`);
    try {
        const lote = (await leerLote(d, p.loteId))!;
        const libro = lote.libros.find(b => b.rid === p.rid)!;
        const c = await calcular(d, lote, p.rid);
        if (c.recurso.userId !== lote.dueno) throw new ErrorDelLote('failed-precondition', 'El libro ya no es de esta biblioteca.');
        if (c.recurso.textExtractionStatus === 'processing') throw new ErrorDelLote('failed-precondition', 'El libro se está extrayendo ahora: espera a que termine.');
        const ubicacion = parseFirebaseStorageLocation(String(c.recurso.storageUrl ?? ''), d.bucketPorDefecto);
        const generacion = ubicacion.path ? await d.almacen.generacion(ubicacion) : null;
        if (!libro.pdf) throw new ErrorDelLote('failed-precondition', 'Este lote se preparó sin la huella del PDF (antes de poder aplicar desde el panel): arma otro lote con este libro.');
        if (libro.pdf.ruta !== `${ubicacion.bucket}/${ubicacion.path}` || libro.pdf.generacion !== generacion) {
            throw new ErrorDelLote('failed-precondition', 'El PDF del libro cambió desde que se preparó el lote: arma otro lote con él.');
        }
        await actualizar(d, p.loteId, l => registrarComparacion(l, p.rid, guardable(c), d.ahora()));
        if (!c.cmp.reemplazar) {
            await actualizar(d, p.loteId, l => registrarAplicacion(l, p.rid, { reemplazado: false, motivo: `se queda como está: ${c.cmp.motivo}` }, d.ahora()));
            return { reemplazado: false, motivo: c.cmp.motivo };
        }
        await escribirLibro(d, lote, p.rid, c);
        await alEscribir({ motivo: c.cmp.motivo });
        await actualizar(d, p.loteId, l => registrarAplicacion(l, p.rid, { reemplazado: true, motivo: c.cmp.motivo }, d.ahora()));
        return { reemplazado: true, motivo: c.cmp.motivo };
    } finally {
        await actualizar(d, p.loteId, l => soltarAplicacion(l, p.rid));
    }
}

async function escribirLibro(d: Dependencias, lote: Lote, rid: string, c: Calculo): Promise<void> {
    const carpeta = `users/${lote.dueno}/library/${rid}`;
    const mdPath = `${carpeta}/structured.md`;
    const ref = d.db.collection('library_resources').doc(rid);
    const ahora = () => new Date(d.ahora());

    // 1) Tomar el libro: a «processing» SÓLO si nadie lo tocó desde que se
    // comparó (un «Reprocesar» del usuario en el medio se pisaba). Con la
    // señal de vida nueva: el barrido mira esa hora, y la vieja era de semanas.
    try {
        await ref.update(
            { textExtractionStatus: 'processing', extractionHeartbeatAt: ahora(), processingStartedAt: ahora(), updatedAt: ahora() },
            ...(c.leidoEn ? [{ lastUpdateTime: c.leidoEn }] : []),
        );
    } catch (err) {
        console.warn(`[lote] ${lote.id}/${rid}: el libro cambió antes de aplicar`, err);
        throw new ErrorDelLote('failed-precondition', 'El libro cambió mientras se comparaba (otra extracción o edición): vuelve a aplicar.');
    }

    const runId = `lote-${lote.id}-${rid}`;
    await abrirFicha(d.db, { runId, resourceId: rid, userId: lote.dueno, path: 'batch-reprocess' });
    const recortado = truncateUtf8(c.nuevo.texto, LIMITE_TEXTCONTENT);
    let mdEscrito = false;
    try {
        // Respaldo de AMBOS textos (en los libros de LlamaParse el md trae sólo
        // marcas y el texto real vive en `textContent`), con la hora en el
        // nombre y sin pisar nunca uno anterior.
        const sello = `antes-del-lote-${lote.id}-${ahora().toISOString().replace(/[:.]/g, '-')}`;
        if (c.mdActual) await d.almacen.escribir(`${carpeta}/structured.${sello}.md`, c.mdActual, { contentType: 'text/markdown; charset=utf-8', sinPisar: true });
        if (c.tcActual) await d.almacen.escribir(`${carpeta}/textContent.${sello}.txt`, c.tcActual, { contentType: 'text/plain; charset=utf-8', sinPisar: true });
        mdEscrito = true;
        await d.almacen.escribir(mdPath, c.nuevo.markdown, {
            contentType: 'text/markdown; charset=utf-8', metadata: { resourceId: rid, extractionVersion: VERSION_DEL_LOTE },
        });
        // 2) Los campos nuevos, pasando a «ready»: el indexador automático se dispara en esa transición.
        await ref.update({
            ...camposDeMedicion(c.medidaNueva, FieldValue.delete()),
            textContent: recortado,
            textExtractionStatus: 'ready',
            extractedAt: ahora(),
            pageCount: c.nuevo.paginas.length,
            characterCount: c.nuevo.texto.length,
            extractedWithGemini: true,
            extractedWithLlamaParse: false,
            extractionVersion: VERSION_DEL_LOTE,
            extractionModel: MODEL_VISION,
            structuredContentUrl: `gs://${d.bucketPorDefecto}/${mdPath}`,
            needsReindex: true,
            wasTruncated: recortado.length < c.nuevo.texto.length,
            extractionError: null,
            extractionFailureReason: null,
            extractionWarning: null,
            scriptCensus: censusOf(c.nuevo.texto),
            reprocesadoEnLote: {
                lote: lote.id, fecha: ahora(), motivo: c.cmp.motivo, paginasConTextoDelPdf: c.rellenadas,
                paginasConTextoAnterior: c.conservadas.map(p => p.pagina),
            },
            updatedAt: ahora(),
        });
    } catch (err) {
        // Deshacer, cada paso por su cuenta y el estado primero: el libro no
        // puede quedar en «processing» (el barrido lo marcaría fallido) ni con
        // el md nuevo y el documento viejo.
        await ref.update({ textExtractionStatus: c.recurso.textExtractionStatus ?? 'ready', updatedAt: ahora() })
            .catch(e => console.error(`[lote] ${lote.id}/${rid}: no se pudo devolver el estado`, e));
        if (mdEscrito) {
            const deshacer = c.mdActual
                ? d.almacen.escribir(mdPath, c.mdActual, { contentType: 'text/markdown; charset=utf-8' })
                : d.almacen.borrar(mdPath);
            await deshacer.catch(e => console.error(`[lote] ${lote.id}/${rid}: no se pudo devolver el md`, e));
        }
        await cerrarFicha(d.db, runId, { outcome: 'failed', reason: err instanceof Error ? err.message : String(err) });
        throw err;
    }
    // Sin `engines`: no es una corrida de un motor (el informe la cuenta aparte por `path`).
    await cerrarFicha(d.db, runId, {
        outcome: 'ready', extractionVersion: VERSION_DEL_LOTE, model: MODEL_VISION,
        pagesExpected: c.total, pagesEmitted: c.nuevo.paginas.length, pagesMissing: c.cmp.nueva.faltantes, text: c.nuevo.texto,
    });
}
