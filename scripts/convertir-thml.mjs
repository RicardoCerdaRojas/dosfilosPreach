/**
 * Convierte una obra en ThML (el XML de CCEL) a markdown anclado al pasaje.
 *
 * Por qué no alcanza con el .txt que CCEL también publica: el texto plano
 * pierde el anclaje. Un comentario de la Biblia entera son 22 MB de prosa
 * corrida, y cortarlo en fragmentos a ciegas produce trozos que el buscador
 * no sabe a qué pasaje pertenecen. El ThML, en cambio, trae 32.281 elementos
 * `<scripCom>` —marcas de «acá empieza el comentario a este pasaje»— con un
 * `osisRef` legible por máquina.
 *
 * La conversión aprovecha eso: cada bloque de comentario sale con su
 * encabezado de pasaje, así el índice queda anclado sin adivinar. Para un
 * paper sobre Jonás 2, el recuperador puede traer exactamente el comentario a
 * esos versículos en vez de un trozo cualquiera del libro.
 *
 * Correr:
 *   node scripts/convertir-thml.mjs <archivo.xml> <salida.md> [--libro JON]
 *
 * `--libro` recorta a un solo libro del canon; sin él convierte la obra
 * entera. Sirve para inspeccionar el resultado antes de ingerir 22 MB.
 */
import fs from 'fs';

const [entrada, salida] = process.argv.slice(2);
const filtroLibro = process.argv.includes('--libro')
    ? process.argv[process.argv.indexOf('--libro') + 1]
    : null;

if (!entrada || !salida) {
    console.error('Uso: node scripts/convertir-thml.mjs <archivo.xml> <salida.md> [--libro JON]');
    process.exit(1);
}

/**
 * Mapa OSIS → id del canon. Se duplica acá a propósito: este script corre con
 * node suelto, sin el build del monorepo, y hacerlo importar `@dosfilos/domain`
 * obligaría a compilar el paquete para una tarea de ingesta que se ejecuta a
 * mano. La fuente de verdad es `packages/domain/src/bible/osis/osisBookCodes.ts`
 * y su test verifica que cubra los 66 en orden canónico.
 */
const OSIS = JSON.parse(
    fs.readFileSync(new URL('./data/osis-book-codes.json', import.meta.url), 'utf8'),
);

/** Quita etiquetas, resuelve entidades y normaliza el espacio en blanco. */
function aTextoPlano(html) {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** `"Bible:Jonah.1.17"` → `{ bookId, chapter, verse }`, o `null` fuera del canon. */
function leerOsisRef(raw) {
    const primero = raw.replace(/^Bible:/, '').split('-')[0] ?? '';
    const partes = primero.split('.');
    const bookId = OSIS[partes[0]];
    if (!bookId) return null;
    return {
        bookId,
        chapter: partes[1] ? Number(partes[1]) : null,
        verse: partes[2] ? Number(partes[2]) : null,
    };
}

const xml = fs.readFileSync(entrada, 'utf8');

// Cada `<scripCom>` abre un bloque; el bloque llega hasta el siguiente.
const marcas = [...xml.matchAll(/<scripCom\b[^>]*\bosisRef="([^"]+)"[^>]*\/>/g)];
console.log(`bloques de comentario encontrados: ${marcas.length}`);

const secciones = [];
const librosVistos = new Set();
let fueraDelCanon = 0;

for (let i = 0; i < marcas.length; i++) {
    const ref = leerOsisRef(marcas[i][1]);
    if (!ref) { fueraDelCanon++; continue; }
    if (filtroLibro && ref.bookId !== filtroLibro) continue;

    const desde = marcas[i].index + marcas[i][0].length;
    const hasta = i + 1 < marcas.length ? marcas[i + 1].index : xml.length;
    const cuerpo = aTextoPlano(xml.slice(desde, hasta));
    // Un `scripCom` de capítulo suele venir seguido sólo del encabezado
    // «CHAPTER 1»: sin cuerpo real no aporta nada al índice.
    if (cuerpo.length < 40) continue;

    librosVistos.add(ref.bookId);
    const ancla = ref.verse
        ? `${ref.bookId} ${ref.chapter}:${ref.verse}`
        : `${ref.bookId} ${ref.chapter ?? ''}`.trim();
    secciones.push(`## ${ancla}\n\n${cuerpo}`);
}

const md = secciones.join('\n\n');
fs.writeFileSync(salida, md);

console.log(`secciones escritas: ${secciones.length}`);
console.log(`libros cubiertos:   ${librosVistos.size}`);
console.log(`fuera del canon:    ${fueraDelCanon} (deuterocanónicos, se descartan)`);
console.log(`tamaño:             ${(md.length / 1048576).toFixed(1)} MB → ${salida}`);
console.log(`\nlibros: ${[...librosVistos].join(', ')}`);
