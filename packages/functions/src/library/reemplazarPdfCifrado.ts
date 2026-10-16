import * as fs from 'fs';
import type { File } from '@google-cloud/storage';
import { descifrarPdf, TOPE_PARA_DESCIFRAR_EN_LA_NUBE, type ResultadoDeDescifrado } from './descifrarPdf';

/**
 * Un PDF con cifrado de permisos se descifra UNA vez, al entrar, y la copia
 * descifrada reemplaza al archivo en Storage. Así todos los caminos que lo
 * leen después —la visión, la cola por rangos, LlamaParse, el visor, el
 * reproceso en lote— ven un PDF común, sin que cada uno tenga que saberlo.
 *
 * Todo lo que no sea «pide contraseña» falla en blando: si qpdf no lo abre,
 * si el PDF pasa del tope de memoria o si Storage no deja escribir, la
 * extracción sigue con lo que tiene, como antes de esto.
 */

/**
 * Metadato que lleva la copia descifrada al escribirse. Reescribir el
 * archivo vuelve a disparar `extractPdfWithGemini`; el evento trae esta
 * marca y el disparador sabe que la escritura fue nuestra. Se quita apenas
 * se escribe, para que no viaje con copias futuras del archivo (el clon de
 * una cuenta embajador copia los metadatos).
 */
export const MARCA_DE_DESCIFRADO = 'pdfDescifrado';

export const MENSAJE_PIDE_CONTRASENA =
    'El PDF pide una contraseña para abrirse y no se puede leer. Sube una copia sin contraseña.';

export class PdfConContrasenaError extends Error {
    constructor() {
        super(MENSAJE_PIDE_CONTRASENA);
        this.name = 'PdfConContrasenaError';
    }
}

/**
 * Dónde queda el original cifrado: dentro de la carpeta del usuario (el
 * borrado de la cuenta la limpia entera) pero FUERA de `library/`, que es lo
 * que mira el disparador de subida. Las reglas de Storage no cubren la ruta:
 * el cliente no la lee.
 */
export function rutaDeRespaldo(rutaDelPdf: string): string {
    const m = /^users\/([^/]+)\/library\/(.+)$/.exec(rutaDelPdf);
    return m ? `users/${m[1]}/respaldos/pdf-cifrados/${m[2]}` : `respaldos/pdf-cifrados/${rutaDelPdf}`;
}

/** ¿Esta escritura del archivo la hicimos nosotros al descifrarlo? */
export function esCopiaDescifrada(metadatos: Record<string, unknown> | undefined | null): boolean {
    return metadatos?.[MARCA_DE_DESCIFRADO] === 'si';
}

const esPrecondicion = (err: unknown) => (err as { code?: number })?.code === 412;

/**
 * Reemplaza en Storage el PDF cifrado por su copia descifrada, dejando el
 * original como respaldo. Conserva los metadatos del archivo, entre ellos el
 * token de descarga que usa el visor.
 *
 * Dos ejecuciones a la vez (un evento repetido, «Reintentar» durante la
 * subida) no se pisan: el respaldo sólo se crea si no existe —el segundo
 * nunca guarda como «original» la copia ya descifrada— y la escritura exige
 * la generación que se leyó.
 */
async function reemplazarEnStorage(archivo: File, descifrado: Buffer): Promise<void> {
    const [meta] = await archivo.getMetadata();
    const respaldo = archivo.bucket.file(rutaDeRespaldo(archivo.name));
    try {
        await archivo.copy(respaldo, { preconditionOpts: { ifGenerationMatch: 0 } });
        // El respaldo no se descarga con el token del visor.
        await respaldo.setMetadata({ metadata: { firebaseStorageDownloadTokens: null } });
    } catch (err) {
        if (!esPrecondicion(err)) throw err; // ya había respaldo: es el original
    }
    try {
        await archivo.save(descifrado, {
            resumable: false,
            contentType: meta.contentType ?? 'application/pdf',
            metadata: { metadata: { ...(meta.metadata ?? {}), [MARCA_DE_DESCIFRADO]: 'si' } },
            preconditionOpts: meta.generation !== undefined ? { ifGenerationMatch: Number(meta.generation) } : undefined,
        });
    } catch (err) {
        if (esPrecondicion(err)) {
            console.log(`🔓 [PDF] ${archivo.name}: otro proceso lo reemplazó primero; se deja el suyo`);
            return;
        }
        throw err;
    }
    await archivo.setMetadata({ metadata: { [MARCA_DE_DESCIFRADO]: null } }).catch(err => {
        console.warn(`[PDF] ${archivo.name}: no se pudo quitar la marca de descifrado:`, err);
    });
    console.log(`🔓 [PDF] ${archivo.name}: estaba cifrado; se reemplazó por la copia descifrada (original en ${respaldo.name})`);
}

/**
 * Para los caminos que ya bajaron el PDF a un temporal: si está cifrado, lo
 * descifra, deja el temporal descifrado y reemplaza el de Storage. Lanza
 * `PdfConContrasenaError` sólo si el PDF pide contraseña para abrirse.
 */
export async function prepararPdfDescargado(archivo: File, rutaTemporal: string): Promise<ResultadoDeDescifrado['estado'] | 'muy-grande'> {
    if (fs.statSync(rutaTemporal).size > TOPE_PARA_DESCIFRAR_EN_LA_NUBE) {
        // qpdf necesitaría ~12× el tamaño en memoria: no entra en la función.
        return 'muy-grande';
    }
    const resultado = await descifrarPdf(fs.readFileSync(rutaTemporal));
    if (resultado.estado === 'pide-contrasena') throw new PdfConContrasenaError();
    if (resultado.estado !== 'descifrado') return resultado.estado;
    fs.writeFileSync(rutaTemporal, resultado.bytes);
    try {
        await reemplazarEnStorage(archivo, resultado.bytes);
    } catch (err) {
        // La extracción de ESTA corrida sigue con el temporal descifrado.
        console.warn(`[PDF] ${archivo.name}: no se pudo reemplazar en Storage; sigue con la copia local:`, err);
    }
    return resultado.estado;
}
