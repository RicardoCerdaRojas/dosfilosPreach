import { beforeEach, describe, expect, it, vi } from 'vitest';
import { compactVersions, expandVersions, firestoreBytes, PAPER_BYTES_MAX, recompactStoredStep, WRITE_COMPACT_VERSIONS } from '../stepVersionStorage';

/**
 * Guardar sin repetir lo que no cambió (TP #9: 205 de 912 KB eran análisis
 * idénticos). Lo que importa: que nada se pierda al volver, y que la aceptada y la
 * vigente sigan completas para quien lee el documento sin pasar por aquí.
 */
const ANALISIS = { reference: { verse: 4 }, notes: 'análisis' };
const OTRO = { reference: { verse: 4 }, notes: 'otro análisis' };
const delAnalisis = [{ origin: 'analysis', raw: 'a' }, { origin: 'analysis', raw: 'b' }];
const deProsa = (raw: string) => [{ origin: 'prose', raw }];
const v = (id: string, over: Record<string, unknown> = {}): Record<string, unknown> & { id: string } => ({ id, markdown: id, ...over });
const ida_y_vuelta = (versiones: Array<Record<string, unknown> & { id: string }>, ...enteras: string[]) =>
    expandVersions(compactVersions(versiones, enteras));

describe('el análisis repetido', () => {
    const tres = [
        v('v1', { canonicalAnalysis: ANALISIS }),
        v('v2', { canonicalAnalysis: { notes: 'análisis', reference: { verse: 4 } } }),
        v('v3', { canonicalAnalysis: ANALISIS }),
    ];

    it('se guarda una vez, sin importar el orden de las claves', () => {
        const g = compactVersions(tres, ['v2', 'v2']);
        expect(g.filter(x => x.canonicalAnalysis)).toHaveLength(1);
        expect(g[1]!.canonicalAnalysis).toEqual(ANALISIS);
        expect(g[0]!.canonicalAnalysisIn).toBe('v2');
        expect(g[2]!.canonicalAnalysisIn).toBe('v2');
    });
    it('vuelve completo en todas', () => {
        expect(ida_y_vuelta(tres, 'v2', 'v2').map(x => x.canonicalAnalysis)).toEqual([ANALISIS, tres[1]!.canonicalAnalysis, ANALISIS]);
    });
    it('la aceptada, la última aceptada y la vigente guardan cada una su copia entera', () => {
        const g = compactVersions(tres, ['v1', null, 'v3']);
        expect(g[0]!.canonicalAnalysis).toBeDefined();
        expect(g[2]!.canonicalAnalysis).toBeDefined();
        expect(g[1]!.canonicalAnalysisIn).toBe('v1');
    });
    it('una lista con huecos no apaga la compactación: un paso casi nunca tiene las tres', () => {
        const g = compactVersions(tres, [undefined, undefined, 'v2']);
        expect(g.filter(x => x.canonicalAnalysis)).toHaveLength(1);
        expect(g[0]!.canonicalAnalysisIn).toBe('v2');
    });
    it('la que apunta lo hace a una de las enteras, no a otra referencia', () => {
        const g = compactVersions(tres, ['v2']);
        expect(g[0]!.canonicalAnalysisIn).toBe('v2');
        expect(g[2]!.canonicalAnalysisIn).toBe('v2');
    });
    it('sin ninguna de las dos, en la última, y las demás apuntan a ella', () => {
        const g = compactVersions(tres, []);
        expect(g[2]!.canonicalAnalysis).toBeDefined();
        expect(g[0]!.canonicalAnalysisIn).toBe('v3');
    });
    it('la aceptada y la vigente con análisis distintos conservan cada una el suyo', () => {
        const g = compactVersions([v('a', { canonicalAnalysis: ANALISIS }), v('b', { canonicalAnalysis: OTRO })], ['a', 'b']);
        expect(g.every(x => x.canonicalAnalysis && !x.canonicalAnalysisIn)).toBe(true);
    });
    it('sin análisis no agrega nada', () => {
        expect(compactVersions([v('a'), v('b')], ['a', 'a'])).toEqual([v('a'), v('b')]);
    });
    it('no toca lo que recibe', () => {
        const entrada = [v('a', { canonicalAnalysis: ANALISIS }), v('b', { canonicalAnalysis: ANALISIS })];
        compactVersions(entrada, ['b', 'b']);
        expect(entrada[0]!.canonicalAnalysis).toEqual(ANALISIS);
    });
});

describe('los veredictos del análisis', () => {
    const dos = [
        v('v1', { citationVerdicts: [...delAnalisis, ...deProsa('uno')] }),
        v('v2', { citationVerdicts: delAnalisis }),
    ];

    it('se guardan una vez; los de la prosa son de cada versión', () => {
        const g = compactVersions(dos, ['v2', 'v2']);
        expect(g[0]!.citationVerdicts).toEqual(deProsa('uno'));
        expect(g[0]!.analysisVerdictsIn).toBe('v2');
        expect(g[1]!.citationVerdicts).toEqual(delAnalisis);
    });
    it('vuelven iguales y en el mismo orden', () => {
        expect(ida_y_vuelta(dos, 'v2', 'v2')).toEqual(dos);
    });
    it('una lista intercalada se deja como está: al unirla cambiaría de orden', () => {
        const intercalada = [{ origin: 'analysis', raw: 'a' }, { origin: 'prose', raw: 'p' }, { origin: 'analysis', raw: 'b' }];
        const g = compactVersions([v('a', { citationVerdicts: intercalada }), v('b', { citationVerdicts: intercalada })], ['b', 'b']);
        expect(g[0]!.citationVerdicts).toEqual(intercalada);
        expect(g[0]).not.toHaveProperty('analysisVerdictsIn');
    });
    it('solo de prosa: nada que compartir', () => {
        const g = compactVersions([v('a', { citationVerdicts: deProsa('p') }), v('b', { citationVerdicts: deProsa('p') })], ['b', 'b']);
        expect(g[0]).not.toHaveProperty('analysisVerdictsIn');
    });
    it('sin veredictos propios de prosa, vuelven solo los del análisis', () => {
        const g = compactVersions([v('a', { citationVerdicts: delAnalisis }), v('b', { citationVerdicts: delAnalisis })], ['b', 'b']);
        expect(expandVersions(g)[0]!.citationVerdicts).toEqual(delAnalisis);
    });
    it('veredictos sin origen, de datos viejos, cuentan como del análisis', () => {
        const viejos = [{ raw: 'x' }];
        expect(ida_y_vuelta([v('a', { citationVerdicts: viejos }), v('b', { citationVerdicts: viejos })], 'b', 'b')[0]!.citationVerdicts).toEqual(viejos);
    });
});

describe('al leer', () => {
    it('un documento viejo, sin referencias, queda igual', () => {
        const viejo = [v('a', { canonicalAnalysis: ANALISIS, citationVerdicts: delAnalisis })];
        expect(expandVersions(viejo)).toEqual(viejo);
    });
    it('una referencia colgada no rompe la lectura: esa versión queda sin análisis y se avisa', () => {
        const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const [r] = expandVersions([v('a', { canonicalAnalysisIn: 'ya-no', analysisVerdictsIn: 'tampoco', citationVerdicts: deProsa('p') })]);
        expect(r).not.toHaveProperty('canonicalAnalysisIn');
        expect(r).not.toHaveProperty('canonicalAnalysis');
        expect(r!.citationVerdicts).toEqual(deProsa('p'));
        expect(aviso).toHaveBeenCalledTimes(2);
        aviso.mockRestore();
    });
    it('la referencia no se guarda de nuevo si la copia pasó a otra versión', () => {
        const guardadas = compactVersions([v('a', { canonicalAnalysis: ANALISIS }), v('b', { canonicalAnalysis: ANALISIS })], ['b', 'b']);
        const otraVez = compactVersions(expandVersions(guardadas), ['a', 'a']);
        expect(otraVez[0]!.canonicalAnalysis).toEqual(ANALISIS);
        expect(otraVez[1]!.canonicalAnalysisIn).toBe('a');
        expect(otraVez[1]).not.toHaveProperty('canonicalAnalysis');
    });
});

describe('cuánto pesa, según Firestore', () => {
    it('texto en bytes, más uno', () => expect(firestoreBytes('ñu')).toBe(4));
    it('número y fecha, 8', () => {
        expect(firestoreBytes(1)).toBe(8);
        expect(firestoreBytes(new Date())).toBe(8);
        expect(firestoreBytes({ toDate: () => new Date() })).toBe(8);
    });
    it('booleano y nulo, 1; lo indefinido no cuenta', () => {
        expect(firestoreBytes(true)).toBe(1);
        expect(firestoreBytes(null)).toBe(1);
        expect(firestoreBytes(undefined)).toBe(0);
    });
    it('un mapa suma sus campos y un arreglo sus valores', () => {
        expect(firestoreBytes({ a: 'b' })).toBe(32 + 2 + 2);
        expect(firestoreBytes(['a', 'b'])).toBe(4);
    });
});

// ── Al escribir ───────────────────────────────────────────────────────
let guardado: Record<string, unknown>;
const escrituras = vi.fn();
vi.mock('../../config/firebase', () => ({ db: {}, functions: {} }));
vi.mock('firebase/functions', () => ({ httpsCallable: () => vi.fn() }));
vi.mock('firebase/firestore', () => ({
    collection: () => ({}),
    doc: () => ({}),
    runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => fn({
        get: async () => ({ exists: () => true, id: 'p', data: () => guardado }),
        update: (_ref: unknown, data: Record<string, unknown>) => { escrituras(); guardado = { ...guardado, ...data }; },
    }),
}));
const { FirestoreExegeticalPaperRepository, deserializeStep, serializeStep } = await import('../FirestoreExegeticalPaperRepository');
const { withoutOldestVersions } = await import('@dosfilos/domain');
const repo = new FirestoreExegeticalPaperRepository();

const relleno = (kb: number, marca = 'x') => marca.repeat(kb * 1024);
const fecha = new Date(2026, 10, 1);
const version = (id: string, parentVersionId: string | null, over: Record<string, unknown> = {}) =>
    ({ id, markdown: id, origin: 'generated', parentVersionId, createdAt: fecha, ...over });
const paso = (id: string, versions: unknown[], over: Record<string, unknown> = {}) => ({
    id, kind: 'verse', state: 'accepted', createdAt: fecha, updatedAt: fecha, versions,
    currentId: (versions.at(-1) as { id: string } | undefined)?.id ?? null,
    acceptedId: (versions.at(-1) as { id: string } | undefined)?.id ?? null,
    ...over,
});
const pasoDe = (id: string) => (guardado.steps as Array<Record<string, unknown> & { id: string; versions: Array<Record<string, unknown>> }>).find(s => s.id === id)!;
const editar = () => repo.saveManualEdit('o', 'p', 's', 'Editado.');

describe('escribir cerca del límite', () => {
    beforeEach(() => escrituras.mockClear());
    const pesadas = (n: number, kb: number) => Array.from({ length: n }, (_, i) =>
        version(`v${i + 1}`, i ? `v${i}` : null, { canonicalAnalysis: { notes: relleno(kb, String(i)) } }));

    it('mientras quepa no quita nada, ni siquiera cerca del límite', async () => {
        guardado = { ownerId: 'o', relleno: relleno(1000), steps: [paso('s', [version('v1', null), version('v2', 'v1'), version('v3', 'v2')])] };
        await editar();
        expect(pasoDe('s').versions).toHaveLength(4);
    });

    it('moverse por el historial no borra: lo deshecho se puede recuperar', async () => {
        const cinco = [1, 2, 3, 4, 5].map(n => version(`v${n}`, n > 1 ? `v${n - 1}` : null));
        guardado = { ownerId: 'o', relleno: relleno(1020), steps: [paso('s', cinco)] };
        await repo.moveToStepVersion('o', 'p', 's', 'v3');
        expect(pasoDe('s').versions.map(x => x.id)).toEqual(['v1', 'v2', 'v3', 'v4', 'v5']);
    });

    it('si no cabría, quita lo más viejo, solo hasta que quepa', async () => {
        guardado = { ownerId: 'o', steps: [paso('s', pesadas(5, 190))] };
        await repo.saveManualEdit('o', 'p', 's', relleno(70));
        const ids = pasoDe('s').versions.map(x => x.id);
        expect(ids).not.toContain('v1');
        expect(ids).toContain('v2');
        expect(ids).toContain('v5');
        expect(firestoreBytes(guardado)).toBeLessThanOrEqual(PAPER_BYTES_MAX);
    });

    it('si no hay qué quitar, escribe igual: el cálculo es pesimista y decide Firestore', async () => {
        guardado = { ownerId: 'o', relleno: relleno(1035), steps: [paso('s', [version('v1', null)]), paso('otro', [])] };
        await repo.saveManualEdit('o', 'p', 's', relleno(5));
        expect(escrituras).toHaveBeenCalled();
    });

    it('un paso sin historial no se bloquea por el peso de los otros', async () => {
        guardado = { ownerId: 'o', relleno: relleno(1030), steps: [paso('intro', [], { kind: 'introduction', state: 'pending', currentId: null, acceptedId: null })] };
        await repo.saveManualEdit('o', 'p', 'intro', relleno(12));
        expect(pasoDe('intro').versions).toHaveLength(1);
    });

    it('la versión que esta escritura acaba de cambiar no se recorta', async () => {
        guardado = { ownerId: 'o', steps: [paso('s', pesadas(5, 200))] };
        const veredictos = [{ origin: 'analysis', raw: relleno(40) }];
        const r = await repo.setStepVersionVerifications('o', 'p', 's', 'v1', { lastRunAt: fecha } as never, veredictos as never);
        expect(r.id).toBe('v1');
        expect(pasoDe('s').versions.map(x => x.id)).toContain('v1');
    });

    it('lo que casi no agrega peso pasa, aunque el cálculo diga que no cabe: decide Firestore', async () => {
        guardado = { ownerId: 'o', relleno: relleno(1100), steps: [paso('s', [version('v1', null)])] };
        await editar();
        expect(escrituras).toHaveBeenCalled();
    });

    it('lo devuelto es lo escrito', async () => {
        guardado = { ownerId: 'o', steps: [paso('s', pesadas(5, 190))] };
        await repo.reopenStep('o', 'p', 's');
        await editar();
        const leido = deserializeStep(pasoDe('s'));
        expect(leido.accepted?.markdown).toBe('Editado.');
    });
});

describe('lo que nunca se recorta', () => {
    const cadena = (n: number) => Array.from({ length: n }, (_, i) => version(`v${i + 1}`, i ? `v${i}` : null));
    const ids = (s: { versions: Array<{ id: string }> } | null) => s?.versions.map(v => v.id);
    const armar = (over: Record<string, unknown>, n = 7) => {
        const versions = cadena(n);
        return { id: 's', kind: 'verse', state: 'awaiting-review', versions, current: versions[n - 1], accepted: null, ...over } as never;
    };
    const nada = () => false;
    const conDos = (s: { versions: unknown[] }) => s.versions.length <= 2;

    it('lo vigente, su madre y su hija: deshacer y rehacer siguen', () => {
        const versions = cadena(7);
        const paso3 = armar({ versions, current: versions[3] });
        expect(ids(withoutOldestVersions(paso3, conDos))).toEqual(['v3', 'v4', 'v5']);
        const queda = withoutOldestVersions(paso3, s => s.versions.length <= 3);
        expect(ids(queda)).toEqual(['v3', 'v4', 'v5']);
    });
    it('lo aceptado y su madre, aunque la vigente sea otra', () => {
        const versions = cadena(7);
        const queda = withoutOldestVersions(armar({ versions, current: versions[6], accepted: versions[2] }), s => s.versions.length <= 4);
        expect(ids(queda)).toEqual(expect.arrayContaining(['v2', 'v3', 'v6', 'v7']));
    });
    it('la última aceptada de un paso devuelto a revisión', () => {
        const queda = withoutOldestVersions(armar({ lastAcceptedVersionId: 'v1' }), s => s.versions.length <= 3);
        expect(ids(queda)).toEqual(['v1', 'v6', 'v7']);
    });
    it('la vigente, aunque lo que se vea sea otra', () => {
        const versions = cadena(7);
        const sinSalida = armar({ versions, state: 'accepted', accepted: versions[1], current: versions[6] });
        expect(ids(withoutOldestVersions(sinSalida, s => s.versions.length <= 3))).toEqual(['v1', 'v2', 'v3', 'v7']);
    });
    it('lo que se ve en un paso aceptado con otra vigente', () => {
        const versions = cadena(7);
        const queda = withoutOldestVersions(armar({ versions, state: 'accepted', accepted: versions[1], current: versions[6] }), s => s.versions.length <= 4);
        expect(ids(queda)).toEqual(expect.arrayContaining(['v1', 'v2', 'v3', 'v7']));
    });
    it('en el ensamble, lo generado: con eso compara el aviso al exportar', () => {
        const versions = [version('g1', null), version('e1', 'g1', { origin: 'edited' }), version('e2', 'e1', { origin: 'edited' }), version('e3', 'e2', { origin: 'edited' }), version('e4', 'e3', { origin: 'edited' })];
        const queda = withoutOldestVersions(armar({ kind: 'assembly', versions, current: versions[4], state: 'accepted', accepted: versions[4] }), s => s.versions.length <= 3);
        expect(ids(queda)).toEqual(['g1', 'e3', 'e4']);
    });
    it('sin nada que quitar, lo deja como está', () => {
        expect(ids(withoutOldestVersions(armar({}, 2), nada))).toEqual(['v1', 'v2']);
    });
    it('lo que esta escritura cambió se queda', () => {
        expect(ids(withoutOldestVersions(armar({}, 4), nada, ['v1']))).toEqual(['v1', 'v3', 'v4']);
    });
    it('las hijas de lo que sale pasan a su abuela: deshacer y el aviso siguen la cadena', () => {
        const versions = [version('g3', null), version('e1', 'g3', { origin: 'edited' }), version('e2', 'e1', { origin: 'edited' }), version('e3', 'e2', { origin: 'edited' }), version('e4', 'e3', { origin: 'edited' })];
        const queda = withoutOldestVersions(armar({ kind: 'assembly', versions, current: versions[4], state: 'accepted', accepted: versions[4] }), s => s.versions.length <= 4);
        expect(queda.versions.map(v => [v.id, v.parentVersionId])).toEqual([['g3', null], ['e2', 'g3'], ['e3', 'e2'], ['e4', 'e3']]);
    });
    it('la vigente sigue siendo la de la lista tras cambiarle la madre', () => {
        const versions = cadena(7);
        const queda = withoutOldestVersions(armar({ versions, state: 'accepted', accepted: versions[1], current: versions[5] }), () => false);
        expect(queda.current).toBe(queda.versions.find(v => v.id === 'v6'));
        expect(queda.current!.parentVersionId).toBe('v3');
    });
    it('si salen dos seguidas, la cadena sigue a la que queda, no a la que ya salió', () => {
        const versions = cadena(7);
        const queda = withoutOldestVersions(armar({ versions, current: versions[6] }), () => false);
        for (const v of queda.versions) expect(v.parentVersionId === null || queda.versions.some(o => o.id === v.parentVersionId)).toBe(true);
    });
});

describe('el segundo despliegue: la escritura compacta', () => {
    it('está encendida: un paso con el análisis repetido lo guarda una vez', () => {
        expect(WRITE_COMPACT_VERSIONS).toBe(true);
        const a = version('a', null, { canonicalAnalysis: ANALISIS });
        const b = version('b', 'a', { canonicalAnalysis: ANALISIS });
        const g = serializeStep(deserializeStep(paso('s', [a, b]))) as { versions: Array<Record<string, unknown>> };
        expect(g.versions[0]).toMatchObject({ canonicalAnalysisIn: 'b' });
        expect(g.versions[0]!.canonicalAnalysis).toBeUndefined();
        expect(g.versions[1]!.canonicalAnalysis).toEqual(ANALISIS);
    });
    it('una edición del TP suma la prosa, no otra copia del análisis', async () => {
        guardado = { ownerId: 'o', steps: [paso('s', [version('v1', null, { canonicalAnalysis: { notes: relleno(56) } })])] };
        const antes = firestoreBytes(guardado);
        await editar();
        expect(firestoreBytes(guardado) - antes).toBeLessThan(2 * 1024);
        expect(deserializeStep(pasoDe('s')).versions.map(x => x.canonicalAnalysis)).toEqual([{ notes: relleno(56) }, { notes: relleno(56) }]);
    });
    it('la lectura entiende las referencias', () => {
        const leido = deserializeStep(paso('s', [
            version('a', null, { canonicalAnalysisIn: 'b', analysisVerdictsIn: 'b', citationVerdicts: deProsa('p') }),
            version('b', 'a', { canonicalAnalysis: ANALISIS, citationVerdicts: delAnalisis }),
        ]));
        expect(leido.versions[0]!.canonicalAnalysis).toMatchObject({ notes: 'análisis' });
        expect(leido.versions[0]!.citationVerdicts).toEqual([...delAnalisis, ...deProsa('p')]);
    });
});

describe('los otros pasos, cuando el documento no cabe', () => {
    // Un paso guardado antes de compactar: el mismo análisis en cada versión.
    const viejo = () => paso('viejo', [1, 2, 3, 4, 5, 6].map(n =>
        version(`a${n}`, n > 1 ? `a${n - 1}` : null, { canonicalAnalysis: { notes: relleno(150) } })));

    it('se compactan antes de quitar historial, y no pierden nada', async () => {
        guardado = { ownerId: 'o', steps: [viejo(), paso('s', [version('v1', null)])] };
        await repo.saveManualEdit('o', 'p', 's', relleno(200));
        const v = pasoDe('viejo');
        expect(v.versions.map(x => x.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6']);
        expect(v.versions.filter(x => x.canonicalAnalysisIn === 'a6')).toHaveLength(5);
        expect(deserializeStep(v).versions.every(x => (x.canonicalAnalysis as unknown as { notes: string }).notes === relleno(150))).toBe(true);
        expect(pasoDe('s').versions).toHaveLength(2);
        expect(firestoreBytes(guardado)).toBeLessThanOrEqual(PAPER_BYTES_MAX);
    });

    it('lo que ahorró compactar no tapa lo que la escritura agrega: si sigue sin caber, se recorta', async () => {
        const repetido = paso('viejo', [version('a1', null, { canonicalAnalysis: { notes: relleno(115) } }), version('a2', 'a1', { canonicalAnalysis: { notes: relleno(115) } })]);
        guardado = { ownerId: 'o', steps: [repetido, paso('s', [1, 2, 3, 4].map(n => version(`v${n}`, n > 1 ? `v${n - 1}` : null, { canonicalAnalysis: { notes: relleno(200, String(n)) } })))] };
        await repo.saveManualEdit('o', 'p', 's', relleno(100));
        expect(pasoDe('s').versions.map(x => x.id)).not.toContain('v1');
        expect(firestoreBytes(guardado)).toBeLessThanOrEqual(PAPER_BYTES_MAX);
    });

    it('la forma vieja, con la aceptada y la vigente enteras y sin identificador, conserva sus copias', () => {
        const a = version('a1', null, { canonicalAnalysis: ANALISIS });
        const b = version('a2', 'a1', { canonicalAnalysis: ANALISIS });
        const c = version('a3', 'a2', { canonicalAnalysis: ANALISIS });
        const legado = { id: 'viejo', versions: [a, b, c], accepted: a, current: b };
        const r = recompactStoredStep(legado) as { versions: Array<Record<string, unknown>> };
        expect(r.versions.map(x => x.canonicalAnalysisIn ?? null)).toEqual([null, null, expect.any(String)]);
        expect(deserializeStep(r).versions.every(x => x.canonicalAnalysis)).toBe(true);
    });

    it('mientras quepa, quedan como se leyeron', async () => {
        const antes = paso('viejo', [version('a1', null, { canonicalAnalysis: ANALISIS }), version('a2', 'a1', { canonicalAnalysis: ANALISIS })]);
        guardado = { ownerId: 'o', steps: [antes, paso('s', [version('v1', null)])] };
        await editar();
        expect(pasoDe('viejo')).toEqual(antes);
    });
});

/**
 * Barrido: operaciones al azar sobre un trabajo cerca del límite, con pasos
 * guardados antes de compactar. Después de cada una, lo que se lee de vuelta no
 * perdió nada y ninguna referencia queda colgada.
 */
describe('barrido de operaciones al azar', () => {
    function azar(semilla: number) {
        let a = semilla;
        return () => {
            a = (a + 0x6d2b79f5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    type Guardado = { id: string; currentId?: string | null; acceptedId?: string | null; lastAcceptedVersionId?: string | null; versions: Array<Record<string, unknown> & { id: string }> };
    const pasos = () => guardado.steps as Guardado[];
    const leido = () => new Map(pasos().flatMap(s => deserializeStep(s).versions.map(x => [`${s.id}/${x.id}`, x] as const)));

    function sinColgadas() {
        for (const s of pasos()) {
            const porId = new Map(s.versions.map(x => [x.id, x]));
            for (const x of s.versions) {
                for (const campo of ['canonicalAnalysisIn', 'analysisVerdictsIn'] as const) {
                    const destino = x[campo];
                    if (typeof destino !== 'string') continue;
                    expect(porId.get(destino), `${s.id}/${x.id}.${campo}`).toBeDefined();
                    expect(porId.get(destino)![campo], 'apunta a otra referencia').toBeUndefined();
                }
            }
            // Quien lee sin pasar por aquí encuentra entera la aceptada y la vigente.
            for (const id of [s.currentId, s.acceptedId, s.lastAcceptedVersionId]) {
                const x = id ? porId.get(id) : undefined;
                if (x) expect(x.canonicalAnalysisIn, `${s.id}/${id} entera`).toBeUndefined();
            }
        }
    }

    for (const semilla of [1, 2, 3, 4, 5]) {
        it(`semilla ${semilla}: 120 operaciones sin perder nada`, async () => {
            const r = azar(semilla);
            const elige = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
            const analisis = Array.from({ length: 4 }, (_, i) => ({ notes: relleno(40 + i * 30, String(i)) }));
            const legado = (id: string) => paso(id, [1, 2, 3, 4].map(n =>
                version(`${id}${n}`, n > 1 ? `${id}${n - 1}` : null, { canonicalAnalysis: analisis[n % 2], citationVerdicts: [...delAnalisis, ...deProsa(`${id}${n}`)] })));
            guardado = { ownerId: 'o', steps: [legado('s'), legado('t'), legado('u')] };
            let recortes = 0;

            for (let n = 0; n < 120; n++) {
                const antes = leido();
                const s = elige(pasos());
                const ids = s.versions.map(x => x.id);
                const op = elige(['editar', 'generar', 'mover', 'aceptar', 'reabrir', 'verificar', 'revisar'] as const);
                const tocada = op === 'verificar' || op === 'revisar' ? elige(ids) : null;
                if (op === 'editar') await repo.saveManualEdit('o', 'p', s.id, relleno(Math.floor(r() * 30), 'e'));
                if (op === 'generar') await repo.appendStepVersion('o', 'p', s.id, {
                    markdown: 'generada', origin: 'generated', parentVersionId: s.currentId ?? null, modelId: null, regenerationHint: null, tokensUsed: null,
                    verifications: { lastRunAt: fecha } as never,
                    canonicalAnalysis: (r() < 0.5 ? elige(analisis) : { notes: relleno(Math.floor(r() * 120), 'g') }) as never,
                });
                if (op === 'mover') await repo.moveToStepVersion('o', 'p', s.id, elige(ids));
                if (op === 'aceptar') await repo.acceptStepVersion('o', 'p', s.id, elige(ids));
                if (op === 'reabrir') await repo.reopenStep('o', 'p', s.id);
                if (op === 'verificar') await repo.setStepVersionVerifications('o', 'p', s.id, tocada!, { lastRunAt: fecha } as never,
                    [{ origin: 'analysis', raw: `a${n}` }, { origin: 'prose', raw: `p${n}` }] as never);
                if (op === 'revisar') await repo.setCitationReview('o', 'p', s.id, tocada!, { path: 'x', note: `nota ${n}`, reviewedAt: fecha });

                sinColgadas();
                const despues = leido();
                if (despues.size < antes.size + (op === 'editar' || op === 'generar' ? 1 : 0)) recortes++;
                for (const [clave, x] of despues) {
                    const previa = antes.get(clave);
                    if (!previa) continue;
                    expect(x.markdown, `${op} ${clave}`).toBe(previa.markdown);
                    expect(x.canonicalAnalysis, `${op} ${clave}`).toEqual(previa.canonicalAnalysis);
                    if (clave !== `${s.id}/${tocada}` || op !== 'verificar') expect(x.citationVerdicts, `${op} ${clave}`).toEqual(previa.citationVerdicts);
                }
            }
            // El barrido de verdad llegó al límite: si nunca recorta, no prueba el resguardo.
            expect(recortes).toBeGreaterThan(0);
        });
    }
});
