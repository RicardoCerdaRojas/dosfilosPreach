import { describe, it, expect, vi } from 'vitest';
import type { AIProject } from '@dosfilos/domain';
import { UpdateProjectUseCase } from '../UpdateProjectUseCase';

/** Como Firestore sin `ignoreUndefinedProperties`: un undefined en cualquier nivel tumba la escritura. */
function rechazaUndefined(v: unknown, ruta = 'raíz'): void {
    if (v === undefined) throw new Error(`Firestore rechaza undefined en ${ruta}`);
    if (Array.isArray(v)) v.forEach((x, i) => rechazaUndefined(x, `${ruta}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) rechazaUndefined(x, `${ruta}.${k}`);
}

/** Un doble del repositorio que se porta como Firestore con los undefined. */
function repoCon(guardado: Partial<AIProject> | null) {
    return {
        getProject: vi.fn(async () => (guardado ? ({ id: 'p1', ...guardado } as AIProject) : null)),
        updateProject: vi.fn(async (_id: string, u: Record<string, unknown>) => { rechazaUndefined(u); return u; }),
    };
}
const escrito = (repo: ReturnType<typeof repoCon>) => repo.updateProject.mock.calls.at(-1)![1] as Record<string, any>;

const EZR = { bookId: 'EZR', chapterStart: 1, chapterEnd: 6, verseStart: null, verseEnd: null };

describe('UpdateProjectUseCase — encuadre por campo', () => {
    it('limpia a fondo: un formulario con undefined anidados llega sin ninguno', async () => {
        const repo = repoCon({});
        await new UpdateProjectUseCase(repo as never).execute('p1', {
            bibleBooks: ['EZR'],
            framingPatch: {
                purpose: 'preach',
                centralIdea: ' Dios cumple su palabra ',
                occasion: '',
                reading: { chapterTitles: { 1: 'El decreto', 2: undefined }, repetitions: undefined },
                structure: [{ passage: EZR, title: 'El regreso', extra: undefined }],
                rhythm: { sundays: 12, startDate: undefined },
                scope: { bookId: 'EZR', passage: EZR },
            },
        });
        const u = escrito(repo);
        expect(u.framingPatch).toEqual({
            purpose: 'preach',
            centralIdea: 'Dios cumple su palabra',
            occasion: null,
            reading: { chapterTitles: { 1: 'El decreto' } },
            structure: [{ passage: EZR, title: 'El regreso' }],
            rhythm: { sundays: 12 },
            scope: { bookId: 'EZR', passage: EZR },
        });
        expect(u.bibleBooks).toEqual(['EZR']);
        expect(u).not.toHaveProperty('bibliographyCriteria');
    });

    it('el formulario no toca el registro ni la revisión que no manda', async () => {
        const repo = repoCon({});
        await new UpdateProjectUseCase(repo as never).execute('p1', { framingPatch: { centralIdea: 'Otra' } });
        expect(Object.keys(escrito(repo).framingPatch)).toEqual(['centralIdea']);
    });

    it('el alcance se descarta si hay dos libros', async () => {
        const repo = repoCon({});
        await new UpdateProjectUseCase(repo as never).execute('p1', { bibleBooks: ['EZR', 'NEH'], framingPatch: { scope: { bookId: 'EZR', passage: EZR } } });
        expect(escrito(repo).framingPatch.scope).toBeNull();
    });

    it('cambiar los libros borra un alcance guardado que ya no corresponde', async () => {
        const repo = repoCon({ framing: { scope: { bookId: 'EZR', passage: EZR as never } }, bibliographyCriteria: { bibleBooks: ['EZR'] } });
        await new UpdateProjectUseCase(repo as never).execute('p1', { bibleBooks: ['EZR', 'NEH'] });
        expect(escrito(repo).framingPatch).toEqual({ scope: null });
        // Con el mismo libro, el alcance queda.
        await new UpdateProjectUseCase(repo as never).execute('p1', { bibleBooks: ['EZR'] });
        expect(escrito(repo)).not.toHaveProperty('framingPatch');
    });

    it('el alcance sin libros en el cambio se valida contra los guardados', async () => {
        const repo = repoCon({ framing: {}, bibliographyCriteria: { bibleBooks: ['EZR'] } });
        await new UpdateProjectUseCase(repo as never).execute('p1', { framingPatch: { scope: { bookId: 'EZR', passage: EZR } } });
        expect(escrito(repo).framingPatch.scope).toEqual({ bookId: 'EZR', passage: EZR });
    });

    it('una anotación se agrega al registro GUARDADO, no al de la caché', async () => {
        const repo = repoCon({ framing: { hypothesisLog: [{ id: 'a', at: '2026-10-24T10:00:00.000Z', source: 'panorama', verdict: 'confirms', note: 'ok' }] } });
        await new UpdateProjectUseCase(repo as never).execute('p1', { hypothesisEntry: { source: 'study', studyId: 's1', verdict: 'nuances', note: 'matiza' } });
        const log = escrito(repo).framingPatch.hypothesisLog;
        expect(log.map((e: { id: string }) => e.id)[0]).toBe('a');
        expect(log[1]).toMatchObject({ source: 'study', studyId: 's1', verdict: 'nuances', note: 'matiza' });
    });
});

describe('UpdateProjectUseCase — los libros del encuadre mandan sobre el borrador de Estado del arte', () => {
    it('con encuadre guardado, los criterios conservan los libros GUARDADOS', async () => {
        const repo = repoCon({ framing: { centralIdea: 'x' }, bibliographyCriteria: { bibleBooks: ['EZR', 'NEH'], inclusion: 'vieja' } });
        await new UpdateProjectUseCase(repo as never).execute('p1', { bibliographyCriteria: { inclusion: 'nueva', bibleBooks: ['ROM'] } });
        expect(escrito(repo).bibliographyCriteria).toEqual({ inclusion: 'nueva', bibleBooks: ['EZR', 'NEH'] });
    });

    it('sin encuadre, Estado del arte sigue eligiendo los libros como antes', async () => {
        const repo = repoCon({ bibliographyCriteria: { bibleBooks: ['EZR'] } });
        await new UpdateProjectUseCase(repo as never).execute('p1', { bibliographyCriteria: { bibleBooks: ['ROM'] } });
        expect(escrito(repo).bibliographyCriteria).toEqual({ bibleBooks: ['ROM'] });
    });

    it('con encuadre, quitar los criterios no se lleva los libros', async () => {
        const repo = repoCon({ framing: {}, bibliographyCriteria: { bibleBooks: ['EZR'] } });
        await new UpdateProjectUseCase(repo as never).execute('p1', { bibliographyCriteria: null });
        expect(escrito(repo).bibliographyCriteria).toEqual({ bibleBooks: ['EZR'] });
    });

    it('criterios y libros a la vez: los libros van adentro, sin ruta suelta que choque', async () => {
        const repo = repoCon({ framing: {}, bibliographyCriteria: { bibleBooks: ['EZR'] } });
        await new UpdateProjectUseCase(repo as never).execute('p1', { bibliographyCriteria: { inclusion: 'i' }, bibleBooks: ['NEH'] });
        const u = escrito(repo);
        expect(u.bibliographyCriteria).toEqual({ inclusion: 'i', bibleBooks: ['NEH'] });
        expect(u).not.toHaveProperty('bibleBooks');
    });
});

describe('UpdateProjectUseCase — la nota de contexto se puede borrar', () => {
    it("'' y null viajan como null (el repositorio los borra); con texto, recortada", async () => {
        const repo = repoCon({});
        const uc = new UpdateProjectUseCase(repo as never);
        await uc.execute('p1', { contextNote: '   ' });
        expect(escrito(repo)).toEqual({ contextNote: null });
        await uc.execute('p1', { contextNote: null });
        expect(escrito(repo)).toEqual({ contextNote: null });
        await uc.execute('p1', { contextNote: ' Iglesia de 80 ' });
        expect(escrito(repo)).toEqual({ contextNote: 'Iglesia de 80' });
        // La nota sola no obliga a leer el proyecto.
        expect(repo.getProject).not.toHaveBeenCalled();
    });
});
