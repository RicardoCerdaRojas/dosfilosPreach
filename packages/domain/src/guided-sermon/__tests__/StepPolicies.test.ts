import { describe, it, expect } from 'vitest';
import { PASTORAL_SEED_STEP_ORDER, type PastoralSeedStepKey } from '../../entities/PastoralSeed';
import { createDefaultStepPolicyRegistry } from '../StepPolicyRegistry';
import type { TurnContext } from '../SocraticTurn';

const registry = createDefaultStepPolicyRegistry();

function ctxFor(stepKey: PastoralSeedStepKey, draft = '', attemptIndex = 0): TurnContext {
    return {
        passage: 'Juan 1:1',
        currentStep: stepKey,
        pastorDraft: draft,
        attemptIndex,
        genre: 'evangelio',
        priorSteps: {},
    };
}

describe('StepPolicyRegistry', () => {
    it('exposes a policy for every step in the canonical order', () => {
        for (const key of PASTORAL_SEED_STEP_ORDER) {
            const p = registry.get(key);
            expect(p.stepKey).toBe(key);
        }
    });

    it('throws on unknown step', () => {
        expect(() => registry.get('nope' as never)).toThrow();
    });
});

describe('AI-forbidden generation invariant (ADR-028)', () => {
    const FORBIDDEN: PastoralSeedStepKey[] = ['reading', 'timelessPrinciple', 'insight'];

    it('the policies for AI-forbidden steps declare it', () => {
        for (const key of FORBIDDEN) {
            expect(registry.get(key).isAiGenerationForbidden).toBe(true);
        }
    });

    it('non-forbidden policies declare false', () => {
        for (const key of PASTORAL_SEED_STEP_ORDER) {
            if (FORBIDDEN.includes(key)) continue;
            expect(registry.get(key).isAiGenerationForbidden).toBe(false);
        }
    });

    it('an LLM that tries to inject pastorTextToPersist on a forbidden step is OVERRIDDEN by the pastor message', () => {
        for (const key of FORBIDDEN) {
            const policy = registry.get(key);
            const pastorMessage = 'mi propia voz pastoral con sustancia suficiente para pasar.';
            // Craft a malicious LLM reply that tries to inject generated content.
            const maliciousReply = JSON.stringify({
                kind: 'accepted',
                agentReply: 'Avanzamos.',
                pastorTextToPersist: 'GENERATED-BY-LLM-NEVER-PERSIST',
            });
            const output = policy.parseLlmReply(maliciousReply, pastorMessage);
            expect(output.kind).toBe('accepted');
            if (output.kind === 'accepted') {
                expect(output.pastorTextToPersist).toBe(pastorMessage);
                expect(output.pastorTextToPersist).not.toContain('GENERATED-BY-LLM');
            }
        }
    });
});

describe('Socratic feedback contract (ADR-034)', () => {
    it('every policy injects the affirm + route-doubts + nudge contract', () => {
        for (const key of PASTORAL_SEED_STEP_ORDER) {
            const prompt = registry.get(key).buildSystemPrompt(ctxFor(key));
            expect(prompt).toContain('Contrato de feedback');
            expect(prompt).toContain('AFIRMAR un acierto CONCRETO');
            expect(prompt).toContain('ENRUTAR dudas');
            expect(prompt).toContain('NUDGE');
        }
    });

    it('the contract forbids resolving the doctrinal doubt (P1/P2)', () => {
        const prompt = registry.get('contextGenre').buildSystemPrompt(ctxFor('contextGenre'));
        expect(prompt).toContain('SIN resolverla');
        expect(prompt).toContain('NUNCA respondas la duda doctrinal');
    });

    it('every policy carries a step-specific affirmation rubric (PR4)', () => {
        for (const key of PASTORAL_SEED_STEP_ORDER) {
            const prompt = registry.get(key).buildSystemPrompt(ctxFor(key));
            expect(prompt).toContain('AFIRMACIÓN (al aceptar, reconoce algo CONCRETO)');
            expect(prompt).toContain('Nada genérico.');
        }
    });
});

describe('Step policies — orient + confront parsing', () => {
    it('parses orient with data + questions', () => {
        const policy = registry.get('contextGenre');
        const reply = JSON.stringify({
            kind: 'orient',
            reason: 'too short',
            agentReply: 'Profundicemos.',
            data: ['Juan es Evangelio'],
            questions: ['¿cómo cambia tu lectura?'],
        });
        const out = policy.parseLlmReply(reply, 'corto');
        expect(out.kind).toBe('orient');
        if (out.kind === 'orient') {
            expect(out.data).toEqual(['Juan es Evangelio']);
            expect(out.questions.length).toBe(1);
        }
    });

    it('parses confront with label + data + questions', () => {
        const policy = registry.get('contextGenre');
        const reply = JSON.stringify({
            kind: 'confront',
            errorLabel: 'genre-mismatch',
            agentReply: 'Revisemos.',
            data: ['Es Evangelio, no profecía.'],
            questions: ['¿cómo cambia eso tu lectura?'],
        });
        const out = policy.parseLlmReply(reply, 'es profecía');
        expect(out.kind).toBe('confront');
        if (out.kind === 'confront') {
            expect(out.errorLabel).toBe('genre-mismatch');
            expect(out.data.length).toBe(1);
        }
    });
});

describe('ContextGenre method-error heuristic (UC3)', () => {
    it('flags "profecía" wording in an evangelio passage', () => {
        const policy = registry.get('contextGenre');
        const err = policy.detectMethodError(
            'como es profecía entiendo que todo lo que dice se cumplirá',
            ctxFor('contextGenre'),
        );
        expect(err).not.toBeNull();
        expect(err!.label).toBe('genre-mismatch');
        expect(err!.confidence).toBeGreaterThan(0.5);
    });

    it('does NOT flag a coherent genre-aware implication', () => {
        const policy = registry.get('contextGenre');
        const err = policy.detectMethodError(
            'Como es un Evangelio, leo buscando lo que afirma de Jesús y cómo el prólogo lo presenta.',
            ctxFor('contextGenre'),
        );
        expect(err).toBeNull();
    });
});

describe('ContextGenre validation — empty-genre fallback', () => {
    const policy = registry.get('contextGenre');
    // When activation could not infer a genre (unrecognized book / legacy seed),
    // the step must still be passable on the implication length alone — the
    // conversational flow has no genre-confirm UI to satisfy.
    const ctxNoGenre = (): TurnContext => ({ ...ctxFor('contextGenre'), genre: undefined });
    const longImplication =
        'Es una Epístola, lo que significa que es una carta a una iglesia: la leo como instrucción pastoral concreta, no como narrativa.';

    it('accepts a sufficiently long implication when no genre was inferred', () => {
        expect(policy.validatePastorInput(longImplication, ctxNoGenre()).valid).toBe(true);
    });

    it('still rejects a too-short implication when no genre was inferred', () => {
        const res = policy.validatePastorInput('Es una carta.', ctxNoGenre());
        expect(res.valid).toBe(false);
        expect(res.reasons.join(' ')).toContain('caracteres');
    });

    it('does not emit a "falta confirmar el género" reason in the fallback', () => {
        const res = policy.validatePastorInput('corto', ctxNoGenre());
        expect(res.reasons.join(' ')).not.toContain('género literario');
    });

    it('accepts when a genre WAS inferred and the implication is long enough', () => {
        expect(policy.validatePastorInput(longImplication, ctxFor('contextGenre')).valid).toBe(true);
    });
});

describe('ContextGenre — genre recognized from the pastor prose (fix C)', () => {
    const policy = registry.get('contextGenre');
    const ctxNoGenre = (): TurnContext => ({ ...ctxFor('contextGenre'), genre: undefined });
    // Single genre named in the prose; long enough to pass length.
    const namesEpistle =
        'Esto es una epístola dirigida a una congregación concreta; la leo como instrucción y corrección para la iglesia.';

    it('accepts a single-genre prose even with no book-inferred genre', () => {
        // "epístola" present, no other genre word → recognized as epistle.
        const single = 'Es una epístola: documento de enseñanza enviado a una comunidad para instruir y ordenar la vida de los creyentes con argumentos.';
        expect(policy.validatePastorInput(single, ctxNoGenre()).valid).toBe(true);
    });

    it('persists the prose-named genre when the seed had none', () => {
        const seed = { contextGenre: { genre: '', genreConfirmed: false, genreImplication: '', bookLocationNote: '', historicalContextConsulted: false, timeSpentSeconds: 0 } } as never;
        const patch = policy.persistTo(seed, namesEpistle) as { contextGenre: { genre: string; genreConfirmed: boolean } };
        expect(patch.contextGenre.genre).toBe('epistle');
        expect(patch.contextGenre.genreConfirmed).toBe(true);
    });

    it('does NOT overwrite a book-inferred genre with a prose mention', () => {
        const seed = { contextGenre: { genre: 'gospel', genreConfirmed: true, genreImplication: '', bookLocationNote: '', historicalContextConsulted: false, timeSpentSeconds: 0 } } as never;
        // Prose mentions "carta" but the book genre stays authoritative.
        const patch = policy.persistTo(seed, 'Lo leo como si fuera una carta personal.') as { contextGenre: { genre: string } };
        expect(patch.contextGenre.genre).toBe('gospel');
    });
});

describe('StructuralAnalysis method-error heuristic (lexical leakage)', () => {
    it('flags morphological vocabulary in the structural step', () => {
        const policy = registry.get('structuralAnalysis');
        const err = policy.detectMethodError(
            'el verbo era Dios es un predicado nominal sin artículo',
            ctxFor('structuralAnalysis'),
        );
        expect(err).not.toBeNull();
        expect(err!.label).toBe('lexical-leakage');
    });
});

describe('Function step method-error heuristic (modern-application leap)', () => {
    it('flags premature application to today', () => {
        const policy = registry.get('function');
        const err = policy.detectMethodError(
            'me dice a mí hoy que debo confiar en Dios',
            ctxFor('function'),
        );
        expect(err).not.toBeNull();
        expect(err!.label).toBe('modern-application-leap');
    });
});

describe('Validator equivalence with the wizard (Phase 1.6 invariant)', () => {
    it('reading validator agrees with the policy on length thresholds', () => {
        const policy = registry.get('reading');
        const ok = 'a'.repeat(60);
        const tooShort = 'a'.repeat(10);
        expect(policy.validatePastorInput(ok, ctxFor('reading')).valid).toBe(true);
        expect(policy.validatePastorInput(tooShort, ctxFor('reading')).valid).toBe(false);
    });

    it('wordStudies needs ≥2 entries with substantive discoveries', () => {
        const policy = registry.get('wordStudies');
        const two = `λόγος (Juan 1:1): el Verbo es agente personal con peso teológico fuerte y carga ontológica.\nἀρχή (Juan 1:1): inicio absoluto que evoca Génesis y la creación.`;
        const one = `λόγος (Juan 1:1): el Verbo es agente personal con descubrimiento sustantivo de más de treinta caracteres.`;
        expect(policy.validatePastorInput(two, ctxFor('wordStudies')).valid).toBe(true);
        expect(policy.validatePastorInput(one, ctxFor('wordStudies')).valid).toBe(false);
    });

    it('wordStudies ACCUMULATES across turns via ctx.existingWordStudies', () => {
        const policy = registry.get('wordStudies');
        const oneNew = `ἀρχή (Juan 1:1): inicio absoluto que evoca Génesis y la creación, con peso teológico.`;
        // One new word alone is not enough…
        expect(policy.validatePastorInput(oneNew, ctxFor('wordStudies')).valid).toBe(false);
        // …but with one already saved on the seed, the merged total is 2 → valid.
        const ctx: TurnContext = {
            ...ctxFor('wordStudies'),
            existingWordStudies: [
                { word: 'λόγος', reference: 'Juan 1:1', pastorDiscovery: 'el Verbo es agente personal con carga ontológica fuerte.' },
            ],
        };
        expect(policy.validatePastorInput(oneNew, ctx).valid).toBe(true);
    });

    it('wordStudies ignores stray/garbage lines and self-heals a polluted seed', () => {
        const policy = registry.get('wordStudies');
        // Seed polluted by earlier stray lines: a bare "2:1" became {word:'2'}.
        const seed = {
            wordStudies: {
                studies: [
                    { word: 'λόγος', reference: 'Juan 1:1', pastorDiscovery: 'descubrimiento propio sustantivo sobre el Verbo encarnado.' },
                    { word: '2', reference: '', pastorDiscovery: '1' }, // garbage
                ],
            },
        } as unknown as Parameters<typeof policy.persistTo>[0];
        // A bare reference line must NOT count or persist as a study.
        const patch = policy.persistTo(seed, '2:1');
        expect(patch.wordStudies!.studies.map((s) => s.word)).toEqual(['λόγος']); // garbage dropped

        // Validating that same stray line against the (still 1 complete) seed → not enough.
        const ctxOne: TurnContext = {
            ...ctxFor('wordStudies'),
            existingWordStudies: seed.wordStudies.studies,
        };
        expect(policy.validatePastorInput('2:1', ctxOne).valid).toBe(false);

        // One real new study added → 2 complete → valid.
        const ctxClean: TurnContext = {
            ...ctxFor('wordStudies'),
            existingWordStudies: [seed.wordStudies.studies[0]],
        };
        const ok = 'ἀρχή (Juan 1:1): inicio absoluto con ecos creacionales, descubrimiento propio del pastor.';
        expect(policy.validatePastorInput(ok, ctxClean).valid).toBe(true);
    });

    it('wordStudies persistTo merges new studies onto the seed (dedupe by word)', () => {
        const policy = registry.get('wordStudies');
        const seed = {
            wordStudies: {
                studies: [{ word: 'λόγος', reference: 'Juan 1:1', pastorDiscovery: 'descubrimiento previo del pastor sobre el Verbo.' }],
            },
        } as unknown as Parameters<typeof policy.persistTo>[0];
        const patch = policy.persistTo(seed, `ἀρχή (Juan 1:1): inicio absoluto que evoca la creación, descubrimiento propio.`);
        expect(patch.wordStudies!.studies.map((s) => s.word)).toEqual(['λόγος', 'ἀρχή']);
    });
});
