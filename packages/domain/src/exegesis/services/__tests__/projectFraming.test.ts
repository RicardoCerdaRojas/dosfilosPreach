import { describe, expect, it } from 'vitest';
import type { BibleBookId } from '../../../bible/canon/BibleCanon';
import { passageToReader } from '../../../bible/versification/mapVersification';
import { readerLastVerse } from '../../../bible/versification/readerLastVerse';
import {
    FRAMING_FIELDS,
    FRAMING_MAX_LOG_ENTRIES,
    cleanFramingPatch,
    cleanProjectFraming,
    consolidateIdea,
    currentRevisedIdea,
    framingStatus,
    isRevisionStale,
    isStorableFramingPassage,
    newHypothesisEntry,
    originalChapterCount,
    readerPassageToOriginal,
    withCappedHypothesisLog,
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
            reading: { chapterTitles: { EZR: { 1: ' El decreto ', 2: '', 3: undefined } }, repetitions: undefined },
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
        expect(limpio.reading).toEqual({ chapterTitles: { EZR: { 1: 'El decreto' } } });
        expect(limpio.structure).toEqual([{ passage: EZR(1, 6), title: 'El regreso' }]);
        expect(limpio.rhythm).toEqual({ sundays: 12, frequency: 'weekly' });
        expect(limpio.hypothesisLog).toEqual([{ id: 'a', at: '2026-10-25T10:00:00.000Z', source: 'panorama', verdict: 'nuances', note: '' }]);
        expect(limpio.revision?.why).toBe('');
    });

    it('trunca: 2 000 por texto, 300 por título, 20 movimientos, 200 entradas de registro', () => {
        const largo = 'a'.repeat(5000);
        const f = cleanProjectFraming({
            centralIdea: largo,
            reading: { chapterTitles: { EZR: { 1: largo } } },
            structure: Array.from({ length: 30 }, () => ({ passage: EZR(1, 2), title: largo })),
            hypothesisLog: Array.from({ length: 250 }, (_, i) => ({ id: `e${i}`, at: '2026-10-25T10:00:00.000Z', source: 'study', verdict: 'confirms', note: 'n' })),
        }, opts);
        expect(f.centralIdea).toHaveLength(2000);
        expect(f.reading!.chapterTitles!.EZR![1]).toHaveLength(300);
        expect(f.structure).toHaveLength(20);
        expect(f.structure![0]!.title).toHaveLength(300);
        expect(f.hypothesisLog).toHaveLength(FRAMING_MAX_LOG_ENTRIES);
        // Se conservan las más recientes.
        expect(f.hypothesisLog!.at(-1)!.id).toBe('e249');
        expect(f.hypothesisLog![0]!.id).toBe('e50');
    });

    it('valida capítulos del libro (lector), fechas YYYY-MM-DD reales, domingos 1..200 y enums', () => {
        const f = cleanProjectFraming({
            purpose: 'sermon', genre: 'novela',
            // Esdras tiene 10 capítulos.
            reading: { chapterTitles: { EZR: { 0: 'cero', 11: 'fuera', 10: 'ok', x: 'no' } } },
            rhythm: { sundays: 201, startDate: '2026-02-30', frequency: 'diaria' },
        }, opts);
        expect(f).not.toHaveProperty('purpose');
        expect(f).not.toHaveProperty('genre');
        expect(f.reading).toEqual({ chapterTitles: { EZR: { 10: 'ok' } } });
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

describe('títulos por capítulo, por libro (C1)', () => {
    const titulos = { EZR: { 1: 'El decreto' }, NEH: { 1: 'La oración de Nehemías', 13: 'Las reformas' } };

    it('cada libro conserva los suyos: con Esdras y Nehemías, el 1 de cada uno es otro capítulo', () => {
        const f = cleanProjectFraming({ reading: { chapterTitles: titulos } }, { bibleBooks: ['EZR', 'NEH'] });
        expect(f.reading!.chapterTitles).toEqual(titulos);
    });

    it('desmarcar un libro se lleva sus títulos; un libro desconocido no entra', () => {
        const f = cleanProjectFraming({ reading: { chapterTitles: { ...titulos, XYZ: { 1: 'x' } } } }, { bibleBooks: ['NEH'] });
        expect(f.reading!.chapterTitles).toEqual({ NEH: titulos.NEH });
    });

    it('cuenta como hecho solo si el libro con títulos es del proyecto', () => {
        const framing = { reading: { chapterTitles: { NEH: { 1: 't' } } } } as ProjectFraming;
        expect(framingStatus({ framing, bibliographyCriteria: { bibleBooks: ['NEH'] } }).missing).not.toContain('chapterTitles');
        expect(framingStatus({ framing, bibliographyCriteria: { bibleBooks: ['EZR'] } }).missing).toContain('chapterTitles');
    });
});

describe('el género tiene dónde responderse (A6)', () => {
    it('genreReading y genreEvidence se limpian, se recortan y van en el orden del formulario', () => {
        const f = cleanProjectFraming({ genreReading: '  El conflicto es la oposición ', genreEvidence: 'a'.repeat(3000) }, opts);
        expect(f.genreReading).toBe('El conflicto es la oposición');
        expect(f.genreEvidence).toHaveLength(2000);
        expect(cleanFramingPatch({ genreReading: '  ', genreEvidence: '4:1-5' }, opts)).toEqual({ genreReading: null, genreEvidence: '4:1-5' });
        expect(FRAMING_FIELDS.indexOf('genreReading')).toBe(FRAMING_FIELDS.indexOf('genre') + 1);
        expect(framingStatus({ framing: {}, bibliographyCriteria: null }).missing).toEqual(expect.arrayContaining(['genreReading', 'genreEvidence']));
    });
});

describe('numeración: del lector al original (C2)', () => {
    const lector = (bookId: string, cs: number, ce: number, vs: number | null = null, ve: number | null = null) =>
        ({ bookId, chapterStart: cs, chapterEnd: ce, verseStart: vs, verseEnd: ve }) as never;

    it('Joel 3:1-21 del lector es JOL 4:1-21, y se guarda aunque Joel tenga 3 capítulos en el lector', () => {
        const r = readerPassageToOriginal(lector('JOL', 3, 3, 1, 21));
        expect(r).toEqual({ ok: true, passage: { bookId: 'JOL', chapterStart: 4, chapterEnd: 4, verseStart: 1, verseEnd: 21 } });
        expect(originalChapterCount('JOL')).toBe(4);
        if (!r.ok) throw new Error('debía convertir');
        expect(isStorableFramingPassage(r.passage)).toBe(true);
        expect(cleanProjectFraming({ scope: { bookId: 'JOL', passage: r.passage } }, { bibleBooks: ['JOL'] }).scope).toEqual({ bookId: 'JOL', passage: r.passage });
    });

    it('«Joel 3» entero se expande a sus versos antes de convertir', () => {
        expect(readerPassageToOriginal(lector('JOL', 3, 3))).toEqual({ ok: true, passage: { bookId: 'JOL', chapterStart: 4, chapterEnd: 4, verseStart: 1, verseEnd: 21 } });
        // Joel 2 entero termina en el 3:5 del original (2:28-32 del lector).
        expect(readerPassageToOriginal(lector('JOL', 2, 2))).toEqual({ ok: true, passage: { bookId: 'JOL', chapterStart: 2, chapterEnd: 3, verseStart: 1, verseEnd: 5 } });
    });

    it('«Malaquías 4» es MAL 3:19-24; «Malaquías 3» termina en el 3:18', () => {
        expect(readerPassageToOriginal(lector('MAL', 4, 4))).toEqual({ ok: true, passage: { bookId: 'MAL', chapterStart: 3, chapterEnd: 3, verseStart: 19, verseEnd: 24 } });
        expect(readerPassageToOriginal(lector('MAL', 3, 3))).toEqual({ ok: true, passage: { bookId: 'MAL', chapterStart: 3, chapterEnd: 3, verseStart: 1, verseEnd: 18 } });
    });

    it('«Nehemías 4» incluye el 4:1-6 del lector (NEH 3:33-38)', () => {
        expect(readerPassageToOriginal(lector('NEH', 4, 4))).toEqual({ ok: true, passage: { bookId: 'NEH', chapterStart: 3, chapterEnd: 4, verseStart: 33, verseEnd: 17 } });
        // «Nehemías 1-3» termina en el 3:32: lo que sigue es el 4 del lector.
        expect(readerPassageToOriginal(lector('NEH', 1, 3))).toEqual({ ok: true, passage: { bookId: 'NEH', chapterStart: 1, chapterEnd: 3, verseStart: 1, verseEnd: 32 } });
    });

    it('sin cruce, el capítulo queda entero; un salmo con título no se corre', () => {
        expect(readerPassageToOriginal(lector('EZR', 1, 6))).toEqual({ ok: true, passage: lector('EZR', 1, 6) });
        expect(readerPassageToOriginal(lector('PSA', 3, 3))).toEqual({ ok: true, passage: lector('PSA', 3, 3) });
    });

    it('un rango de capítulos enteros siempre convierte, aunque el capítulo final no se corra', () => {
        // Medidos: antes pedían versos y bloqueaban guardar el encuadre entero.
        const casos: Array<[string, number, number, [number, number, number, number]]> = [
            ['JON', 1, 4, [1, 1, 4, 11]],   // Jon 1:17 es JON 2:1; Jonás 4 no se corre.
            ['JON', 2, 4, [2, 2, 4, 11]],   // Jonás 2 del lector empieza en el 2:2.
            ['NEH', 4, 6, [3, 33, 6, 19]],
            ['NEH', 3, 6, [3, 1, 6, 19]],
            ['NEH', 9, 13, [9, 1, 13, 31]], // Neh 9:38 es NEH 10:1.
            ['1KI', 4, 11, [4, 1, 11, 43]], // 1 Re 4:21-34 es 1KI 5:1-14.
            ['NEH', 3, 7, [3, 1, 7, 72]],   // Neh 7:73 del lector es 7:72 del original.
            ['NEH', 4, 9, [3, 33, 10, 1]],  // Neh 9:38 del lector es NEH 10:1: el 9 entero termina ahí.
            ['JOL', 1, 3, [1, 1, 4, 21]],
        ];
        for (const [libro, cs, ce, [ocs, ovs, oce, ove]] of casos) {
            expect(readerPassageToOriginal(lector(libro, cs, ce)), `${libro} ${cs}-${ce}`)
                .toEqual({ ok: true, passage: { bookId: libro, chapterStart: ocs, verseStart: ovs, chapterEnd: oce, verseEnd: ove } });
        }
    });

    it('ida y vuelta: el original convertido vuelve a ser el rango de capítulos enteros del lector', () => {
        const casos: Array<[string, number, number]> = [['JON', 1, 4], ['JON', 2, 4], ['NEH', 4, 6], ['NEH', 3, 6], ['NEH', 9, 13], ['1KI', 4, 11], ['NEH', 3, 7], ['NEH', 4, 9], ['JOL', 1, 3], ['MAL', 4, 4]];
        for (const [libro, cs, ce] of casos) {
            const r = readerPassageToOriginal(lector(libro, cs, ce));
            if (!r.ok) throw new Error(`${libro} ${cs}-${ce} debía convertir`);
            expect(isStorableFramingPassage(r.passage), `${libro} ${cs}-${ce}`).toBe(true);
            expect(passageToReader(r.passage).passage, `${libro} ${cs}-${ce}`).toEqual({
                bookId: libro, chapterStart: cs, verseStart: 1, chapterEnd: ce, verseEnd: readerLastVerse(libro as BibleBookId, ce),
            });
        }
    });

    it('pide versos solo si la tabla no conoce el capítulo; con versos convierte igual', () => {
        // Jonás no tiene capítulo 5 del lector: no se inventa el último verso.
        expect(readerPassageToOriginal(lector('JON', 1, 5))).toEqual({ ok: false, reason: 'needs-verses' });
        expect(readerPassageToOriginal(lector('NEH', 4, 6, 1, 19))).toEqual({ ok: true, passage: { bookId: 'NEH', chapterStart: 3, chapterEnd: 6, verseStart: 33, verseEnd: 19 } });
    });

    it('el original se valida contra el original: JOL 5 no existe, MAL 3:20-1 se invierte', () => {
        expect(isStorableFramingPassage(lector('JOL', 5, 5))).toBe(false);
        expect(isStorableFramingPassage(lector('MAL', 3, 3, 20, 1))).toBe(false);
        expect(isStorableFramingPassage(lector('JOL', 3, 4, 5, 2))).toBe(true);
        expect(isStorableFramingPassage(lector('JOL', 1, 1, 1, null))).toBe(false);
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

describe('registro: una anotación para arrayUnion (C7)', () => {
    it('limpia, con id y fecha, sin undefined', () => {
        const e = newHypothesisEntry({ source: 'study', studyId: null, verdict: 'contradicts', note: ' 4:1-5 ' }, new Date('2026-10-25T10:00:00.000Z'));
        expect(e).toMatchObject({ source: 'study', verdict: 'contradicts', note: '4:1-5', at: '2026-10-25T10:00:00.000Z' });
        expect(e).not.toHaveProperty('studyId');
        expect(() => rechazaUndefined(e)).not.toThrow();
        expect(newHypothesisEntry({ source: 'study', studyId: 's1', verdict: 'confirms', note: '' })!.studyId).toBe('s1');
    });

    it('dos anotaciones iguales en el mismo instante tienen ids distintos: arrayUnion no las funde', () => {
        const now = new Date('2026-10-25T10:00:00.000Z');
        const ids = new Set(Array.from({ length: 50 }, () => newHypothesisEntry({ source: 'panorama', verdict: 'confirms', note: 'x' }, now)!.id));
        expect(ids.size).toBe(50);
    });

    it('un veredicto inválido no produce anotación', () => {
        expect(newHypothesisEntry({ source: 'study', verdict: 'quizá' as never, note: '' })).toBeNull();
    });

    it('el tope se aplica al leer: quedan las 200 más recientes', () => {
        const log = Array.from({ length: 230 }, (_, i) => ({ id: `e${i}`, at: '2026-10-25T10:00:00.000Z', source: 'study' as const, verdict: 'confirms' as const, note: '' }));
        const f = withCappedHypothesisLog({ centralIdea: 'x', hypothesisLog: log });
        expect(f.hypothesisLog).toHaveLength(FRAMING_MAX_LOG_ENTRIES);
        expect(f.hypothesisLog![0]!.id).toBe('e30');
        expect(f.centralIdea).toBe('x');
        const corto = { hypothesisLog: log.slice(0, 3) };
        expect(withCappedHypothesisLog(corto)).toBe(corto);
    });
});


describe('«di por hecha la división» (escritorio, fase 3)', () => {
    it('solo se guarda el sí explícito', () => {
        expect(cleanProjectFraming({ purpose: 'teach', divisionWithoutSeries: true }, opts).divisionWithoutSeries).toBe(true);
        expect('divisionWithoutSeries' in cleanProjectFraming({ divisionWithoutSeries: false }, opts)).toBe(false);
        expect('divisionWithoutSeries' in cleanProjectFraming({ divisionWithoutSeries: 'sí' }, opts)).toBe(false);
    });

    it('en un cambio, desmarcar borra el campo (null) y marcar lo escribe', () => {
        expect(cleanFramingPatch({ divisionWithoutSeries: true }, opts)).toEqual({ divisionWithoutSeries: true });
        expect(cleanFramingPatch({ divisionWithoutSeries: false }, opts)).toEqual({ divisionWithoutSeries: null });
    });

    it('no es un campo del formulario: no cambia el estado del encuadre', () => {
        expect(FRAMING_FIELDS).not.toContain('divisionWithoutSeries');
        expect(framingStatus({ framing: { divisionWithoutSeries: true }, bibliographyCriteria: null }).status).toBe('missing');
    });
});
