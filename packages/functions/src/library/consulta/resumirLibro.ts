import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { appCheckCallableOptions } from '../../config/appCheckOptions';
import { consumeRateLimitToken } from '../../shared/rateLimit';
import { clientePorRuta, MENSAJE_SIN_RESPUESTA } from '../../llm/clientePorRuta';
import { sanitizeExtractedText } from '../sanitizeExtractedText';
import { markdownAPlano } from '../markdownAPlano';
import { revisarCuota, sumarConsulta } from './cuotaDeConsultas';

/**
 * Resúmenes breves que leen poco (fase «biblioteca consultable», U7).
 *
 * Decisión del fundador (2026-10-15): breves, para no comprometer el costo.
 * El costo lo pone lo que se LEE, así que hay dos reglas: un resumen corto y
 * un tope a lo que se lee.
 *
 *   - `mapa`: el libro entero SIN leerlo. Las secciones (`sectionPath`) y el
 *     comienzo de cada una; a lo sumo 300 palabras y los temas con sus hojas.
 *   - `seccion`: el capítulo donde está una hoja (lo halla el servidor por
 *     `sectionPath`), con un tope de 60 hojas.
 *   - `paginas`: un tramo de hojas, también hasta 60.
 *
 * Las hojas NO las escribe el asistente: cita secciones o fragmentos
 * numerados y el servidor pone las hojas. Se guarda en `library_summaries`
 * (volver a pedirlo no cuesta ni cuenta) y se invalida al reindexar el libro.
 * Cada resumen nuevo cuenta como una consulta del plan.
 */

const COLECCION = 'library_summaries';
export const MAX_HOJAS = 60;
const MAX_SECCIONES = 150;
const COMIENZO_DE_SECCION = 500;
/** ~45.000 tokens: 60 hojas de un comentario denso caben; un diccionario se corta. */
const MAX_CARACTERES_DEL_TRAMO = 180_000;
const TIMEOUT_S = 120;
const POR_HORA = 30;

export type TipoDeResumen = 'mapa' | 'seccion' | 'paginas';

export interface FragmentoDelLibro {
    texto: string;
    hoja: number | null;
    seccion: string[];
    orden: number;
}

export interface SeccionDelMapa {
    n: number;
    titulo: string;
    desde: number | null;
    hasta: number | null;
    comienzo: string;
}

export interface Resumen {
    tipo: TipoDeResumen;
    /** Hojas del tramo resumido (en `mapa`, el libro entero). */
    desde: number | null;
    hasta: number | null;
    /** El título de la sección resumida, si es una. */
    titulo: string | null;
    resumen: string;
    puntos: Array<{ texto: string; hojas: number[] }>;
}

/** Las dos primeras partes del encabezado: «Capítulo 5 › 5:13-18». */
const claveDeSeccion = (seccion: ReadonlyArray<string>) => seccion.slice(0, 2).join(' › ');

/**
 * Las secciones del libro en orden, con sus hojas y el comienzo de cada una.
 * Si son demasiadas (un diccionario), se agrupan por el primer nivel.
 */
export function armarSecciones(fragmentos: ReadonlyArray<FragmentoDelLibro>, maximo = MAX_SECCIONES): SeccionDelMapa[] {
    const ordenados = [...fragmentos].sort((a, b) => a.orden - b.orden);
    const agrupar = (clave: (f: FragmentoDelLibro) => string) => {
        const secciones: SeccionDelMapa[] = [];
        let actual: SeccionDelMapa | null = null;
        let claveActual: string | null = null;
        for (const f of ordenados) {
            const c = clave(f);
            if (!c) continue;
            if (c !== claveActual) {
                actual = { n: secciones.length + 1, titulo: c, desde: f.hoja, hasta: f.hoja, comienzo: f.texto.slice(0, COMIENZO_DE_SECCION) };
                secciones.push(actual);
                claveActual = c;
            } else if (actual && f.hoja !== null) {
                actual.desde = actual.desde === null ? f.hoja : Math.min(actual.desde, f.hoja);
                actual.hasta = actual.hasta === null ? f.hoja : Math.max(actual.hasta, f.hoja);
            }
        }
        return secciones;
    };
    const finas = agrupar(f => claveDeSeccion(f.seccion));
    if (finas.length <= maximo) return finas;
    const gruesas = agrupar(f => f.seccion[0] ?? '');
    if (gruesas.length <= maximo) return gruesas;
    // Un diccionario con más entradas que el tope: se toman parejas a lo largo
    // del libro, no las primeras (si no, el «mapa» sería sólo la letra Alef).
    const paso = gruesas.length / maximo;
    return Array.from({ length: maximo }, (_, i) => gruesas[Math.floor(i * paso)]!).map((sec, i) => ({ ...sec, n: i + 1 }));
}

/**
 * El capítulo donde está una hoja: las hojas de los fragmentos que comparten
 * su sección. Un capítulo de más de 60 hojas se parte en bloques FIJOS desde
 * su comienzo (sin salirse de él): pedir la hoja 50 y la 51 da el mismo
 * bloque, el mismo resumen y un solo cobro (revisión adversarial).
 */
export function tramoDeLaSeccion(fragmentos: ReadonlyArray<FragmentoDelLibro>, hoja: number): { desde: number; hasta: number; titulo: string | null } {
    const enLaHoja = fragmentos.filter(f => f.hoja === hoja && f.seccion.length > 0).sort((a, b) => a.orden - b.orden)[0];
    if (!enLaHoja) {
        const desde = 1 + MAX_HOJAS * Math.floor((hoja - 1) / MAX_HOJAS);
        return { desde, hasta: desde + MAX_HOJAS - 1, titulo: null };
    }
    const clave = claveDeSeccion(enLaHoja.seccion);
    const hojas = fragmentos.filter(f => claveDeSeccion(f.seccion) === clave && f.hoja !== null).map(f => f.hoja!);
    const inicio = Math.min(...hojas);
    const fin = Math.max(...hojas);
    if (fin - inicio + 1 <= MAX_HOJAS) return { desde: inicio, hasta: fin, titulo: clave };
    const partes = Math.ceil((fin - inicio + 1) / MAX_HOJAS);
    const k = Math.floor((hoja - inicio) / MAX_HOJAS);
    const desde = inicio + MAX_HOJAS * k;
    return { desde, hasta: Math.min(desde + MAX_HOJAS - 1, fin), titulo: `${clave} (parte ${k + 1} de ${partes})` };
}

/**
 * La forma exacta, también en el pedido: el respaldo de Gemini no recibe el
 * esquema, y sin esto devolvía otras claves (revisión adversarial).
 */
const FORMA_JSON = 'Responde SOLO un JSON con esta forma: {"resumen": "texto", "puntos": [{"texto": "tema o idea", "refs": [3, 7]}]}, donde refs son los NÚMEROS de las secciones [S…] o fragmentos [F…] citados.';

const SISTEMA = [
    'Eres el asistente de estudio de un pastor. Resumes UNA parte de un libro de su biblioteca, usando SOLO el texto que se te da.',
    '- Español neutro latinoamericano. Breve y claro: nada de preámbulos («Este capítulo trata…» sí; «Claro, aquí tienes…» no).',
    '- No inventes: si el texto no alcanza, dilo.',
    '- No menciones que eres un modelo ni nombres de proveedores.',
].join('\n');

export function armarPedidoDeMapa(titulo: string, autor: string, secciones: ReadonlyArray<SeccionDelMapa>): { system: string; prompt: string } {
    const lista = secciones.map(s => `[S${s.n}] ${s.titulo}\n${markdownAPlano(s.comienzo).trim()}`).join('\n\n');
    return {
        system: `${SISTEMA}\n- Es el MAPA de un libro entero: de qué trata y cómo avanza. A lo sumo 300 palabras.\n- Después, entre 4 y 10 temas; cada uno con las secciones donde se trata, por su número.\n${FORMA_JSON}`,
        prompt: `Libro: «${titulo}»${autor ? `, de ${autor}` : ''}.\n\nSecciones, con el comienzo de cada una:\n\n${lista}`,
    };
}

export function armarPedidoDeTramo(titulo: string, autor: string, fragmentos: ReadonlyArray<FragmentoDelLibro>, rotulo: string): { system: string; prompt: string } {
    let usados = 0;
    const partes: string[] = [];
    fragmentos.forEach((f, i) => {
        const texto = markdownAPlano(f.texto).trim();
        if (usados + texto.length > MAX_CARACTERES_DEL_TRAMO) return;
        usados += texto.length;
        partes.push(`[F${i + 1}] (hoja ${f.hoja ?? '?'})\n${texto}`);
    });
    return {
        system: `${SISTEMA}\n- Resume este tramo en a lo sumo 250 palabras.\n- Después, entre 3 y 5 ideas principales; cada una con los fragmentos de donde sale, por su número.\n${FORMA_JSON}`,
        prompt: `Libro: «${titulo}»${autor ? `, de ${autor}` : ''}. Tramo: ${rotulo}.\n\n${partes.join('\n\n---\n\n')}`,
    };
}

/** La forma de la respuesta (estricta: el proveedor no puede salirse). */
export const ESQUEMA_DE_RESUMEN = {
    type: 'object',
    additionalProperties: false,
    required: ['resumen', 'puntos'],
    properties: {
        resumen: { type: 'string' },
        puntos: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['texto', 'refs'],
                properties: { texto: { type: 'string' }, refs: { type: 'array', items: { type: 'integer' } } },
            },
        },
    },
} as const;

/** Recorta el texto a un número de palabras, en el límite de una palabra. */
export function aLoSumo(texto: string, palabras: number): string {
    const p = texto.trim().split(/\s+/);
    return p.length <= palabras ? texto.trim() : `${p.slice(0, palabras).join(' ')}…`;
}

/**
 * Lee la respuesta y pone las HOJAS: el asistente cita secciones o
 * fragmentos por número; un número que no existe se descarta.
 */
export function leerResumen(
    crudo: string,
    hojasDe: (ref: number) => number[],
    topePalabras: number,
): { resumen: string; puntos: Array<{ texto: string; hojas: number[] }> } | null {
    let datos: { resumen?: unknown; puntos?: unknown };
    try { datos = JSON.parse(crudo); } catch { return null; }
    if (typeof datos.resumen !== 'string' || !datos.resumen.trim()) return null;
    const puntos = (Array.isArray(datos.puntos) ? datos.puntos : [])
        .filter((p): p is { texto: string; refs?: unknown } => typeof p?.texto === 'string' && p.texto.trim().length > 0)
        .slice(0, 10)
        .map(p => {
            // Enteros, o «S3»/«F2» si el asistente copió la marca.
            const refs = Array.isArray(p.refs)
                ? p.refs.map(r => (typeof r === 'string' ? Number(r.replace(/^\[?[SF]/i, '').replace(/\]$/, '')) : r)).filter((r): r is number => Number.isInteger(r))
                : [];
            const hojas = [...new Set(refs.flatMap(hojasDe))].sort((a, b) => a - b);
            return { texto: aLoSumo(p.texto, 40), hojas };
        });
    return { resumen: aLoSumo(datos.resumen, topePalabras), puntos };
}

function leerEntrada(data: unknown): { resourceId: string; tipo: TipoDeResumen; hoja?: number; desde?: number; hasta?: number } {
    const d = (data ?? {}) as Record<string, unknown>;
    const resourceId = typeof d.resourceId === 'string' ? d.resourceId.trim() : '';
    if (!resourceId) throw new HttpsError('invalid-argument', 'Falta el libro.');
    const entero = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : undefined);
    if (d.tipo === 'mapa') return { resourceId, tipo: 'mapa' };
    if (d.tipo === 'seccion') {
        const hoja = entero(d.hoja);
        if (!hoja) throw new HttpsError('invalid-argument', 'Falta la hoja.');
        return { resourceId, tipo: 'seccion', hoja };
    }
    if (d.tipo === 'paginas') {
        const desde = entero(d.desde);
        const hasta = entero(d.hasta);
        if (!desde || !hasta || hasta < desde) throw new HttpsError('invalid-argument', 'El tramo de páginas no es válido.');
        if (hasta - desde + 1 > MAX_HOJAS) throw new HttpsError('invalid-argument', `Elige a lo sumo ${MAX_HOJAS} páginas.`);
        return { resourceId, tipo: 'paginas', desde, hasta };
    }
    throw new HttpsError('invalid-argument', 'Tipo de resumen desconocido.');
}

export const resumirEnBiblioteca = onCall(
    {
        ...appCheckCallableOptions(),
        region: 'us-central1',
        memory: '1GiB',
        timeoutSeconds: TIMEOUT_S,
        secrets: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY'],
    },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Sign-in required');
        const userId = request.auth.uid;
        const entrada = leerEntrada(request.data);
        const db = getFirestore();

        // Sólo un libro propio o de la biblioteca común.
        const recurso = (await db.collection('library_resources').doc(entrada.resourceId).get()).data();
        const dueno = recurso?.userId as string | undefined;
        if (!recurso || (dueno !== userId && dueno !== '__system__')) throw new HttpsError('not-found', 'No se encontró el libro.');
        const titulo = String(recurso.title ?? 'Libro');
        const autor = String(recurso.author ?? '');
        // La versión del índice: si el libro se reindexa, el resumen guardado ya no vale.
        const version = recurso.indexedAt?.toMillis?.() ?? recurso.indexedAt ?? null;
        const inicio = Date.now();
        const resumenes = db.collection(COLECCION);

        // 1) LA CACHÉ PRIMERO, antes de leer el libro (revisión adversarial):
        //    volver a ver un resumen no puede leer miles de fragmentos. Para
        //    «este capítulo» se guarda un alias por hoja que dice qué bloque es.
        const guardadoValido = async (clave: string) => {
            const d = (await resumenes.doc(clave).get()).data();
            return d && d.version === version ? (d.resultado as Resumen) : null;
        };
        const claveDeTramo = (desde: number | null, hasta: number | null) =>
            `${entrada.resourceId}_${entrada.tipo === 'mapa' ? 'mapa' : `${desde}-${hasta}`}`;
        const aliasDeHoja = entrada.tipo === 'seccion' ? `${entrada.resourceId}_hoja_${entrada.hoja}` : null;
        let claveConocida: string | null = entrada.tipo === 'mapa' ? claveDeTramo(null, null)
            : entrada.tipo === 'paginas' ? claveDeTramo(entrada.desde!, entrada.hasta!) : null;
        if (aliasDeHoja) {
            const alias = (await resumenes.doc(aliasDeHoja).get()).data();
            if (alias && alias.version === version) claveConocida = String(alias.clave);
        }
        if (claveConocida) {
            const ya = await guardadoValido(claveConocida);
            if (ya) return { ...ya, guardado: true };
        }

        // 2) Cuota y tope por hora, también ANTES de la lectura grande.
        const sinCuota = await revisarCuota(userId);
        if (sinCuota) throw new HttpsError('resource-exhausted', sinCuota);
        const permitido = await consumeRateLimitToken(db, { bucket: 'library_summaries', key: userId, windowMs: 60 * 60 * 1000, max: POR_HORA });
        if (!permitido) throw new HttpsError('resource-exhausted', 'Demasiados resúmenes seguidos. Espera unos minutos.');

        // 3) Recién ahora, el libro.
        const leidos = (await db.collection('document_chunks')
            .where('userId', '==', dueno)
            .where('resourceId', '==', entrada.resourceId)
            .select('text', 'metadata', 'chunkIndex')
            .get()).docs;
        if (leidos.length === 0) throw new HttpsError('failed-precondition', 'Este libro todavía no está listo para resumir.');
        const fragmentos: FragmentoDelLibro[] = leidos.map(d => ({
            texto: sanitizeExtractedText(String(d.get('text') ?? '')).text,
            hoja: typeof d.get('metadata')?.page === 'number' ? d.get('metadata').page : null,
            seccion: Array.isArray(d.get('metadata')?.sectionPath) ? d.get('metadata').sectionPath.map(String) : [],
            orden: Number(d.get('chunkIndex') ?? 0),
        }));

        let tramo: { desde: number | null; hasta: number | null; titulo: string | null };
        if (entrada.tipo === 'mapa') tramo = { desde: null, hasta: null, titulo: null };
        else if (entrada.tipo === 'seccion') tramo = tramoDeLaSeccion(fragmentos, entrada.hoja!);
        else tramo = { desde: entrada.desde!, hasta: entrada.hasta!, titulo: null };
        const clave = claveDeTramo(tramo.desde, tramo.hasta);
        // Otra hoja del mismo bloque ya lo resumió: se anota el alias y no se cobra.
        if (aliasDeHoja && clave !== claveConocida) {
            const ya = await guardadoValido(clave);
            if (ya) {
                await resumenes.doc(aliasDeHoja).set({ userId: dueno, resourceId: entrada.resourceId, version, clave }).catch(() => undefined);
                return { ...ya, guardado: true };
            }
        }

        let pedido: { system: string; prompt: string };
        let hojasDe: (ref: number) => number[];
        let tope: number;
        if (entrada.tipo === 'mapa') {
            const secciones = armarSecciones(fragmentos);
            if (secciones.length === 0) throw new HttpsError('failed-precondition', 'Este libro no tiene secciones reconocibles para armar su mapa. Prueba resumiendo un capítulo.');
            pedido = armarPedidoDeMapa(titulo, autor, secciones);
            hojasDe = n => { const s = secciones[n - 1]; return s?.desde != null ? [s.desde] : []; };
            tope = 300;
        } else {
            const delTramo = fragmentos
                .filter(f => f.hoja !== null && f.hoja >= tramo.desde! && f.hoja <= tramo.hasta!)
                .sort((a, b) => (a.hoja! - b.hoja!) || (a.orden - b.orden));
            if (delTramo.length === 0) throw new HttpsError('failed-precondition', 'No hay texto en esas páginas.');
            const rotulo = tramo.titulo ? `«${tramo.titulo}» (hojas ${tramo.desde}–${tramo.hasta})` : `hojas ${tramo.desde}–${tramo.hasta}`;
            pedido = armarPedidoDeTramo(titulo, autor, delTramo, rotulo);
            hojasDe = n => { const f = delTramo[n - 1]; return f?.hoja != null ? [f.hoja] : []; };
            tope = 250;
        }

        // El plazo del asistente es lo que le QUEDA a la función: la lectura ya gastó una parte.
        const quedan = TIMEOUT_S - Math.ceil((Date.now() - inicio) / 1000) - 15;
        if (quedan < 20) throw new HttpsError('unavailable', MENSAJE_SIN_RESPUESTA);
        const llm = await clientePorRuta({ usage: { feature: 'library.summarize', userId }, timeoutSeconds: quedan, maxOutputTokens: 3000 });
        let crudo: string;
        try {
            crudo = await llm.generate({ ...pedido, responseMimeType: 'application/json', responseSchema: ESQUEMA_DE_RESUMEN, temperature: 0.2, maxOutputTokens: 3000 });
        } catch (err) {
            console.error('[resumirEnBiblioteca] el asistente no respondió:', err);
            throw new HttpsError('unavailable', MENSAJE_SIN_RESPUESTA);
        }
        const leido = leerResumen(crudo, hojasDe, tope);
        if (!leido) throw new HttpsError('unavailable', MENSAJE_SIN_RESPUESTA);
        const resultado: Resumen = { tipo: entrada.tipo, desde: tramo.desde, hasta: tramo.hasta, titulo: tramo.titulo, ...leido };

        // Se guarda y DESPUÉS se cuenta: un resumen que no se pudo guardar igual
        // se muestra, pero la pantalla no promete que quedó guardado.
        let sinGuardar = false;
        try {
            // `userId` = el dueño del libro: el borrado de la cuenta se lleva sus resúmenes.
            await resumenes.doc(clave).set({ userId: dueno, resourceId: entrada.resourceId, version, resultado, creado: new Date() });
            if (aliasDeHoja) await resumenes.doc(aliasDeHoja).set({ userId: dueno, resourceId: entrada.resourceId, version, clave });
        } catch (err) {
            console.error('[resumirEnBiblioteca] no se pudo guardar el resumen:', err);
            sinGuardar = true;
        }
        await sumarConsulta(userId);
        return { ...resultado, guardado: false, ...(sinGuardar ? { sinGuardar: true } : {}) };
    },
);
