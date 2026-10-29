import { describe, it, expect } from 'vitest';
import {
    cleanProjectWorkTypes,
    cleanNoRepeatSourceTypes,
    resolveProjectCharge,
} from '../../../entities/AIProject';
import {
    proposeExclusions,
    repetitionPolicyForWorkType,
    DEFAULT_SOURCE_REPETITION_POLICY,
} from '../excludedSources';
import { deliveriesBefore, summariesOfSameWorkType, previousDeliveries } from '../sourceMemory';
import {
    fillBriefSlots,
    joinSourceKeys,
    passagesNamedInBrief,
    replaceBriefPassages,
    stalePassagesInBrief,
} from '../assignmentBriefSlots';
import { initialSourcesFromBibliography, sourceIdentitiesFromStudies, type ProjectBibliographyEntry } from '../projectBibliography';
import { parsePassageReference, buildPassageReference, versesInChapter, findPassageInText } from '../../../bible/canon/passage-reference';

/**
 * TP #9 (Santiago 4:11-17, NT785, «TP Semanal»): lo que el fundador tuvo que
 * hacer a mano al crear el trabajo desde el curso.
 */
const stg4_11 = { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 11, verseEnd: 17 } as const;

describe('B11 · el tipo de trabajo guarda qué tipos de fuente no se repiten', () => {
    it('se guarda la lista limpia: solo tipos del catálogo, sin repetir', () => {
        expect(cleanNoRepeatSourceTypes(['commentary-critical', 'commentary-critical', 'basura', 3])).toEqual(['commentary-critical']);
        expect(cleanNoRepeatSourceTypes(undefined)).toBeNull();
        // `[]` es una decisión («todo se repite»), no la ausencia.
        expect(cleanNoRepeatSourceTypes([])).toEqual([]);
        const [t] = cleanProjectWorkTypes([{ id: 'tp', label: 'TP Semanal', noRepeatSourceTypes: ['textual-commentary', 'nada' as never] }]);
        expect(t!.noRepeatSourceTypes).toEqual(['textual-commentary']);
        const [sin] = cleanProjectWorkTypes([{ id: 'tp', label: 'TP Semanal' }]);
        expect('noRepeatSourceTypes' in sin!).toBe(false);
    });

    it('no viaja al estudio como parte del encargo', () => {
        const c = resolveProjectCharge({ workTypes: [{ id: 'tp', label: 'TP', noRepeatSourceTypes: ['commentary-critical'], exegeticalMethod: 'mixed' }] }, 'tp');
        expect(c).toEqual({ exegeticalMethod: 'mixed' });
    });
});

describe('B15 + B16 · la propuesta excluye SOLO los tipos que el curso no deja repetir', () => {
    // El TP #8 (Santiago 4:1-10) citó esto.
    const tp8 = {
        paperId: 'tp8', title: 'Santiago 4:1-10', passage: {} as never, createdAt: new Date(2026, 9, 21),
        citedSourceKeys: ['Adamson', 'Mayor', 'Metzger', 'NA28', 'Wallace'],
        citedSourceTypes: {
            Adamson: ['commentary-critical'], Mayor: ['commentary-expository'], Metzger: ['textual-commentary'],
            NA28: ['critical-apparatus'], Wallace: ['grammar-syntax'],
        },
    } as const;

    it('con «comentarios» marcado: Adamson, Mayor y Metzger; Wallace y NA28 quedan libres', () => {
        const { policy, origin } = repetitionPolicyForWorkType({ noRepeatSourceTypes: ['commentary-critical', 'commentary-expository', 'textual-commentary'] });
        expect(origin).toBe('workType');
        const propuesta = proposeExclusions(tp8, 'es', { policy });
        expect(propuesta.map(e => [e.key, e.rule, e.sourceType])).toEqual([
            ['Adamson', 'exclude', 'commentary-critical'],
            ['Mayor', 'exclude', 'commentary-expository'],
            ['Metzger', 'exclude', 'textual-commentary'],
        ]);
    });

    it('sin lista, la regla general; Metzger (comentario textual) también entra', () => {
        const { policy, origin } = repetitionPolicyForWorkType({});
        expect(origin).toBe('default');
        expect(policy).toBe(DEFAULT_SOURCE_REPETITION_POLICY);
        expect(proposeExclusions(tp8, 'es', { policy }).map(e => e.key)).toContain('Metzger');
    });

    it('con la lista vacía no se propone nada, ni las claves sin tipo (revisión)', () => {
        const conSinTipo = { ...tp8, citedSourceKeys: [...tp8.citedSourceKeys, 'Dibelius'] };
        expect(proposeExclusions(conSinTipo, 'es', repetitionPolicyForWorkType({ noRepeatSourceTypes: [] }))).toEqual([]);
        // Con una lista, la clave sin tipo se sigue proponiendo, por si acaso.
        const conLista = repetitionPolicyForWorkType({ noRepeatSourceTypes: ['commentary-critical'] });
        expect(proposeExclusions(conSinTipo, 'es', conLista).map(e => e.key)).toEqual(['Adamson', 'Dibelius']);
    });
});

describe('B4 · la entrega anterior es la del mismo tipo de trabajo', () => {
    const s = (id: string, dia: number, tipo: string | null, citas: string[]) => ({
        id, title: id, passage: {} as never, createdAt: new Date(2026, 9, dia), citedSourceKeys: citas, projectWorkTypeId: tipo,
    });
    const tp8 = s('tp8', 21, 'tp', ['Adamson']);
    const ensayo = s('ensayo', 24, 'ens', ['Moo']);
    const suelto = s('tp7', 14, null, ['Ropes']);

    it('el TP se compara con el TP anterior, no con el ensayo entregado en medio', () => {
        const lista = summariesOfSameWorkType([tp8, ensayo, suelto], { projectWorkTypeId: 'tp' }, null);
        expect(deliveriesBefore(lista, new Date(2026, 9, 28), 1)[0]!.paperId).toBe('tp8');
    });

    it('cuenta un TP suelto que el calendario vincula a una entrada de ese tipo', () => {
        const lista = summariesOfSameWorkType([ensayo, suelto], { projectWorkTypeId: 'tp' }, { courseSchedule: [{ workTypeId: 'tp', paperId: 'tp7' }] });
        expect(lista.map(x => x.id)).toEqual(['tp7']);
    });

    it('sin ninguno del tipo, se mira toda la lista (no se pierde la entrega anterior)', () => {
        const lista = summariesOfSameWorkType([ensayo, suelto], { projectWorkTypeId: 'tp' }, null);
        expect(lista).toHaveLength(2);
    });

    it('revisión: al crear, la primera entrega de un tipo no toma un trabajo de otro tipo', () => {
        const lista = summariesOfSameWorkType([ensayo, suelto], { projectWorkTypeId: 'tp' }, null, { fallbackToAll: false });
        expect(deliveriesBefore(lista, new Date(2026, 9, 28), 1)).toEqual([]);
    });

    it('deliveriesBefore y previousDeliveries eligen igual', () => {
        const actual = s('tp9', 28, 'tp', []);
        expect(previousDeliveries([tp8, ensayo, actual], 'tp9', 1)[0]!.paperId)
            .toBe(deliveriesBefore([tp8, ensayo], actual.createdAt, 1)[0]!.paperId);
    });
});

describe('B5 + B4 · los huecos del encargo se llenan por entrega', () => {
    const plantilla = 'Trabajo práctico sobre [PASAJE]. Prohibido citar [FUENTES DE LA SEMANA ANTERIOR]: el plan de estudios no permite repetir.';

    it('llena el pasaje y las fuentes de la entrega anterior', () => {
        const r = fillBriefSlots(plantilla, { passage: 'Santiago 4:11-17', previousSources: ['Adamson', 'Mayor', 'Metzger'], language: 'es' });
        expect(r.text).toBe('Trabajo práctico sobre Santiago 4:11-17. Prohibido citar Adamson, Mayor y Metzger: el plan de estudios no permite repetir.');
        expect(r.filled).toEqual(['passage', 'previousSources']);
        expect(r.pending).toEqual([]);
    });

    it('sin dato, el hueco queda escrito y se avisa', () => {
        const r = fillBriefSlots(plantilla, { passage: null, previousSources: null, language: 'es' });
        expect(r.text).toBe(plantilla);
        expect(r.pending).toEqual(['passage', 'previousSources']);
        // Hubo entrega anterior pero nada quedó prohibido: tampoco se inventa «ninguna».
        expect(fillBriefSlots(plantilla, { passage: 'x', previousSources: [], language: 'es' }).pending).toEqual(['previousSources']);
    });

    it('acepta el hueco sin mayúsculas y en inglés', () => {
        expect(fillBriefSlots('On [passage]; avoid [Previous Week Sources].', { passage: 'James 4:11-17', previousSources: ['Mayor', 'Adamson'], language: 'en' }).text)
            .toBe('On James 4:11-17; avoid Mayor and Adamson.');
        expect(joinSourceKeys(['Wallace'], 'es')).toBe('Wallace');
    });

    it('detecta el pasaje que quedó fijo del TP anterior, no los versículos de las preguntas', () => {
        const encargo = 'Trabajo sobre Santiago 4:1-10. 1. ¿Cómo funciona δυνάμενος (Stg. 4:12)? 2. Ver Stg 4:13–15.';
        const fijos = stalePassagesInBrief(encargo, stg4_11);
        expect(fijos.map(m => m.text)).toEqual(['Santiago 4:1-10']);
        expect(replaceBriefPassages(encargo, fijos, '[PASAJE]')).toBe('Trabajo sobre [PASAJE]. 1. ¿Cómo funciona δυνάμενος (Stg. 4:12)? 2. Ver Stg 4:13–15.');
        // Un versículo suelto de otro lugar es una referencia cruzada, no el pasaje de otra entrega.
        expect(stalePassagesInBrief('Compara con Stg. 1:5.', stg4_11)).toEqual([]);
        // El pasaje del trabajo, escrito, no es «fijo».
        expect(stalePassagesInBrief('Trabajo sobre Santiago 4:11-17.', stg4_11)).toEqual([]);
        expect(passagesNamedInBrief('Romanos 3:1-4', 'JAS')).toEqual([]);
    });

    it('revisión: un capítulo entero no cuenta, y los rangos legítimos son candidatos (se eligen uno a uno)', () => {
        const encargo = 'Escriba sobre Santiago 4:1-10 en el contexto de Santiago 4 y a la luz de Santiago 1:19-21.';
        const fijos = stalePassagesInBrief(encargo, stg4_11);
        expect(fijos.map(m => m.text)).toEqual(['Santiago 4:1-10', 'Santiago 1:19-21']);
        // Tampoco un tramo de capítulos enteros.
        expect(stalePassagesInBrief('Lea Santiago 1-2 antes de empezar.', stg4_11)).toEqual([]);
        // Reemplazar solo el elegido.
        expect(replaceBriefPassages(encargo, [fijos[0]!], '[PASAJE]'))
            .toBe('Escriba sobre [PASAJE] en el contexto de Santiago 4 y a la luz de Santiago 1:19-21.');
    });

    it('revisión: «1 Juan 4:7-12» no es Juan 4:7-12', () => {
        const jn3 = { bookId: 'JHN', chapterStart: 3, chapterEnd: 3, verseStart: 16, verseEnd: 21 } as const;
        for (const otro of ['Compare 1 Juan 4:7-12.', 'Compare I Juan 4:7-12.', 'Compare Primera de Juan 4:7-12.', 'Compare 1 John 4:7-12.', 'Ver 2 Jn 1:4-6.']) {
            expect(stalePassagesInBrief(otro, jn3)).toEqual([]);
        }
        expect(stalePassagesInBrief('Sobre Juan 4:7-12.', jn3).map(m => m.text)).toEqual(['Juan 4:7-12']);
    });
});

describe('B13 + B14 · las fuentes heredadas llegan con tipo y clave de cita', () => {
    const ficha: ProjectBibliographyEntry = { id: 'b1', title: 'The Epistle of James', author: 'Adamson, James B.', resourceId: 'r-adamson', weight: 'recommended', decision: 'approved', origins: ['studies'] };
    const usadas = sourceIdentitiesFromStudies([
        { createdAt: new Date(2026, 9, 14), sources: [{ sourceLibraryResourceId: 'r-adamson', sourceType: 'commentary-expository', citationKey: 'Adamson (viejo)' }] },
        { createdAt: new Date(2026, 9, 21), sources: [{ sourceLibraryResourceId: 'r-adamson', sourceType: 'commentary-critical', citationKey: null }] },
    ]);

    it('sin tipo en la ficha ni en la biblioteca, el que le dio el trabajo anterior del curso', () => {
        const [f] = initialSourcesFromBibliography([ficha], () => null, () => null, { usedBefore: id => usadas.get(id) });
        expect(f!.sourceType).toBe('commentary-critical');
        // La clave del más reciente que la tenía.
        expect(f!.citationKey).toBe('Adamson (viejo)');
    });

    it('sin uso anterior, la clave sale del autor', () => {
        const [f] = initialSourcesFromBibliography([ficha], () => 'commentary-critical', () => null, {});
        expect(f!.citationKey).toBe('Adamson');
        const [sinAutor] = initialSourcesFromBibliography([{ ...ficha, author: null }], () => null, () => null, {});
        expect('citationKey' in sinAutor!).toBe(false);
        expect(sinAutor!.sourceType).toBe('other');
    });
});

describe('B1 · el pasaje no acepta versículos que no existen', () => {
    it('Santiago 4 tiene 17 versículos', () => {
        expect(versesInChapter('JAS', 4)).toBe(17);
        const r = parsePassageReference('Santiago 4:11-19', { strictVerses: true });
        expect(r.ok).toBe(false);
        if (r.ok === false) {
            expect(r.error).toBe('verse-out-of-range');
            expect(r.limit).toEqual({ bookId: 'JAS', chapter: 4, verses: 17, verse: 19 });
        }
        expect(parsePassageReference('Santiago 4:11-17', { strictVerses: true }).ok).toBe(true);
        expect(buildPassageReference({ bookId: 'JAS', chapterStart: 4, verseStart: 18, verseEnd: 18 }, { strictVerses: true }).ok).toBe(false);
    });

    it('vale cualquiera de las dos numeraciones (Malaquías 3:24 del original, 4:6 del lector)', () => {
        const estricto = { strictVerses: true };
        expect(parsePassageReference('Malaquías 3:24', estricto).ok).toBe(true);
        expect(parsePassageReference('Malaquías 4:6', estricto).ok).toBe(true);
        expect(parsePassageReference('Malaquías 4:7', estricto).ok).toBe(false);
        // Ap 12:18 está en el NA28 (la RVR lo imprime como 13:1): revisión de B1.
        expect(parsePassageReference('Apocalipsis 12:18', estricto).ok).toBe(true);
        expect(parsePassageReference('3 Juan 15', estricto).ok).toBe(false);
        expect(parsePassageReference('3 Juan 1:15', estricto).ok).toBe(true);
    });

    it('lo GUARDADO y los encabezados de los libros se siguen leyendo como antes (sin estricto)', () => {
        // Una cadena guardada que se pasa del capítulo no se pierde en silencio.
        expect(parsePassageReference('Juan 1:52-2:30').ok).toBe(true);
        expect(buildPassageReference({ bookId: 'JAS', chapterStart: 4, verseStart: 18, verseEnd: 18 }).ok).toBe(true);
    });
});

describe('B7 · el pasaje de la entrada del calendario, aunque esté solo en el rótulo', () => {
    it('lee el pasaje del rótulo', () => {
        expect(findPassageInText('TP9 - Santiago 4:11-17')).toEqual(stg4_11);
        expect(findPassageInText('TP #10 · Stg 4:13 – 5:6')).toEqual({ bookId: 'JAS', chapterStart: 4, chapterEnd: 5, verseStart: 13, verseEnd: 6 });
        expect(findPassageInText('Entrega 1 Juan 3:1-3')?.bookId).toBe('1JN');
    });

    it('un rótulo sin pasaje (o con uno que no existe) no inventa nada', () => {
        expect(findPassageInText('TP #9')).toBeNull();
        expect(findPassageInText('TP 9 · vence 31 oct')).toBeNull();
        expect(findPassageInText('Santiago 4:11-19')).toBeNull();
        expect(findPassageInText(null)).toBeNull();
    });
});
