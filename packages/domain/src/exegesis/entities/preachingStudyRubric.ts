import type { PaperRubric } from './PaperRubric';
import { DEFAULT_TMS_EXEGETICAL_RUBRIC } from './PaperRubric';

/**
 * La rúbrica de un estudio PARA PREDICAR, que no es la de un trabajo
 * académico.
 *
 * Nace de medir: los seis sermones de la serie expositiva de Jonás corrían con
 * `DEFAULT_TMS_EXEGETICAL_RUBRIC` —doce páginas, comentarios críticos como
 * ancla, notas al pie— porque nadie eligió otra cosa y ésa es la que el
 * sistema aplica por omisión. Ninguno de los seis la había pedido.
 *
 * La diferencia entre las dos NO es de rigor. Las dos exigen el mismo estudio;
 * lo que cambia es a quién le rinde cuentas el resultado. El trabajo académico
 * lo lee un profesor que califica el MÉTODO, así que el andamiaje se muestra:
 * el comentario crítico ancla el versículo y el expositivo apoya. El sermón lo
 * escucha una congregación que no va a ver el andamiaje, pero lo necesita
 * entero debajo — así que el expositivo ancla, el crítico contrasta y lo
 * técnico entra cuando hay una cruz que resolver.
 *
 * Por eso esto NO es una rúbrica más floja. Es la misma exigencia con otra
 * salida, y el único número que baja es la extensión: un estudio de
 * predicación no se entrega, se usa.
 */
export const PREACHING_STUDY_RUBRIC: PaperRubric = {
    ...DEFAULT_TMS_EXEGETICAL_RUBRIC,
    provenance: 'system-default',
    description:
        'Estudio exegético para predicación expositiva. Mismo rigor que un trabajo académico, '
        + 'con otra salida: el andamiaje se hace entero y no se muestra.',

    /**
     * Tres a cinco páginas de ESTUDIO, no de sermón.
     *
     * El trabajo académico declara la extensión que el sílabo califica. Aquí
     * nadie califica páginas: la extensión la fija cuánto material necesita el
     * predicador para no quedarse corto en el púlpito, y doce páginas de
     * aparato para una perícopa de cuatro versículos es material que no se va
     * a releer.
     */
    expectedLength: { unit: 'pages', min: 3, max: 5 },

    /**
     * Cita parentética, no nota al pie.
     *
     * Nadie lee notas al pie mientras prepara un sermón. La cita tiene que
     * estar donde está la afirmación, para poder volver a la fuente sin saltar
     * al final de la página.
     */
    formatting: {
        lineSpacing: 'single',
        citationForm: 'parenthetical',
        blankLineBetweenParagraphs: true,
    },

    /**
     * El orden de las fuentes se invierte respecto del trabajo académico, y es
     * el cambio de fondo.
     */
    structuralExpectations: [
        {
            section: 'introduction',
            emphasizedTypes: ['historical-background', 'commentary-expository', 'theological-monograph'],
            justification:
                'La introducción sitúa la perícopa en el argumento del libro: dónde está el oyente '
                + 'cuando empieza esta escena y qué se juega en ella.',
        },
        {
            section: 'verse',
            emphasizedTypes: [
                'commentary-expository',
                'commentary-critical',
                'grammar-syntax',
                'lexicon-technical',
                'biblical-text-edition',
            ],
            justification:
                'El expositivo ancla porque sigue el flujo del argumento, que es lo que se predica; '
                + 'el crítico contrasta cuando hay lecturas rivales; lo técnico entra donde hay una '
                + 'cruz que decidir, no en cada versículo.',
        },
        {
            section: 'conclusion',
            emphasizedTypes: ['commentary-expository', 'theological-monograph', 'commentary-critical'],
            justification:
                'La conclusión dice la intención del autor en una oración y qué hace esa intención '
                + 'con quien escucha. No es un resumen de hallazgos: es el puente.',
        },
    ],

    /**
     * Mínimos bajos y deliberados.
     *
     * El trabajo académico exige cobertura por tipo porque el método se
     * califica. Aquí lo que hace falta es una voz que siga el argumento y otra
     * que discuta; el resto entra si el texto lo pide. Un mínimo alto obliga a
     * meter un léxico en una perícopa narrativa que no lo necesita.
     */
    sourceRequirements: [
        {
            sourceType: 'commentary-expository',
            minimum: 1,
            maximum: null,
            justification: 'Al menos una voz que siga el argumento del pasaje de corrido.',
        },
        {
            sourceType: 'commentary-critical',
            minimum: 1,
            maximum: null,
            justification: 'Al menos una que discuta las lecturas rivales donde las haya.',
        },
    ],

    qualityCriteria: [],
    sourceCorpusId: null,
    sourcePastedText: null,
    sourceTemplateId: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
};

/** Una copia fresca, con las fechas de cuando se aplica. */
export function buildPreachingStudyRubric(): PaperRubric {
    const now = new Date();
    return { ...PREACHING_STUDY_RUBRIC, createdAt: now, updatedAt: now };
}
