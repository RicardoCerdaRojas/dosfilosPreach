import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { leerRutaPorDefecto, leerTabla } from '../ruteoDeModelos';
import { PROXY_FEATURES } from '../runLlmPrompt';
import { LLM_PRICING } from '../llmCost';

/**
 * La tabla que se carga en `config/llmRouting` vive versionada en
 * `scripts/llm-routing/ruteo.json`. Una clave mal escrita no falla: esa función
 * sigue por su modelo de siempre sin que nadie lo note. Un modelo sin precio
 * hace que el proxy ignore la ruta. Estas pruebas atrapan las dos cosas antes
 * de cargar nada.
 */
const RUTA = path.join(__dirname, '../../../../../scripts/llm-routing/ruteo.json');
const doc = JSON.parse(fs.readFileSync(RUTA, 'utf8'));
const tabla = leerTabla(doc);

describe('la tabla de ruteo propuesta', () => {
    it('ninguna entrada se descarta al leerla', () => {
        expect(Object.keys(tabla).length).toBe(Object.keys(doc.features).length);
    });

    it('cada función existe en el proxy', () => {
        const conocidas = new Set<string>(PROXY_FEATURES);
        const desconocidas = Object.keys(tabla).filter((f) => !conocidas.has(f));
        expect(desconocidas, `funciones que el proxy no conoce: ${desconocidas.join(', ')}`).toEqual([]);
    });

    it('cada modelo tiene precio: sin él el proxy ignoraría la ruta', () => {
        const sinPrecio = Object.values(tabla).map((r) => r.model).filter((m) => !(m in LLM_PRICING));
        expect(sinPrecio).toEqual([]);
    });

    it('el paper va con Sol, como decidió el fundador', () => {
        for (const f of ['exegesis.analyzeVerse', 'exegesis.composeAcademicPaper']) {
            expect(tabla[f]?.model).toBe('gpt-6.1-sol');
        }
    });

    it('la ruta por defecto es Luna y tiene precio', () => {
        const porDefecto = leerRutaPorDefecto(doc);
        expect(porDefecto?.model).toBe('gpt-6-luna');
        expect(porDefecto!.model in LLM_PRICING).toBe(true);
    });
});
