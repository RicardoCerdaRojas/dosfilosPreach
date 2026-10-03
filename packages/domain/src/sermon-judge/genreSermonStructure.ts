/**
 * Redacción v2 Fase 3 / Ola 6.2a (§6) — mapeo GÉNERO → ESTRUCTURA del sermón.
 *
 * Es un mapeo NUEVO que CONSUME `PassageProfile`, no lo re-deriva: el género lo
 * fija el perfil del pasaje (ADR-035) y este catálogo solo dice qué estructura
 * homilética pide ese género. Re-derivar acá crearía una segunda fuente de
 * verdad del género, que es exactamente lo que el invariante prohíbe.
 *
 * Cada perfil declara las cuatro piezas selladas en §6:
 *   1. Rango de puntos + razón hermenéutica.
 *   2. Fuente de los puntos en el análisis estructural (paso 3).
 *   3. Realización de la explicación (el componente camaleónico de §5).
 *   4. Forma de la proposición sustantivada.
 *
 * DATO EDITABLE (SSOT domain, movible a Firestore). Llaves = enum `LiteraryGenre`
 * (test rompe CI si difieren).
 *
 * EL RANGO NO ES UNA REGLA DE CONTEO. La vara transversal (§6, sellada) es
 * COBERTURA + ANCLAJE, no "nº puntos = nº movimientos" — ver `pointAnchoring.ts`.
 * El techo es guía de carga homilética, no límite exegético.
 */

import type { LiteraryGenre } from '../exegesis/expository/BookPanorama';

/** Cómo se sustantiva la proposición en este género (elemento 3 de los 8). */
export type FormaSustantivo = 'singular' | 'plural' | 'ambos';

export interface RangoDePuntos {
    min: number;
    max: number;
    /** Por qué ESE rango. La razón es hermenéutica; el número es homilético. */
    razon: string;
}

export interface GenreSermonStructure {
    /** Pieza 1. */
    puntos: RangoDePuntos;
    /**
     * `true` solo en parábola: el sistema RESISTE la multiplicación de puntos en
     * vez de proponerla. Es el único género donde la fusión opera hacia FORZAR
     * unidad, porque la parábola enseña por un punto mayor de comparación.
     */
    confrontaMultiplicacion?: boolean;
    /** Pieza 2 — de dónde salen los puntos en el análisis estructural del paso 3. */
    fuenteDeLosPuntos: string;
    /** Pieza 3 — cómo se realiza la explicación en este género. */
    realizacionDeLaExplicacion: string;
    /** Pieza 4 — forma de la proposición. */
    proposicion: { sustantivo: FormaSustantivo; nota: string };
    /**
     * Marca interna que RAMIFICA el perfil sin partirlo en dos (decisión del
     * fundador). Comparten descalificadores y naturaleza; se bifurcan en
     * estructura o en elementos internos.
     */
    marcas?: readonly string[];
    /**
     * Override por marca cuando la ramificación cambia la estructura misma, no
     * solo los elementos internos (hoy: solo sapiencial).
     */
    porMarca?: Readonly<Record<string, Partial<Omit<GenreSermonStructure, 'porMarca' | 'marcas'>>>>;
    fuente: string;
}

export const GENRE_SERMON_STRUCTURE: Record<LiteraryGenre, GenreSermonStructure | null> = {
    epistle: {
        puntos: {
            min: 2,
            max: 4,
            razon: 'Los puntos salen de los movimientos del argumento. Sobre 4 movimientos se agrupan afines (permite el sermón panorámico); un movimiento denso se divide. La fragmentación sin anclaje se confronta.',
        },
        fuenteDeLosPuntos:
            'Flujo del argumento: conectores lógicos y cláusulas principales identificados en el paso 3 ("por tanto", "porque", "para que").',
        realizacionDeLaExplicacion:
            'Desglosa el argumento cláusula por cláusula siguiendo los conectores lógicos. Máximo peso a la explicación exegética gramatical.',
        proposicion: {
            sustantivo: 'plural',
            nota: 'El género es intrínsecamente proposicional (Terry, Romanos 1:16 como tema del que cuelga todo). Verdades / razones / advertencias / exhortaciones, según lo que hace el argumento. El elemento 8 (armonía puntos↔texto) muerde fuerte aquí porque el argumento es explícito.',
        },
        fuente: 'Redacción v2 §6.1 (Zuck, Terry)',
    },
    narrative: {
        puntos: {
            min: 1,
            max: 4,
            razon: 'Acotado por los movimientos reales de la trama; el techo 4 es homilético. Los movimientos son los GIROS DE LA TRAMA, no razones de un argumento. Un relato simple rinde pocos; uno con varias escenas, más.',
        },
        fuenteDeLosPuntos:
            'Trama, escena y caracterización. El paso 3 en narrativa traza el ARCO (dónde arranca la tensión, dónde el clímax, dónde la resolución), no conectores.',
        realizacionDeLaExplicacion:
            'Narra el movimiento de la escena y saca su fuerza del RELATO: no lo disecciona en receta, y la explicación llega a tiempo para no matar la tensión. Se apoya menos en la carga gramatical de una palabra (eso es epístola) y más en el movimiento, la caracterización y el juicio del narrador.',
        proposicion: {
            sustantivo: 'ambos',
            // Cae la excepción de "revelar tarde en narrativa" que sugería la
            // literatura secular: el propósito de predicar no es sostener
            // suspenso, es comunicar la verdad de Dios, y repetirla es patrón
            // bíblico. La transición re-ancla proposición + puntos también acá.
            nota: 'Se ANUNCIA, no se revela tarde, igual que en toda forma. Singular si el relato rinde un solo principio.',
        },
        fuente: 'Redacción v2 §6.2 (Zuck, McQuilkin)',
    },
    parable: {
        puntos: {
            min: 1,
            max: 1,
            razon: 'El perfil MÁS restrictivo del catálogo: la parábola enseña UNA sola verdad, por un punto mayor de comparación.',
        },
        // Único género donde la fusión opera hacia FORZAR unidad: si el pastor
        // quiere varios puntos, el tutor confronta ("¿tus puntos no fragmentan la
        // única verdad?"). El sistema resiste, no propone.
        confrontaMultiplicacion: true,
        fuenteDeLosPuntos:
            'La comparación central: ocasión histórica y propósito, análisis de las imágenes, e interpretación de las partes con referencia al designio general → la verdad central prominente. Muchas veces Jesús la declara (Lc 15:7, Mt 20:16).',
        realizacionDeLaExplicacion:
            'Explica la comparación y su fuerza SIN alegorizar los detalles (mesonero, monedas, burro dan realismo, no significado espiritual). Excepción: cuando el propio Jesús interpreta los detalles (sembrador, cizaña).',
        proposicion: {
            sustantivo: 'singular',
            nota: 'Captura la verdad central que la parábola ilustra ("una verdad que…").',
        },
        fuente: 'Redacción v2 §6.3 (Zuck, Terry)',
    },
    poetry: {
        puntos: {
            min: 1,
            max: 3,
            razon: 'La poesía no se desmenuza en muchos puntos: su unidad es afectiva y temática (la idea central, el pensamiento unificador). Los movimientos salen de la estructura de la categoría y de los giros de metáfora.',
        },
        // Las categorías ramifican los ELEMENTOS INTERNOS que el paso 3 busca (ej.
        // lamento individual: invocación → lamento → confianza → petición → voto
        // de alabanza), no el rango de puntos. Por eso son `marcas` sin `porMarca`.
        marcas: ['lamento', 'alabanza', 'confianza', 'sabiduría', 'canto-de-Sion'],
        fuenteDeLosPuntos:
            'Paralelismo, imagen y estructura de la categoría. El paso 3 traza paralelismos y giros de imagen, no conectores ni arco.',
        realizacionDeLaExplicacion:
            'Abre la imagen y el paralelismo SIN aplanar el poema: (a) abre el paralelismo (¿el 2º verso ilustra, contrasta o intensifica?); (b) interpreta la imagen sin sobre-literalizar ni vaciar ("el Señor es mi roca" = firmeza/refugio preciso); (c) conserva el AFECTO, no solo la doctrina. En poesía el "sentir" es constitutivo del texto.',
        proposicion: {
            sustantivo: 'ambos',
            nota: 'Captura el pensamiento unificador. El cuidado propio: formular una proposición fiel que NO reduzca el poema — anunciar la verdad sin apagar el afecto que la carga.',
        },
        fuente: 'Redacción v2 §6.5 (Terry, Zuck, Lowth)',
    },
    prophecy: {
        puntos: {
            min: 1,
            max: 4,
            razon: 'Los movimientos siguen la estructura del oráculo; patrón por defecto acusación → juicio → restauración (patrón del pacto). Fusión y división libres.',
        },
        fuenteDeLosPuntos:
            'Estructura del oráculo (denuncia / juicio / esperanza) + su lenguaje figurado. El paso 3 traza el oráculo y su TIPO de mensaje (¿censura? ¿promesa? ¿predicción?).',
        realizacionDeLaExplicacion:
            'Tres operaciones: (a) ubica el mensaje al PRESENTE original (qué le dijo el profeta a SU audiencia: portavoz, no almanaque); (b) interpreta el lenguaje figurado sin sobre-literalizar (lo cósmico/hiperbólico describe realidad histórica o espiritual); (c) maneja el cumplimiento CON EL MARCO DEL PASTOR — donde el NT señala cumplimiento se traza, y donde hay cuestión escatológica abierta el sistema NO impone escuela.',
        proposicion: {
            sustantivo: 'ambos',
            nota: 'Captura el mensaje del oráculo, muchas veces un llamado (arrepentimiento, esperanza, fidelidad), no un dato sobre el futuro.',
        },
        fuente: 'Redacción v2 §6.6 (Terry, Zuck)',
    },
    apocalypse: {
        puntos: {
            min: 1,
            max: 4,
            razon: 'Según la estructura de la visión (bloques: siete iglesias, sellos, trompetas) y el patrón macro juicio/salvación. Fusión y división libres.',
        },
        fuenteDeLosPuntos:
            'Estructura de la visión + patrón juicio/salvación. El paso 3 traza los bloques y distingue forma (símbolo) de sustancia (verdad).',
        realizacionDeLaExplicacion:
            'Operación única: distinguir la FORMA simbólica de la VERDAD sustancial (la regla de mayor énfasis). Regla operacional del símbolo: literal salvo que tomado literalmente sea imposible o ilógico, respetando cuando el texto se auto-interpreta ("prostituta sobre siete montes" → el texto dice que los montes son reyes). No simbolizar todo porque hay algunos símbolos.',
        proposicion: {
            sustantivo: 'ambos',
            nota: 'Captura el CONSUELO o DESAFÍO al pueblo de Dios (el propósito original: animar al oprimido), no un dato del calendario profético.',
        },
        fuente: 'Redacción v2 §6.7 (Zuck, Terry)',
    },
    wisdom: {
        // Sub-tipo como MARCA interna, no dos perfiles (decisión del fundador):
        // comparten el descalificador de fondo (sabiduría ≠ promesa) y la
        // naturaleza poética, y se ramifican en estructura. Es el ÚNICO género
        // donde la marca cambia el rango, por eso tiene `porMarca`.
        marcas: ['proverbial', 'reflexiva'],
        puntos: {
            min: 1,
            max: 4,
            razon: 'Rango envolvente de las dos marcas. La estructura real la fija la marca: ver `porMarca`.',
        },
        fuenteDeLosPuntos:
            'Proverbial: el paralelismo (sinónimo/antitético) y la máxima. Reflexiva: el flujo del argumento reflexivo + la operación "quién habla".',
        realizacionDeLaExplicacion:
            'Proverbial: abre el paralelismo (¿el 2º verso ilustra o contrasta?) y determina la figura. Reflexiva: rastrea el discurso y UBICA la voz — distingue la voz que el libro afirma de la que refuta.',
        proposicion: {
            sustantivo: 'ambos',
            nota: 'Proverbial: singular, o plural si agrupa proverbios afines. Reflexiva: patrón de epístola.',
        },
        porMarca: {
            proverbial: {
                puntos: {
                    min: 1,
                    max: 1,
                    razon: 'Una máxima a fondo, o agrupación temática de proverbios afines (unidos por tema, no por arco).',
                },
                proposicion: { sustantivo: 'singular', nota: 'Singular; plural solo si agrupa proverbios afines.' },
            },
            reflexiva: {
                puntos: {
                    min: 2,
                    max: 4,
                    razon: 'Sigue el movimiento del argumento reflexivo (Job, Eclesiastés) — cercano a epístola.',
                },
                proposicion: { sustantivo: 'plural', nota: 'Patrón de epístola.' },
            },
        },
        fuente: 'Redacción v2 §6.4 (Zuck, Terry)',
    },
    law: {
        puntos: {
            min: 1,
            max: 3,
            razon: 'Una ley o precepto a fondo, o agrupación temática de leyes afines. Los puntos salen del precepto y su fundamento (la razón que la ley da, cuando la da).',
        },
        fuenteDeLosPuntos:
            'El precepto (apodíctico o casuístico) + su razón/fundamento. El paso 3 en legal identifica el tipo de ley y pregunta la TRANSFERIBILIDAD (¿moral permanente? ¿ceremonial anulada? ¿civil con principio transferible?).',
        realizacionDeLaExplicacion:
            'Expone el precepto en su contexto original (qué demandaba a Israel y por qué) y traza la transferibilidad al oyente de hoy con los tres criterios de McQuilkin. La explicación exegética incluye el fundamento: muchas leyes dan su razón (imagen de Dios, santidad).',
        proposicion: {
            sustantivo: 'ambos',
            nota: 'Captura la demanda permanente de Dios que la ley revela, no la letra ceremonial si fue anulada. Singular o plural según agrupe.',
        },
        fuente: 'Redacción v2 §6.8 (Zuck, McQuilkin, Terry)',
    },
    // CENTINELAS: no son géneros predicables, así que NO tienen estructura
    // derivable. `gospel` se disuelve por perícopa (relato / parábola / discurso
    // argumentativo) y `mixed` dispara el override socrático; en ambos casos la
    // estructura la fija el género que el pastor nombre. `null` dice "no hay
    // estructura acá", que es distinto de un objeto con rangos en cero — eso
    // último se leería como "de 0 a 0 puntos" y confrontaría cualquier sermón.
    gospel: null,
    mixed: null,
};

/** Llaves del catálogo (para el test de invariante enum ≡ llaves). */
export const GENRE_SERMON_STRUCTURE_GENRES = Object.keys(GENRE_SERMON_STRUCTURE) as LiteraryGenre[];

/**
 * La estructura efectiva del género, con el override de marca aplicado si la
 * marca ramifica la estructura. `null` cuando el género no tiene estructura
 * derivable (centinela o fuera del enum): el llamador NO debe inventar una.
 */
export function sermonStructureFor(
    genre: string | undefined,
    marca?: string,
): GenreSermonStructure | null {
    if (!genre) return null;
    const base = GENRE_SERMON_STRUCTURE[genre as LiteraryGenre] ?? null;
    if (!base) return null;
    if (!marca) return base;
    const override = base.porMarca?.[marca];
    if (!override) return base;
    return { ...base, ...override };
}
