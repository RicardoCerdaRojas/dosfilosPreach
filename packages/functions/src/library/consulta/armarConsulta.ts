/**
 * La consulta a la biblioteca (fase «biblioteca consultable», U2): armar el
 * pedido al asistente y leer su respuesta. Todo lo de acá es puro.
 *
 * **Cómo se cita.** El asistente no escribe páginas: cita con la marca del
 * fragmento, `[F3]`. La página impresa la pone la pantalla con la numeración
 * calibrada del libro (domain, `citationAnchorFor`), que functions no puede
 * importar. Así el asistente no puede inventar una página, una cita que no es
 * de un fragmento recuperado se quita, y si el libro se calibra después, las
 * citas guardadas se corrigen solas.
 */

import { markdownAPlano } from '../markdownAPlano';

/**
 * El extracto que se MUESTRA (y se guarda): sin marcas de tablas, etiquetas
 * HTML ni bloques de código, que en pantalla se veían crudos («| :--- |»,
 * «<table>», «```python»; fundador, 2026-10-16). Sólo para mostrar: el texto
 * indexado y el que lee el asistente no se tocan.
 */
export function extractoLegible(texto: string, largo = LARGO_EXTRACTO): string {
    // Separadores de tabla sólo pegados a «|» (antes de pasar a texto plano,
    // que convierte las barras en espacios): «---» en una frase es texto.
    const sinSeparadores = texto.replace(/\|\s*:?-{3,}:?\s*(?=\|)/g, '|');
    const limpio = markdownAPlano(sinSeparadores)
        .replace(/```[a-z]*/gi, ' ')
        // Sólo etiquetas de TABLA y saltos: «<» y «>» sueltos, «<B>» (el
        // Vaticano) o «<b>»/«<p>» (notación de grafemas) son texto en las
        // gramáticas («*qatal < *qatala», «el códice <A>»). Mismo criterio que
        // `limpiarParaIndexar` del chunker.
        .replace(/<\/?(?:table|thead|tbody|tfoot|tr|td|th|br|caption|colgroup|col)\b[^>]*>/gi, ' ')
        .replace(/\|/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return limpio.length > largo ? `${limpio.slice(0, largo)}…` : limpio;
}

export interface FragmentoRecuperado {
    /** El id del fragmento en `document_chunks` (para no repetirlo y para el banco de evaluación). */
    id?: string;
    resourceId: string;
    titulo: string;
    autor: string;
    /** La hoja del PDF (`metadata.page`); la pantalla la pasa a página impresa. */
    hoja: number | null;
    seccion: string;
    texto: string;
    score: number;
}

/** Lo que se guarda de cada fuente citada: alcanza para mostrarla, abrirla en el visor y citarla. */
export interface FuenteCitada {
    /** El número de la marca: `[F3]` → 3. */
    n: number;
    resourceId: string;
    titulo: string;
    autor: string;
    hoja: number | null;
    seccion: string;
    extracto: string;
}

export interface TurnoAnterior {
    pregunta: string;
    respuesta: string;
}

/** Largo del extracto que se guarda por fuente (el texto del fragmento entero va sólo al asistente). */
export const LARGO_EXTRACTO = 400;
/** Turnos anteriores que viajan con la pregunta, para que «¿y Moo qué dice?» se entienda. */
export const TURNOS_DE_CONTEXTO = 3;

const SISTEMA = [
    'Eres el asistente de estudio de un pastor. Respondes sus preguntas usando SOLO los fragmentos de sus libros que se te dan.',
    'Reglas:',
    '- Escribe en español neutro latinoamericano, tratando al pastor de «tú». Sé claro y breve: a lo sumo unas 250 palabras, salvo que te pidan más.',
    '- Empieza directo con la respuesta, sin preámbulo («Claro», «Aquí tienes un resumen…»).',
    '- Toda afirmación que saques de un fragmento lleva su marca justo después, así: [F3]. Si sale de dos, [F2][F5]. No inventes marcas ni números de página: la página la pone la aplicación.',
    '- Distingue lo que dice cada autor: «Varner sostiene… [F1]; en cambio Moo… [F4]».',
    '- Si los fragmentos no alcanzan para responder, dilo con claridad («En los fragmentos de tus libros no encontré…») y no completes con lo que sepas por tu cuenta.',
    '- Cita textual sólo lo que está en el fragmento, entre comillas y con su marca.',
    '- No menciones que eres un modelo ni nombres de proveedores.',
].join('\n');

function rotuloDeFragmento(f: FragmentoRecuperado, n: number): string {
    const donde = [f.hoja !== null ? `hoja ${f.hoja}` : null, f.seccion ? `§ ${f.seccion}` : null].filter(Boolean).join(', ');
    return `[F${n}] ${f.autor || 'Autor desconocido'}, «${f.titulo}»${donde ? ` (${donde})` : ''}\n${f.texto.trim()}`;
}

/**
 * U6: cuando la pregunta es sobre un pasaje, la respuesta se ordena por
 * autor, como se lee un comentario de comentarios.
 */
export function reglaDePasaje(pasaje: string): string {
    return [
        `La pregunta es sobre un pasaje: ${pasaje}. Organiza la respuesta POR AUTOR:`,
        '- un párrafo por autor, que empieza con su apellido en negrita («**Varner** entiende…»), con sus marcas;',
        '- primero los que tratan el pasaje de frente; si dos coinciden o discrepan, dilo;',
        '- si sólo un autor lo trata, dilo con claridad. No llenes con autores que sólo lo mencionan de paso.',
    ].join('\n');
}

/** El pedido al asistente: las reglas, la conversación previa, los fragmentos numerados y la pregunta. */
export function armarPedido(
    pregunta: string,
    fragmentos: ReadonlyArray<FragmentoRecuperado>,
    anteriores: ReadonlyArray<TurnoAnterior> = [],
    opciones: { pasaje?: string | null } = {},
): { system: string; prompt: string } {
    const previos = anteriores.slice(-TURNOS_DE_CONTEXTO)
        .map(t => `Pregunta: ${t.pregunta}\nRespuesta: ${quitarMarcas(t.respuesta)}`)
        .join('\n\n');
    const partes = [
        previos ? `Conversación hasta ahora (sólo para entender la pregunta; sus marcas ya no valen):\n\n${previos}` : '',
        fragmentos.length > 0
            ? `Fragmentos de los libros del pastor:\n\n${fragmentos.map((f, i) => rotuloDeFragmento(f, i + 1)).join('\n\n---\n\n')}`
            : 'No se encontraron fragmentos en los libros del pastor para esta pregunta.',
        `Pregunta del pastor: ${pregunta.trim()}`,
    ].filter(Boolean);
    const system = opciones.pasaje ? `${SISTEMA}\n\n${reglaDePasaje(opciones.pasaje)}` : SISTEMA;
    return { system, prompt: partes.join('\n\n====\n\n') };
}

const MARCA = /\[F(\d{1,3})\]/g;

/**
 * Las marcas que el asistente escribe a su manera —«[F2, F5]», «[F2; F5]»,
 * «[f2]», «[F2,5]»— pasadas a la forma única «[F2][F5]». Sin esto quedaban
 * literales en la respuesta, sin cita ni enlace (revisión adversarial, U2).
 */
export function normalizarMarcas(texto: string): string {
    return texto.replace(/\[\s*[Ff]\s*\d{1,3}(?:\s*[,;]\s*[Ff]?\s*\d{1,3})*\s*\]/g, grupo =>
        (grupo.match(/\d{1,3}/g) ?? []).map(n => `[F${Number(n)}]`).join(''));
}

function quitarMarcas(texto: string): string {
    return texto.replace(MARCA, '').replace(/[ \t]{2,}/g, ' ');
}

/**
 * La respuesta del asistente lista para guardar: sin las marcas que no son de
 * un fragmento recuperado, y con las fuentes que sí citó (en orden de número).
 */
export function leerRespuesta(
    texto: string,
    fragmentos: ReadonlyArray<FragmentoRecuperado>,
): { respuesta: string; fuentes: FuenteCitada[] } {
    const citadas = new Set<number>();
    const respuesta = normalizarMarcas(texto).replace(MARCA, (marca, num: string) => {
        const n = Number(num);
        if (n < 1 || n > fragmentos.length) return '';
        citadas.add(n);
        return marca;
    }).replace(/[ \t]{2,}/g, ' ').trim();
    const fuentes = [...citadas].sort((a, b) => a - b).map(n => {
        const f = fragmentos[n - 1]!;
        return {
            n,
            resourceId: f.resourceId,
            titulo: f.titulo,
            autor: f.autor,
            hoja: f.hoja,
            seccion: f.seccion,
            extracto: extractoLegible(f.texto),
        };
    });
    return { respuesta, fuentes };
}

/** El título de una consulta nueva: su primera pregunta, recortada. */
export function tituloDeConsulta(pregunta: string): string {
    const limpia = pregunta.replace(/\s+/g, ' ').trim();
    return limpia.length > 80 ? `${limpia.slice(0, 77)}…` : limpia;
}
