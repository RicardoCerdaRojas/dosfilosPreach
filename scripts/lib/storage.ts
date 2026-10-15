/** Utilidades de Storage compartidas por los scripts de la biblioteca. */

/** `gs://bucket/ruta` o la URL de descarga de Firebase → ruta dentro del bucket. */
export function ubicacionEnStorage(url: string | undefined): { bucket: string; ruta: string } | null {
    if (!url) return null;
    if (url.startsWith('gs://')) {
        const [bucket, ...ruta] = url.slice(5).split('/');
        return { bucket: bucket!, ruta: ruta.join('/') };
    }
    const m = url.match(/\/b\/([^/]+)\/o\/([^?]+)/);
    return m ? { bucket: m[1]!, ruta: decodeURIComponent(m[2]!) } : null;
}
