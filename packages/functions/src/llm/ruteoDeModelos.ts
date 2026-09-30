import * as admin from 'firebase-admin';
import type { EsfuerzoDeRazonamiento } from './OpenAiLlmClient';

/**
 * Qué modelo atiende cada función del proxy.
 *
 * Hasta acá el modelo lo elegía el navegador: cada adaptador traía el suyo
 * escrito en el código (2.5 Pro para exégesis, Flash para el resto). Cambiar
 * uno era un deploy de web, y probar otro proveedor era imposible.
 *
 * La tabla vive en `config/llmRouting` —mismo patrón que `config/llmBudget`—,
 * así que reasignar una función es editar un documento, no publicar código:
 *
 *     { "features": { "hebrewTutor.analyzeVerse": { "provider": "openai",
 *                                                   "model": "gpt-6-luna",
 *                                                   "reasoning": "none" } } }
 *
 * UNA FUNCIÓN QUE NO ESTÁ EN LA TABLA SE COMPORTA EXACTAMENTE COMO ANTES. La
 * tabla vacía es el estado de partida, y sólo se llena con lo que un bakeoff
 * midió.
 */

export type Proveedor = 'gemini' | 'openai' | 'anthropic';

export interface RutaDeModelo {
    provider: Proveedor;
    model: string;
    /** Sólo OpenAI: cuánto razona. Luna acepta `none`; Sol no baja de `low`. */
    reasoning?: EsfuerzoDeRazonamiento;
}

/** Lo que el pedido necesita del proveedor; decide si una ruta le sirve. */
export interface NecesidadesDelPedido {
    fileSearch: boolean;
    imagen: boolean;
    esquema: boolean;
}

/**
 * ¿Puede este proveedor atender este pedido tal como vino?
 *
 * Gemini puede todo lo que hoy se pide. Los otros no tienen la búsqueda en
 * archivos de Gemini (es un servicio de Google, con los corpus cargados ahí),
 * y los adaptadores todavía no mandan imágenes. El esquema JSON sí lo cumple
 * OpenAI (ver `esquemaEstricto`); Anthropic no. Mandarles un pedido así no fallaría: devolvería una respuesta sin el
 * corpus, o sin la estructura que el llamador parsea. Por eso la ruta se
 * IGNORA y el pedido sigue por Gemini, con registro.
 */
export function rutaCompatible(ruta: RutaDeModelo, pedido: NecesidadesDelPedido): boolean {
    if (ruta.provider === 'gemini') return true;
    if (pedido.fileSearch || pedido.imagen) return false;
    // OpenAI cumple el esquema en modo estricto (`esquemaEstricto` lo traduce);
    // el adaptador de Anthropic todavía no.
    return !pedido.esquema || ruta.provider === 'openai';
}

const PROVEEDORES: ReadonlySet<string> = new Set(['gemini', 'openai', 'anthropic']);
const ESFUERZOS: ReadonlySet<string> = new Set(['none', 'minimal', 'low', 'medium', 'high']);

/**
 * La tabla tal como está guardada, sin las entradas que no se entienden. Una
 * entrada mal escrita se descarta y se avisa: tomarla a medias —un proveedor sin
 * modelo— rompería cada llamada de esa función.
 */
export function leerTabla(raw: unknown): Record<string, RutaDeModelo> {
    const features = (raw as { features?: unknown } | undefined)?.features;
    if (!features || typeof features !== 'object') return {};
    const tabla: Record<string, RutaDeModelo> = {};
    for (const [feature, v] of Object.entries(features as Record<string, unknown>)) {
        const r = v as Partial<RutaDeModelo> | undefined;
        if (!r || typeof r.provider !== 'string' || !PROVEEDORES.has(r.provider) || typeof r.model !== 'string' || !r.model) {
            console.warn(`[ruteo] entrada inválida para ${feature}; se ignora`, v);
            continue;
        }
        tabla[feature] = {
            provider: r.provider as Proveedor,
            model: r.model,
            ...(typeof r.reasoning === 'string' && ESFUERZOS.has(r.reasoning)
                ? { reasoning: r.reasoning as EsfuerzoDeRazonamiento }
                : {}),
        };
    }
    return tabla;
}

const VIGENCIA_MS = 60_000;
let cache: { tabla: Record<string, RutaDeModelo>; hasta: number } | null = null;

/**
 * La ruta de una función, o `null` si no tiene. Se lee con caché de un minuto:
 * el proxy atiende cada llamada al modelo y no puede sumar una lectura por
 * llamada. Si la lectura falla se sigue sin ruta, que es el comportamiento
 * anterior — nunca peor.
 */
export async function rutaPara(feature: string): Promise<RutaDeModelo | null> {
    const ahora = Date.now();
    if (!cache || cache.hasta < ahora) {
        try {
            const doc = await admin.firestore().collection('config').doc('llmRouting').get();
            cache = { tabla: leerTabla(doc.data()), hasta: ahora + VIGENCIA_MS };
        } catch (err) {
            console.warn('[ruteo] no se pudo leer config/llmRouting; se sigue sin ruteo', err);
            cache = { tabla: {}, hasta: ahora + VIGENCIA_MS };
        }
    }
    return cache.tabla[feature] ?? null;
}

/** Sólo para pruebas. */
export function _olvidarCache(): void {
    cache = null;
}
