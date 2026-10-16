/**
 * Quitar el cifrado de permisos de un PDF, con qpdf compilado a WASM.
 *
 * Muchos libros vienen cifrados SIN contraseña de apertura: cualquier lector
 * los abre, pero llevan restricciones de copia o impresión. pdf-lib no los
 * descifra, y abrirlos con `ignoreEncryption` da recortes en blanco que el
 * modelo lee como páginas vacías y se cobran (el léxico de Ortiz, dos veces:
 * ver `geminiExtraction.ts` y el lote `biblioteca4`). Hasta acá se rechazaban.
 *
 * qpdf es la herramienta de referencia para esto: cubre RC4 y AES de 128 y
 * 256 bits. En WASM corre igual en Cloud Functions que en un script, sin
 * binarios nativos. Sólo descifra lo que se abre sin contraseña.
 *
 * MEMORIA (medido, 2026-10-16): el pico es ~12 veces el tamaño del archivo
 * —entrada y salida viven en el sistema de archivos en memoria del módulo—:
 * 50 MB → 0,69 GB; 100 MB → 1,32 GB; 200 MB → 2,43 GB. Quien lo llama dentro
 * de una función de 2 GiB tiene que poner un tope (`TOPE_PARA_DESCIFRAR_EN_LA_NUBE`).
 *
 * Licencias: qpdf es Apache-2.0 y el empaque WASM, ISC.
 */

/** Lo mínimo del módulo de Emscripten que se usa. */
interface Qpdf {
    callMain(args: string[]): number;
    FS: { writeFile(ruta: string, datos: Uint8Array): void; readFile(ruta: string): Uint8Array };
}
type CrearQpdf = (opciones: Record<string, unknown>) => Promise<Qpdf>;

export type ResultadoDeDescifrado =
    | { estado: 'sin-cifrar' }
    | { estado: 'descifrado'; bytes: Buffer }
    | { estado: 'pide-contrasena' }
    /** qpdf no lo abre (dañado, cifrado raro): se sigue con el original, como antes. */
    | { estado: 'no-se-pudo-abrir' };

/** Hasta este tamaño se descifra dentro de una función de 2 GiB (pico ~12×: ~0,8 GB). */
export const TOPE_PARA_DESCIFRAR_EN_LA_NUBE = 60 * 1024 * 1024;

/** Códigos de salida de qpdf: 0 bien, 3 bien con advertencias, 2 error. */
const QPDF_BIEN = new Set([0, 3]);

/**
 * Un PDF cifrado declara `/Encrypt` en su tráiler (o en el diccionario del
 * flujo de referencias cruzadas), que no va comprimido. Sin esa marca no
 * está cifrado y no hace falta cargar qpdf.
 */
export function puedeEstarCifrado(pdf: Uint8Array): boolean {
    return Buffer.from(pdf.buffer, pdf.byteOffset, pdf.byteLength).includes('/Encrypt');
}

/**
 * Un módulo nuevo por PDF: el sistema de archivos de Emscripten vive en la
 * memoria del módulo, y así se libera con él en vez de acumularse entre
 * libros en la misma instancia.
 */
async function crearQpdf(): Promise<Qpdf> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crear = require('@neslinesli93/qpdf-wasm') as CrearQpdf;
    const wasm = require.resolve('@neslinesli93/qpdf-wasm/dist/qpdf.wasm');
    return crear({ locateFile: () => wasm, noInitialRun: true });
}

/**
 * Cada `callMain` de este empaque deja su código en `process.exitCode`
 * (medido): un script que descifra un PDF que pide contraseña terminaría
 * «fallido». Se restaura el que había.
 */
function correr(qpdf: Qpdf, args: string[]): number {
    const antes = process.exitCode;
    try {
        return qpdf.callMain(args);
    } finally {
        process.exitCode = antes;
    }
}

/**
 * ¿Pide contraseña para abrirse? Lo dice pdf.js, que es el que lee los PDF
 * en el resto de la extracción. qpdf no sirve para esto: en este empaque un
 * PDF que no puede abrir —dañado o con contraseña— da el mismo código.
 */
async function pideContrasena(pdf: Uint8Array): Promise<boolean> {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const tarea = pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: false });
    try {
        await tarea.promise;
        return false;
    } catch (err) {
        return (err as { name?: string })?.name === 'PasswordException';
    } finally {
        await tarea.destroy().catch(() => undefined);
    }
}

/**
 * El PDF sin cifrado, si lo tenía y se abre sin contraseña. No lanza: lo que
 * qpdf no puede abrir vuelve como `no-se-pudo-abrir` y el que llama sigue
 * con el original.
 */
export async function descifrarPdf(pdf: Uint8Array): Promise<ResultadoDeDescifrado> {
    if (!puedeEstarCifrado(pdf)) return { estado: 'sin-cifrar' };
    try {
        const qpdf = await crearQpdf();
        qpdf.FS.writeFile('/entrada.pdf', pdf);
        // `--requires-password`: 3 cifrado sin contraseña de apertura (el caso
        // que se descifra), 0 pide contraseña, 2 «no cifrado» o no lo pudo
        // abrir. Para el 2, `--show-encryption` abre (0) uno sin cifrar
        // —la marca `/Encrypt` venía dentro de un texto— y pdf.js decide
        // entre «pide contraseña» y «dañado».
        const requiere = correr(qpdf, ['--requires-password', '/entrada.pdf']);
        if (requiere === 0) return { estado: 'pide-contrasena' };
        if (requiere !== 3) {
            if (correr(qpdf, ['--show-encryption', '/entrada.pdf']) === 0) return { estado: 'sin-cifrar' };
            return (await pideContrasena(pdf)) ? { estado: 'pide-contrasena' } : { estado: 'no-se-pudo-abrir' };
        }
        if (!QPDF_BIEN.has(correr(qpdf, ['--decrypt', '/entrada.pdf', '/salida.pdf']))) return { estado: 'no-se-pudo-abrir' };
        const salida = qpdf.FS.readFile('/salida.pdf');
        return { estado: 'descifrado', bytes: Buffer.from(salida.buffer, salida.byteOffset, salida.byteLength) };
    } catch (err) {
        console.warn(`[descifrarPdf] qpdf falló; se sigue con el original: ${err instanceof Error ? err.message.slice(0, 200) : err}`);
        return { estado: 'no-se-pudo-abrir' };
    }
}
