import { describe, it, expect } from 'vitest';
import { briefWithExclusions, excludedLast, exclusionFor, proposeExclusions, repetitionRuleFor, warnsRepeatedSource } from '../excludedSources';

/**
 * TP #6 (Santiago 3, 2026-10-07): el encuadre prohibía McCartney, Varner,
 * Ropes y Robertson, y «Extraer de mi biblioteca» recomendó esos cuatro.
 */
const tp5 = [
    { key: 'McCartney', previousPaperTitle: 'TP #5' },
    { key: 'Varner', previousPaperTitle: 'TP #5' },
    { key: 'Carson y Moo', previousPaperTitle: null },
];

describe('qué libro alcanza una exclusión', () => {
    it('REGRESIÓN: el libro de la biblioteca trae el autor completo y se reconoce', () => {
        expect(exclusionFor({ author: 'Dan G. McCartney' }, tp5)?.key).toBe('McCartney');
        expect(exclusionFor({ author: 'Varner, William' }, tp5)?.key).toBe('Varner');
    });

    it('por la clave de cita, sin acentos ni mayúsculas', () => {
        expect(exclusionFor({ citationKey: 'mccartney' }, tp5)?.key).toBe('McCartney');
        expect(exclusionFor({ citationKey: 'Martín' }, [{ key: 'Martin', previousPaperTitle: null }])?.key).toBe('Martin');
    });

    it('cualquier coautor; una clave de varios autores sólo alcanza a la obra de todos', () => {
        expect(exclusionFor({ author: 'Mark Dubis y William Varner' }, tp5)?.key).toBe('Varner');
        expect(exclusionFor({ author: 'D. A. Carson & Douglas J. Moo' }, tp5)?.key).toBe('Carson y Moo');
        expect(exclusionFor({ author: 'D. A. Carson' }, tp5)).toBeNull();
    });

    it('REGRESIÓN (revisión): sólo apellidos — un nombre de pila o un apellido sin su partícula no alcanzan', () => {
        const martin = [{ key: 'Martin', previousPaperTitle: null }];
        expect(exclusionFor({ author: 'Martin Dibelius' }, martin)).toBeNull();
        expect(exclusionFor({ author: 'Ralph P. Martin' }, martin)?.key).toBe('Martin');
        expect(exclusionFor({ author: 'Wallace M. Alston' }, [{ key: 'Wallace', previousPaperTitle: null }])).toBeNull();
        expect(exclusionFor({ author: 'David A. de Silva' }, [{ key: 'Silva', previousPaperTitle: null }])).toBeNull();
    });

    it('REGRESIÓN (revisión): la clave escrita de otra forma igual alcanza', () => {
        const de = (key: string) => [{ key, previousPaperTitle: null }];
        expect(exclusionFor({ author: 'Varner, William' }, de('William Varner'))).not.toBeNull();
        expect(exclusionFor({ author: 'Dan G. McCartney' }, de('McCartney, Dan'))).not.toBeNull();
        expect(exclusionFor({ author: 'deSilva' }, de('de Silva'))).not.toBeNull();
        expect(exclusionFor({ author: 'David A. de Silva' }, de('deSilva'))).not.toBeNull();
        expect(exclusionFor({ author: 'William Varner' }, de('Varner.'))).not.toBeNull();
        expect(exclusionFor({ author: 'Aland, Barbara; Aland, Kurt; Metzger, Bruce M. (eds.)' }, de('Metzger'))).not.toBeNull();
    });

    it('no confunde un apellido con parte de otro', () => {
        expect(exclusionFor({ author: 'Douglas J. Moo' }, [{ key: 'Mo', previousPaperTitle: null }])).toBeNull();
        expect(exclusionFor({ author: 'Peter H. Davids' }, tp5)).toBeNull();
        expect(exclusionFor({ author: 'Dan McCartney' }, [])).toBeNull();
        expect(exclusionFor({ author: 'Dan McCartney' }, null)).toBeNull();
    });
});

describe('las excluidas van al final, sin desordenar el resto', () => {
    it('conserva el orden relativo de cada grupo', () => {
        expect(excludedLast(['a', 'X1', 'b', 'X2', 'c'], s => s.startsWith('X'))).toEqual(['a', 'b', 'c', 'X1', 'X2']);
    });
});

describe('lo que se propone y lo que leen los pasos que redactan', () => {
    it('propone lo citado en la entrega anterior, con su título', () => {
        expect(proposeExclusions({
            paperId: 'p5', title: 'TP #5', passage: {} as never, createdAt: new Date(), citedSourceKeys: ['Ropes', 'Varner'],
        })).toEqual([
            // Sin el tipo de cada cita, se propone todo, como antes de A7.
            { key: 'Ropes', previousPaperTitle: 'TP #5', rule: 'exclude', sourceType: null, alternatives: [] },
            { key: 'Varner', previousPaperTitle: 'TP #5', rule: 'exclude', sourceType: null, alternatives: [] },
        ]);
        expect(proposeExclusions(null)).toEqual([]);
    });

    it('sin título, la propuesta nombra el pasaje (TP #7, #2 y #10: decía «trabajo anterior»)', () => {
        const [e] = proposeExclusions({
            paperId: 'p6', title: null, createdAt: new Date(), citedSourceKeys: ['Adamson'],
            passage: { bookId: 'JAS', chapterStart: 3, chapterEnd: 3, verseStart: 1, verseEnd: 12 },
        } as never, 'es');
        expect(e!.previousPaperTitle).toMatch(/3:1.?12/);
    });

    it('el encuadre lleva las exclusiones al final, en el idioma del trabajo', () => {
        const es = briefWithExclusions({ assignmentBrief: 'Cuatro preguntas.', excludedSources: tp5, displayLanguage: 'es' });
        // Adelante: un encuadre largo se recorta por el final.
        expect(es).toBe('Fuentes excluidas de este trabajo (no las cites ni te apoyes en ellas): McCartney, Varner, Carson y Moo.\n\nCuatro preguntas.');
        expect(briefWithExclusions({ assignmentBrief: null, excludedSources: tp5, displayLanguage: 'en' }))
            .toMatch(/^Sources excluded from this paper .*McCartney/);
    });

    it('sin exclusiones, el encuadre queda como estaba', () => {
        expect(briefWithExclusions({ assignmentBrief: 'X', excludedSources: [], displayLanguage: 'es' })).toBe('X');
        expect(briefWithExclusions({ assignmentBrief: null, excludedSources: null, displayLanguage: 'es' })).toBeNull();
    });
});

describe('una clave «et al.» (G)', () => {
    it('alcanza al primer autor, no a un apellido «al»', () => {
        const aland = [{ key: 'Aland et al.', previousPaperTitle: null }];
        expect(exclusionFor({ author: 'Aland, Barbara; Aland, Kurt' }, aland)).not.toBeNull();
        expect(exclusionFor({ author: 'Ahmad Al' }, aland)).toBeNull();
    });
});

/**
 * TP #8 (2026-10-21, fase 8a, A7): la regla del sílabo es sólo para los
 * comentarios. La propuesta traía Tuggy, NA28 y Robertson, y el fundador los
 * desmarcaba a mano cada semana (#1). La gramática se alterna por prudencia.
 */
describe('la regla de no repetir, por tipo de fuente', () => {
    const tp7 = {
        paperId: 'tp7', title: 'TP #7', passage: {} as never, createdAt: new Date(2026, 9, 14),
        citedSourceKeys: ['McCartney', 'NA28', 'Robertson', 'Ropes', 'Tuggy', 'Varner'],
        citedSourceTypes: {
            McCartney: ['commentary-expository'], NA28: ['critical-apparatus'], Robertson: ['grammar-syntax'],
            Ropes: ['commentary-critical'], Tuggy: ['lexicon-technical'], Varner: ['commentary-expository'],
        },
    } as const;
    const tp6 = {
        paperId: 'tp6', title: 'TP #6', passage: {} as never, createdAt: new Date(2026, 9, 7),
        citedSourceKeys: ['Adamson', 'Wallace', 'Tuggy'],
        citedSourceTypes: { Adamson: ['commentary-critical'], Wallace: ['grammar-syntax'], Tuggy: ['lexicon-technical'] },
    } as const;

    it('propone los comentarios y la gramática; el léxico y el texto base quedan libres', () => {
        const propuesta = proposeExclusions(tp7, 'es', { beforePrevious: tp6 });
        expect(propuesta.map(e => [e.key, e.rule])).toEqual([
            ['McCartney', 'exclude'], ['Robertson', 'alternate'], ['Ropes', 'exclude'], ['Varner', 'exclude'],
        ]);
    });

    it('la gramática sugiere la otra: Robertson la semana pasada, Wallace la anterior', () => {
        const robertson = proposeExclusions(tp7, 'es', { beforePrevious: tp6 }).find(e => e.key === 'Robertson')!;
        expect(robertson.alternatives).toEqual(['Wallace']);
        // Sin la entrega anterior a la anterior no hay a cuál volver.
        expect(proposeExclusions(tp7, 'es').find(e => e.key === 'Robertson')!.alternatives).toEqual([]);
    });

    it('no sugiere volver a la misma gramática si se usó las dos semanas', () => {
        const conRobertson = { ...tp6, citedSourceKeys: ['Robertson'], citedSourceTypes: { Robertson: ['grammar-syntax'] } } as const;
        expect(proposeExclusions(tp7, 'es', { beforePrevious: conRobertson }).find(e => e.key === 'Robertson')!.alternatives).toEqual([]);
    });

    it('dos obras con la misma clave: manda la regla más restrictiva (revisión de 8a)', () => {
        // La *Grammar* y las *Word Pictures* de Robertson, citadas como «Robertson».
        const ambas = { ...tp7, citedSourceKeys: ['Robertson'], citedSourceTypes: { Robertson: ['grammar-syntax', 'commentary-expository'] } } as const;
        expect(proposeExclusions(ambas, 'es')[0]!.rule).toBe('exclude');
    });

    it('la regla es configurable por tipo', () => {
        const todoLibre = { 'commentary-critical': 'free', 'commentary-expository': 'free', 'grammar-syntax': 'free' } as const;
        expect(proposeExclusions(tp7, 'es', { policy: todoLibre })).toEqual([]);
    });

    it('un tipo sin regla es libre, y una cita sin tipo se excluye', () => {
        expect(repetitionRuleFor('historical-background')).toBe('free');
        expect(repetitionRuleFor('commentary-critical')).toBe('exclude');
        expect(repetitionRuleFor('grammar-syntax')).toBe('alternate');
        expect(repetitionRuleFor(null)).toBe('exclude');
    });
});

describe('el aviso de «la citaste la vez pasada» en la fila de la fuente (#15)', () => {
    const previa = { paperId: 'tp7', title: 'TP #7', passage: {} as never, createdAt: new Date(), citedSourceKeys: ['Ropes', 'Tuggy'] };
    const ropes = { citationKey: 'Ropes', sourceType: 'commentary-critical' as const };

    it('avisa un comentario repetido mientras las exclusiones no se confirmaron', () => {
        expect(warnsRepeatedSource(ropes, null, previa)).toBe(true);
    });

    it('calla si el estudiante ya confirmó las exclusiones y la dejó fuera', () => {
        expect(warnsRepeatedSource(ropes, [{ key: 'Varner', previousPaperTitle: 'TP #7' }], previa)).toBe(false);
        expect(warnsRepeatedSource(ropes, [], previa)).toBe(false);
    });

    it('calla para un léxico, que se puede repetir', () => {
        expect(warnsRepeatedSource({ citationKey: 'Tuggy', sourceType: 'lexicon-technical' }, null, previa)).toBe(false);
    });

    it('calla si no se citó la vez pasada o no tiene clave', () => {
        expect(warnsRepeatedSource({ citationKey: 'Mayor', sourceType: 'commentary-critical' }, null, previa)).toBe(false);
        expect(warnsRepeatedSource({ citationKey: null, sourceType: 'commentary-critical' }, null, previa)).toBe(false);
    });
});
