import { describe, it, expect } from 'vitest';
import { buildSermonDraftPrompt, buildRegeneratePointPrompt } from '../prompts-generator';
import type { HomileticalAnalysis, GenerationRules, CitationManifest } from '@dosfilos/domain';

const baseAnalysis: HomileticalAnalysis = {
    exegeticalStudy: {
        passage: 'Juan 3:16',
        context: { historical: 'h', literary: 'l', audience: 'a' },
        keyWords: [],
        exegeticalProposition: 'ep',
        pastoralInsights: [],
    },
    homileticalApproach: 'temático',
    contemporaryApplication: [],
    homileticalProposition: 'hp',
    outline: { mainPoints: [{ title: 'I', description: 'd', scriptureReferences: [] }] },
};

const baseRules: GenerationRules = { tone: 'pastoral' };

describe('buildSermonDraftPrompt — paper context preservation (T3 #16 Fase 1)', () => {
    it('omits the paper context block when rules.paperContext is undefined', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, baseRules);
        expect(prompt).not.toContain('CONTEXTO DE ORIGEN — PAPER EXEGÉTICO');
        expect(prompt).not.toContain('--- BEGIN PAPER ---');
    });

    it('omits the block when paperContext.assembledMarkdown is empty or whitespace', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, {
            ...baseRules,
            paperContext: { passage: 'Juan 3:16', assembledMarkdown: '   ' },
        });
        expect(prompt).not.toContain('CONTEXTO DE ORIGEN');
    });

    it('injects the paper passage, title, brief, and full assembled markdown', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, {
            ...baseRules,
            paperContext: {
                passage: '1 Pedro 2:11-17',
                title: 'Vivir como extranjeros',
                assignmentBrief: 'Sermón dominical, congregación reformada',
                assembledMarkdown: '# Paper completo\n\nAnálisis exegético del pasaje...',
            },
        });
        expect(prompt).toContain('CONTEXTO DE ORIGEN — PAPER EXEGÉTICO');
        expect(prompt).toContain('1 Pedro 2:11-17');
        expect(prompt).toContain('Vivir como extranjeros');
        expect(prompt).toContain('Sermón dominical, congregación reformada');
        expect(prompt).toContain('# Paper completo');
        expect(prompt).toContain('--- BEGIN PAPER ---');
        expect(prompt).toContain('--- END PAPER ---');
    });

    it('keeps the no-invented-citations anti-hallucination guidance in the paper block', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, {
            ...baseRules,
            paperContext: {
                passage: 'Juan 3:16',
                assembledMarkdown: '# Paper\n\ncontent',
            },
        });
        expect(prompt).toContain('NO inventes');
    });

    it('places the paper block above FASE 3 so the model attends to it first', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, {
            ...baseRules,
            paperContext: {
                passage: 'Juan 3:16',
                assembledMarkdown: '# Paper\n\ncontent',
            },
        });
        const paperIdx = prompt.indexOf('CONTEXTO DE ORIGEN');
        const fase3Idx = prompt.indexOf('FASE 3');
        expect(paperIdx).toBeGreaterThan(-1);
        expect(fase3Idx).toBeGreaterThan(paperIdx);
    });
});

describe('buildSermonDraftPrompt — Faculty context preservation (T3 #16 Fase 2)', () => {
    it('omits the Faculty block when facultyContext is undefined', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, baseRules);
        expect(prompt).not.toContain('CONTEXTO DE ORIGEN — FACULTAD');
        expect(prompt).not.toContain('Bosquejo aprobado en la facultad');
    });

    it('injects sessionTitle + outline (title / passage / proposition / points)', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, {
            ...baseRules,
            facultyContext: {
                sessionTitle: 'Estudio sobre 1 Pedro',
                outline: {
                    title: 'Vivir como extranjeros',
                    passage: '1 Pedro 2:11-17',
                    proposition: 'En 📖 1 Pedro 2:11-17 aprenderás a vivir con santidad ante el mundo.',
                    points: [
                        { title: 'Reconoce tu identidad', verses: 'vv. 11-12' },
                        { title: 'Somete tu voluntad', verses: 'vv. 13-15' },
                        { title: 'Honra a todos', verses: 'vv. 16-17' },
                    ],
                },
            },
        });
        expect(prompt).toContain('CONTEXTO DE ORIGEN — FACULTAD');
        expect(prompt).toContain('Estudio sobre 1 Pedro');
        expect(prompt).toContain('Vivir como extranjeros');
        expect(prompt).toContain('1 Pedro 2:11-17');
        expect(prompt).toContain('vivir con santidad ante el mundo');
        expect(prompt).toContain('I. Reconoce tu identidad (vv. 11-12)');
        expect(prompt).toContain('II. Somete tu voluntad (vv. 13-15)');
        expect(prompt).toContain('III. Honra a todos (vv. 16-17)');
        expect(prompt).toContain('NO cambies el título');
    });
});

describe('buildSermonDraftPrompt — project context preservation (T3 #16 Fase 2)', () => {
    it('omits the project block when projectContext is undefined', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, baseRules);
        expect(prompt).not.toContain('CONTEXTO DEL PROYECTO');
    });

    it('omits when contextNote is blank or whitespace', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, {
            ...baseRules,
            projectContext: { name: 'Serie Juan', contextNote: '   ' },
        });
        expect(prompt).not.toContain('CONTEXTO DEL PROYECTO');
    });

    it('injects project name + contextNote when present', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, {
            ...baseRules,
            projectContext: {
                name: 'Serie Juan',
                contextNote: 'Congregación reformada, 80 personas, nivel teológico medio-alto, énfasis pastoral en santificación.',
            },
        });
        expect(prompt).toContain('CONTEXTO DEL PROYECTO');
        expect(prompt).toContain('Serie Juan');
        expect(prompt).toContain('Congregación reformada');
        expect(prompt).toContain('nivel teológico medio-alto');
        expect(prompt).toContain('Adapta el tono');
    });

    it('stacks project + paper + faculty blocks when all three are present', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, {
            ...baseRules,
            projectContext: { name: 'Serie Juan', contextNote: 'Reformados' },
            paperContext: { passage: 'Juan 3:16', assembledMarkdown: '# Paper\n\ncontent' },
            facultyContext: {
                sessionTitle: 'Estudio',
                outline: {
                    title: 't', passage: 'p', proposition: 'pr',
                    points: [{ title: 'pt', verses: 'v' }],
                },
            },
        });
        const projectIdx = prompt.indexOf('CONTEXTO DEL PROYECTO');
        const paperIdx = prompt.indexOf('CONTEXTO DE ORIGEN — PAPER EXEGÉTICO');
        const facultyIdx = prompt.indexOf('CONTEXTO DE ORIGEN — FACULTAD');
        const fase3Idx = prompt.indexOf('FASE 3');
        expect(projectIdx).toBeGreaterThan(-1);
        expect(paperIdx).toBeGreaterThan(projectIdx);
        expect(facultyIdx).toBeGreaterThan(paperIdx);
        expect(fase3Idx).toBeGreaterThan(facultyIdx);
    });
});

describe('buildSermonDraftPrompt — narrative + verifiable anchor citation contract (ADR-031)', () => {
    const manifest: CitationManifest = {
        entries: [
            { sourceId: 'S1', title: 'Volvamos a la predicación Bíblica', author: 'Subukjian', page: '102', excerpt: 'La doctrina es el negocio del predicador.' },
            { sourceId: 'S2', title: 'Comentario de 2 Pedro', author: 'Schreiner', excerpt: 'El verbo denota una acción decisiva.' },
        ],
    } as CitationManifest;

    it('omits the citation contract block when the manifest is empty', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, baseRules, undefined, {
            entries: [],
        } as CitationManifest);
        expect(prompt).not.toContain('FUENTES DISPONIBLES PARA CITAR');
    });

    it('instructs BOTH narrative attribution AND a verifiable [Sn] anchor (ADR-031)', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, baseRules, undefined, manifest);
        expect(prompt).toContain('FUENTES DISPONIBLES PARA CITAR');
        expect(prompt).toContain('Atribución NARRATIVA');
        expect(prompt).toContain('Ancla verificable');
    });

    it('requires at least one citation per point and forbids inventing citations', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, baseRules, undefined, manifest);
        expect(prompt).toContain('Una cita por punto');
        expect(prompt).toContain('NUNCA inventes una cita');
        expect(prompt).toContain('grounding'); // fidelity-to-text rule
    });

    it('lists source identity (S-IDs + author/title) but NOT the verbatim excerpt (anti-recitation)', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, baseRules, undefined, manifest);
        expect(prompt).toContain('[S1]');
        expect(prompt).toContain('[S2]');
        expect(prompt).toContain('Subukjian');
        expect(prompt).toContain('ragSources');
        // The verbatim copyrighted excerpt must NOT be fed to the model
        // (it trips Gemini's RECITATION filter); it lives in the manifest/popover.
        expect(prompt).not.toContain('La doctrina es el negocio del predicador.');
        expect(prompt).toContain('PROHIBIDO reproducir texto');
    });
});

describe('buildSermonDraftPrompt — R3 paralelos canónicos del pastor (ADR-035)', () => {
    it('omite el bloque cuando no hay canonicalParallels', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, baseRules);
        expect(prompt).not.toContain('Paralelos canónicos marcados por el pastor');
    });

    it('inyecta los paralelos del pastor en el contexto del borrador', () => {
        const analysis: HomileticalAnalysis = {
            ...baseAnalysis,
            exegeticalStudy: {
                ...baseAnalysis.exegeticalStudy!,
                canonicalParallels: [
                    { reference: 'Proverbios 26:11', relevanceNote: 'el perro vuelve al vómito' },
                    { reference: 'Números 22-24', relevanceNote: 'Balaam' },
                ],
            },
        };
        const prompt = buildSermonDraftPrompt(analysis, baseRules);
        expect(prompt).toContain('Paralelos canónicos marcados por el pastor');
        expect(prompt).toContain('Proverbios 26:11');
        expect(prompt).toContain('Números 22-24');
    });
});

describe('buildSermonDraftPrompt — el bosquejo del pastor gobierna el borrador', () => {
    const conDirectivas: HomileticalAnalysis = {
        ...baseAnalysis,
        outline: {
            mainPoints: [
                {
                    title: 'I. Dios habla y revela su voluntad (vv. 1-2)',
                    description: 'El pasaje comienza…',
                    scriptureReferences: ['Jonás 1:1-2'],
                    pastorDirective: {
                        emphasis: 'Dios habla, pero su palabra no es sin propósito: habla para dirigir a su pueblo.',
                    },
                },
                {
                    title: 'II. El hombre desobedece (v. 3)',
                    description: 'La respuesta…',
                    scriptureReferences: ['Jonás 1:3a'],
                    pastorDirective: {
                        exegeticalNotes: ['"y pagando su pasaje": el hebreo personifica a la nave.'],
                    },
                },
            ],
        },
    };

    it('el bosquejo viaja ETIQUETADO, no como JSON crudo', () => {
        const prompt = buildSermonDraftPrompt(conDirectivas, baseRules);
        expect(prompt).toContain('▸ PUNTO 1: I. Dios habla');
        expect(prompt).toContain('Descripción: El pasaje comienza…');
        // El JSON crudo tapaba el trabajo del pastor entre llaves sin etiquetar.
        expect(prompt).not.toContain('"mainPoints":');
    });

    it('la directiva del pastor llega marcada como vinculante', () => {
        const prompt = buildSermonDraftPrompt(conDirectivas, baseRules);
        expect(prompt).toContain('⚑ ÉNFASIS DEL PASTOR (vinculante)');
        expect(prompt).toContain('no es sin propósito');
        expect(prompt).toContain('⚑ DEBE APARECER EN LA EXPOSICIÓN DE ESTE PUNTO (vinculante)');
        expect(prompt).toContain('personifica a la nave');
    });

    it('el contrato nombra QUÉ punto lleva cada forma de directiva', () => {
        const prompt = buildSermonDraftPrompt(conDirectivas, baseRules);
        expect(prompt).toContain('DIRECTIVAS DEL PASTOR — MÁXIMA PRECEDENCIA');
        expect(prompt).toContain('**ÉNFASIS (puntos 1)**');
        expect(prompt).toContain('**DEBE APARECER (puntos 2)**');
    });

    it('sin directivas NO emite el contrato: un bloque vacío es ruido que compite', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, baseRules);
        expect(prompt).not.toContain('DIRECTIVAS DEL PASTOR');
        expect(prompt).toContain('▸ PUNTO 1: I');
    });

    it('el límite anti-invención viaja con el contrato', () => {
        const prompt = buildSermonDraftPrompt(conDirectivas, baseRules);
        expect(prompt).toContain('No autoriza a afirmar lo que');
        expect(prompt).toContain('NO la refuerces con datos inventados');
    });
});

describe('buildRegeneratePointPrompt — el punto regenerado no puede desentonar', () => {
    const point = { point: 'II. El hombre desobedece (v. 3)', scriptureReferences: ['Jonás 1:3a'] };
    const homileticsResult: HomileticalAnalysis = {
        ...baseAnalysis,
        outline: {
            mainPoints: [
                { title: 'I. Dios habla (vv. 1-2)', description: 'd', scriptureReferences: [] },
                {
                    title: 'II. El hombre desobedece (v. 3)',
                    description: 'd',
                    scriptureReferences: ['Jonás 1:3a'],
                    application: 'Reconoce esta semana dónde estás huyendo de una orden clara.',
                    pastorDirective: {
                        emphasis: 'Mostrar con ejemplos bíblicos cómo hombres se hicieron necios resistiendo a Dios.',
                        exegeticalNotes: ['"y pagando su pasaje": el hebreo personifica a la nave.'],
                    },
                },
            ],
        },
    };
    const ctx = { sermonTitle: 'Huir de Dios', homileticalProposition: 'hp', homileticsResult };

    it('lleva la voz del predicador: sin ella el punto desentona con el resto del sermón', () => {
        const prompt = buildRegeneratePointPrompt(point, {
            tone: 'pastoral',
            personalization: {
                illustrations: 'Cuando se estrenó LOST, millones nos obsesionamos con los misterios de la isla.',
                pastoralEmphasis: 'Que reconozcan que es mejor obedecer a Dios.',
            },
        } as GenerationRules, ctx);
        expect(prompt).toContain('VOZ DEL PREDICADOR');
        expect(prompt).toContain('LOST');
        expect(prompt).toContain('ÉNFASIS PASTORAL');
    });

    it('lleva el registro del sermón, y describe a quien ESCUCHA, no a quien predica', () => {
        const cotidiano = buildRegeneratePointPrompt(point, { audienceRigor: 'beginner' } as GenerationRules, ctx);
        expect(cotidiano).toContain('Registro COTIDIANO — congregación general');
        const tecnico = buildRegeneratePointPrompt(point, { audienceRigor: 'seminary' } as GenerationRules, ctx);
        expect(tecnico).toContain('Registro TÉCNICO — congregación con formación teológica');
        // El encabezado anunciaba la audiencia y el cuerpo describía al
        // predicador: dos ejes distintos en la misma regla.
        expect(cotidiano).not.toContain('Predicador sin formación');
        expect(tecnico).not.toContain('Predicador con formación');
    });

    it('encuentra la directiva del pastor para ESTE punto, no la del vecino', () => {
        const prompt = buildRegeneratePointPrompt(point, {} as GenerationRules, ctx);
        expect(prompt).toContain('DIRECTIVAS DEL PASTOR PARA ESTE PUNTO');
        expect(prompt).toContain('personifica a la nave');
        expect(prompt).toContain('hombres se hicieron necios');
        // La del punto I no debe filtrarse como directiva de éste.
        expect(prompt).not.toContain('I. Dios habla (vv. 1-2)\n   ⚑');
    });

    it('desarrolla la aplicación YA APROBADA, no inventa dos nuevas', () => {
        const prompt = buildRegeneratePointPrompt(point, {} as GenerationRules, ctx);
        expect(prompt).toContain('dónde estás huyendo de una orden clara');
        expect(prompt).toContain('no la reemplaces por otra tuya');
        // La versión vieja pedía "al menos 2 implicaciones prácticas", contra la
        // regla vigente de UNA por punto.
        expect(prompt).not.toContain('2 implicaciones');
        expect(prompt).toContain('TEXTO → PUNTO →');
    });

    it('la cita de autoridad es OPCIONAL y prohíbe inventarla', () => {
        const prompt = buildRegeneratePointPrompt(point, {} as GenerationRules, ctx);
        // Exigir una cita es exactamente cómo se fabrica una falsa.
        expect(prompt).not.toContain('5. Una cita de autoridad');
        expect(prompt).toContain('OPCIONAL, null por defecto');
        expect(prompt).toContain('PROHIBIDO');
        expect(prompt).toContain('destruye credibilidad');
    });

    it('sin directiva no emite el bloque vinculante', () => {
        const sinDirectiva = buildRegeneratePointPrompt(
            { point: 'I. Dios habla (vv. 1-2)' },
            {} as GenerationRules,
            ctx,
        );
        expect(sinDirectiva).not.toContain('DIRECTIVAS DEL PASTOR PARA ESTE PUNTO');
    });
});

describe('buildSermonDraftPrompt — la ilustración del pastor ABRE el sermón', () => {
    const conAnecdota = {
        ...baseRules,
        pastoralSeed: {
            pastoralAnecdote: 'Cuando se estrenó LOST, millones nos obsesionamos con los misterios de la isla.',
            observations: [],
            wordStudies: [],
            parallels: [],
        },
    } as GenerationRules;

    it('la anécdota del Paso 8 va primero, antes del contexto histórico', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, conAnecdota);
        expect(prompt).toContain('ILUSTRACIÓN DE APERTURA');
        const orden = prompt.match(/Orden de las secciones: (.+)/)?.[1] ?? '';
        expect(orden.indexOf('Ilustración de Apertura')).toBeLessThan(orden.indexOf('Contexto Histórico'));
    });

    it('prohíbe reciclarla dentro de un punto: cada punto genera la suya', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, conAnecdota);
        expect(prompt).toContain('NO la repitas en ningún punto del cuerpo');
        expect(prompt).toContain('se genera DESDE ese punto');
    });

    it('sin anécdota, la introducción no anuncia una sección que no existirá', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, baseRules);
        expect(prompt).not.toContain('ILUSTRACIÓN DE APERTURA');
        expect(prompt).not.toContain('Ilustración de Apertura');
    });
});

describe('buildSermonDraftPrompt — orientación al libro sólo si el sermón lo abre', () => {
    const abre = { ...baseAnalysis, exegeticalStudy: { ...baseAnalysis.exegeticalStudy, passage: 'Jonás 1:1-3' } } as HomileticalAnalysis;
    const medio = { ...baseAnalysis, exegeticalStudy: { ...baseAnalysis.exegeticalStudy, passage: 'Jonás 3:1-5' } } as HomileticalAnalysis;

    it('en Jonás 1:1-3 pide ubicar el libro entero, anclado en el canon', () => {
        const prompt = buildSermonDraftPrompt(abre, baseRules);
        expect(prompt).toContain('EL LIBRO DE UN VISTAZO');
        expect(prompt).toContain('divisiones más reconocidas');
        expect(prompt).toContain('historia de la redención');
        // Lo que pide es dato BÍBLICO, no reconstrucción académica: qué otro
        // pasaje habla del libro, y quién más profetiza en el mismo escenario.
        expect(prompt).toContain('ANCLA EN EL CANON');
        expect(prompt).toContain('2 Reyes 14:25');
        expect(prompt).toContain('Nahúm también profetiza');
    });

    it('en Jonás 3:1-5 NO la pide: en medio de una serie es relleno', () => {
        expect(buildSermonDraftPrompt(medio, baseRules)).not.toContain('EL LIBRO DE UN VISTAZO');
    });

    it('PROHÍBE abrir un debate que el sermón no va a cerrar', () => {
        // Una versión anterior de esta regla pedía "da el rango y nombra que hay
        // discusión". El modelo obedeció y escribió "algunos estudiosos debaten
        // su fecha" — académicamente honesto, pastoralmente equivocado: plantea
        // una duda ante la congregación que nadie va a arbitrar y que se queda
        // con ellos el resto del sermón. Ese foro es el paper, no el púlpito.
        const prompt = buildSermonDraftPrompt(abre, baseRules);
        expect(prompt).toContain('NO ABRAS DEBATES QUE NO VAS A CERRAR');
        expect(prompt).toContain('algunos estudiosos debaten');
        expect(prompt).toContain('PROHIBIDO');
        // Y la salida cuando no hay respuesta simple sigue siendo omitir, no
        // inventar: un párrafo más corto es mejor que un dato fabricado.
        expect(prompt).toContain('OMITE ese punto');
    });
});

describe('buildSermonDraftPrompt — el texto se lee de pie, en voz alta', () => {
    it('exige párrafos cortos con ancla para reencontrar el lugar', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, baseRules);
        expect(prompt).toContain('máximo 3 oraciones');
        expect(prompt).toContain('ANCLA AL INICIO DE CADA PÁRRAFO');
        expect(prompt).toContain('REENCONTRAR');
    });
});

describe('buildSermonDraftPrompt — el pastor decide cuántas implicaciones', () => {
    const conDos = (application: string): HomileticalAnalysis => ({
        ...baseAnalysis,
        outline: { mainPoints: [{ title: 'I. Dios habla', description: 'd', scriptureReferences: [], application }] },
    }) as HomileticalAnalysis;

    it('dos bloques separados por línea en blanco llegan numerados', () => {
        const prompt = buildSermonDraftPrompt(
            conDos('Vive consciente de su dirección.\n\nLee tu Biblia y ora.'),
            baseRules,
        );
        expect(prompt).toContain('Aplicaciones aprobadas por el pastor (2');
        expect(prompt).toContain('1. Vive consciente de su dirección.');
        expect(prompt).toContain('2. Lee tu Biblia y ora.');
    });

    it('un solo bloque sigue siendo una aplicación, sin numerar', () => {
        const prompt = buildSermonDraftPrompt(conDos('Reconoce dónde estás huyendo.'), baseRules);
        expect(prompt).toContain('Aplicación aprobada por el pastor: Reconoce dónde estás huyendo.');
        expect(prompt).not.toContain('Aplicaciones aprobadas');
    });

    it('la instrucción pide UNA implicación por aplicación aprobada, no una fija', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, baseRules);
        expect(prompt).toContain('UNA ENTRADA POR CADA APLICACIÓN APROBADA');
        expect(prompt).toContain('No las fusiones');
    });
});

describe('buildSermonDraftPrompt — las referencias cruzadas tienen que cruzar', () => {
    it('prohíbe repetir el pasaje predicado y pide de 2 a 3 de otros libros', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, baseRules);
        expect(prompt).toContain('CRUCEN a OTROS');
        expect(prompt).toContain('PROHIBIDO usar el pasaje que se está predicando');
        expect(prompt).toContain('Tampoco cuenta otro capítulo del MISMO libro');
        expect(prompt).toContain('CONSISTENTE CON EL');
    });
});

describe('buildSermonDraftPrompt — la transición lleva UN solo rótulo', () => {
    it('pide SÓLO el puente retórico: la proposición y los puntos se ensamblan', () => {
        // El formato anterior decía `[Proposición, tal cual, como frase]`. Un
        // corchete es una invitación a escribir, no a copiar — y el modelo puso
        // un título inventado donde iba la proposición que el pastor aprobó.
        const prompt = buildSermonDraftPrompt(baseAnalysis, baseRules);
        expect(prompt).toContain('SÓLO la frase de transición');
        expect(prompt).toContain('NO escribas la proposición ni la lista de puntos');
        expect(prompt).toContain('copiadas palabra por palabra');
        expect(prompt).not.toContain('**Recordatorio:**');
    });

    it('los campos ya no repiten su propia etiqueta', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, baseRules);
        expect(prompt).not.toContain('"**Ilustración:** [Título]');
        expect(prompt).not.toContain('**Cita de Autoridad:**\\n\\n>');
    });
});

describe('buildSermonDraftPrompt — el dato léxico no es el comentario del pastor', () => {
    const conAnalisis = {
        ...baseRules,
        pastoralSeed: {
            observations: [],
            parallels: [],
            wordStudies: [
                {
                    word: 'לִבְרֹחַ',
                    reference: 'Jonás 1:3',
                    discovery: 'El acto de huir implica que Jonás entendió lo que Dios quería.',
                    semanticRange: ['huir', 'escapar', 'ponerse a salvo'],
                    useInVerse: 'Infinitivo constructo con lamed: expresa el propósito del movimiento.',
                    theologicalWeight: 'La huida no es pánico sino decisión deliberada contra una orden clara.',
                },
            ],
        },
    } as GenerationRules;

    it('el rango semántico y el uso llegan ETIQUETADOS', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, conAnalisis);
        expect(prompt).toContain('Rango semántico: huir · escapar · ponerse a salvo');
        expect(prompt).toContain('Uso en este versículo: Infinitivo constructo');
        expect(prompt).toContain('Peso teológico: La huida no es pánico');
    });

    it('el descubrimiento del pastor se marca como SUYO, no como glosa', () => {
        // El fallo: el borrador imprimía el comentario del pastor bajo el rótulo
        // "Palabras Clave", como si fuera el significado de la palabra.
        const prompt = buildSermonDraftPrompt(baseAnalysis, conAnalisis);
        expect(prompt).toContain('Lo que descubrió EL PASTOR (es suyo, no es la glosa)');
    });

    it('sin análisis cacheado degrada al descubrimiento, pero rotulado', () => {
        const sinAnalisis = {
            ...baseRules,
            pastoralSeed: {
                observations: [],
                parallels: [],
                wordStudies: [{ word: 'לִבְרֹחַ', reference: 'Jonás 1:3', discovery: 'Su rebelión.' }],
            },
        } as GenerationRules;
        const prompt = buildSermonDraftPrompt(baseAnalysis, sinAnalisis);
        expect(prompt).toContain('Lo que descubrió EL PASTOR');
        expect(prompt).not.toContain('Rango semántico:');
    });

    it('la instrucción pide rango + qué sentido usó el autor, y prohíbe la confusión', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, baseRules);
        expect(prompt).toContain('RANGO SEMÁNTICO');
        expect(prompt).toContain('QUÉ SENTIDO LE DIO EL AUTOR AQUÍ');
        expect(prompt).toContain('PROHIBIDO presentar el comentario del pastor');
        expect(prompt).toContain('asociación forzada');
    });
});

describe('buildSermonDraftPrompt — forma canónica del punto (convergencia con el taller)', () => {
    const p = () => buildSermonDraftPrompt(baseAnalysis, {} as any, 'es');

    it('el content abre con la proposición del punto, no con "### Exposición Bíblica"', () => {
        expect(p()).toContain('LA PROPOSICIÓN DEL PUNTO');
        expect(p()).not.toContain('### Exposición Bíblica');
    });

    it('las palabras clave van en el campo keyWords, fuera de content', () => {
        expect(p()).toContain('"keyWords"');
        expect(p()).toContain('Palabras Clave → campo "keyWords"');
    });

    it('los encabezados de la introducción son los del taller (constante compartida)', () => {
        const prompt = p();
        expect(prompt).toContain('### Contexto Histórico');
        expect(prompt).toContain('### Conexión Actual');
        expect(prompt).toContain('### Proposición Homilética');
    });

    it('en inglés, los encabezados cambian con el idioma', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, {} as any, 'en');
        expect(prompt).toContain('### Historical Context');
        expect(prompt).not.toContain('### Contexto Histórico');
    });

    it('comparte la regla de concisión del taller — el manuscrito no es la predicación', () => {
        expect(p()).toContain('EL MANUSCRITO NO ES LA PREDICACIÓN');
        expect(p()).toContain('Hermanos');
    });

    it('la numeración del anuncio de puntos respeta la del pastor', () => {
        expect(p()).toContain('NO le antepongas otro');
    });
});

describe('buildSermonDraftPrompt — hallazgos del smoke del fundador (2026-08-26)', () => {
    const p = () => buildSermonDraftPrompt(baseAnalysis, {} as any, 'es');

    it('las referencias cruzadas van desnudas: el texto lo pone la Biblia real', () => {
        expect(p()).toContain('SOLO LA REFERENCIA, SIN el texto del versículo');
        expect(p()).not.toContain('[Texto del versículo]');
    });

    it('las implicaciones van sin el prefijo que se veía con asteriscos literales', () => {
        expect(p()).toContain('nada de "**Implicación:**"');
        expect(p()).not.toContain('Empieza cada\n       entrada con "**Implicación:**"');
    });

    it('los puntos del anuncio van como viñetas — markdown colapsa saltos simples', () => {
        expect(p()).toContain('CADA punto es una VIÑETA con guion');
    });

    it('el ejemplo de conclusión no trae los encabezados que la instrucción prohíbe', () => {
        // La instrucción decía "sin encabezados" pero el EJEMPLO seguía
        // mostrando "### Resumen Principal" — y el ejemplo manda.
        expect(p()).not.toContain('### Resumen Principal');
        // La única mención que queda es la prohibición misma, no la plantilla.
        expect(p()).not.toContain('**Pasos de Acción**');
    });

    it('prohíbe narrar el acto de predicar', () => {
        expect(p()).toContain('Hoy comenzamos a explorar');
    });
});

describe('buildSermonDraftPrompt — segundo smoke del fundador (viñetas y conclusión)', () => {
    const p = () => buildSermonDraftPrompt(baseAnalysis, {} as any, 'es');

    it('la exposición del punto va en viñetas, un movimiento por concepto', () => {
        expect(p()).toContain('CADA UNO COMO SU\n   PROPIA VIÑETA');
    });

    it('las implicaciones van sin anclas en negrita — la lista ya separa', () => {
        expect(p()).toContain('SIN anclas en negrita');
    });

    it('la conclusión son puntos precisos, no prosa', () => {
        expect(p()).toContain('CONCLUSIÓN — PUNTOS PRECISOS, NO PROSA');
        expect(p()).toContain('UNA VIÑETA POR CADA');
    });
});

describe('buildSermonDraftPrompt — estilo del manuscrito del usuario (#5 del ejercicio de Jonás)', () => {
    it('usa el estilo guardado y conserva el registro del español', () => {
        const prompt = buildSermonDraftPrompt(baseAnalysis, {
            ...baseRules,
            manuscriptStyle: 'Escribe párrafos largos, con una ilustración por idea.',
        });
        expect(prompt).toContain('Escribe párrafos largos, con una ilustración por idea.');
        expect(prompt).toContain('ESPAÑOL LATINOAMERICANO NEUTRO');
        expect(prompt).not.toContain('EL MANUSCRITO NO ES LA PREDICACIÓN');
    });

    it('sin estilo guardado, el del sistema', () => {
        expect(buildSermonDraftPrompt(baseAnalysis, baseRules)).toContain('EL MANUSCRITO NO ES LA PREDICACIÓN');
    });
});
