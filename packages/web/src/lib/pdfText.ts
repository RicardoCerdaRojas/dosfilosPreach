import { pdfjsLib } from './pdfWorker';

/** Los mismos recursos que el visor de páginas: sin ellos el griego sale en cajas. */
const PDFJS_ASSETS = {
    wasmUrl: '/pdfjs/wasm/',
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
} as const;

/**
 * El texto de un PDF, leído en el navegador. Para un sílabo basta: la
 * bibliografía va en la capa de texto, y así no hay que subirlo a la
 * biblioteca ni mandar el archivo al servidor. Un escaneo no tiene texto:
 * vuelve vacío y la pantalla pide una imagen.
 */
export async function pdfToText(file: File, maxPages = 40): Promise<{ text: string; pages: number; truncated: boolean }> {
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), ...PDFJS_ASSETS }).promise;
    try {
        const paginas: string[] = [];
        for (let n = 1; n <= Math.min(doc.numPages, maxPages); n++) {
            const contenido = await (await doc.getPage(n)).getTextContent();
            let linea = '';
            const lineas: string[] = [];
            for (const item of contenido.items) {
                if (!('str' in item)) continue;
                linea += item.str;
                if (item.hasEOL) { lineas.push(linea); linea = ''; } else linea += ' ';
            }
            if (linea.trim()) lineas.push(linea);
            paginas.push(lineas.join('\n'));
        }
        return { text: paginas.join('\n\n').replace(/[ \t]+/g, ' ').trim(), pages: doc.numPages, truncated: doc.numPages > maxPages };
    } finally {
        await doc.destroy();
    }
}

/** Un archivo de imagen como base64, sin el prefijo `data:…;base64,`. */
export function imageToBase64(file: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = () => resolve(String(lector.result).replace(/^data:[^;]+;base64,/, ''));
        lector.onerror = () => reject(lector.error);
        lector.readAsDataURL(file);
    });
}
