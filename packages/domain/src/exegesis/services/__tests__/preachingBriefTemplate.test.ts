import { describe, expect, it } from 'vitest';
import { PREACHING_BRIEF_TEMPLATE, briefGaps, buildPreachingBrief, preachingBriefTemplateFor } from '../preachingBriefTemplate';
import { grammarSearchKeys } from '../grammarSearchKeys';
import { PREACHING_STUDY_RUBRIC } from '../../entities/preachingStudyRubric';
import { DEFAULT_TMS_EXEGETICAL_RUBRIC } from '../../entities/PaperRubric';

describe('briefGaps — qué le falta al encuadre para que el sistema trabaje', () => {
    it('el encuadre vacío es la única carencia que se reporta sola', () => {
        // Los seis sermones de la serie de Jonás están así.
        expect(briefGaps('')).toEqual(['empty']);
        expect(briefGaps(null)).toEqual(['empty']);
        expect(briefGaps('   \n  ')).toEqual(['empty']);
    });

    it('la plantilla recién copiada se reporta sin llenar Y sin llaves', () => {
        expect(briefGaps(PREACHING_BRIEF_TEMPLATE)).toEqual(['template-unfilled', 'no-search-keys']);
    });

    it('un encuadre sin forma del original deja a las gramáticas sin entrada', () => {
        // Medido en Jonás 4: Ortiz, Barrick y Farfan no nombran el pasaje en
        // ninguna página. Sin una forma hebrea, no tienen por dónde entrar.
        expect(briefGaps('Estudio de Jonás 4:1-4 para predicar el domingo.'))
            .toEqual(['no-search-keys']);
    });

    it('con una forma del original nombrada, ya no falta nada', () => {
        const lleno = `PASAJE Y UNIDAD
Jonás 4:1-4, cuarta escena.

PREGUNTAS DEL TEXTO
1. ¿Qué aporta el hitpael de וַיִּתְפַּלֵּל frente a la oración del capítulo 2?`;
        expect(briefGaps(lleno)).toEqual([]);
    });

    it('nombrar sólo la categoría gramatical también alcanza', () => {
        // El léxico entra por lema, pero la gramática entra por categoría.
        expect(briefGaps('¿Cómo funciona el infinitivo absoluto en 4:4?')).toEqual([]);
    });

    it('borrar el texto de ayuda pero dejar los corchetes no es llenarlo', () => {
        expect(briefGaps('PREGUNTAS DEL TEXTO\n[completar esto más adelante]\n1. el hitpael'))
            .toContain('template-unfilled');
    });
});

describe('la plantilla le da al sistema lo que necesita', () => {
    it('nombra el destino, que es lo que cambia el formato y la extensión', () => {
        expect(PREACHING_BRIEF_TEMPLATE).toContain('predicación expositiva');
        expect(PREACHING_BRIEF_TEMPLATE).toContain('NO es un trabajo académico');
    });

    it('pide explícitamente la forma hebrea o griega, y dice por qué', () => {
        // Sin ese porqué, el bloque se llena con preguntas en castellano y las
        // gramáticas siguen sin entrada.
        expect(PREACHING_BRIEF_TEMPLATE).toContain('forma hebrea o griega');
        expect(PREACHING_BRIEF_TEMPLATE).toContain('no se indexan por pasaje');
    });

    it('la forma de cita ya NO se pide a mano: la aporta el bloque generado', () => {
        // Salía de la rúbrica y estaba escrita en la plantilla como si el
        // autor tuviera que copiarla. Ahora la escribe el sistema.
        expect(PREACHING_BRIEF_TEMPLATE).not.toContain('(Apellido, p. N)');
        expect(buildPreachingBrief('Citas parentéticas (Apellido, p. N).'))
            .toContain('(Apellido, p. N)');
    });
});

describe('la rúbrica de predicación NO es una rúbrica más floja', () => {
    it('invierte el orden de las fuentes en el versículo', () => {
        // Académico: el crítico ancla. Predicación: el expositivo ancla,
        // porque sigue el flujo del argumento, que es lo que se predica.
        const verso = PREACHING_STUDY_RUBRIC.structuralExpectations.find(e => e.section === 'verse')!;
        expect(verso.emphasizedTypes[0]).toBe('commentary-expository');
        const academico = DEFAULT_TMS_EXEGETICAL_RUBRIC.structuralExpectations.find(e => e.section === 'verse')!;
        expect(academico.emphasizedTypes[0]).not.toBe('commentary-expository');
    });

    it('baja la extensión y sólo la extensión', () => {
        // Un estudio de predicación no se entrega, se usa.
        expect(PREACHING_STUDY_RUBRIC.expectedLength).toEqual({ unit: 'pages', min: 3, max: 5 });
        expect(DEFAULT_TMS_EXEGETICAL_RUBRIC.expectedLength!.min).toBeGreaterThan(5);
    });

    it('cita entre paréntesis: nadie lee notas al pie preparando un sermón', () => {
        expect(PREACHING_STUDY_RUBRIC.formatting!.citationForm).toBe('parenthetical');
    });

    it('exige una voz que siga el argumento y otra que discuta', () => {
        const tipos = PREACHING_STUDY_RUBRIC.sourceRequirements.map(r => r.sourceType);
        expect(tipos).toEqual(expect.arrayContaining(['commentary-expository', 'commentary-critical']));
        expect(PREACHING_STUDY_RUBRIC.sourceRequirements.every(r => r.minimum >= 1)).toBe(true);
    });

    it('un encuadre lleno con esta plantilla produce llaves de búsqueda reales', () => {
        const claves = grammarSearchKeys('¿Qué aporta el hitpael de וַיִּתְפַּלֵּל y el infinitivo absoluto de 4:4?');
        expect(claves.originalForms.length + claves.categories.length).toBeGreaterThan(0);
    });
});

/**
 * Pregunta del fundador: ¿encuadres por género, testamento o uno general? Uno
 * general, y sólo el bloque de preguntas cambia según el género.
 */
describe('preachingBriefTemplateFor — el bloque de preguntas según el género', () => {
    it('Jonás (narrativa) pide leer la escena y la cadena de wayyiqtol', () => {
        const t = preachingBriefTemplateFor('narrative');
        expect(t).toContain('wayyiqtol');
        expect(t).not.toContain('Este bloque lo llenas leyendo el pasaje');
    });

    it('una epístola pide el argumento y sus conectores', () => {
        expect(preachingBriefTemplateFor('epistle')).toContain('γάρ');
    });

    it('lo demás no cambia: pasaje, destino, lo resuelto', () => {
        const t = preachingBriefTemplateFor('narrative');
        for (const bloque of ['PASAJE Y UNIDAD', 'DESTINO', 'LO QUE TIENE QUE QUEDAR RESUELTO', 'FUENTES Y FORMATO']) {
            expect(t).toContain(bloque);
        }
    });

    it('sigue siendo una plantilla sin llenar, con su lista numerada', () => {
        const t = preachingBriefTemplateFor('poetry');
        expect(briefGaps(t)).toContain('template-unfilled');
        expect(t).toMatch(/\n1\.\n2\.\n/);
    });

    it('sin género (o mixto), la de siempre', () => {
        expect(preachingBriefTemplateFor()).toBe(PREACHING_BRIEF_TEMPLATE);
        expect(preachingBriefTemplateFor('mixed')).toBe(PREACHING_BRIEF_TEMPLATE);
    });

    it('buildPreachingBrief usa el género', () => {
        expect(buildPreachingBrief('FUENTES', 'prophecy')).toContain('oráculo');
    });
});
