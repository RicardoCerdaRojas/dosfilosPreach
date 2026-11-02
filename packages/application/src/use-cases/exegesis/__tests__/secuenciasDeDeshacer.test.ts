import { beforeEach, describe, expect, it } from 'vitest';
import {
    assembleMarkdown,
    buildEmptyCanonicalVerseAnalysis,
    sectionsBehindAssembly,
    stepAfterVersionMove,
    stepHistoryMoves,
    swapPreviousProse,
    withRecomposedProse,
    type ExegeticalPaper,
    type ExegeticalStep,
    type ExegeticalStepVersion,
} from '@dosfilos/domain';
import { spliceVerseIntoAssembly } from '../../../services/exegesis/spliceVerseIntoAssembly';
import { UndoStepChangeUseCase } from '../UndoStepChangeUseCase';

/**
 * Secuencias reales, de principio a fin, sobre un trabajo en memoria: el paso y
 * el documento se escriben con las mismas funciones del dominio que usa el
 * repositorio. Ninguna escribe a mano el resultado que espera.
 *
 * La regla: deshacer nunca pisa lo que el autor corrigió en el documento, nunca
 * deja aceptado ni mete al documento lo que nadie aceptó, y el paso aceptado y el
 * documento no quedan distintos sin que se diga.
 */
const REF_4 = { bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: 4, verseEnd: 4 };
const REF_5 = { ...REF_4, verseStart: 5, verseEnd: 5 };
const analisisDe = (ref: typeof REF_4) => ({ ...buildEmptyCanonicalVerseAnalysis(ref as never), reference: ref });

const ORIGINAL = 'La prosa original del versículo cuatro, tal como se aceptó.';
const RECOMPUESTA = 'La prosa recompuesta del versículo cuatro, que vino después.';
const DEL_5 = 'La prosa del versículo cinco, que nadie toca en estas pruebas.';
const CONCLUSION = 'La conclusión del trabajo, que se ensambló junto con lo demás.';
const AGREGADA = 'Un párrafo que el autor agregó después, y que luego quiso quitar.';
const A_MANO = 'Un párrafo que el autor escribió a mano en el documento ensamblado.';

let paper: ExegeticalPaper;
let reloj = 0;
const ahora = () => new Date(2026, 10, 1, 0, reloj++);

const version = (id: string, markdown: string, over: Partial<ExegeticalStepVersion> = {}) =>
    ({ id, markdown, origin: 'generated', parentVersionId: null, createdAt: ahora(), ...over }) as ExegeticalStepVersion;

const pasoAceptado = (id: string, kind: string, order: number, v: ExegeticalStepVersion, verseRef: unknown = null) =>
    ({ id, kind, order, verseRef, state: 'accepted', versions: [v], current: v, accepted: v }) as unknown as ExegeticalStep;

const paso = (id: string) => paper.steps.find(s => s.id === id)!;
const cambiar = (id: string, f: (s: ExegeticalStep) => ExegeticalStep) => {
    paper = { ...paper, steps: paper.steps.map(s => (s.id === id ? f(s) : s)) };
};
const conVersion = (s: ExegeticalStep, id: string, f: (v: ExegeticalStepVersion) => ExegeticalStepVersion): ExegeticalStep => {
    const versions = s.versions.map(v => (v.id === id ? f(v) : v));
    const porId = (x: ExegeticalStepVersion | null) => (x ? versions.find(v => v.id === x.id) ?? x : x);
    return { ...s, versions, current: porId(s.current), accepted: porId(s.accepted) };
};

const repo = {
    getPaper: async () => paper,
    updatePaper: async (_o: string, _p: string, cambios: Partial<ExegeticalPaper>) => { paper = { ...paper, ...cambios }; },
    swapStepVersionProse: async (_o: string, _p: string, id: string, versionId: string) => {
        cambiar(id, s => conVersion(s, versionId, v => swapPreviousProse(v)));
        return paso(id);
    },
    moveToStepVersion: async (_o: string, _p: string, id: string, target: string) => {
        cambiar(id, s => stepAfterVersionMove(s, s.versions.find(v => v.id === target)!));
        return paso(id);
    },
};
const useCase = new UndoStepChangeUseCase(repo as never);

const recomponer = async (id: string, prosa: string) => {
    const versionId = paso(id).accepted!.id;
    cambiar(id, s => conVersion(s, versionId, v => withRecomposedProse(v, prosa)));
    await spliceVerseIntoAssembly(repo as never, 'o', paper, paso(id).accepted!.canonicalAnalysis!, prosa, [], true);
};
const editar = (id: string, markdown: string) => {
    const madre = paso(id).accepted!;
    const v = version(`e${reloj}`, markdown, { origin: 'edited', parentVersionId: madre.id, ...(madre.canonicalAnalysis ? { canonicalAnalysis: madre.canonicalAnalysis } : {}) });
    cambiar(id, s => ({ ...s, versions: [...s.versions, v], current: v, accepted: v, state: 'accepted' }));
};
const regenerarEnsamble = () => {
    const madre = paso('a').current;
    const v = version(`g${reloj}`, assembleMarkdown(paper, 'es'), { parentVersionId: madre?.id ?? null });
    cambiar('a', s => ({ ...s, versions: [...s.versions, v], current: v, state: 'awaiting-review' }));
};
const aceptar = (id: string) => cambiar(id, s => ({ ...s, accepted: s.current, state: 'accepted' }));
const aceptarEnsamble = () => {
    cambiar('a', s => ({ ...s, accepted: s.current, state: 'accepted' }));
    paper = { ...paper, assembledMarkdown: paso('a').accepted!.markdown };
};
const ensamblar = () => { regenerarEnsamble(); aceptarEnsamble(); };
const corregirEnsambleAMano = (texto: string) => {
    const madre = paso('a').accepted!;
    const v = version(`m${reloj}`, texto, { origin: 'edited', parentVersionId: madre.id });
    cambiar('a', s => ({ ...s, versions: [...s.versions, v], current: v, accepted: v, state: 'accepted' }));
    paper = { ...paper, assembledMarkdown: texto };
};
const mover = (id: string, action: 'undo' | 'redo') =>
    useCase.execute({ ownerId: 'o', paperId: 'p', stepId: id, action, expected: stepHistoryMoves(paso(id))[action]! });
const atrasadas = () => sectionsBehindAssembly(paper, 'es').map(p => p.label);
const documento = () => paper.assembledMarkdown!;

beforeEach(() => {
    reloj = 0;
    paper = {
        id: 'p', displayLanguage: 'es', title: 'Salmo 23', passage: REF_4, assignmentBrief: null, assembledMarkdown: null,
        steps: [
            pasoAceptado('v4', 'verse', 1, version('v4-1', ORIGINAL, { canonicalAnalysis: analisisDe(REF_4) as never }), REF_4),
            pasoAceptado('v5', 'verse', 2, version('v5-1', DEL_5, { canonicalAnalysis: analisisDe(REF_5) as never }), REF_5),
            pasoAceptado('c', 'conclusion', 3, version('c-1', CONCLUSION)),
            { id: 'a', kind: 'assembly', order: 99, verseRef: null, state: 'pending', versions: [], current: null, accepted: null } as unknown as ExegeticalStep,
        ],
    } as unknown as ExegeticalPaper;
    ensamblar();
});

describe('deshacer y el documento', () => {
    it('recomponer y deshacer deja el documento exactamente como estaba, separadores incluidos', async () => {
        const antes = documento();
        await recomponer('v4', RECOMPUESTA);
        expect(documento()).toContain(RECOMPUESTA);
        const r = await mover('v4', 'undo');
        expect(documento().trim()).toBe(antes.trim());
        expect(r.documentBehind).toBe(false);
        expect(atrasadas()).toEqual([]);
    });

    it('sin documento ensamblado no hay nada de qué avisar', async () => {
        await recomponer('v4', RECOMPUESTA);
        paper = { ...paper, assembledMarkdown: null };
        const r = await mover('v4', 'undo');
        expect(r.documentBehind).toBe(false);
    });

    it('si el documento ya trae la prosa que vuelve, no escribe ni avisa', async () => {
        // La recomposición no llegó a entrar.
        cambiar('v4', s => conVersion(s, 'v4-1', v => withRecomposedProse(v, RECOMPUESTA)));
        const antes = documento();
        const r = await mover('v4', 'undo');
        expect(documento()).toBe(antes);
        expect(r.documentBehind).toBe(false);
    });

    it('y rehacer vuelve a llevar la prosa recompuesta', async () => {
        await recomponer('v4', RECOMPUESTA);
        await mover('v4', 'undo');
        const r = await mover('v4', 'redo');
        expect(documento()).toContain(RECOMPUESTA);
        expect(documento()).not.toContain(ORIGINAL);
        expect(r.documentBehind).toBe(false);
    });

    it('un párrafo escrito a mano en esa sección no se borra: no escribe y avisa', async () => {
        await recomponer('v4', RECOMPUESTA);
        const corregido = documento().replace(RECOMPUESTA, `${RECOMPUESTA}\n\n${A_MANO}`);
        corregirEnsambleAMano(corregido);
        const r = await mover('v4', 'undo');
        expect(documento()).toBe(corregido);
        expect(r.documentBehind).toBe(true);
        expect(atrasadas()).toEqual(['Salmo 23:4']);
    });

    it('una oración agregada a mano al mismo párrafo tampoco se borra, y lo dice al deshacer', async () => {
        await recomponer('v4', RECOMPUESTA);
        const corregido = documento().replace(RECOMPUESTA, `${RECOMPUESTA} Y una oración a mano.`);
        corregirEnsambleAMano(corregido);
        const r = await mover('v4', 'undo');
        expect(documento()).toBe(corregido);
        expect(r.documentBehind).toBe(true);
    });

    it('volver de un análisis regenerado sin aceptar no toca una corrección a mano ni avisa', async () => {
        const corregido = documento().replace(ORIGINAL, A_MANO);
        corregirEnsambleAMano(corregido);
        const madre = paso('v4').accepted!;
        const v2 = version('v4-2', '', { parentVersionId: madre.id, canonicalAnalysis: madre.canonicalAnalysis! });
        cambiar('v4', s => ({ ...s, versions: [...s.versions, v2], current: v2, state: 'awaiting-review' }));
        const r = await mover('v4', 'undo');
        expect(documento()).toBe(corregido);
        expect(r.documentBehind).toBe(false);
    });

    it('deshacer una edición ya ensamblada no cambia nada hasta aceptar; al aceptar, se nombra', async () => {
        editar('c', `${CONCLUSION}\n\n${AGREGADA}`);
        ensamblar();
        const antes = documento();
        const r = await mover('c', 'undo');
        expect(paso('c').state).toBe('awaiting-review');
        expect(paso('c').accepted!.markdown).toContain(AGREGADA);
        expect(documento()).toBe(antes);
        expect(r.documentBehind).toBe(false);
        expect(atrasadas()).toEqual([]);
        aceptar('c');
        expect(atrasadas()).toEqual(['Conclusión']);
    });

    it('deshacer y rehacer sobre lo aceptado vuelve a estar exactamente igual', async () => {
        editar('c', `${CONCLUSION}\n\n${AGREGADA}`);
        ensamblar();
        const aceptada = paso('c').accepted!.id;
        await mover('c', 'undo');
        await mover('c', 'redo');
        expect(paso('c').state).toBe('accepted');
        expect(paso('c').accepted!.id).toBe(aceptada);
        expect(paso('c').current!.id).toBe(aceptada);
    });

    it('volver a un borrador que nadie aceptó no lo deja aceptado', async () => {
        const madre = paso('c').accepted!;
        const borrador = version('c-b', AGREGADA, { parentVersionId: madre.id });
        const final = version('c-f', CONCLUSION, { parentVersionId: 'c-b', origin: 'edited' });
        cambiar('c', s => ({ ...s, versions: [...s.versions, borrador, final], current: final, accepted: final }));
        ensamblar();
        const antes = documento();
        await mover('c', 'undo');
        expect(paso('c').accepted!.id).toBe('c-f');
        expect(paso('c').state).toBe('awaiting-review');
        expect(documento()).toBe(antes);
    });

    it('una conclusión regenerada sin ensamblar vuelve sin avisar: el documento nunca cambió', async () => {
        const madre = paso('c').accepted!;
        const v2 = version('c-2', AGREGADA, { parentVersionId: madre.id });
        cambiar('c', s => ({ ...s, versions: [...s.versions, v2], current: v2, state: 'awaiting-review' }));
        const r = await mover('c', 'undo');
        expect(r.documentBehind).toBe(false);
        expect(paso('c').accepted!.markdown).toBe(CONCLUSION);
    });

    it('deshacer una edición que nunca se ensambló no toca el documento ni avisa', async () => {
        const antes = documento();
        editar('v4', RECOMPUESTA);
        const r = await mover('v4', 'undo');
        expect(documento()).toBe(antes);
        expect(r.documentBehind).toBe(false);
    });

    it('volver a una versión sin prosa cuando el documento nunca tuvo la otra no avisa', async () => {
        const v0 = version('v4-0', '', { canonicalAnalysis: analisisDe(REF_4) as never });
        cambiar('v4', s => ({ ...s, versions: [v0, ...s.versions.map(v => ({ ...v, parentVersionId: 'v4-0' }))], current: { ...s.current!, parentVersionId: 'v4-0' }, accepted: { ...s.accepted!, parentVersionId: 'v4-0' } }));
        const sinEl = documento().replace(ORIGINAL, A_MANO);
        corregirEnsambleAMano(sinEl);
        const r = await mover('v4', 'undo');
        expect(documento()).toBe(sinEl);
        expect(r.documentBehind).toBe(false);
    });

    it('salir de una versión sin prosa hacia una con prosa no pisa una corrección a mano', async () => {
        const corregido = documento().replace(ORIGINAL, A_MANO);
        corregirEnsambleAMano(corregido);
        const madre = paso('v4').accepted!;
        const v2 = version('v4-2', '', { parentVersionId: madre.id, canonicalAnalysis: madre.canonicalAnalysis! });
        cambiar('v4', s => ({ ...s, versions: [...s.versions, v2], current: v2, accepted: v2 }));
        const r = await mover('v4', 'undo');
        expect(documento()).toBe(corregido);
        expect(r.documentBehind).toBe(false);
    });

    it('una sección excluida no escribe ni avisa', async () => {
        await recomponer('v4', RECOMPUESTA);
        cambiar('v4', s => ({ ...s, includeInDocument: false }));
        ensamblar();
        const antes = documento();
        const r = await mover('v4', 'undo');
        expect(documento()).toBe(antes);
        expect(r.documentBehind).toBe(false);
    });

    it('un documento sin sección para el versículo no se toca, y se dice', async () => {
        await recomponer('v4', RECOMPUESTA);
        const sinTitulo = documento().replace('## Salmo 23:4', '## Otro título').replace(RECOMPUESTA, A_MANO);
        corregirEnsambleAMano(sinTitulo);
        const r = await mover('v4', 'undo');
        expect(documento()).toBe(sinTitulo);
        expect(r.documentBehind).toBe(true);
    });

    it('deshacer la prosa de una versión en revisión no toca el documento', async () => {
        const madre = paso('v4').accepted!;
        const v2 = version('v4-2', RECOMPUESTA, { parentVersionId: madre.id, canonicalAnalysis: madre.canonicalAnalysis!, previousProse: { markdown: 'La prosa anterior de esa misma versión en revisión.' } });
        cambiar('v4', s => ({ ...s, versions: [...s.versions, v2], current: v2, state: 'awaiting-review' }));
        const corregido = documento().replace(ORIGINAL, A_MANO);
        corregirEnsambleAMano(corregido);
        const r = await mover('v4', 'undo');
        expect(documento()).toBe(corregido);
        expect(r.documentBehind).toBe(false);
    });

    it('un paso reabierto no mete su prosa al documento', async () => {
        await recomponer('v4', RECOMPUESTA);
        cambiar('v4', s => ({ ...s, accepted: null, state: 'awaiting-review' }));
        const antes = documento();
        await mover('v4', 'undo');
        expect(documento()).toBe(antes);
    });

    it('avanzar a una versión que no es la aceptada la deja en revisión: no entra al documento', async () => {
        const madre = paso('v4').accepted!;
        const v2 = version('v4-2', RECOMPUESTA, { parentVersionId: madre.id, canonicalAnalysis: madre.canonicalAnalysis! });
        cambiar('v4', s => ({ ...s, versions: [...s.versions, v2], current: v2, state: 'awaiting-review' }));
        await mover('v4', 'undo');
        const antes = documento();
        const r = await mover('v4', 'redo');
        expect(paso('v4').state).toBe('awaiting-review');
        expect(paso('v4').accepted!.id).toBe('v4-1');
        expect(documento()).toBe(antes);
        expect(r.documentBehind).toBe(false);
    });
});

describe('deshacer en el ensamble', () => {
    it('regenerado sin aceptar: vuelve a lo aceptado y no reescribe un documento con un versículo empalmado', async () => {
        await recomponer('v4', RECOMPUESTA);
        const antes = documento();
        regenerarEnsamble();
        const r = await mover('a', 'undo');
        expect(paso('a').state).toBe('accepted');
        expect(documento()).toBe(antes);
        expect(r.documentBehind).toBe(false);
    });

    it('con una composición guardada encima: no la toca', async () => {
        ensamblar();
        const composicion = '# Salmo 23\n\nUna redacción entera guardada al trabajo.\n';
        paper = { ...paper, assembledMarkdown: composicion };
        await mover('a', 'undo');
        expect(documento()).toBe(composicion);
    });

    it('el documento vuelve a la versión anterior solo al aceptarla, y lo que perdió se nombra', async () => {
        const anterior = documento();
        editar('c', `${CONCLUSION}\n\n${AGREGADA}`);
        ensamblar();
        const antes = documento();
        await mover('a', 'undo');
        expect(documento()).toBe(antes);
        aceptarEnsamble();
        expect(documento()).toBe(anterior);
        expect(atrasadas()).toEqual(['Conclusión']);
    });
});

describe('el aviso sigue las secuencias', () => {
    it('aceptar un ensamble regenerado antes de recomponer deja la prosa nueva fuera, y se nombra', async () => {
        regenerarEnsamble();
        await recomponer('v4', RECOMPUESTA);
        aceptarEnsamble();
        expect(documento()).not.toContain(RECOMPUESTA);
        expect(atrasadas()).toEqual(['Salmo 23:4']);
    });

    it('deshacer una corrección a mano tras recomponer devuelve la prosa vieja, y se nombra', async () => {
        await recomponer('v4', RECOMPUESTA);
        const anterior = paso('a').accepted!.markdown;
        corregirEnsambleAMano(documento().replace(CONCLUSION, A_MANO));
        await mover('a', 'undo');
        aceptarEnsamble();
        expect(documento()).toBe(anterior);
        expect(atrasadas()).toEqual(['Salmo 23:4']);
    });

    it('volver a incluir una sección que el ensamble no trae se nombra', () => {
        cambiar('v4', s => ({ ...s, includeInDocument: false }));
        ensamblar();
        expect(atrasadas()).toEqual([]);
        cambiar('v4', s => ({ ...s, includeInDocument: true }));
        expect(atrasadas()).toEqual(['Salmo 23:4']);
    });

    it('cinco correcciones a mano del ensamble no apagan el aviso', () => {
        editar('c', `${CONCLUSION}\n\n${AGREGADA}`);
        for (let i = 0; i < 5; i++) corregirEnsambleAMano(`${documento()}\n`);
        expect(atrasadas()).toEqual(['Conclusión']);
    });

    it('regenerar y aceptar cuando el aviso lo nombra lo deja al día', () => {
        editar('c', `${CONCLUSION}\n\n${AGREGADA}`);
        expect(atrasadas()).toEqual(['Conclusión']);
        ensamblar();
        expect(atrasadas()).toEqual([]);
    });

    it('una corrección a mano nacida del primer ensamble no apaga el aviso de lo regenerado y descartado', async () => {
        editar('c', `${CONCLUSION}\n\n${AGREGADA}`);
        regenerarEnsamble();
        await mover('a', 'undo');
        expect(atrasadas()).toEqual(['Conclusión']);
        corregirEnsambleAMano(documento().replace(DEL_5, `${DEL_5} Corregido.`));
        expect(atrasadas()).toEqual(['Conclusión']);
    });

    it('recomponer, excluir y deshacer se nombra: el documento sigue con esa prosa', async () => {
        await recomponer('v4', RECOMPUESTA);
        cambiar('v4', s => ({ ...s, includeInDocument: false }));
        await mover('v4', 'undo');
        expect(documento()).toContain(RECOMPUESTA);
        expect(atrasadas()).toEqual(['Salmo 23:4']);
    });

    it('recomponer, reabrir y deshacer se nombra: el documento sigue con esa prosa', async () => {
        await recomponer('v4', RECOMPUESTA);
        cambiar('v4', s => ({ ...s, accepted: null, state: 'awaiting-review' }));
        await mover('v4', 'undo');
        expect(documento()).toContain(RECOMPUESTA);
        expect(atrasadas()).toEqual(['Salmo 23:4']);
    });

    it('deshacer y volver a aceptar con un párrafo agregado se nombra', async () => {
        editar('v4', `${ORIGINAL}\n\n${AGREGADA}`);
        ensamblar();
        await mover('v4', 'undo');
        aceptar('v4');
        expect(atrasadas()).toEqual(['Salmo 23:4']);
        await mover('v4', 'redo');
        aceptar('v4');
        expect(atrasadas()).toEqual([]);
    });
});
