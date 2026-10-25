import { describe, expect, it } from 'vitest';
import type { BibleBookId } from '../../../bible/canon/BibleCanon';
import {
    FRAMING_MAX_LOG_ENTRIES,
    appendHypothesisEntry,
    cleanFramingPatch,
    cleanProjectFraming,
    consolidateIdea,
    currentRevisedIdea,
    framingStatus,
    isRevisionStale,
    placeInBook,
    type ProjectFraming,
} from '../projectFraming';

/** Como Firestore sin `ignoreUndefinedProperties`: un undefined en cualquier nivel tumba la escritura. */
function rechazaUndefined(v: unknown, ruta = 'raíz'): void {
    if (v === undefined) throw new Error(`undefined en ${ruta}`);
    if (Array.isArray(v)) v.forEach((x, i) => rechazaUndefined(x, `${ruta}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) rechazaUndefined(x, `${ruta}.${k}`);
}

const EZR = (cs: number, ce: number, vs: number | null = null, ve: number | null = null) =>
    ({ bookId: 'EZR', chapterStart: cs, chapterEnd: ce, verseStart: vs, verseEnd: ve });
const opts = { bibleBooks: ['EZR'] as BibleBookId[] };

describe('cleanProjectFraming — limpieza profunda', () => {
    it('no deja undefined en ningún nivel, ni claves ajenas, ni texto vacío', () => {
        const sucio = {
            purpose: 'preach',
            centralIdea: '  Dios cumple su palabra  ',
            occasion: '   ',
            audience: undefined,
            ajena: 'no',
            reading: { chapterTitles: { 1: ' El decreto ', 2: '', 3: undefined }, repetitions: undefined },
            structure: [{ passage: { ...EZR(1, 6), extra: undefined }, title: ' El regreso ', otro: undefined }],
            rhythm: { sundays: 12, startDate: undefined, frequency: 'weekly' },
            scope: { bookId: 'EZR', passage: EZR(1, 6) },
            hypothesisLog: [{ id: 'a', at: '2026-10-25T10:00:00.000Z', source: 'panorama', studyId: undefined, verdict: 'nuances', note: undefined }],
            revision: { centralIdea: 'x', verdict: 'nuanced', why: undefined, ofIdea: 'Dios cumple su palabra', revisedAt: '2026-10-25T10:00:00.000Z' },
        };
        const limpio = cleanProjectFraming(sucio, opts);
        expect(() => rechazaUndefined(limpio)).not.toThrow();
        expect(() => rechazaUndefined(sucio)).toThrow();
        expect(limpio).not.toHaveProperty('ajena');
        expect(limpio).not.toHaveProperty('occasion');
        expect(limpio.centralIdea).toBe('Dios cumple su palabra');
        expect(limpio.reading).toEqual({ chapterTitles: { 1: 'El decreto' } });
        expect(limpio.structure).toEqual([{ passage: EZR(1, 6), title: 'El regreso' }]);
        expect(limpio.rhythm).toEqual({ sundays: 12, frequency: 'weekly' });
        expect(limpio.hypothesisLog).toEqual([{ id: 'a', at: '2026-10-25T10:00:00.000Z', source: 'panorama', verdict: 'nuances', note: '' }]);
        expect(limpio.revision?.why).toBe('');
    });

    it('trunca: 2 000 por texto, 300 por título, 20 movimientos, 200 entradas de registro', () => {
        const largo = 'a'.repeat(5000);
        const f = cleanProjectFraming({
            centralIdea: largo,
            reading: { chapterTitles: { 1: largo } },
            structure: Array.from({ length: 30 }, () => ({ passage: EZR(1, 2), title: largo })),
            hypothesisLog: Array.from({ length: 250 }, (_, i) => ({ id: `e${i}`, at: '2026-10-25T10:00:00.000Z', source: 'study', verdict: 'confirms', note: 'n' })),
        }, opts);
        expect(f.centralIdea).toHaveLength(2000);
        expect(f.reading!.chapterTitles![1]).toHaveLength(300);
        expect(f.structure).toHaveLength(20);
        expect(f.structure![0]!.title).toHaveLength(300);
        expect(f.hypothesisLog).toHaveLength(FRAMING_MAX_LOG_ENTRIES);
        // Se conservan las más recientes.
        expect(f.hypothesisLog!.at(-1)!.id).toBe('e249');
        expect(f.hypothesisLog![0]!.id).toBe('e50');
    });

    it('valida capítulos 1..150, fechas YYYY-MM-DD reales, domingos 1..200 y enums', () => {
        const f = cleanProjectFraming({
            purpose: 'sermon', genre: 'novela',
            reading: { chapterTitles: { 0: 'cero', 151: 'fuera', 150: 'ok', x: 'no' } },
            rhythm: { sundays: 201, startDate: '2026-02-30', frequency: 'diaria' },
        }, opts);
        expect(f).not.toHaveProperty('purpose');
        expect(f).not.toHaveProperty('genre');
        expect(f.reading).toEqual({ chapterTitles: { 150: 'ok' } });
        expect(f).not.toHaveProperty('rhythm');
        expect(cleanProjectFraming({ rhythm: { sundays: '12', startDate: '2026-11-01' } }, opts).rhythm).toEqual({ sundays: 12, startDate: '2026-11-01' });
        expect(cleanProjectFraming({ rhythm: { sundays: 3.5 } }, opts)).not.toHaveProperty('rhythm');
        expect(cleanProjectFraming({ genre: 'historical-narrative' }, opts).genre).toBe('historical-narrative');
    });

    it('«estudio personal» quita lo pastoral y el ritmo, pero conserva la trayectoria hacia Cristo', () => {
        const f = cleanProjectFraming({
            purpose: 'personal', audience: 'la iglesia', need: 'n', needEvidence: '1:1', desiredChange: 'c',
            rhythm: { sundays: 10 }, christTrajectory: 'El templo apunta a Cristo', christTrajectoryEvidence: 'Jn 2:19',
        }, opts);
        expect(f).toEqual({ purpose: 'personal', christTrajectory: 'El templo apunta a Cristo', christTrajectoryEvidence: 'Jn 2:19' });
    });

    it('el alcance se descarta si su libro no es el único del proyecto', () => {
        const scope = { bookId: 'EZR', passage: EZR(1, 6) };
        expect(cleanProjectFraming({ scope }, { bibleBooks: ['EZR'] }).scope).toEqual(scope);
        expect(cleanProjectFraming({ scope }, { bibleBooks: ['EZR', 'NEH'] })).not.toHaveProperty('scope');
        expect(cleanProjectFraming({ scope }, { bibleBooks: ['NEH'] })).not.toHaveProperty('scope');
        expect(cleanProjectFraming({ scope }, { bibleBooks: [] })).not.toHaveProperty('scope');
        // Pasaje de otro libro o fuera del libro (Esdras tiene 10 capítulos).
        expect(cleanProjectFraming({ scope: { bookId: 'EZR', passage: { ...EZR(1, 6), bookId: 'NEH' } } }, opts)).not.toHaveProperty('scope');
        expect(cleanProjectFraming({ scope: { bookId: 'EZR', passage: EZR(9, 11) } }, opts)).not.toHaveProperty('scope');
    });
});

describe('cleanFramingPatch — cambios por campo', () => {
    it('solo las claves presentes; vacío o null pasa a null (borrar)', () => {
        const p = cleanFramingPatch({ centralIdea: '  ', occasion: null, genre: 'law', need: undefined }, opts);
        expect(p).toEqual({ centralIdea: null, occasion: null, genre: 'law' });
        expect(() => rechazaUndefined(p)).not.toThrow();
    });

    it('ignora updatedAt: lo escribe el repositorio', () => {
        expect(cleanFramingPatch({ updatedAt: 'x', genre: 'law' }, opts)).toEqual({ genre: 'law' });
    });

    it('«estudio personal» borra los campos pastorales, aunque no vengan', () => {
        const p = cleanFramingPatch({ purpose: 'personal', audience: 'a', christTrajectory: 't' }, opts);
        expect(p).toEqual({ purpose: 'personal', audience: null, need: null, needEvidence: null, desiredChange: null, rhythm: null, christTrajectory: 't' });
    });

    it('sin propósito en el cambio manda el guardado', () => {
        expect(cleanFramingPatch({ audience: 'a' }, { ...opts, savedPurpose: 'personal' })).toEqual({ audience: null });
        expect(cleanFramingPatch({ audience: 'a' }, { ...opts, savedPurpose: 'preach' })).toEqual({ audience: 'a' });
    });
});

describe('framingStatus', () => {
    it('missing sin nada; lista todos los campos en el orden del formulario', () => {
        const r = framingStatus({ framing: undefined, bibliographyCriteria: null });
        expect(r.status).toBe('missing');
        expect(r.missing[0]).toBe('bibleBooks');
        expect(r.missing).toContain('rhythm');
        expect(r.missing.indexOf('structure')).toBeLessThan(r.missing.indexOf('centralIdea'));
    });

    it('partial con libro pero sin idea central, o con idea sin libro', () => {
        expect(framingStatus({ bibliographyCriteria: { bibleBooks: ['EZR'] } }).status).toBe('partial');
        const r = framingStatus({ framing: { centralIdea: 'Dios restaura' }, bibliographyCriteria: null });
        expect(r.status).toBe('partial');
        expect(r.missing).toContain('bibleBooks');
        expect(r.missing).not.toContain('centralIdea');
    });

    it('complete con libro e idea central; lo demás sigue en missing sin bloquear', () => {
        const r = framingStatus({ framing: { centralIdea: 'Dios restaura', genre: 'historical-narrative' }, bibliographyCriteria: { bibleBooks: ['EZR', 'NEH'] } });
        expect(r.status).toBe('complete');
        expect(r.missing).not.toContain('genre');
        expect(r.missing).toEqual(expect.arrayContaining(['purpose', 'occasion', 'audience']));
    });

    it('en «estudio personal» no pide lo pastoral, pero sí la trayectoria', () => {
        const r = framingStatus({ framing: { purpose: 'personal' }, bibliographyCriteria: null });
        expect(r.missing).not.toContain('audience');
        expect(r.missing).not.toContain('rhythm');
        expect(r.missing).toContain('christTrajectory');
    });

    it('una idea de puros espacios no cuenta', () => {
        expect(framingStatus({ framing: { centralIdea: '   ' }, bibliographyCriteria: { bibleBooks: ['EZR'] } }).status).toBe('partial');
    });
});

describe('revisión de la idea', () => {
    const now = new Date('2026-10-25T12:00:00.000Z');
    const base: ProjectFraming = { centralIdea: 'Dios cumple su palabra' };

    it('vigente: la revisada llega', () => {
        const f = { ...base, ...consolidateIdea(base, { centralIdea: ' Dios restaura a su pueblo por su palabra ', verdict: 'nuanced', why: 'Esd 1:1' }, now) } as ProjectFraming;
        expect(f.revision).toEqual({ centralIdea: 'Dios restaura a su pueblo por su palabra', verdict: 'nuanced', why: 'Esd 1:1', ofIdea: 'Dios cumple su palabra', revisedAt: now.toISOString() });
        expect(isRevisionStale(f)).toBe(false);
        expect(currentRevisedIdea(f)).toBe('Dios restaura a su pueblo por su palabra');
    });

    it('desactualizada si la idea original cambió o se borró: null', () => {
        const f = { ...base, ...consolidateIdea(base, { centralIdea: 'Revisada', verdict: 'corrected', why: '' }, now) } as ProjectFraming;
        expect(currentRevisedIdea({ ...f, centralIdea: 'Otra idea' })).toBeNull();
        expect(isRevisionStale({ ...f, centralIdea: 'Otra idea' })).toBe(true);
        expect(currentRevisedIdea({ ...f, centralIdea: undefined })).toBeNull();
        // Los espacios de más no la desactualizan.
        expect(currentRevisedIdea({ ...f, centralIdea: '  Dios cumple su palabra ' })).toBe('Revisada');
    });

    it('sin revisión: null y no desactualizada', () => {
        expect(currentRevisedIdea(base)).toBeNull();
        expect(isRevisionStale(base)).toBe(false);
        expect(currentRevisedIdea(null)).toBeNull();
    });
});

describe('appendHypothesisEntry', () => {
    it('agrega al final del registro guardado, con id y fecha, sin undefined', () => {
        const guardado: ProjectFraming = { hypothesisLog: [{ id: 'a', at: '2026-10-24T10:00:00.000Z', source: 'panorama', verdict: 'confirms', note: 'ok' }] };
        const p = appendHypothesisEntry(guardado, { source: 'study', studyId: null, verdict: 'contradicts', note: ' 4:1-5 ' }, new Date('2026-10-25T10:00:00.000Z'));
        expect(p.hypothesisLog).toHaveLength(2);
        expect(p.hypothesisLog![1]).toMatchObject({ source: 'study', verdict: 'contradicts', note: '4:1-5', at: '2026-10-25T10:00:00.000Z' });
        expect(p.hypothesisLog![1]).not.toHaveProperty('studyId');
        expect(() => rechazaUndefined(p)).not.toThrow();
    });
});

describe('placeInBook', () => {
    const serie = {
        metadata: {
            plannedSermons: [
                { id: 'r1', title: 'El decreto de Ciro', passage: 'Esdras 1:1-11' },
                { id: 'r2', title: 'El altar y los cimientos', passage: 'Esdras 3:1-13' },
                { id: 'r3', title: 'La oposición', passage: 'Esdras 4:1-24' },
            ],
        },
    };

    it('la del medio dice su lugar, la anterior y la siguiente', () => {
        expect(placeInBook(serie, 'r2')).toBe(
            'Perícopa 2 de 3 de la serie. Antes: Esdras 1:1-11 («El decreto de Ciro»). Después: Esdras 4:1-24 («La oposición»).',
        );
    });

    it('en los extremos omite el vecino que no hay', () => {
        expect(placeInBook(serie, 'r1')).toBe('Perícopa 1 de 3 de la serie. Después: Esdras 3:1-13 («El altar y los cimientos»).');
        expect(placeInBook(serie, 'r3')).toBe('Perícopa 3 de 3 de la serie. Antes: Esdras 3:1-13 («El altar y los cimientos»).');
    });

    it('una perícopa que no está en la serie: null', () => {
        expect(placeInBook(serie, 'otra')).toBeNull();
        expect(placeInBook(null, 'r1')).toBeNull();
    });

    it('cuenta unidades, no filas: una unidad en dos domingos (mismo estudio o mismo pasaje) cuenta una vez', () => {
        const dosDomingos = {
            metadata: {
                plannedSermons: [
                    { id: 'r1', title: 'El decreto', passage: 'Esdras 1:1-11', paperId: 'p1' },
                    { id: 'r2a', title: 'El altar (1)', passage: 'Esdras 3:1-13', paperId: 'p2' },
                    { id: 'r2b', title: 'El altar (2)', passage: 'Esdras 3:1-13' },
                    { id: 'r3', title: 'La oposición', passage: 'Esdras 4:1-24', paperId: 'p3' },
                ],
            },
        };
        expect(placeInBook(dosDomingos, 'r2b')).toBe(
            'Perícopa 2 de 3 de la serie. Antes: Esdras 1:1-11 («El decreto»). Después: Esdras 4:1-24 («La oposición»).',
        );
        expect(placeInBook(dosDomingos, 'r3')).toMatch(/^Perícopa 3 de 3 de la serie\. Antes: Esdras 3:1-13 \(«El altar \(1\)»\)\.$/);
    });

    it('dos filas con el mismo estudio son una unidad aunque el rótulo del pasaje difiera', () => {
        const s = {
            metadata: {
                plannedSermons: [
                    { id: 'a1', title: 'El altar', passage: 'Esdras 3:1-6', paperId: 'p2' },
                    { id: 'a2', title: 'Los cimientos', passage: 'Esdras 3:7-13', paperId: 'p2' },
                    { id: 'b', title: 'La oposición', passage: 'Esdras 4:1-24' },
                ],
            },
        };
        expect(placeInBook(s, 'b')).toBe('Perícopa 2 de 2 de la serie. Antes: Esdras 3:1-6 («El altar»).');
    });

    it('sin `passage`, traduce el syntacticUnit (numeración del original) a la del lector', () => {
        // Jonás 2:1 del hebreo es 1:17 en la RVR.
        const s = {
            metadata: {
                plannedSermons: [
                    { id: 'a', title: 'El pez', passage: '', syntacticUnit: { book: 'Jonás', chapterStart: 2, verseStart: 1, chapterEnd: 2, verseEnd: 11 } },
                    { id: 'b', title: 'Nínive', passage: 'Jonás 3:1-10' },
                ],
            },
        };
        expect(placeInBook(s, 'b')).toBe('Perícopa 2 de 2 de la serie. Antes: Jonás 1:17-2:10 («El pez»).');
    });
});
