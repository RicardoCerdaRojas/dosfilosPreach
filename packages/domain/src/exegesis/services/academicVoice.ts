/**
 * CÓMO ESCRIBE ESTE AUTOR, en sus propias palabras.
 *
 * El trabajo de Salmo 23:1–3 salió correcto y ajeno: el autor lo leyó y
 * fue cambiando palabras que no eran suyas. El glosario (#651) cierra las
 * peores una por una; esto ataca lo otro, que es el registro —cómo abre
 * un argumento, cuánto dura su frase, cuándo usa primera persona—.
 *
 * LA REGLA QUE GOBIERNA ESTE MÓDULO, copiada del perfil de voz de los
 * sermones y por la misma razón: sólo enseña prosa que ESCRIBIÓ ÉL.
 *
 * Un paso «editado» no califica. `origin: 'edited'` significa que el autor
 * corrigió una prosa generada: lo que queda es una mezcla, y la parte que
 * pesa es la nuestra. Aprender de ahí sería devolverle nuestra voz cada
 * vez más convincente, un bucle que se cierra sobre sí mismo. Por eso la
 * fuente es un texto que él DECLARA suyo —su ensayo, su trabajo anterior
 * entregado— y nada más.
 *
 * Y los fragmentos elegidos enseñan REGISTRO, no contenido. El prompt lo
 * dice y esta selección lo ayuda: se descartan los párrafos cargados de
 * hebreo, griego o citas, que enseñarían a citar como él y no a escribir
 * como él —y citar como él sobre un pasaje que no estudió es inventar—.
 */

export interface AcademicVoiceSample {
    /** Un párrafo de su prosa. */
    excerpt: string;
    /** Dónde caía en el documento, en tanto por uno. Sólo para mostrarlo. */
    position: number;
}

/**
 * Una nota al pie empieza con su número y sigue con el nombre del autor:
 * «1 James Leo Garrett h., …». No lleva punto tras el número —eso ya lo
 * descarta el filtro de listas numeradas—, y por eso hace falta esta.
 */
const EMPIEZA_COMO_NOTA = /^\d{1,3}\s+\p{Lu}\p{L}+/u;

/**
 * Pie de imprenta: «(El Paso, TX: Editorial Mundo Hispano, 2011)». Uno
 * suelto puede aparecer en prosa que comenta una edición; dos o más en el
 * mismo párrafo son una tira de notas.
 */
const PIE_DE_IMPRENTA = /\([^)]{3,60}:\s*[^)]{3,60},\s*\d{4}\)/g;

function contarPiesDeImprenta(parrafo: string): number {
    const pies: string[] = parrafo.match(PIE_DE_IMPRENTA) ?? [];
    return pies.length;
}

/**
 * Cuánto de un párrafo puede ser cita textual de otro. Por encima de esto
 * lo que enseñaría es el registro del citado.
 */
const MAX_PROPORCION_CITADA = 0.5;

/** Lo que va entre comillas, en cualquiera de las formas que usa el autor. */
const ENTRECOMILLADO = /«[^»]{20,}»|“[^”]{20,}”|"[^"]{20,}"/g;

function proporcionCitada(parrafo: string): number {
    // Tipado explícito: `match` devuelve `RegExpMatchArray | null` y el
    // `?? []` deja una unión con `never[]` que rompe el `reduce`.
    const citas: string[] = parrafo.match(ENTRECOMILLADO) ?? [];
    const citado = citas.reduce((n, c) => n + c.length, 0);
    return parrafo.length > 0 ? citado / parrafo.length : 0;
}

/** Largo de párrafo que sirve como muestra de registro. */
const MIN_CHARS = 220;
const MAX_CHARS = 700;

/** Cuántas muestras viajan al prompt. Más no enseña más y sí ocupa contexto. */
export const MAX_VOICE_SAMPLES = 4;

/**
 * Proporción de caracteres no latinos por encima de la cual el párrafo se
 * descarta: enseña a citar en hebreo, no a escribir en español.
 */
const MAX_FOREIGN_RATIO = 0.12;

/**
 * Elige unos pocos párrafos representativos de cómo escribe el autor.
 *
 * Reparte a lo largo del documento en vez de tomar los primeros: el
 * arranque de un trabajo académico es portada, índice y resumen, que no
 * se parecen a su prosa de análisis.
 */
export function selectAcademicVoiceSamples(
    text: string,
    limit: number = MAX_VOICE_SAMPLES,
): AcademicVoiceSample[] {
    if (!text?.trim()) return [];

    const parrafos = trocearEnParrafos(text);

    // El arranque de un trabajo académico es portada, índice y resumen. El
    // comentario de arriba lo afirmaba y el código no lo evitaba: sobre la
    // guía de estilo real, la única muestra que salía era la portada.
    const desde = parrafos.length >= MIN_PARRAFOS_PARA_SALTAR_PORTADA
        ? Math.floor(parrafos.length * PROPORCION_DE_PORTADA)
        : 0;

    const candidatos: AcademicVoiceSample[] = [];
    parrafos.forEach((parrafo, i) => {
        if (i < desde) return;
        if (!sirveComoMuestra(parrafo)) return;
        candidatos.push({
            excerpt: parrafo.length > MAX_CHARS ? `${parrafo.slice(0, MAX_CHARS).trimEnd()}…` : parrafo,
            position: parrafos.length > 1 ? i / (parrafos.length - 1) : 0,
        });
    });

    if (candidatos.length <= limit) return candidatos;

    // Repartidos: uno de cada tramo, no los primeros cuatro.
    const paso = candidatos.length / limit;
    return Array.from({ length: limit }, (_, i) => candidatos[Math.floor(i * paso)]!);
}

/**
 * Trocea un documento en párrafos.
 *
 * Por línea en blanco cuando las hay. MUCHOS TEXTOS EXTRAÍDOS NO LAS
 * TIENEN: medido sobre la guía de estilo del seminario —130.566
 * caracteres reales— el troceo por línea en blanco devolvía UN párrafo
 * gigante, y la única «muestra» que salía era la portada recortada a 700
 * caracteres. Cuando el promedio por bloque delata que no hubo troceo, se
 * parte por renglón: un renglón largo de un PDF es un párrafo.
 */
function trocearEnParrafos(text: string): string[] {
    const porLineaEnBlanco = text.split(/\n{2,}/).map(limpiar).filter(Boolean);
    if (troceoPlausible(porLineaEnBlanco)) return porLineaEnBlanco;

    const porRenglon = text.split(/\n+/).map(limpiar).filter(Boolean);
    if (troceoPlausible(porRenglon)) return porRenglon;

    // Sin un solo salto de línea. Medido sobre la guía de estilo del
    // seminario: 130.566 caracteres y CERO saltos, porque su extracción los
    // perdió. Ahí se agrupa por oraciones hasta llegar al largo de un
    // párrafo, que es lo único que queda para distinguir prosa de portada.
    return agruparPorOraciones(text);
}

function troceoPlausible(bloques: string[]): boolean {
    if (bloques.length < 3) return false;
    const promedio = bloques.reduce((n, p) => n + p.length, 0) / bloques.length;
    if (promedio > MAX_PARRAFO_PLAUSIBLE) return false;

    // Un promedio bajo delata RENGLONES en vez de párrafos —medido sobre un
    // ensayo real del autor: 22.518 caracteres, 603 saltos de línea, 37
    // caracteres por línea—, pero sólo cuando hay muchos bloques. En un
    // documento de cuatro, un promedio bajo es sólo un documento corto, y
    // rechazar el troceo ahí junta el encabezado con el texto y lo descarta
    // todo.
    if (bloques.length >= MIN_BLOQUES_PARA_SOSPECHAR_RENGLONES && promedio < MIN_PARRAFO_PLAUSIBLE) {
        return false;
    }
    return true;
}

function agruparPorOraciones(text: string): string[] {
    const oraciones = limpiar(text).split(/(?<=[.!?])\s+/);
    const out: string[] = [];
    let actual = '';
    for (const oracion of oraciones) {
        actual = actual ? `${actual} ${oracion}` : oracion;
        if (actual.length >= MIN_CHARS) {
            out.push(actual);
            actual = '';
        }
    }
    if (actual) out.push(actual);
    return out;
}

function limpiar(parrafo: string): string {
    return parrafo.replace(/\s+/g, ' ').trim();
}

/**
 * Largo medio por encima del cual se concluye que el documento no traía
 * separación de párrafos. Un párrafo académico ronda los 500-900
 * caracteres; 2.000 de media significa que no se partió nada.
 */
const MAX_PARRAFO_PLAUSIBLE = 2_000;

/**
 * Largo medio por debajo del cual lo que se partió son renglones y no
 * párrafos. Un párrafo académico corto ronda los 300; 120 es holgado
 * para no confundirlo con una línea de PDF, que ronda los 40-90.
 */
const MIN_PARRAFO_PLAUSIBLE = 120;

/**
 * Cuántos bloques hacen falta para que un promedio bajo signifique algo.
 * Con cuatro, «promedio corto» es «documento corto».
 */
const MIN_BLOQUES_PARA_SOSPECHAR_RENGLONES = 20;

/**
 * Cuánto del principio se salta por ser portada, índice y resumen, y a
 * partir de cuántos párrafos vale la pena saltarlo. En un documento de
 * diez párrafos, saltarse el primero ya es perder el 10 % del material.
 */
const PROPORCION_DE_PORTADA = 0.08;
const MIN_PARRAFOS_PARA_SALTAR_PORTADA = 12;

/**
 * Si un párrafo enseña registro.
 *
 * Descarta lo que enseñaría otra cosa: encabezados y notas (que enseñan
 * formato), párrafos cargados de lengua original o de citas (que enseñan
 * a citar), y los demasiado cortos, donde no hay frase que imitar.
 */
function sirveComoMuestra(parrafo: string): boolean {
    if (parrafo.length < MIN_CHARS) return false;
    // Encabezados, viñetas, notas al pie y marcas de página.
    if (/^(#{1,6}\s|[-*•]\s|\d+\.\s|<!--|\[PAGE)/.test(parrafo)) return false;
    // Un párrafo que es sobre todo una cita en bloque no es su prosa.
    if (/^[>"«]/.test(parrafo)) return false;
    // Índice: los puntos conductores («Publicación electrónica ..... 30»).
    // Medido sobre la guía de estilo real, el índice pasaba todos los demás
    // filtros —es largo, es latino y tiene puntos— y salía como muestra.
    if (/\.{4,}/.test(parrafo)) return false;
    // Notas al pie. Medido sobre un ensayo real del autor: DOS de las cuatro
    // muestras eran bloques de notas —«1 James Leo Garrett h., Teología
    // sistemática, trans. …, vol. II (El Paso, TX: Editorial Mundo Hispano,
    // 2011), 706.»—. Enseñan a citar, no a escribir, que es justo lo que
    // este módulo dice descartar. Se reconocen por cómo empiezan (número de
    // nota y nombre propio) y por el pie de imprenta entre paréntesis.
    if (EMPIEZA_COMO_NOTA.test(parrafo)) return false;
    if (contarPiesDeImprenta(parrafo) >= 2) return false;
    // Un párrafo que es sobre todo una cita larga de otro autor enseña el
    // registro de ese otro. Medido sobre un ensayo real: «Millard lo explica
    // de esta manera: “Todo esto significa que la iglesia estará ausente…”»
    // —una frase suya y trescientas palabras ajenas—. Se mide lo entrecomi-
    // llado en vez de descartar todo párrafo con comillas: citar una línea
    // dentro del propio argumento SÍ es parte de cómo escribe.
    if (proporcionCitada(parrafo) > MAX_PROPORCION_CITADA) return false;

    const letras = parrafo.replace(/[\s\d\p{P}]/gu, '');
    if (letras.length === 0) return false;
    const extranjeras = letras.match(/[^\p{Script=Latin}]/gu)?.length ?? 0;
    if (extranjeras / letras.length > MAX_FOREIGN_RATIO) return false;

    // Al menos dos oraciones: una sola frase no muestra cómo encadena.
    return (parrafo.match(/[.!?]\s/g)?.length ?? 0) >= 1;
}

/**
 * El bloque que viaja al prompt.
 *
 * Dice para qué sirven las muestras y, sobre todo, para qué NO: el modelo
 * que recibe prosa de ejemplo tiende a reutilizar sus datos, y aquí eso
 * significaría citar en un trabajo nuevo las fuentes del anterior.
 */
export function buildAcademicVoiceBlock(
    samples: ReadonlyArray<AcademicVoiceSample>,
    language: 'es' | 'en',
): string {
    if (samples.length === 0) return '';
    const cabecera = language === 'en'
        ? [
            'HOW THIS AUTHOR WRITES (samples of his own academic prose):',
            'Imitate the REGISTER — sentence length, connectors, how he opens an argument, how much he hedges.',
            'NEVER borrow content, sources, page numbers or examples from these samples: they are from another paper.',
        ]
        : [
            'ASÍ ESCRIBE ESTE AUTOR (muestras de su propia prosa académica):',
            'Imita el REGISTRO: largo de frase, conectores, cómo abre un argumento, cuánto matiza.',
            'NUNCA tomes contenido, fuentes, páginas ni ejemplos de estas muestras: son de otro trabajo.',
        ];
    return [...cabecera, ...samples.map(s => `"""${s.excerpt}"""`)].join('\n');
}
