import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { leerRutaPorDefecto, leerTabla, rutaCompatible, rutaEn } from '../ruteoDeModelos';

const SIN_NADA = { fileSearch: false, imagen: false, esquema: false };

describe('leerTabla', () => {
    it('toma las entradas válidas y descarta las mal escritas', () => {
        const tabla = leerTabla({
            features: {
                'hebrewTutor.analyzeVerse': { provider: 'openai', model: 'gpt-6-luna', reasoning: 'none' },
                'sermon.writeSection': { provider: 'gemini', model: 'gemini-3.8-flash' },
                'roto.sinModelo': { provider: 'openai' },
                'roto.proveedor': { provider: 'mistral', model: 'x' },
            },
        });
        expect(Object.keys(tabla).sort()).toEqual(['hebrewTutor.analyzeVerse', 'sermon.writeSection']);
        expect(tabla['hebrewTutor.analyzeVerse']).toEqual({ provider: 'openai', model: 'gpt-6-luna', reasoning: 'none' });
    });

    it('sin documento, o sin `features`, no hay ruteo: todo sigue como antes', () => {
        expect(leerTabla(undefined)).toEqual({});
        expect(leerTabla({ otra: 1 })).toEqual({});
    });

    it('un esfuerzo de razonamiento desconocido se omite, no rompe la entrada', () => {
        const t = leerTabla({ features: { f: { provider: 'openai', model: 'gpt-6-luna', reasoning: 'muchísimo' } } });
        expect(t.f).toEqual({ provider: 'openai', model: 'gpt-6-luna' });
    });
});

describe('la ruta por defecto', () => {
    const luna = { provider: 'openai' as const, model: 'gpt-6-luna', reasoning: 'none' as const };
    const sol = { provider: 'openai' as const, model: 'gpt-6.1-sol', reasoning: 'low' as const };

    it('una función sin entrada propia toma `porDefecto`', () => {
        const doc = { porDefecto: luna, features: { 'exegesis.analyzeVerse': sol } };
        const ruteo = { tabla: leerTabla(doc), porDefecto: leerRutaPorDefecto(doc) };
        expect(rutaEn(ruteo, 'funcion.nueva')).toEqual(luna);
    });

    it('la entrada propia manda sobre `porDefecto`', () => {
        const doc = { porDefecto: luna, features: { 'exegesis.analyzeVerse': sol } };
        const ruteo = { tabla: leerTabla(doc), porDefecto: leerRutaPorDefecto(doc) };
        expect(rutaEn(ruteo, 'exegesis.analyzeVerse')).toEqual(sol);
    });

    it('sin `porDefecto`, o mal escrito, una función sin entrada sigue como antes', () => {
        expect(leerRutaPorDefecto({ features: {} })).toBeNull();
        expect(leerRutaPorDefecto(undefined)).toBeNull();
        expect(leerRutaPorDefecto({ porDefecto: { provider: 'openai' } })).toBeNull();
        expect(rutaEn({ tabla: {}, porDefecto: null }, 'funcion.nueva')).toBeNull();
    });
});

describe('rutaCompatible', () => {
    const openai = { provider: 'openai' as const, model: 'gpt-6-luna' };

    it('Gemini atiende todo lo que hoy se pide', () => {
        expect(rutaCompatible({ provider: 'gemini', model: 'gemini-3.8-flash' }, { fileSearch: true, imagen: true, esquema: true })).toBe(true);
    });

    it('otro proveedor no toma pedidos con corpus ni con imagen', () => {
        expect(rutaCompatible(openai, SIN_NADA)).toBe(true);
        // El tutor de griego con su corpus: sin la búsqueda de Gemini respondería
        // sin las fuentes, y nada fallaría.
        expect(rutaCompatible(openai, { ...SIN_NADA, fileSearch: true })).toBe(false);
        expect(rutaCompatible(openai, { ...SIN_NADA, imagen: true })).toBe(false);
    });

    it('el esquema lo cumple OpenAI en modo estricto; Anthropic todavía no', () => {
        expect(rutaCompatible(openai, { ...SIN_NADA, esquema: true })).toBe(true);
        expect(rutaCompatible({ provider: 'anthropic', model: 'claude-sonnet-4-6' }, { ...SIN_NADA, esquema: true })).toBe(false);
    });
});

/**
 * Toda ruta hacia un modelo sin precio se ignora en el proxy: el medidor lo
 * cobraría a la tarifa de respaldo y el panel mentiría. Los modelos que el
 * ruteo sabe usar tienen que estar en la tabla de precios.
 */
describe('los modelos de otros proveedores tienen precio', () => {
    const costo = fs.readFileSync(path.join(__dirname, '..', 'llmCost.ts'), 'utf8');
    for (const modelo of ['gpt-6-luna', 'gpt-6.1-sol', 'gemini-3.8-flash']) {
        it(modelo, () => expect(costo).toContain(`'${modelo}'`));
    }
});
