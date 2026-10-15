import { describe, it, expect } from 'vitest';
import type { ILlmClient, LlmGenerateOptions } from '../../llm/LlmClient';
import { clienteDeEval } from '../../llm/__tests__/clienteDeEval';
import { adjudicateRefutes, parseRefutes, type AdjudicateRefutesInput } from '../adjudicateRefutes';

/** Fake client que devuelve un JSON fijo (prueba plumbing, no juicio). */
function fakeClient(json: string): ILlmClient {
    return { generate: async (_opts: LlmGenerateOptions) => json };
}

describe('adjudicateRefutes — plumbing determinista (sin LLM real)', () => {
    it('parseRefutes tolera fences + extrae verdict', () => {
        expect(parseRefutes('```json\n{"refutes":"yes","reasoning":"x"}\n```').refutes).toBe('yes');
        expect(parseRefutes('{"refutes":"no","reasoning":"y"}').refutes).toBe('no');
        expect(parseRefutes('{"refutes":"unclear"}').refutes).toBe('unclear');
    });

    it('parseRefutes default conservador: verdict desconocido → unclear', () => {
        expect(parseRefutes('{"refutes":"maybe"}').refutes).toBe('unclear');
        expect(parseRefutes('{"refutes":""}').refutes).toBe('unclear');
        expect(parseRefutes('{}').refutes).toBe('unclear');
    });

    it('adjudicateRefutes pasa el verdict del cliente', async () => {
        const r = await adjudicateRefutes(fakeClient('{"refutes":"yes","reasoning":"contradice"}'), {
            claim: 'se pierde la salvación',
            anchorReference: 'Juan 10:28-29',
            anchorVerseText: 'no perecerán jamás',
        });
        expect(r.refutes).toBe('yes');
    });

    it('fail-closed: sin texto de verso → no (no llama al LLM)', async () => {
        let called = false;
        const spy: ILlmClient = { generate: async () => { called = true; return '{}'; } };
        const r = await adjudicateRefutes(spy, {
            claim: 'se pierde la salvación',
            anchorReference: 'Juan 10:28',
            anchorVerseText: '   ',
        });
        expect(r.refutes).toBe('no');
        expect(called).toBe(false);
    });
});

/**
 * EVAL VIVO contra Sonnet real — corre SOLO con ANTHROPIC_API_KEY.
 *
 * Mide el caso FINO (criterio del founder): un ancla que de verdad REFUTA vs una
 * que solo MENCIONA el tema. La regla conservadora exige que "solo menciona" NO
 * dé `yes`. N corridas por caso para confirmar que no OSCILA (un acierto único no
 * prueba estabilidad). Consistente → pasa; oscila → endurecer prompt / escalar.
 *
 *   ANTHROPIC_API_KEY=sk-... PROFILE_EVAL_RUNS=5 yarn workspace @dosfilos/functions test
 */
interface EvalCase {
    name: string;
    input: AdjudicateRefutesInput;
    /** 'yes' = debe refutar; 'not-yes' = conservador, NUNCA yes. */
    expect: 'yes' | 'not-yes';
}

// Textos RVR1960 inlineados (el adjudicador recibe el texto, no lo redacta).
const CASES: EvalCase[] = [
    {
        name: 'REFUTA de verdad: "pierde salvación" ↔ Juan 10:28-29',
        input: {
            claim: 'el creyente verdadero puede perder la salvación',
            whyWrong: 'el texto afirma seguridad eterna del que es de Cristo',
            anchorReference: 'Juan 10:28-29',
            anchorVerseText:
                'Y yo les doy vida eterna; y no perecerán jamás, ni nadie las arrebatará de mi mano. Mi Padre que me las dio, es mayor que todos, y nadie las puede arrebatar de la mano de mi Padre.',
        },
        expect: 'yes',
    },
    {
        name: 'SOLO MENCIONA el tema: "pierde salvación" ↔ Romanos 10:9 (habla de salvación, no la refuta)',
        input: {
            claim: 'el creyente verdadero puede perder la salvación',
            anchorReference: 'Romanos 10:9',
            anchorVerseText:
                'que si confesares con tu boca que Jesús es el Señor, y creyeres en tu corazón que Dios le levantó de los muertos, serás salvo.',
        },
        expect: 'not-yes',
    },
    {
        name: 'REFUTA de verdad (otra doctrina): "Jesús no es Dios" ↔ Juan 1:1',
        input: {
            claim: 'Jesús no es Dios, solo una criatura',
            anchorReference: 'Juan 1:1',
            anchorVerseText: 'En el principio era el Verbo, y el Verbo era con Dios, y el Verbo era Dios.',
        },
        expect: 'yes',
    },
    {
        name: 'IRRELEVANTE: "pierde salvación" ↔ Génesis 1:1 (no toca el tema)',
        input: {
            claim: 'el creyente verdadero puede perder la salvación',
            anchorReference: 'Génesis 1:1',
            anchorVerseText: 'En el principio creó Dios los cielos y la tierra.',
        },
        expect: 'not-yes',
    },
];

const EVAL = clienteDeEval();
describe.runIf(Boolean(EVAL))(`adjudicateRefutes — eval vivo (${EVAL?.nombre})`, () => {
    const client = EVAL?.cliente as ILlmClient;
    const RUNS = Number(process.env.PROFILE_EVAL_RUNS ?? 5);

    for (const c of CASES) {
        it(`${c.name} × ${RUNS}: verdict CONSISTENTE (${c.expect})`, async () => {
            const verdicts: string[] = [];
            for (let i = 0; i < RUNS; i++) {
                const r = await adjudicateRefutes(client, c.input);
                verdicts.push(r.refutes);
            }
            // eslint-disable-next-line no-console
            console.log(`[eval refutes] ${c.name} → ${JSON.stringify(verdicts)}`);
            if (c.expect === 'yes') {
                expect(verdicts.every((v) => v === 'yes')).toBe(true);
            } else {
                // Conservador: jamás 'yes' cuando solo menciona / es irrelevante.
                expect(verdicts.every((v) => v !== 'yes')).toBe(true);
            }
        }, 30000 * Math.max(1, RUNS));
    }
});
