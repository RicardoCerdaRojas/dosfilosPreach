import { describe, it, expect } from 'vitest';
import type { ILlmClient, LlmGenerateOptions } from '../../llm/LlmClient';
import { clienteDeEval } from '../../llm/__tests__/clienteDeEval';
import { judgeEngagement, parseEngagement, isSubstantive, type EngagementInput } from '../coverageEngagement';

/**
 * Corpus A/B/C/D — espejo de packages/domain/src/services/__tests__/
 * misreadingEngagementCorpus.ts (SSOT). functions no importa @dosfilos/domain →
 * se inlinea. Caso 2 Pe 2:22, ancla v.22 + Juan 10:28-29.
 */
const BASE = {
    claim: 'el pasaje enseña que se pierde la salvación',
    whyWrong: 'describe falsos maestros que apostatan; la naturaleza nunca cambió (v.22)',
    correctiveAnchors: ['v.22', 'Juan 10:28-29'],
};

interface Row {
    row: string;
    pastorMessage: string;
    expect: { substantive: boolean; engagedAnchor: boolean; contradictsAnchor: boolean };
}

const ROWS: Row[] = [
    {
        row: 'A — enganchó, no contradice',
        pastorMessage:
            'Trabajé v.22 y Juan 10:28-29: la naturaleza del perro nunca cambió, así que leo esto como advertencia a falsos maestros que nunca fueron regenerados, aunque reconozco la tensión de "habían escapado".',
        expect: { substantive: true, engagedAnchor: true, contradictsAnchor: false },
    },
    {
        row: 'B — ignoró el ancla',
        pastorMessage: 'Sí, se pierde la salvación, el texto lo dice claramente y no hay vuelta atrás.',
        expect: { substantive: true, engagedAnchor: false, contradictsAnchor: true },
    },
    {
        row: 'C — sin sustancia',
        pastorMessage: 'es complicado',
        expect: { substantive: false, engagedAnchor: false, contradictsAnchor: false },
    },
    {
        row: 'D — enganchó a fondo PERO contradice (la garantía de la tesis)',
        pastorMessage:
            'Cité y razoné v.22 y Juan 10:28-29 a fondo, y aun así concluyo que sí se puede perder la salvación porque "habían escapado de las contaminaciones".',
        expect: { substantive: true, engagedAnchor: true, contradictsAnchor: true },
    },
];

/** Fake client que devuelve el JSON canónico de la fila (prueba plumbing, no juicio). */
function fakeClient(json: string): ILlmClient {
    return {
        generate: async (_opts: LlmGenerateOptions) => json,
    };
}

describe('coverageEngagement — plumbing determinista (sin LLM real)', () => {
    it('isSubstantive: C bajo umbral, A/B/D sobre umbral', () => {
        expect(isSubstantive(ROWS[2].pastorMessage)).toBe(false);
        expect(isSubstantive(ROWS[0].pastorMessage)).toBe(true);
        expect(isSubstantive(ROWS[1].pastorMessage)).toBe(true);
        expect(isSubstantive(ROWS[3].pastorMessage)).toBe(true);
    });

    it('parseEngagement tolera fences + extrae los dos booleanos', () => {
        expect(parseEngagement('```json\n{"engagedAnchor":true,"contradictsAnchor":true}\n```')).toEqual({
            engagedAnchor: true,
            contradictsAnchor: true,
        });
    });

    for (const r of ROWS) {
        it(`fila ${r.row}: judgeEngagement produce los 3 booleanos esperados`, async () => {
            const json = JSON.stringify({
                engagedAnchor: r.expect.engagedAnchor,
                contradictsAnchor: r.expect.contradictsAnchor,
            });
            // Para C (no sustantivo) el LLM no debe llamarse: un cliente que explota lo prueba.
            const client = r.expect.substantive ? fakeClient(json) : fakeClient('SHOULD_NOT_BE_CALLED_FOR_C');
            const input: EngagementInput = { ...BASE, pastorMessage: r.pastorMessage };
            const judgment = await judgeEngagement(client, input);
            expect(judgment).toEqual(r.expect);
        });
    }

    it('C no llama al LLM (gate de sustancia corta antes)', async () => {
        let called = false;
        const spy: ILlmClient = { generate: async () => { called = true; return '{}'; } };
        await judgeEngagement(spy, { ...BASE, pastorMessage: 'es complicado' });
        expect(called).toBe(false);
    });
});

/**
 * EVAL VIVO contra Sonnet real — corre SOLO con ANTHROPIC_API_KEY.
 * Mide el juicio fino (Corte 2, plan §5), especialmente la fila D: enganchó a
 * fondo y discrepa → engagedAnchor=true (NO false). Si Sonnet falla D de forma
 * reproducible aquí, NO se wirea (gate del founder; escalar a Pro).
 *
 *   ANTHROPIC_API_KEY=sk-... yarn workspace @dosfilos/functions test
 */
const EVAL = clienteDeEval();
describe.runIf(Boolean(EVAL))(`coverageEngagement — eval vivo (${EVAL?.nombre})`, () => {
    const client = EVAL?.cliente as ILlmClient;

    // Una corrida por fila — barrido base.
    for (const r of ROWS.filter((x) => x.expect.substantive)) {
        it(`fila ${r.row}: Sonnet adjudica engagement correctamente`, async () => {
            const judgment = await judgeEngagement(client, { ...BASE, pastorMessage: r.pastorMessage });
            expect(judgment.engagedAnchor).toBe(r.expect.engagedAnchor);
            expect(judgment.contradictsAnchor).toBe(r.expect.contradictsAnchor);
        }, 30000);
    }

    // Fila D × N corridas — REPRODUCIBILIDAD (Sonnet no es determinista; un acierto
    // único no prueba estabilidad). Si oscila (mismo input, a veces true/false) ya
    // es señal de escalar a Pro o endurecer el prompt, aunque pase en promedio.
    // Override de N: PROFILE_EVAL_RUNS=10 yarn workspace @dosfilos/functions test
    const D_RUNS = Number(process.env.PROFILE_EVAL_RUNS ?? 5);
    const D = ROWS.find((x) => x.row.startsWith('D'))!;
    it(`fila D × ${D_RUNS}: enganchó a fondo + discrepa → engagedAnchor=true CONSISTENTE`, async () => {
        const results: Array<{ engaged: boolean; contradicts: boolean }> = [];
        for (let i = 0; i < D_RUNS; i++) {
            const j = await judgeEngagement(client, { ...BASE, pastorMessage: D.pastorMessage });
            results.push({ engaged: j.engagedAnchor, contradicts: j.contradictsAnchor });
        }
        // Log para que el founder vea la distribución de las corridas.
        // eslint-disable-next-line no-console
        console.log('[eval fila D] corridas:', JSON.stringify(results));
        // TODAS deben acertar: engaged=true (la garantía) y contradicts=true.
        expect(results.every((r) => r.engaged === true)).toBe(true);
        expect(results.every((r) => r.contradicts === true)).toBe(true);
    }, 30000 * Math.max(1, D_RUNS));
});
