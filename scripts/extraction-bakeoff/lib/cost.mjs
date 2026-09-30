/**
 * Converting billable units into money — and refusing to when it cannot be
 * done honestly.
 *
 * The first cost table this harness produced showed `0` for all three
 * LlamaParse modes. That number was read from the right field, so it was not
 * a bug; it was simply uninterpretable. Nobody could tell whether the modes
 * are free, whether the API omits the figure, or whether the job came back
 * from cache. It was reported as a cost anyway, and a reader would have
 * concluded that premium costs nothing.
 *
 * The rules here exist so that cannot happen again:
 *
 *   1. Rates are never hardcoded. They come from `rates.json`, which the
 *      operator fills from their own invoice. A price recalled from memory
 *      produces a comparison that looks rigorous and is not.
 *   2. A missing rate yields `null`, never a guess, and the report says
 *      NO CALCULABLE.
 *   3. A cached job is money that was not spent this run. It is labelled, so
 *      a cheap-looking engine cannot be cheap merely because we measured it
 *      twice.
 */

import fs from 'node:fs';
import path from 'node:path';

export function loadRates(dir) {
    const file = path.join(dir, 'rates.json');
    if (!fs.existsSync(file)) return { present: false, rates: null, path: file };
    try {
        return { present: true, rates: JSON.parse(fs.readFileSync(file, 'utf8')), path: file };
    } catch (err) {
        return { present: false, rates: null, path: file, error: err.message };
    }
}

/**
 * Where each rate came from.
 *
 * A price with no stated origin is indistinguishable from a price somebody
 * half-remembered, and this comparison already produced one confident table
 * built on an uninterpretable zero. Every figure that reaches the report
 * carries its provenance so a reader can check it against the invoice
 * instead of trusting the person who typed it.
 */
export function rateProvenance(rates) {
    const out = [];
    const add = (label, value, source) => {
        if (value == null) out.push({ label, value: null, source: 'SIN DATO — el informe no calcula dinero para esto' });
        else out.push({ label, value, source: source || '⚠️ sin procedencia declarada — verifícalo antes de citarlo' });
    };
    add('LlamaParse · USD/crédito', rates?.llamaparse?.usdPorCredito, rates?.llamaparse?._fuente);
    add('LlamaParse · créditos/mes', rates?.llamaparse?.creditosPorMes, rates?.llamaparse?._fuenteCupo);
    add('Mistral · USD/página', rates?.mistral?.usdPorPagina, rates?.mistral?._fuente);
    add('Gemini · USD/M tokens entrada', rates?.gemini?.usdPorMillonTokensEntrada, rates?.gemini?._fuente);
    add('Gemini · USD/M tokens salida', rates?.gemini?.usdPorMillonTokensSalida, rates?.gemini?._fuente);
    for (const [modelo, t] of Object.entries(rates?.modelos ?? {})) {
        if (modelo.startsWith('_')) continue;
        add(`${modelo} · USD/M entrada`, t?.entrada, t?._fuente);
        add(`${modelo} · USD/M salida`, t?.salida, t?._fuente);
    }
    return out;
}

/**
 * Money for one engine run.
 *
 * Returns `{ usd, basis, caveat }`, where `usd` is null whenever the figure
 * would be invented. `basis` states the arithmetic so a reader can check it
 * without trusting this function.
 */
export function computeCost(result, rates) {
    const b = result.billing ?? {};

    if (b.cacheHit === true) {
        return {
            usd: 0,
            basis: 'trabajo servido desde caché',
            caveat: 'NO es el costo real: se facturó 0 por reusar un trabajo previo. '
                + 'Vuelve a medir con --fresh para forzar trabajo nuevo.',
        };
    }

    if (result.id === 'pdftotext') return { usd: 0, basis: 'local, sin servicio externo', caveat: null };

    if (result.id?.startsWith('llamaparse')) {
        // El contador de la CUENTA es la fuente fiable, no el del trabajo.
        // Medido: `job_credits_usage` devolvió 0 en las tres modalidades
        // mientras el panel mostraba 1.670 créditos consumidos. El campo por
        // trabajo no refleja el gasto; el delta del contador de cuenta entre
        // dos trabajos consecutivos sí, porque es el mismo número que factura.
        const rate = rates?.llamaparse?.usdPorCredito;

        // En plan Free la API devuelve 0 en los dos campos de crédito, así que
        // el delta no sirve. Lo que SÍ reporta bien es `job_pages`. Con el
        // consumo por página de cada modo —medido aislando un motor por
        // corrida y leyendo el panel antes y después— el costo se reconstruye
        // exactamente. Es una medición del operador, no de la API, y por eso
        // es la única que hasta ahora resultó fiable: el panel marcó 539
        // créditos mientras la API insistía en 0.
        const mode = result.id.replace('llamaparse-', '');
        const perPage = rates?.llamaparse?.creditosPorPagina?.[mode];
        if (perPage != null && b.pagesBilled) {
            const c = perPage * b.pagesBilled;
            if (rate == null) return { usd: null, basis: `${c} créditos (${perPage}/pág × ${b.pagesBilled})`, caveat: 'falta usdPorCredito' };
            return {
                usd: c * rate,
                credits: c,
                basis: `${b.pagesBilled} págs × ${perPage} créd/pág × ${rate} USD`,
                caveat: null,
            };
        }

        const credits = b.creditsDelta ?? null;

        if (credits === null) {
            return {
                usd: null,
                basis: b.credits === 0 ? `la API reportó 0 créditos; ${b.pagesBilled ?? '?'} páginas facturadas` : null,
                caveat: `sin \`creditosPorPagina.${mode}\` en rates.json. La API no reporta créditos `
                    + 'en plan Free (0 en job_credits_usage y en credits_used). Aísla este modo en '
                    + 'una corrida --fresh, lee el panel antes y después, divide por las páginas, '
                    + 'y anota el valor.',
            };
        }
        if (rate == null) {
            return { usd: null, basis: `${credits} créditos (delta de cuenta)`, caveat: 'falta usdPorCredito en rates.json' };
        }
        return {
            usd: credits * rate,
            basis: `${credits} créditos (delta de cuenta) × ${rate} USD`,
            caveat: credits === 0 ? 'delta cero: puede ser caché o granularidad del contador' : null,
        };
    }

    if (result.id === 'mistral-ocr') {
        const pages = b.pagesBilled;
        const rate = rates?.mistral?.usdPorPagina;
        if (pages == null) return { usd: null, basis: null, caveat: 'la API no reportó páginas' };
        if (rate == null) return { usd: null, basis: `${pages} páginas`, caveat: 'falta usdPorPagina en rates.json' };
        return { usd: pages * rate, basis: `${pages} páginas × ${rate} USD`, caveat: null };
    }

    // Todo motor que factura por tokens: el `gemini` histórico con su tarifa
    // propia, y los de la comparación de modelos con la de `rates.modelos`,
    // buscada por el id del modelo que de verdad corrió.
    const porModelo = result.model ? rates?.modelos?.[result.model] : undefined;
    if (result.id === 'gemini' || result.model) {
        const { inputTokens: i, outputTokens: o, totalTokens: t } = b;
        const ri = result.id === 'gemini' ? rates?.gemini?.usdPorMillonTokensEntrada : porModelo?.entrada;
        const ro = result.id === 'gemini' ? rates?.gemini?.usdPorMillonTokensSalida : porModelo?.salida;
        if (i == null || t == null) return { usd: null, basis: null, caveat: 'la API no reportó el desglose de tokens' };
        if (ri == null || ro == null) {
            return {
                usd: null,
                basis: `${i} entrada, ${t} total`,
                caveat: `faltan tarifas de ${result.model ?? 'Gemini'} en rates.json`,
            };
        }

        // `candidatesTokenCount` NO es todo lo que se factura como salida.
        // Medido: 6.017 entrada + 13.330 candidatos = 19.347, contra 39.253
        // totales. Los 19.906 de diferencia son tokens de PENSAMIENTO, y la
        // página de precios dice explícitamente "Precio de salida (incluidos
        // los tokens de pensamiento)". Cobrar sólo los candidatos subestimaba
        // el costo 2,4 veces — de $4,21 a $9,98 por libro, que es la
        // diferencia entre elegir Gemini y descartarlo.
        const billableOutput = t - i;
        const thinking = billableOutput - (o ?? billableOutput);
        const usd = (i / 1e6) * ri + (billableOutput / 1e6) * ro;
        return {
            usd,
            basis: `${i} entrada × ${ri}/M + ${billableOutput} salida × ${ro}/M`
                + (thinking > 0 ? ` (incluye ${thinking} de pensamiento)` : ''),
            caveat: thinking > 0
                ? `${thinking} tokens de pensamiento (${Math.round((thinking / billableOutput) * 100)}% de la salida facturable) — se cobran a tarifa de salida`
                : null,
        };
    }

    return { usd: null, basis: null, caveat: 'motor sin modelo de costo' };
}

/**
 * Extrapolates a slice's cost to a whole book.
 *
 * Stated separately from the measured figure, and always with the page counts
 * visible, because it is the number a decision gets made on and it is the
 * easiest one to quote without its assumptions. Linear in pages — which holds
 * for per-page billing and roughly for tokens, and is worth distrusting for
 * anything with a fixed overhead.
 */
export function extrapolate(usd, slicePages, bookPages) {
    if (usd == null || !slicePages || !bookPages) return null;
    return { usd: (usd / slicePages) * bookPages, basis: `${usd.toFixed(4)} USD / ${slicePages} págs × ${bookPages} págs` };
}
