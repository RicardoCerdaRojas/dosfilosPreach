import { SPANISH_REGISTER } from '../shared/spanishRegister';

/**
 * La regla de estilo del MANUSCRITO del sermón, compartida por los dos
 * caminos que escriben prosa: el redactor por sección del taller y el
 * generador de borrador completo.
 *
 * UNA SOLA COPIA A PROPÓSITO. El fundador comparó los dos borradores y el
 * generado tenía "mucha más prosa" que el del taller: cada prompt traía su
 * propia idea de cuánto y cómo escribir, y divergieron exactamente como
 * divergen dos copias de cualquier regla. La forma aprobada es la del taller;
 * el generador la importa en vez de redeclararla.
 */
/**
 * La parte EDITABLE del estilo: cuánto y cómo escribe el manuscrito.
 *
 * El fundador no sabía que existía una regla de estilo para los sermones
 * (#5 del ejercicio de Jonás 4:5-11) y decidió que fuera editable: cada
 * usuario puede guardar la suya en la configuración de la fase de redacción
 * (`PhaseConfiguration.manuscriptStyle`). Ésta es la del sistema, y a ésta se
 * vuelve con «Usar la del sistema».
 */
export const DEFAULT_MANUSCRIPT_STYLE = `   **CONCISIÓN. EL MANUSCRITO NO ES LA PREDICACIÓN.**
   Este texto es el documento de trabajo del predicador, no la transcripción
   de lo que dirá. Su trabajo es que él vea LA IDEA DE UN VISTAZO.

   PROHIBIDO:
   - Vocativos ("Hermanos", "Amados", "Queridos hermanos"). El trato con la
     congregación lo pone él, vivo, y escribirlo aquí se lo pre-guioniza.
   - Narrar el acto de predicar: "Hoy comenzamos a explorar…", "Hoy hemos
     meditado…", "Hemos aprendido que…", "un relato fascinante que nos
     introduce…". El manuscrito presenta el CONTENIDO; el momento litúrgico
     —el hoy, el nosotros reunidos, el entusiasmo— lo pone el predicador en
     vivo. Escribe "El libro de Jonás presenta…", no "Hoy exploraremos…".
   - Adorno retórico: "Imaginen la profunda…", "de manera poderosa",
     "profundamente", "verdaderamente", "es importante notar que".
   - Repetir la idea con otras palabras para alargar. Si ya se dijo, sigue.
   - Cerrar cada bloque con una moraleja que nadie pidió.

   Cada movimiento: la idea, dicha con claridad, y sólo el desarrollo que
   haga falta para que se entienda. Dos a cuatro frases suelen bastar. El
   calor lo agrega él en el púlpito; tú entregas la idea limpia.`;

/**
 * El estilo que va al prompt: el registro del español, que NO se edita
 * (`SPANISH_REGISTER`: sin voseo ni vosotros en todo lo que escribe la app), y
 * después el estilo del usuario si guardó uno, o el del sistema.
 */
export function manuscriptStyleFor(custom?: string | null): string {
    return `**${SPANISH_REGISTER}**\n\n${custom?.trim() || DEFAULT_MANUSCRIPT_STYLE}`;
}

/**
 * Lo que se guarda al editar: nada si quedó vacío o igual al del sistema, para
 * que una mejora futura del estilo del sistema le llegue también a quien nunca
 * lo cambió.
 */
export function customManuscriptStyle(edited: string | null | undefined): string | null {
    const norm = (x: string) => x.replace(/\s+/g, ' ').trim();
    const e = norm(edited ?? '');
    return !e || e === norm(DEFAULT_MANUSCRIPT_STYLE) ? null : (edited ?? '').trim();
}

/** El del sistema, ya armado: para los llamadores que no leen la configuración. */
export const SERMON_MANUSCRIPT_STYLE = manuscriptStyleFor(null);

/**
 * Los encabezados de la introducción del sermón, por idioma.
 *
 * SON LOS MISMOS que el taller pinta vía i18n (claves
 * `drafting.sections.*.heading`), y un test de paridad en `packages/web` lo
 * verifica contra los JSON. Viven acá porque el generador arma su prompt en
 * infraestructura, donde no hay i18n: sin esta constante, el prompt escribiría
 * su propia versión de cada encabezado y los dos caminos producirían
 * introducciones con títulos distintos — que es exactamente lo que pasaba.
 */
export const SERMON_INTRO_HEADINGS = {
    es: {
        openingIllustration: 'Ilustración de Apertura',
        bookOverview: 'El Libro de un Vistazo',
        historicalContext: 'Contexto Histórico',
        currentConnection: 'Conexión Actual',
        sermonProposition: 'Proposición Homilética',
    },
    en: {
        openingIllustration: 'Opening Illustration',
        bookOverview: 'The Book at a Glance',
        historicalContext: 'Historical Context',
        currentConnection: 'Current Connection',
        sermonProposition: 'Homiletical Proposition',
    },
} as const;
