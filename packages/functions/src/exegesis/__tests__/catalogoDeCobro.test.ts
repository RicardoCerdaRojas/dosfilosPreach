import { describe, expect, it } from 'vitest';
import { EXEGESIS_OPERATION_CATALOG } from '@dosfilos/domain';
import { CATALOGO_DE_COBRO, ETIQUETAS_QUE_COBRAN } from '../catalogoDeCobro';
import { PROXY_FEATURES } from '../../llm/runLlmPrompt';

/**
 * El catálogo de cobro es copia del dominio (functions no importa
 * `@dosfilos/domain`). Si el dominio sube un costo o agrega una operación y
 * acá no, el servidor cobra otra cosa que lo que la pantalla anuncia —o
 * rechaza una operación nueva por desconocida.
 */
describe('catálogo de cobro: paridad con el dominio', () => {
    it('mismas operaciones y mismos costos', () => {
        const delDominio = Object.fromEntries(Object.values(EXEGESIS_OPERATION_CATALOG).map(o => [o.key, o.estimatedCostUsd]));
        const local = Object.fromEntries(Object.entries(CATALOGO_DE_COBRO).map(([k, o]) => [k, o.costoUsd]));
        expect(local).toEqual(delDominio);
    });

    it('cada etiqueta que cobra existe en el proxy', () => {
        for (const e of ETIQUETAS_QUE_COBRAN) expect(PROXY_FEATURES as readonly string[], e).toContain(e);
    });

    it('cada operación cubre al menos una llamada con reintentos', () => {
        for (const [k, o] of Object.entries(CATALOGO_DE_COBRO)) expect(o.maxLlamadas, k).toBeGreaterThanOrEqual(6);
    });

    it('las etiquetas que NO cobran siguen sin cobrar (planificación, expositivo, bibliografía)', () => {
        for (const e of ['exegesis.planStepCorpus', 'exegesis.detectPericopes', 'exegesis.readBibliography', 'exegesis.classifySourceType', 'exegesis.expository.macro', 'sermon.consult']) {
            expect(ETIQUETAS_QUE_COBRAN.has(e), e).toBe(false);
        }
    });
});
